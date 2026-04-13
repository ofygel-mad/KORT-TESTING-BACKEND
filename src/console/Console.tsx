import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  autocompleteConsoleCommand,
  executeConsoleCommand,
  sanitizeCommandForLog,
} from './commands';
import { emitConsoleEvent } from './events';
import { useConsoleStore } from './store';
import styles from './Console.module.css';
import type { ConsoleLogEntry } from './types';

function isConsoleToggleKey(event: KeyboardEvent) {
  return event.code === 'Backquote' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey;
}

function entryLevelClass(entry: ConsoleLogEntry) {
  if (entry.level === 'success') return styles.entrySuccess;
  if (entry.level === 'warn') return styles.entryWarn;
  if (entry.level === 'error') return styles.entryError;
  return styles.entryInfo;
}

export function ConsoleView() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const logViewportRef = useRef<HTMLDivElement | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [historyCursor, setHistoryCursor] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const {
    isOpen,
    entries,
    commandHistory,
    open,
    close,
    clearEntries,
    addEntry,
    pushCommand,
  } = useConsoleStore();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isConsoleToggleKey(event)) {
        if (!isOpen) return;

        if (event.key === 'Escape') {
          event.preventDefault();
          close();
          return;
        }

        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'l') {
          event.preventDefault();
          clearEntries();
          addEntry({ source: 'console', level: 'success', message: 'Console cleared.' });
        }
        return;
      }

      event.preventDefault();
      if (isOpen) {
        close();
      } else {
        open();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [addEntry, clearEntries, close, isOpen, open]);

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const viewport = logViewportRef.current;
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  }, [entries, isOpen]);

  const visibleEntries = useMemo(() => entries, [entries]);

  async function runCommand(rawValue: string) {
    const nextInput = rawValue.trim();
    if (!nextInput || isExecuting) return;

    setIsExecuting(true);
    setHistoryCursor(null);
    const sanitizedCommand = sanitizeCommandForLog(nextInput);
    if (sanitizedCommand === nextInput) {
      pushCommand(nextInput);
    }

    emitConsoleEvent({
      source: 'console',
      level: 'info',
      message: sanitizedCommand,
      command: sanitizedCommand,
    });

    try {
      const result = await executeConsoleCommand(nextInput);

      if (result.clearBeforeLog) {
        clearEntries();
      }

      addEntry({
        source: 'console',
        level: result.level,
        message: result.message,
        details: result.details,
      });

      if (result.closeConsole) {
        close();
      }
    } catch (error) {
      addEntry({
        source: 'console',
        level: 'error',
        message: 'Command failed.',
        details: error instanceof Error ? error.message : 'Unknown error.',
      });
    } finally {
      setInputValue('');
      setIsExecuting(false);
    }
  }

  function stepHistory(direction: 'up' | 'down') {
    if (commandHistory.length === 0) return;

    if (direction === 'up') {
      const nextCursor = historyCursor === null
        ? commandHistory.length - 1
        : Math.max(0, historyCursor - 1);
      setHistoryCursor(nextCursor);
      setInputValue(commandHistory[nextCursor] ?? '');
      return;
    }

    if (historyCursor === null) return;

    const nextCursor = historyCursor + 1;
    if (nextCursor >= commandHistory.length) {
      setHistoryCursor(null);
      setInputValue('');
      return;
    }

    setHistoryCursor(nextCursor);
    setInputValue(commandHistory[nextCursor] ?? '');
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={styles.root}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
        >
          <motion.section
            className={styles.window}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.1 }}
            role="dialog"
            aria-label="Console"
          >
            <header className={styles.titleBar}>
              <div className={styles.titleLeft}>
                <span className={styles.title}>Console</span>
              </div>
              <div className={styles.titleRight}>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => close()}
                  aria-label="Close"
                />
              </div>
            </header>

            <div className={styles.logArea} ref={logViewportRef}>
              {visibleEntries.length === 0 ? (
                <div className={styles.empty}>
                  Type <span className={styles.hint}>help</span> for commands.
                </div>
              ) : (
                visibleEntries.map((entry) => (
                  <div key={entry.id} className={`${styles.entry} ${entryLevelClass(entry)}`}>
                    <span className={styles.msg}>
                      {[entry.message, entry.details].filter(Boolean).join('\n')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className={styles.inputBar}>
              <input
                ref={inputRef}
                className={styles.input}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    void runCommand(inputValue);
                    return;
                  }
                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    stepHistory('up');
                    return;
                  }
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    stepHistory('down');
                    return;
                  }
                  if (event.key === 'Tab') {
                    event.preventDefault();
                    setInputValue(autocompleteConsoleCommand(inputValue));
                  }
                }}
                placeholder=""
                disabled={isExecuting}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
              <button
                type="button"
                className={styles.submitBtn}
                onClick={() => void runCommand(inputValue)}
                disabled={isExecuting}
              >
                Submit
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
