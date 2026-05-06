import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import s from './EditorialCursor.module.css';

const CLICKABLE = 'a, button, [role="button"], input, textarea, select, summary, label, [data-cursor-label]';

export function EditorialCursor() {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const rafRef   = useRef(0);
  const hoveredClickableRef = useRef<Element | null>(null);
  const target   = useRef({ x: -200, y: -200 });
  const current  = useRef({ x: -200, y: -200 });
  const loopRunning = useRef(false);
  const [active,  setActive]  = useState(false);
  const [compact, setCompact] = useState(false);
  const [label,   setLabel]   = useState('');

  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return;
    document.body.dataset.cursor = 'enhanced';

    const updateHoverState = (el: Element | null) => {
      setActive(Boolean(el));
      setCompact(Boolean(el?.closest('input, textarea, select')));
      setLabel(el?.getAttribute('data-cursor-label') ?? '');
    };

    const startLoop = () => {
      if (!loopRunning.current) {
        loopRunning.current = true;
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const onMove = (e: MouseEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
      startLoop();
    };

    const onHover = (e: MouseEvent) => {
      const el = e.target instanceof Element ? e.target.closest(CLICKABLE) : null;
      if (hoveredClickableRef.current !== el) {
        hoveredClickableRef.current = el;
        updateHoverState(el);
      }
    };

    const onLeave = () => {
      hoveredClickableRef.current = null;
      target.current = { x: -200, y: -200 };
      updateHoverState(null);
      startLoop();
    };

    const loop = () => {
      const dx = target.current.x - current.current.x;
      const dy = target.current.y - current.current.y;
      current.current.x += dx * 0.16;
      current.current.y += dy * 0.16;
      if (outerRef.current) {
        outerRef.current.style.transform = `translate3d(${current.current.x}px,${current.current.y}px,0)`;
      }
      if (innerRef.current) {
        innerRef.current.style.transform = `translate3d(${target.current.x}px,${target.current.y}px,0)`;
      }
      // Stop looping when cursor has converged (< 0.5px difference)
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        loopRunning.current = false;
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseover', onHover, { passive: true });
    document.addEventListener('mouseleave', onLeave, { passive: true });

    return () => {
      delete document.body.dataset.cursor;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseover', onHover);
      document.removeEventListener('mouseleave', onLeave);
      loopRunning.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const content = (
    <>
      <div
        ref={outerRef}
        className={`${s.outer} ${active ? s.outerActive : ''} ${compact ? s.outerCompact : ''}`}
        aria-hidden="true"
      >
        {label && <span className={s.label}>{label}</span>}
      </div>
      <div
        ref={innerRef}
        className={`${s.inner} ${active ? s.innerActive : ''}`}
        aria-hidden="true"
      />
    </>
  );

  // Portal к document.body — вырывается из isolation/transform/filter stacking context
  return createPortal(content, document.body);
}
