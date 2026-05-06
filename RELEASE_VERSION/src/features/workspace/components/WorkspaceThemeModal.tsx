import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { X, Check, Grid3X3 } from 'lucide-react';
import { useWorkspaceTheme, WORKSPACE_BG_OPTIONS, type WorkspaceBg } from '../model/workspaceTheme';
import styles from './WorkspaceTheme.module.css';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function WorkspaceThemeModal({ open, onClose }: Props) {
  const { activeBg, setActiveBg } = useWorkspaceTheme();

  const content = (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={styles.backdrop}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <div className={styles.shell}>
            <motion.div
              className={styles.panel}
              initial={{ opacity: 0, scale: 0.93, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.93, y: 8 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.75 }}
              role="dialog"
              aria-modal="true"
              aria-label="Тема рабочего окружения"
            >
              <div className={styles.header}>
                <div className={styles.headerLeft}>
                  <span className={styles.eyebrow}>Рабочее окружение</span>
                  <h2 className={styles.title}>Тема рабочего пространства</h2>
                </div>
                <button className={styles.closeBtn} onClick={onClose} aria-label="Закрыть">
                  <X size={15} />
                </button>
              </div>

              <p className={styles.hint}>
                Выберите фон для рабочего пространства. Плитки и интерактивность сохраняются поверх любого фона.
              </p>

              <div className={styles.grid}>
                {WORKSPACE_BG_OPTIONS.map((bg) => {
                  const isActive = activeBg === bg.id;
                  return (
                    <button
                      key={bg.id}
                      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
                      onClick={() => { setActiveBg(bg.id); }}
                    >
                      {/* Preview thumbnail */}
                      <div className={styles.preview}>
                        {bg.id === 'grid' ? (
                          <div className={styles.previewGrid}>
                            <Grid3X3 size={22} strokeWidth={1.2} />
                          </div>
                        ) : (
                          <div
                            className={styles.previewEffect}
                            style={{ background: bg.previewColor }}
                          />
                        )}

                        {isActive && (
                          <div className={styles.previewCheck}>
                            <Check size={13} strokeWidth={2.5} />
                          </div>
                        )}
                      </div>

                      {/* Label */}
                      <div className={styles.cardBody}>
                        <span className={styles.cardLabel}>{bg.label}</span>
                        <span className={styles.cardDesc}>{bg.description}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
