import { useState, useRef, useCallback } from 'react';
import { Compass } from 'lucide-react';
import { useWorkspaceStore, WORLD_FACTOR } from '../model/store';
import styles from './Workspace.module.css';

const MINIMAP_W = 180;
const MINIMAP_H = 110;

export function WorkspaceMinimap() {
  const [visible, setVisible] = useState(false);
  const tiles       = useWorkspaceStore((s) => s.tiles);
  const viewport    = useWorkspaceStore((s) => s.viewport);
  const viewportSize = useWorkspaceStore((s) => s.viewportSize);
  const setViewport = useWorkspaceStore((s) => s.setViewport);
  const mapRef      = useRef<HTMLDivElement>(null);

  const worldW = viewportSize.width  * WORLD_FACTOR || 1;
  const worldH = viewportSize.height * WORLD_FACTOR || 1;
  const scaleX = MINIMAP_W / worldW;
  const scaleY = MINIMAP_H / worldH;

  // Viewport indicator size & position on minimap
  const vpW  = (viewportSize.width  / worldW) * MINIMAP_W;
  const vpH  = (viewportSize.height / worldH) * MINIMAP_H;
  const vpX  = (-viewport.x / worldW) * MINIMAP_W;
  const vpY  = (-viewport.y / worldH) * MINIMAP_H;

  const handleMapClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / MINIMAP_W) * worldW;
    const my = ((e.clientY - rect.top)  / MINIMAP_H) * worldH;
    const newX = -(mx - viewportSize.width  / 2);
    const newY = -(my - viewportSize.height / 2);
    const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
    setViewport(
      clamp(newX, -(worldW - viewportSize.width),  0),
      clamp(newY, -(worldH - viewportSize.height), 0),
    );
  }, [worldW, worldH, viewportSize, setViewport]);

  return (
    <div className={styles.minimapContainer} data-workspace-ui="true">
      <button
        className={styles.minimapToggle}
        onClick={() => setVisible(v => !v)}
        title={visible ? 'Скрыть карту' : 'Показать карту'}
        aria-label="Мини-карта рабочего поля"
      >
        <Compass size={14} />
      </button>

      {visible && (
        <div
          ref={mapRef}
          className={styles.minimapBoard}
          style={{ width: MINIMAP_W, height: MINIMAP_H }}
          onClick={handleMapClick}
          title="Нажмите для навигации"
        >
          {/* Tiles as dots */}
          {tiles.map(tile => (
            <div
              key={tile.id}
              className={styles.minimapTile}
              style={{
                left:   tile.x * scaleX,
                top:    tile.y * scaleY,
                width:  Math.max(4, tile.width  * scaleX),
                height: Math.max(3, tile.height * scaleY),
              }}
            />
          ))}

          {/* Viewport indicator */}
          <div
            className={styles.minimapViewport}
            style={{ left: vpX, top: vpY, width: vpW, height: vpH }}
          />
        </div>
      )}
    </div>
  );
}
