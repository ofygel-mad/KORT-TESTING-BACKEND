import type { WorkspaceSceneTheme } from '../model/types';

export function resolveThemeAtmosphere(themeId: WorkspaceSceneTheme) {
  const denseFogTheme = themeId === 'overcast';
  const mistyTheme = denseFogTheme || themeId === 'morning' || themeId === 'night';

  return {
    denseFogTheme,
    mistyTheme,
    overcastIntensity: denseFogTheme ? 1 : 0,
  };
}

export function computeLightningFlash(lightningProgress: number, denseFogTheme: boolean) {
  if (!denseFogTheme || lightningProgress <= 0) {
    return 0;
  }

  const lightningAge = 0.55 - lightningProgress;
  return Math.max(
    Math.exp(-lightningAge * 14) * 1.9,
    Math.exp(-Math.pow(lightningAge - 0.08, 2) / 0.0014) * 1.35,
    Math.exp(-Math.pow(lightningAge - 0.2, 2) / 0.0032) * 0.95,
  );
}
