import { useState, useRef, useEffect, useCallback, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { assistantReply, commandInvoke } from '../../shared/motion/presets';
import { Sparkles, X, Send, Loader2, User, Bot, Trash2, Command, Wand2, CornerDownLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../../shared/api/client';
import { useIsMobile } from '../../shared/hooks/useIsMobile';
import { useUIStore } from '../../shared/stores/ui';
import { runTimeout } from '../../shared/lib/browser';
import s from './AiAssistant.module.css';

/* ── Types ──────────────────────────────────────────────────── */
interface Message { role: 'user' | 'assistant'; content: string; }
interface Props { customerId?: string; dealId?: string; entityType?: 'customer' | 'deal'; entityId?: string; }

const SUGGESTIONS = [
  'Расскажи о последних взаимодействиях',
  'Что обсуждалось с клиентом?',
  'Какой следующий шаг рекомендуешь?',
  'Оцени вероятность закрытия сделки',
];

/* ── Panel dimensions ────────────────────────────────────────── */
// Width/height/position are runtime values that depend on viewport.
// They live in inline style (correct use per architecture doc).
const DESKTOP_PANEL: CSSProperties = {
  position: 'fixed', right: 24, bottom: 24,
  width: 380, height: 560, zIndex: 200,
  display: 'flex', flexDirection: 'column',
  background: 'var(--bg-surface-elevated)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-xl)',
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  overflow: 'hidden',
};

const MOBILE_PANEL: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  display: 'flex', flexDirection: 'column',
  background: 'var(--bg-surface-elevated)',
};

/* ── Component ───────────────────────────────────────────────── */
export function AiAssistant({ customerId, dealId, entityType, entityId }: Props) {
  const resolvedCustomerId = customerId ?? (entityType === 'customer' ? entityId : undefined);
  const resolvedDealId = dealId ?? (entityType === 'deal' ? entityId : undefined);

  const [open, setOpen]       = useState(false);
  const [input, setInput]     = useState('');
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const isMobile = useIsMobile();
  const assistantPromptRequest = useUIStore(s => s.assistantPromptRequest);
  const openCommandPalette = useUIStore(s => s.openCommandPalette);
  const bottomRef             = useRef<HTMLDivElement>(null);
  const inputRef              = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history, loading]);

  useEffect(() => {
    if (!assistantPromptRequest.nonce) return;
    setOpen(true);
    setInput(assistantPromptRequest.payload ?? 'Какой следующий шаг?');
  }, [assistantPromptRequest]);

  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput('');
    setLoading(true);
    setHistory(h => [...h, { role: 'user', content: msg }]);
    try {
      const res = await api.post('/ai/chat/', {
        message: msg, customer_id: resolvedCustomerId, deal_id: resolvedDealId, history: history.slice(-10),
      }) as any;
      setHistory(h => [...h, { role: 'assistant', content: res.reply }]);
      setConfirmation('Ответ готов · можно уточнить, выполнить действие или передать следующий ход в palette.');
    } catch {
      setHistory(h => [...h, { role: 'assistant', content: 'Не удалось получить ответ. Попробуйте уточнить запрос или повторить чуть позже.' }]);
      setConfirmation('Не получилось ответить с первого раза · уточните запрос или отправьте его через palette.');
    } finally {
      setLoading(false);
    }
  }, [input, history, loading, resolvedCustomerId, resolvedDealId]);

  useEffect(() => {
    if (!confirmation) return;
    const timeoutId = runTimeout(() => setConfirmation(''), 2800);
    return () => {
      if (typeof window !== 'undefined') {
        window.clearTimeout(timeoutId);
      }
    };
  }, [confirmation]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const contextLabel = resolvedCustomerId ? 'Контекст: клиент' : resolvedDealId ? 'Контекст: сделка' : 'Общий режим';
  const contextChips = resolvedCustomerId
    ? ['Последние касания', 'Риски оттока', 'Следующий шаг']
    : resolvedDealId
      ? ['Вероятность закрытия', 'Блокеры', 'Аргументы для next step']
      : ['Что просрочено', 'Где риск', 'Куда нажать дальше'];
  const promptChips = ['Сводка', 'Рекомендация', 'Следующее действие'];

  return (
    <>
      {/* Trigger */}
      <motion.button
        className={s.trigger}
        style={{ '--trigger-bottom': `${isMobile ? 90 : 24}px` } as CSSProperties}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Закрыть ИИ-ассистент' : 'Открыть ИИ-ассистент'}
      >
        {open ? <X size={20} /> : <Sparkles size={20} />}
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className={s.panel}
            style={isMobile ? MOBILE_PANEL : DESKTOP_PANEL}
            variants={commandInvoke}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            {/* Header */}
            <div className={s.panelHeader}>
              <div className={s.headerAvatar}><Sparkles size={16} /></div>
              <div className={s.headerInfo}>
                <div className={s.headerTitle}>ИИ-ассистент Kort</div>
                <div className={s.headerContext}>{contextLabel}</div>
              </div>
              {history.length > 0 && (
                <button className={s.headerAction} onClick={() => setHistory([])} aria-label="Очистить историю">
                  <Trash2 size={14} />
                </button>
              )}
              <button className={s.headerAction} onClick={() => setOpen(false)} aria-label="Закрыть">
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div className={s.messages}>
              {history.length === 0 && (
                <div className={s.suggestions}>
                  <div className={s.signatureIntro}>Kort Copilot · думай вопросом, действуй командой</div>
                  <div className={s.suggestionsHint}>Задайте вопрос или выберите сценарий:</div>
                  <div className={s.contextRail}>
                    {contextChips.map((chip) => (
                      <button key={chip} className={s.contextChip} onClick={() => send(chip)}><Wand2 size={12} /> {chip}</button>
                    ))}
                  </div>
                  <div className={s.suggestionGrid}>
                    {SUGGESTIONS.map(sug => (
                      <button key={sug} className={s.suggestionBtn} onClick={() => send(sug)}>{sug}</button>
                    ))}
                  </div>
                  <div className={s.promptRail}>
                    {promptChips.map((chip) => (
                      <button key={chip} className={s.promptChip} onClick={() => send(chip)}>{chip}</button>
                    ))}
                  </div>
                  <div className={s.commandHint}><Command size={12} /> Palette отвечает за переход и запуск, ассистент - за решение, риск и следующий шаг.</div>
                </div>
              )}

              {history.map((msg, i) => (
                <motion.div
                  key={i}
                  className={`${s.msgRow} ${msg.role === 'user' ? s.user : ''}`}
                  variants={assistantReply}
                  initial="hidden"
                  animate="visible"
                >
                  <div className={`${s.msgAvatar} ${msg.role === 'user' ? s.user : s.bot}`}>
                    {msg.role === 'user' ? <User size={13} /> : <Bot size={13} />}
                  </div>
                  <div className={`${s.bubble} ${msg.role === 'user' ? s.user : s.bot}`}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {loading && (
                <div className={s.typingRow}>
                  <div className={`${s.msgAvatar} ${s.bot}`}><Bot size={13} /></div>
                  <div className={s.typingDots}>
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        className={s.typingDot}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, delay: i * 0.15, repeat: Infinity }}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {confirmation && (
              <motion.div className={s.confirmationRail} variants={assistantReply} initial="hidden" animate="visible">
                <CheckCircle2 size={12} />
                <span>{confirmation}</span>
                <button className={s.confirmationAction} onClick={openCommandPalette}>Открыть palette</button>
              </motion.div>
            )}

            <div className={s.composerMeta}>
              <span className={s.composerHint}><CornerDownLeft size={12} /> Enter отправляет, Shift+Enter переносит строку</span>
              <span className={s.composerHint}><CheckCircle2 size={12} /> Kort отвечает в контексте текущего сценария</span>
            </div>

            <div className={s.inputArea}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Спросить про клиента, сделку или следующий шаг..."
                rows={1}
                className={s.inputTextarea}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className={`${s.sendBtn} ${input.trim() && !loading ? s.active : s.inactive}`}
                aria-label="Отправить"
              >
                {loading
                  ? <Loader2 size={16} className={s.sendLoader} />
                  : <Send size={16} />
                }
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
