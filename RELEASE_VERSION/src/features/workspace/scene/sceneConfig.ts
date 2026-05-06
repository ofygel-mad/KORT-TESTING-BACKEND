import type {
  WorkspaceSceneTheme,
  WorkspaceTileDistance,
  WorkspaceWidgetKind,
} from '../model/types';

export interface WorkspaceSceneThemeDefinition {
  id: WorkspaceSceneTheme;
  label: string;
  skyTop: string;
  skyBottom: string;
  horizon: string;
  fog: string;
  fogDensity: number;
  exposure: number;
  ambientLight: string;
  mainLight: string;
  accentLight: string;
  terrainFill: string;
  terrainEmissive: string;
  emissiveIntensity: number;
  terrainWire: string;
  terrainGlow: string;
  terrainPoints: string;
  terrainBeacon: string;
  atmosphere: string;
  particles: string;
  bloomStrength: number;
  wireOpacity: number;
  pointsOpacity: number;
  meshRoughness: number;
  meshMetalness: number;
  shellFrame: string;
  shellGlow: string;
  shellBack: string;
  shellChrome: string;
  hudBorder: string;
  hudFill: string;
  hudText: string;
}

export interface TileDistanceOption {
  id: WorkspaceTileDistance;
  label: string;
  hint: string;
}

export interface WidgetVisualAccent {
  accent: string;
  screen: string;
}

export interface WorkspaceWidgetShellProfile {
  depthFactor: number;
  screenInset: number;
  hoverLift: number;
  introLift: number;
}

export interface WorkspaceSceneVisualTuning {
  wireBlend: number;
  wireSurfaceOpacity: number;
  wireFlightOpacityNear: number;
  wireFlightOpacityFar: number;
  glowSurfaceOpacity: number;
  glowFlightOpacityNear: number;
  glowFlightOpacityFar: number;
  pointOpacity: number;
  beaconOpacity: number;
  emissiveCap: number;
  hazeOpacity: number;
  mistOpacity: number;
  terrainFogOpacity: number;
}

export interface WorkspaceSceneShellVisualTuning {
  surfaceScreenOpacity: number;
  flightScreenOpacity: number;
  hoverScreenBoost: number;
  surfaceAccentMix: number;
  flightAccentMix: number;
  surfaceGlowOpacity: number;
  flightGlowOpacity: number;
  hoverGlowBoost: number;
  distanceScaleNear: number;
  distanceScaleMid: number;
  distanceScaleFar: number;
}

export interface WorkspaceSceneFlightTileBandTuning {
  wallArc: number;
  wallHeight: number;
  sourceLift: number;
  scale: number;
  opacity: number;
  blur: number;
}

export interface WorkspaceSceneFlightTileTuning {
  far: WorkspaceSceneFlightTileBandTuning;
  mid: WorkspaceSceneFlightTileBandTuning;
  near: WorkspaceSceneFlightTileBandTuning;
  wallRadius: number;
  wallSwitchThreshold: number;
  wallSwitchBlendSpeed: number;
  edgeOpacityDecay: number;
  edgeBlurGain: number;
  pinnedScaleBoost: number;
}

export const WORKSPACE_SCENE_THEMES: Record<WorkspaceSceneTheme, WorkspaceSceneThemeDefinition> = {
  default: {
    id: 'default',
    label: 'Баланс',
    skyTop: '#03101F',
    skyBottom: '#2E3F5C',
    horizon: '#6f88ab',
    fog: '#07111f',
    fogDensity: 0.0024,
    exposure: 0.84,
    ambientLight: '#4e5f75',
    mainLight: '#b1c3d8',
    accentLight: '#334760',
    terrainFill: '#020a14',
    terrainEmissive: '#040a13',
    emissiveIntensity: 0.018,
    terrainWire: '#7aa4e0',
    terrainGlow: '#5e8fd6',
    terrainPoints: '#4e6f98',
    terrainBeacon: '#5e8fd6',
    atmosphere: '#314563',
    particles: '#445771',
    bloomStrength: 0.012,
    wireOpacity: 0.16,
    pointsOpacity: 0.004,
    meshRoughness: 0.995,
    meshMetalness: 0.005,
    shellFrame: '#1e2b40',
    shellGlow: '#9ed8ff',
    shellBack: '#111a28',
    shellChrome: '#d2deed',
    hudBorder: 'rgba(255,255,255,0.12)',
    hudFill: 'rgba(9,16,29,0.7)',
    hudText: '#eff5ff',
  },
  morning: {
    id: 'morning',
    label: 'Рассвет',
    skyTop: '#23324a',
    skyBottom: '#5b677d',
    horizon: '#e0b893',
    fog: '#434d60',
    fogDensity: 0.0032,
    exposure: 0.9,
    ambientLight: '#7a7f89',
    mainLight: '#f0c79f',
    accentLight: '#8b95a6',
    terrainFill: '#4b4d52',
    terrainEmissive: '#14171d',
    emissiveIntensity: 0.045,
    terrainWire: '#d2c3b5',
    terrainGlow: '#e0b893',
    terrainPoints: '#e8dccd',
    terrainBeacon: '#ffe3c7',
    atmosphere: '#e0b893',
    particles: '#b2b9c2',
    bloomStrength: 0.025,
    wireOpacity: 0.05,
    pointsOpacity: 0.02,
    meshRoughness: 0.95,
    meshMetalness: 0.02,
    shellFrame: '#46372d',
    shellGlow: '#ffe2c8',
    shellBack: '#251b17',
    shellChrome: '#fff0df',
    hudBorder: 'rgba(255,255,255,0.14)',
    hudFill: 'rgba(28,24,21,0.68)',
    hudText: '#fff4e8',
  },
  overcast: {
    id: 'overcast',
    label: 'Пасмурно',
    skyTop: '#08121d',
    skyBottom: '#40536a',
    horizon: '#8fa4bc',
    fog: '#2c3b4d',
    fogDensity: 0.0056,
    exposure: 0.76,
    ambientLight: '#6a788b',
    mainLight: '#a6b6c4',
    accentLight: '#415164',
    terrainFill: '#06101a',
    terrainEmissive: '#071018',
    emissiveIntensity: 0.012,
    terrainWire: '#7e99b7',
    terrainGlow: '#56739a',
    terrainPoints: '#5b7491',
    terrainBeacon: '#56739a',
    atmosphere: '#7f94ac',
    particles: '#6d8195',
    bloomStrength: 0.01,
    wireOpacity: 0.14,
    pointsOpacity: 0.0035,
    meshRoughness: 1,
    meshMetalness: 0,
    shellFrame: '#2b3441',
    shellGlow: '#dcedf6',
    shellBack: '#18202a',
    shellChrome: '#eef4f8',
    hudBorder: 'rgba(255,255,255,0.12)',
    hudFill: 'rgba(16,20,24,0.74)',
    hudText: '#f2f6f8',
  },
  dusk: {
    id: 'dusk',
    label: 'Закат',
    skyTop: '#2b2131',
    skyBottom: '#8a5d52',
    horizon: '#f1b47a',
    fog: '#5e3f43',
    fogDensity: 0.003,
    exposure: 0.94,
    ambientLight: '#7a6058',
    mainLight: '#e6ad7b',
    accentLight: '#a58b93',
    terrainFill: '#4c3f3b',
    terrainEmissive: '#171211',
    emissiveIntensity: 0.055,
    terrainWire: '#e4c3aa',
    terrainGlow: '#f1b47a',
    terrainPoints: '#f5dac1',
    terrainBeacon: '#ffd6aa',
    atmosphere: '#f1b47a',
    particles: '#c6a89d',
    bloomStrength: 0.03,
    wireOpacity: 0.055,
    pointsOpacity: 0.024,
    meshRoughness: 0.94,
    meshMetalness: 0.02,
    shellFrame: '#402622',
    shellGlow: '#ffd6b4',
    shellBack: '#241311',
    shellChrome: '#ffefde',
    hudBorder: 'rgba(255,255,255,0.12)',
    hudFill: 'rgba(27,15,18,0.72)',
    hudText: '#fff0e3',
  },
  night: {
    id: 'night',
    label: 'Ночь',
    skyTop: '#020712',
    skyBottom: '#12243b',
    horizon: '#587198',
    fog: '#040b15',
    fogDensity: 0.0021,
    exposure: 0.82,
    ambientLight: '#394c64',
    mainLight: '#8ca9ca',
    accentLight: '#23344a',
    terrainFill: '#010812',
    terrainEmissive: '#030912',
    emissiveIntensity: 0.015,
    terrainWire: '#7095cf',
    terrainGlow: '#4e71aa',
    terrainPoints: '#49678f',
    terrainBeacon: '#4e71aa',
    atmosphere: '#22334a',
    particles: '#536b89',
    bloomStrength: 0.014,
    wireOpacity: 0.17,
    pointsOpacity: 0.004,
    meshRoughness: 0.998,
    meshMetalness: 0.004,
    shellFrame: '#111c2d',
    shellGlow: '#8fd0ff',
    shellBack: '#09111b',
    shellChrome: '#d7eaff',
    hudBorder: 'rgba(255,255,255,0.12)',
    hudFill: 'rgba(5,10,20,0.76)',
    hudText: '#ecf6ff',
  },
};

export const WORKSPACE_SCENE_THEME_OPTIONS = (
  ['default', 'morning', 'overcast', 'dusk', 'night'] as WorkspaceSceneTheme[]
).map((id) => ({
  id,
  label: WORKSPACE_SCENE_THEMES[id].label,
}));

export const WORKSPACE_SCENE_VISUAL_TUNING: Record<WorkspaceSceneTheme, WorkspaceSceneVisualTuning> = {
  default: {
    wireBlend: 0.78,
    wireSurfaceOpacity: 0.14,
    wireFlightOpacityNear: 0.12,
    wireFlightOpacityFar: 0.16,
    glowSurfaceOpacity: 0.018,
    glowFlightOpacityNear: 0.016,
    glowFlightOpacityFar: 0.022,
    pointOpacity: 0.0015,
    beaconOpacity: 0,
    emissiveCap: 0.012,
    hazeOpacity: 0.046,
    mistOpacity: 0.022,
    terrainFogOpacity: 0.094,
  },
  morning: {
    wireBlend: 0.72,
    wireSurfaceOpacity: 0.125,
    wireFlightOpacityNear: 0.11,
    wireFlightOpacityFar: 0.145,
    glowSurfaceOpacity: 0.015,
    glowFlightOpacityNear: 0.013,
    glowFlightOpacityFar: 0.018,
    pointOpacity: 0.0018,
    beaconOpacity: 0,
    emissiveCap: 0.014,
    hazeOpacity: 0.082,
    mistOpacity: 0.054,
    terrainFogOpacity: 0.118,
  },
  overcast: {
    wireBlend: 0.68,
    wireSurfaceOpacity: 0.11,
    wireFlightOpacityNear: 0.095,
    wireFlightOpacityFar: 0.12,
    glowSurfaceOpacity: 0.012,
    glowFlightOpacityNear: 0.01,
    glowFlightOpacityFar: 0.014,
    pointOpacity: 0.001,
    beaconOpacity: 0,
    emissiveCap: 0.008,
    hazeOpacity: 0.21,
    mistOpacity: 0.22,
    terrainFogOpacity: 0.28,
  },
  dusk: {
    wireBlend: 0.72,
    wireSurfaceOpacity: 0.128,
    wireFlightOpacityNear: 0.112,
    wireFlightOpacityFar: 0.15,
    glowSurfaceOpacity: 0.016,
    glowFlightOpacityNear: 0.014,
    glowFlightOpacityFar: 0.02,
    pointOpacity: 0.0018,
    beaconOpacity: 0,
    emissiveCap: 0.014,
    hazeOpacity: 0.074,
    mistOpacity: 0.048,
    terrainFogOpacity: 0.122,
  },
  night: {
    wireBlend: 0.82,
    wireSurfaceOpacity: 0.15,
    wireFlightOpacityNear: 0.13,
    wireFlightOpacityFar: 0.17,
    glowSurfaceOpacity: 0.02,
    glowFlightOpacityNear: 0.018,
    glowFlightOpacityFar: 0.024,
    pointOpacity: 0.0015,
    beaconOpacity: 0,
    emissiveCap: 0.01,
    hazeOpacity: 0.058,
    mistOpacity: 0.032,
    terrainFogOpacity: 0.088,
  },
};

export const WORKSPACE_SCENE_SHELL_VISUAL_TUNING: Record<WorkspaceSceneTheme, WorkspaceSceneShellVisualTuning> = {
  default: {
    surfaceScreenOpacity: 0.74,
    flightScreenOpacity: 0.96,
    hoverScreenBoost: 0.08,
    surfaceAccentMix: 0.14,
    flightAccentMix: 0.08,
    surfaceGlowOpacity: 0.085,
    flightGlowOpacity: 0.18,
    hoverGlowBoost: 0.08,
    distanceScaleNear: 1.08,
    distanceScaleMid: 1,
    distanceScaleFar: 0.9,
  },
  morning: {
    surfaceScreenOpacity: 0.82,
    flightScreenOpacity: 1,
    hoverScreenBoost: 0.1,
    surfaceAccentMix: 0.08,
    flightAccentMix: 0.04,
    surfaceGlowOpacity: 0.062,
    flightGlowOpacity: 0.14,
    hoverGlowBoost: 0.06,
    distanceScaleNear: 1.12,
    distanceScaleMid: 1.02,
    distanceScaleFar: 0.93,
  },
  overcast: {
    surfaceScreenOpacity: 0.78,
    flightScreenOpacity: 0.98,
    hoverScreenBoost: 0.08,
    surfaceAccentMix: 0.1,
    flightAccentMix: 0.06,
    surfaceGlowOpacity: 0.07,
    flightGlowOpacity: 0.16,
    hoverGlowBoost: 0.07,
    distanceScaleNear: 1.06,
    distanceScaleMid: 0.99,
    distanceScaleFar: 0.91,
  },
  dusk: {
    surfaceScreenOpacity: 0.8,
    flightScreenOpacity: 0.99,
    hoverScreenBoost: 0.09,
    surfaceAccentMix: 0.1,
    flightAccentMix: 0.05,
    surfaceGlowOpacity: 0.072,
    flightGlowOpacity: 0.17,
    hoverGlowBoost: 0.07,
    distanceScaleNear: 1.09,
    distanceScaleMid: 1,
    distanceScaleFar: 0.91,
  },
  night: {
    surfaceScreenOpacity: 0.7,
    flightScreenOpacity: 0.94,
    hoverScreenBoost: 0.1,
    surfaceAccentMix: 0.18,
    flightAccentMix: 0.1,
    surfaceGlowOpacity: 0.1,
    flightGlowOpacity: 0.21,
    hoverGlowBoost: 0.1,
    distanceScaleNear: 1.06,
    distanceScaleMid: 0.98,
    distanceScaleFar: 0.88,
  },
};

export const WORKSPACE_SCENE_FLIGHT_TILE_TUNING: Record<WorkspaceSceneTheme, WorkspaceSceneFlightTileTuning> = {
  default: {
    far: { wallArc: 0.94, wallHeight: 29, sourceLift: 14, scale: 0.7, opacity: 0.78, blur: 0.85 },
    mid: { wallArc: 0.72, wallHeight: 22.5, sourceLift: 10.8, scale: 0.81, opacity: 0.9, blur: 0.34 },
    near: { wallArc: 0.52, wallHeight: 16.8, sourceLift: 8.6, scale: 0.93, opacity: 0.975, blur: 0 },
    wallRadius: 0.94,
    wallSwitchThreshold: 0.92,
    wallSwitchBlendSpeed: 3.2,
    edgeOpacityDecay: 0.05,
    edgeBlurGain: 0.18,
    pinnedScaleBoost: 0.03,
  },
  morning: {
    far: { wallArc: 0.88, wallHeight: 30.5, sourceLift: 14.2, scale: 0.74, opacity: 0.82, blur: 0.68 },
    mid: { wallArc: 0.68, wallHeight: 24, sourceLift: 11.2, scale: 0.84, opacity: 0.92, blur: 0.24 },
    near: { wallArc: 0.48, wallHeight: 18, sourceLift: 8.8, scale: 0.955, opacity: 0.99, blur: 0 },
    wallRadius: 0.93,
    wallSwitchThreshold: 0.9,
    wallSwitchBlendSpeed: 3.4,
    edgeOpacityDecay: 0.042,
    edgeBlurGain: 0.14,
    pinnedScaleBoost: 0.028,
  },
  overcast: {
    far: { wallArc: 0.98, wallHeight: 29.4, sourceLift: 14.4, scale: 0.71, opacity: 0.76, blur: 0.96 },
    mid: { wallArc: 0.74, wallHeight: 22.8, sourceLift: 11, scale: 0.82, opacity: 0.88, blur: 0.42 },
    near: { wallArc: 0.54, wallHeight: 17.2, sourceLift: 8.9, scale: 0.94, opacity: 0.965, blur: 0.06 },
    wallRadius: 0.945,
    wallSwitchThreshold: 0.94,
    wallSwitchBlendSpeed: 3,
    edgeOpacityDecay: 0.052,
    edgeBlurGain: 0.2,
    pinnedScaleBoost: 0.028,
  },
  dusk: {
    far: { wallArc: 0.9, wallHeight: 29.8, sourceLift: 14.1, scale: 0.73, opacity: 0.8, blur: 0.72 },
    mid: { wallArc: 0.69, wallHeight: 23.6, sourceLift: 11, scale: 0.84, opacity: 0.91, blur: 0.28 },
    near: { wallArc: 0.49, wallHeight: 17.6, sourceLift: 8.7, scale: 0.95, opacity: 0.985, blur: 0 },
    wallRadius: 0.935,
    wallSwitchThreshold: 0.91,
    wallSwitchBlendSpeed: 3.25,
    edgeOpacityDecay: 0.046,
    edgeBlurGain: 0.16,
    pinnedScaleBoost: 0.028,
  },
  night: {
    far: { wallArc: 0.82, wallHeight: 27.8, sourceLift: 13.4, scale: 0.71, opacity: 0.8, blur: 0.92 },
    mid: { wallArc: 0.6, wallHeight: 21, sourceLift: 10.1, scale: 0.835, opacity: 0.92, blur: 0.32 },
    near: { wallArc: 0.42, wallHeight: 15.4, sourceLift: 7.9, scale: 0.965, opacity: 0.995, blur: 0 },
    wallRadius: 0.945,
    wallSwitchThreshold: 0.96,
    wallSwitchBlendSpeed: 3.6,
    edgeOpacityDecay: 0.04,
    edgeBlurGain: 0.14,
    pinnedScaleBoost: 0.024,
  },
};

export const TILE_DISTANCE_OPTIONS: TileDistanceOption[] = [
  { id: 'near', label: 'Ближе', hint: 'Передний план' },
  { id: 'mid', label: 'Средняя', hint: 'Основная полоса' },
  { id: 'far', label: 'Дальше', hint: 'Линия горизонта' },
];

export const WORKSPACE_WIDGET_ACCENTS: Record<WorkspaceWidgetKind | 'reports' | 'imports', WidgetVisualAccent> = {
  leads: { accent: '#f1b56d', screen: '#2a1910' },
  customers: { accent: '#f5b56f', screen: '#2b1b10' },
  deals: { accent: '#7acbff', screen: '#122132' },
  tasks: { accent: '#c6a7ff', screen: '#22183a' },
  warehouse: { accent: '#bba76d', screen: '#2a2310' },
  production: { accent: '#ffbe66', screen: '#2d1b10' },
  finance: { accent: '#72e2c4', screen: '#10261f' },
  employees: { accent: '#c7d6ef', screen: '#162233' },
  reports: { accent: '#8de8c0', screen: '#10261e' },
  documents: { accent: '#9ab6ff', screen: '#151f34' },
  imports: { accent: '#ffb09d', screen: '#311712' },
  chapan: { accent: '#ffe38f', screen: '#2e2612' },
};

export const WORKSPACE_WIDGET_SHELL_PROFILES: Record<WorkspaceWidgetKind | 'reports' | 'imports', WorkspaceWidgetShellProfile> = {
  leads: { depthFactor: 0.108, screenInset: 0.848, hoverLift: 1.03, introLift: 10.8 },
  customers: { depthFactor: 0.112, screenInset: 0.85, hoverLift: 1.08, introLift: 11.2 },
  deals: { depthFactor: 0.102, screenInset: 0.86, hoverLift: 1.02, introLift: 10.1 },
  tasks: { depthFactor: 0.104, screenInset: 0.845, hoverLift: 1.04, introLift: 10.4 },
  warehouse: { depthFactor: 0.095, screenInset: 0.838, hoverLift: 0.99, introLift: 9.6 },
  production: { depthFactor: 0.103, screenInset: 0.848, hoverLift: 1.02, introLift: 10.2 },
  finance: { depthFactor: 0.101, screenInset: 0.844, hoverLift: 1.01, introLift: 9.9 },
  employees: { depthFactor: 0.1, screenInset: 0.846, hoverLift: 1.01, introLift: 9.8 },
  reports: { depthFactor: 0.098, screenInset: 0.84, hoverLift: 0.98, introLift: 9.7 },
  documents: { depthFactor: 0.099, screenInset: 0.842, hoverLift: 1, introLift: 9.9 },
  imports: { depthFactor: 0.106, screenInset: 0.848, hoverLift: 1.01, introLift: 10.6 },
  chapan: { depthFactor: 0.11, screenInset: 0.852, hoverLift: 1.06, introLift: 11.4 },
};

export function getThemeByTime(): WorkspaceSceneTheme {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return 'morning';
  if (hour >= 9 && hour < 17) return 'overcast';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

export function getTileDistanceOffset(distance: WorkspaceTileDistance) {
  switch (distance) {
    case 'near':
      return 11;
    case 'far':
      return -12;
    default:
      return 0;
  }
}
