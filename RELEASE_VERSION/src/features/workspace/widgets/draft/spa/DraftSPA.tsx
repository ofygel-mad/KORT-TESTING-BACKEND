import { useState } from 'react';
import { BarChart3, FileText, Plus, Table2, Trash2 } from 'lucide-react';
import s from './DraftSPA.module.css';

type BlockType = 'note' | 'table' | 'chart';

interface Block {
  id: string;
  type: BlockType;
  title: string;
  content: string;
}

const BLOCK_OPTIONS: Array<{ type: BlockType; icon: typeof FileText; label: string; desc: string }> = [
  { type: 'note', icon: FileText, label: 'Заметка', desc: 'Свободный текст, план или короткий чеклист.' },
  { type: 'table', icon: Table2, label: 'Таблица', desc: 'Рабочая структура для ручных данных и сводок.' },
  { type: 'chart', icon: BarChart3, label: 'Диаграмма', desc: 'Быстрый визуальный блок для метрики или динамики.' },
];

export function DraftSPA() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [picking, setPicking] = useState(false);

  function addBlock(type: BlockType) {
    setBlocks((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        type,
        title: BLOCK_OPTIONS.find((option) => option.type === type)?.label ?? 'Блок',
        content: '',
      },
    ]);
    setPicking(false);
  }

  function remove(id: string) {
    setBlocks((prev) => prev.filter((block) => block.id !== id));
  }

  function update(id: string, content: string) {
    setBlocks((prev) => prev.map((block) => (block.id === id ? { ...block, content } : block)));
  }

  return (
    <div className={s.root}>
      <div className={s.toolbar}>
        <div className={s.toolbarCopy}>
          <span className={s.eyebrow}>Personal Builder</span>
          <span className={s.title}>Черновик</span>
          <span className={s.sub}>Личное пространство для свободных блоков, заметок и быстрых схем.</span>
        </div>
        <button className={s.addBtn} onClick={() => setPicking((value) => !value)}>
          <Plus size={14} />
          <span>{picking ? 'Скрыть блоки' : 'Добавить блок'}</span>
        </button>
      </div>

      {picking && (
        <div className={s.picker}>
          {BLOCK_OPTIONS.map((option) => (
            <button key={option.type} className={s.pickerCard} onClick={() => addBlock(option.type)}>
              <div className={s.pickerIconWrap}>
                <option.icon size={18} className={s.pickerIcon} />
              </div>
              <div className={s.pickerText}>
                <div className={s.pickerLabel}>{option.label}</div>
                <div className={s.pickerDesc}>{option.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className={s.canvas}>
        {blocks.length === 0 && !picking ? (
          <div className={s.empty}>
            <div className={s.emptyIconWrap}>
              <Plus size={28} className={s.emptyIcon} />
            </div>
            <div className={s.emptyTitle}>Соберите первый рабочий блок</div>
            <div className={s.emptyDesc}>
              Здесь можно держать личные заметки, таблицы и черновые визуализации без выхода из workspace.
            </div>
            <button className={s.emptyBtn} onClick={() => setPicking(true)}>Добавить блок</button>
          </div>
        ) : (
          blocks.map((block) => (
            <div key={block.id} className={s.block}>
              <div className={s.blockHeader}>
                <span className={s.blockTitle}>{block.title}</span>
                <button className={s.blockRemove} onClick={() => remove(block.id)} aria-label="Удалить блок">
                  <Trash2 size={13} />
                </button>
              </div>

              {block.type === 'note' && (
                <textarea
                  className={s.noteArea}
                  placeholder="Пишите что угодно: план, гипотезы, список решений."
                  value={block.content}
                  onChange={(event) => update(block.id, event.target.value)}
                />
              )}

              {block.type === 'table' && (
                <div className={s.tablePlaceholder}>
                  <Table2 size={20} />
                  <span>Табличный блок подключается следующим этапом.</span>
                </div>
              )}

              {block.type === 'chart' && (
                <div className={s.chartPlaceholder}>
                  <div className={s.chartBars}>
                    {[40, 70, 55, 90, 65, 80].map((height, index) => (
                      <div
                        key={index}
                        className={`${s.chartBar} ${index % 2 === 0 ? s.chartBarAccent : s.chartBarMuted}`}
                        style={{ height: `${height}%` }}
                      />
                    ))}
                  </div>
                  <span>Диаграмма появится после привязки источника данных.</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
