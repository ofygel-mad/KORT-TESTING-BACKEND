import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useDevicePerformance } from './useDevicePerformance';
import type { DevicePerformanceProfile } from '../lib/browser';

/**
 * Regression guard for the workspace 3D-scene "cheap copy" bug.
 *
 * `useDevicePerformance` feeds `WorkspaceBgEffect`'s runtime-creation effect.
 * If the hook hands back a fresh-but-equal object after mount, that effect
 * disposes and rebuilds the WebGL runtime — but the resize/setState effects
 * are keyed on scene state, not on the runtime, so the replacement runtime is
 * left rendering into an un-sized 300x150 buffer with the wrong camera aspect
 * (blurry, stretched) until an unrelated scene change happens to re-run them.
 * The reference returned by this hook must therefore stay stable.
 */
describe('useDevicePerformance', () => {
  let originalMatchMedia: typeof window.matchMedia | undefined;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    // jsdom ships no matchMedia; the hook's effect early-returns without one,
    // so a stub is required to exercise the post-mount code path at all.
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    if (originalMatchMedia) {
      window.matchMedia = originalMatchMedia;
    } else {
      delete (window as { matchMedia?: typeof window.matchMedia }).matchMedia;
    }
  });

  it('returns the same object reference across the mount effect', () => {
    const seen: DevicePerformanceProfile[] = [];

    function Probe() {
      seen.push(useDevicePerformance());
      return null;
    }

    render(<Probe />);

    // render() flushes mount effects inside act(). Every render the probe
    // performed must have observed one and the same object — a post-mount
    // reference swap is exactly the bug this guards against.
    expect(seen.length).toBeGreaterThan(0);
    for (const profile of seen) {
      expect(profile).toBe(seen[0]);
    }
  });
});
