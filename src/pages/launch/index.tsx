import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './LaunchScreen.module.css';

/*
  Киноинтро — строго без авторизации:

  0.00s  → чёрный экран + noise
  0.70s  → "KORT" появляется (fade + slight scale)
  2.20s  → "KORT" уходит (fade out)
  2.70s  → "Enterprise Resource Planning" появляется (как titres)
  4.00s  → "Enterprise Resource Planning" уходит
  4.50s  → шторка начинает подниматься
  5.80s  → шторка ушла, navigate('/') — workspace
*/

type Phase =
  | 'blank'
  | 'title'
  | 'titleOut'
  | 'subtitle'
  | 'subtitleOut'
  | 'lift'
  | 'done';

export function LaunchScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>('blank');
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const t: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) => { t.push(setTimeout(fn, ms)); };

    at(700,  () => setPhase('title'));
    at(2200, () => setPhase('titleOut'));
    at(2700, () => setPhase('subtitle'));
    at(4000, () => setPhase('subtitleOut'));
    at(4500, () => setPhase('lift'));
    at(5900, () => {
      setPhase('done');
      navigate('/', { replace: true });
    });

    return () => t.forEach(clearTimeout);
  }, [navigate]);

  if (phase === 'done') return null;

  const titleVisible    = phase === 'title';
  const subtitleVisible = phase === 'subtitle';
  const lifting         = phase === 'lift';

  return (
    <div className={s.root}>
      {/* Noise / wavy lines */}
      <div className={s.noise} aria-hidden />
      <div className={s.vignette} aria-hidden />

      {/* KORT — крупный серифный заголовок */}
      <div className={`${s.titleWrap} ${titleVisible ? s.visible : s.hidden}`} aria-hidden>
        <span className={s.titleKort}>KORT</span>
      </div>

      {/* Subtitle — как titres */}
      <div className={`${s.subtitleWrap} ${subtitleVisible ? s.visible : s.hidden}`} aria-hidden>
        <span className={s.subtitleText}>Enterprise Resource Planning</span>
      </div>

      {/* Шторка */}
      <div className={`${s.curtain} ${lifting ? s.curtainUp : ''}`} aria-hidden>
        <svg
          className={s.curtainEdge}
          viewBox="0 0 1440 90"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M0,44 C60,64 120,20 180,42 C240,64 300,18 360,40 C420,62 480,16 540,38
               C600,60 660,20 720,44 C780,68 840,16 900,38 C960,60 1020,22 1080,46
               C1140,70 1200,18 1260,40 C1320,62 1380,26 1440,48 L1440,90 L0,90 Z"
            fill="#0f0d0a"
          />
        </svg>
      </div>
    </div>
  );
}
