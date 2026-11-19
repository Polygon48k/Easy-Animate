export interface PixelUndoEntry {
  type: 'pixels';
  imgData: ImageData;
  w: number;
  h: number;
  offsetX: number;
  offsetY: number;
}

export interface IKSiblingSnapshot {
  layerKey: string;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  posKeys?: CelPosKey[];
  originX?: number;
  originY?: number;
  mouthFrame?: number;
  mouthPrevKey?: MouthKey | null;
}

export interface MoveUndoEntry {
  type: 'move';
  offsetX: number;
  offsetY: number;
  rotation?: number;
  scale?: number;
  originX?: number;
  originY?: number;
  ikSiblings?: IKSiblingSnapshot[];
}

export interface CelPosKey {
  relFrame: number;
  offsetX: number;
  offsetY: number;
  scale?: number;
  rotation?: number;
  ctrlDx?: number;
  ctrlDy?: number;
}

export interface TweenUndoEntry {
  type: 'tween';
  offsetX: number;
  offsetY: number;
  posKeys?: CelPosKey[];
  rotation?: number;
  scale?: number;
  originX?: number;
  originY?: number;
  ikSiblings?: IKSiblingSnapshot[];
}

export type UndoEntry = PixelUndoEntry | MoveUndoEntry | TweenUndoEntry;

export interface Cel {
  canvas: HTMLCanvasElement;
  undoStack: UndoEntry[];
  hasInk: boolean;
  duration: number;
  offsetX: number;
  offsetY: number;
  originX?: number;
  originY?: number;
  rotation?: number;
  scale?: number;
  posKeys?: CelPosKey[];
  nestId?: string;
  nestOriginFrame?: number;
}

export interface VectorStrokeItem {
  kind: 'stroke';
  points: Point2D[];
  color: string;
  size: number;
}

export interface VectorEraseItem {
  kind: 'erase';
  points: Point2D[];
  size: number;
}

export interface VectorFillItem {
  kind: 'fill';
  contours: Point2D[][];
  color: string;
  isErase?: boolean;
}

export type VectorItem = VectorStrokeItem | VectorEraseItem | VectorFillItem;

export type VectorUndoEntry =
  | {
      type: 'items';
      items: VectorItem[];
      hasInk: boolean;
      offsetX: number;
      offsetY: number;
      posKeys?: CelPosKey[];
      rotation?: number;
      scale?: number;
      originX?: number;
      originY?: number;
    }
  | MoveUndoEntry
  | TweenUndoEntry;

export interface VectorCel {
  items: VectorItem[];
  undoStack: VectorUndoEntry[];
  hasInk: boolean;
  duration: number;
  offsetX: number;
  offsetY: number;
  originX?: number;
  originY?: number;
  rotation?: number;
  scale?: number;
  posKeys?: CelPosKey[];
  nestId?: string;
  nestOriginFrame?: number;
}

export interface VectorTrack {
  id: string;
  name: string;
  visible: boolean;
  cels: Map<number, VectorCel>;
}

export interface CelTrack {
  id: string;
  name: string;
  visible: boolean;
  cels: Map<number, Cel>;
}

export interface BgLayer {
  id: string;
  trackName: string;
  canvas: HTMLCanvasElement;
  undoStack: UndoEntry[];
  hasInk: boolean;
  visible: boolean;
  name: string;
  offsetX: number;
  offsetY: number;
  originX?: number;
  originY?: number;
  rotation?: number;
  scale?: number;
}

export interface Viseme {
  name: string;
  canvas: HTMLCanvasElement;
  undoStack: UndoEntry[];
}

export interface MouthKey {
  viseme: number;
  x: number;
  y: number;
  scale: number;
  originDx?: number;
  originDy?: number;
  rotation?: number;
}

export interface MouthLayer {
  id: string;
  name: string;
  visible: boolean;
  keys: Map<number, MouthKey>;
  visemes: Viseme[];
}

export interface CameraKey {
  x: number;
  y: number;
  scale: number;
  ease: string;
}

export interface AudioClip {
  buffer: AudioBuffer;
  peaks: Float32Array;
  name: string;
  timelineStartSec: number;
  trimStartSec: number;
  trimEndSec: number;
  muted: boolean;
  volume: number;
}

export interface AudioTrack {
  id: string;
  name: string;
  volume: number;
  muted: boolean;
  clip: AudioClip | null;
}

export interface LoopRange {
  start: number;
  end: number;
}

export interface NestedClip {
  id: string;
  name: string;
  sourceLayer: 'cel' | 'vector';
  totalFrames: number;
  currentFrame: number;
  loopRange: LoopRange | null;
  celTracks: CelTrack[];
  activeCelTrackId: string;
  vectorTracks: VectorTrack[];
  activeVectorTrackId: string;
  layerOrder: string[];
  layerParents: Record<string, string | null>;
  layerIK?: Record<string, boolean>;
}

export interface Scene {
  id: string;
  name: string;
  totalFrames: number;
  currentFrame: number;
  loopRange: LoopRange | null;
  celTracks: CelTrack[];
  activeCelTrackId: string;
  vectorTracks: VectorTrack[];
  activeVectorTrackId: string;
  bgLayers: BgLayer[];
  activeBgLayerId: string;
  mouthLayers: MouthLayer[];
  activeMouthLayerId: string;
  layerOrder: string[];
  layerParents: Record<string, string | null>;
  layerIK?: Record<string, boolean>;
  nestedClips: Map<string, NestedClip>;
  cameraKeys: Map<number, CameraKey>;
  audioTracks: AudioTrack[];
  activeAudioTrackId: string;
}

interface BrushMask {
  cells: Array<{ dx: number; dy: number }>;
  edges: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

interface Point2D {
  x: number;
  y: number;
  corner?: boolean;
}

export function initAnimator(onNotify: (msg: string) => void): () => void {
  const abortController = new AbortController();
  const { signal } = abortController;

  let WORLD_W = 1280;
  let WORLD_H = 720;
  const MOUTH_W = 160;
  const MOUTH_H = 120;
  const VISEME_NAMES = ['Rest', 'MBP', 'AI', 'E', 'O', 'U', 'FV', 'L'];

  function mustEl<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`Missing element #${id}`);
    return el as T;
  }

  function createCelCanvas(w = WORLD_W, h = WORLD_H): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const cctx = c.getContext('2d');
    if (cctx) cctx.imageSmoothingEnabled = false;
    return c;
  }

  function drawStarterViseme(canvas: HTMLCanvasElement, idx: number): void {
    const c = canvas.getContext('2d');
    if (!c) return;
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, MOUTH_W, MOUTH_H);
    const cx = MOUTH_W / 2;
    const cy = MOUTH_H / 2;

    const fillOval = (ox: number, oy: number, rx: number, ry: number, col: string) => {
      c.fillStyle = col;
      for (let y = -ry; y <= ry; y++) {
        for (let x = -rx; x <= rx; x++) {
          if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
            c.fillRect(Math.round(ox + x), Math.round(oy + y), 1, 1);
          }
        }
      }
    };

    const name = VISEME_NAMES[idx];
    if (name === 'Rest') {
      c.fillStyle = '#000000';
      c.fillRect(cx - 28, cy - 2, 56, 4);
      c.fillRect(cx - 32, cy - 4, 5, 3);
      c.fillRect(cx + 27, cy - 4, 5, 3);
    } else if (name === 'MBP') {
      c.fillStyle = '#000000';
      c.fillRect(cx - 30, cy - 3, 60, 6);
      c.fillRect(cx - 34, cy - 5, 4, 10);
      c.fillRect(cx + 30, cy - 5, 4, 10);
    } else if (name === 'AI') {
      fillOval(cx, cy, 34, 28, '#000000');
      fillOval(cx, cy + 2, 28, 22, '#450a0a');
      c.fillStyle = '#ffffff';
      c.fillRect(cx - 20, cy - 20, 40, 8);
      fillOval(cx, cy + 16, 18, 8, '#f43f5e');
    } else if (name === 'E') {
      fillOval(cx, cy, 38, 17, '#000000');
      fillOval(cx, cy, 32, 12, '#ffffff');
      c.fillStyle = '#000000';
      c.fillRect(cx - 30, cy - 1, 60, 2);
    } else if (name === 'O') {
      fillOval(cx, cy, 24, 28, '#000000');
      fillOval(cx, cy + 2, 18, 22, '#450a0a');
      fillOval(cx, cy + 16, 11, 6, '#f43f5e');
    } else if (name === 'U') {
      fillOval(cx, cy, 15, 16, '#000000');
      fillOval(cx, cy, 9, 10, '#450a0a');
    } else if (name === 'FV') {
      fillOval(cx, cy, 32, 14, '#000000');
      c.fillStyle = '#ffffff';
      c.fillRect(cx - 24, cy - 9, 48, 9);
      c.fillStyle = '#f43f5e';
      c.fillRect(cx - 26, cy + 2, 52, 6);
    } else if (name === 'L') {
      fillOval(cx, cy, 30, 22, '#000000');
      fillOval(cx, cy + 2, 24, 16, '#450a0a');
      c.fillStyle = '#ffffff';
      c.fillRect(cx - 18, cy - 15, 36, 7);
      fillOval(cx, cy - 4, 14, 10, '#f43f5e');
    }
  }

  function createDefaultVisemes(): Viseme[] {
    return VISEME_NAMES.map((name, i) => {
      const canvas = createCelCanvas(MOUTH_W, MOUTH_H);
      drawStarterViseme(canvas, i);
      return { name, canvas, undoStack: [] };
    });
  }

  function createVectorTrack(name = 'Vector 1', seedFirstCel = true): VectorTrack {
    const cels = new Map<number, VectorCel>();
    if (seedFirstCel) {
      cels.set(0, { items: [], undoStack: [], hasInk: false, duration: 1, offsetX: 0, offsetY: 0 });
    }
    return {
      id: 'vtrk_' + Math.random().toString(36).slice(2, 10),
      name,
      visible: true,
      cels,
    };
  }

  function createCelTrack(name = 'Bitmap 1', seedFirstCel = true): CelTrack {
    const cels = new Map<number, Cel>();
    if (seedFirstCel) {
      cels.set(0, { canvas: createCelCanvas(), undoStack: [], hasInk: false, duration: 1, offsetX: 0, offsetY: 0 });
    }
    return {
      id: 'ctrk_' + Math.random().toString(36).slice(2, 10),
      name,
      visible: true,
      cels,
    };
  }

  function createBgLayer(trackName = 'Background 1', visible = false): BgLayer {
    return {
      id: 'bg_' + Math.random().toString(36).slice(2, 10),
      trackName,
      canvas: createCelCanvas(),
      undoStack: [],
      hasInk: false,
      visible,
      name: '',
      offsetX: 0,
      offsetY: 0,
    };
  }

  function createMouthLayer(name = 'Picker 1', visible = false): MouthLayer {
    return {
      id: 'mth_' + Math.random().toString(36).slice(2, 10),
      name,
      visible,
      keys: new Map(),
      visemes: createDefaultVisemes(),
    };
  }

  function createAudioTrack(name = 'Sound'): AudioTrack {
    return {
      id: 'aud_' + Math.random().toString(36).slice(2, 10),
      name,
      volume: 1,
      muted: false,
      clip: null,
    };
  }

  function makeScene(name: string): Scene {
    const firstCelTrack = createCelTrack('Draw', true);
    const firstVectorTrack = createVectorTrack('Vector 1', true);
    const firstBgLayer = createBgLayer('Background 1', false);
    const firstMouthLayer = createMouthLayer('Picker 1', false);
    const firstAudioTrack = createAudioTrack('Sound');
    return {
      id: 'sc_' + Math.random().toString(36).slice(2, 10),
      name,
      totalFrames: 24,
      currentFrame: 0,
      loopRange: null,
      celTracks: [firstCelTrack],
      activeCelTrackId: firstCelTrack.id,
      vectorTracks: [firstVectorTrack],
      activeVectorTrackId: firstVectorTrack.id,
      bgLayers: [firstBgLayer],
      activeBgLayerId: firstBgLayer.id,
      mouthLayers: [firstMouthLayer],
      activeMouthLayerId: firstMouthLayer.id,
      layerOrder: [
        `mouth:${firstMouthLayer.id}`,
        `vector:${firstVectorTrack.id}`,
        `cel:${firstCelTrack.id}`,
        `bg:${firstBgLayer.id}`,
      ],
      layerParents: {},
      layerIK: {},
      nestedClips: new Map(),
      cameraKeys: new Map(),
      audioTracks: [firstAudioTrack],
      activeAudioTrackId: firstAudioTrack.id,
    };
  }

  const app = {
    mode: 'basic' as 'basic' | 'pro' | 'scenes',
    lastEditorMode: 'basic' as 'basic' | 'pro',
    fps: 12,
    loop: true,
    scenes: [makeScene('Scene 1')],
    activeSceneId: '',
    scenesPlaying: false,
    scenesGlobalFrame: 0,
    scenesBoardZoomPx: 220,
  };
  app.activeSceneId = app.scenes[0].id;
  const isBasicMode = (): boolean => app.mode === 'basic';

  function activeScene(): Scene {
    return app.scenes.find((s) => s.id === app.activeSceneId) || app.scenes[0];
  }

  interface NestBreadcrumbEntry {
    clipId: string;
    returnFrame: number;
    returnLayer: 'cel' | 'vector';
    returnCelTrackId?: string;
    returnVectorTrackId?: string;
    savedTracks: {
      showVectorTrack: boolean;
      showBgTrack: boolean;
      showMouthTrack: boolean;
      showAudioTrack: boolean;
      showCamTrack: boolean;
    } | null;
  }

  let nestStack: NestBreadcrumbEntry[] = [];

  function activeNestedClip(): NestedClip | null {
    if (nestStack.length === 0) return null;
    const sc = activeScene();
    const top = nestStack[nestStack.length - 1];
    return sc.nestedClips.get(top.clipId) || null;
  }

  function activeTimelineTarget(): Scene | NestedClip {
    return activeNestedClip() || activeScene();
  }

  function getActiveCelTrackInTarget(target: Scene | NestedClip): CelTrack {
    if (target.celTracks.length === 0) {
      const trk = createCelTrack('Draw', true);
      target.celTracks.push(trk);
      target.activeCelTrackId = trk.id;
      return trk;
    }
    const found = target.celTracks.find((t) => t.id === target.activeCelTrackId);
    if (found) return found;
    target.activeCelTrackId = target.celTracks[0].id;
    return target.celTracks[0];
  }

  function getActiveVectorTrackInTarget(target: Scene | NestedClip): VectorTrack {
    if (target.vectorTracks.length === 0) {
      const trk = createVectorTrack('Vector 1', true);
      target.vectorTracks.push(trk);
      target.activeVectorTrackId = trk.id;
      return trk;
    }
    const found = target.vectorTracks.find((t) => t.id === target.activeVectorTrackId);
    if (found) return found;
    target.activeVectorTrackId = target.vectorTracks[0].id;
    return target.vectorTracks[0];
  }

  function getActiveBgLayerInScene(sc: Scene): BgLayer {
    if (sc.bgLayers.length === 0) {
      const bg = createBgLayer('Background 1', state.showBgTrack);
      sc.bgLayers.push(bg);
      sc.activeBgLayerId = bg.id;
      return bg;
    }
    const found = sc.bgLayers.find((b) => b.id === sc.activeBgLayerId);
    if (found) return found;
    sc.activeBgLayerId = sc.bgLayers[0].id;
    return sc.bgLayers[0];
  }

  function getActiveMouthLayerInScene(sc: Scene): MouthLayer {
    if (sc.mouthLayers.length === 0) {
      const ml = createMouthLayer('Picker 1', state.showMouthTrack);
      sc.mouthLayers.push(ml);
      sc.activeMouthLayerId = ml.id;
      return ml;
    }
    const found = sc.mouthLayers.find((m) => m.id === sc.activeMouthLayerId);
    if (found) return found;
    sc.activeMouthLayerId = sc.mouthLayers[0].id;
    return sc.mouthLayers[0];
  }

  function getActiveAudioTrackInScene(sc: Scene): AudioTrack {
    if (sc.audioTracks.length === 0) {
      const at = createAudioTrack('Sound');
      sc.audioTracks.push(at);
      sc.activeAudioTrackId = at.id;
      return at;
    }
    const found = sc.audioTracks.find((a) => a.id === sc.activeAudioTrackId);
    if (found) return found;
    sc.activeAudioTrackId = sc.audioTracks[0].id;
    return sc.audioTracks[0];
  }

  const proPrefs = {
    vectorPixelPreview: false,
    showOriginPoint: false,
    onionBefore: true,
    onionAfter: false,
    showCelTrack: true,
    showVectorTrack: false,
    showBgTrack: false,
    showMouthTrack: false,
    showAudioTrack: false,
    showCamTrack: false,
    activeLayer: 'cel' as 'cel' | 'vector' | 'bg' | 'mouth',
    selectedTrack: 'cel' as 'cel' | 'vector' | 'audio' | 'mouth' | 'bg' | 'cam',
  };

  let basicShowAudioTrack = false;

  const state = {
    isPlaying: false,
    onionSkin: false,
    onionBefore: true,
    onionAfter: false,
    showCelLayer: true,
    showVectorLayer: true,
    vectorPixelPreview: false,
    showOriginPoint: false,
    applyCamera: true,
    showCelTrack: true,
    showVectorTrack: false,
    showBgTrack: false,
    showMouthTrack: false,
    showAudioTrack: false,
    showCamTrack: false,
    activeLayer: 'cel' as 'cel' | 'vector' | 'bg' | 'mouth',
    selectedTrack: 'cel' as 'cel' | 'vector' | 'audio' | 'mouth' | 'bg' | 'cam',

    tool: 'brush' as 'brush' | 'eraser' | 'fill' | 'moveCam' | 'nudge' | 'vectorEdit',
    brushColor: '#000000',
    brushSize: 4,
    nudgeRadius: 60,
    fillGapRadius: 0,
    audioVolume: 1,

    viewZoom: 1,
    viewPanX: 0,
    viewPanY: 0,
    timelineZoom: 1,

    get totalFrames() {
      return activeTimelineTarget().totalFrames;
    },
    set totalFrames(v: number) {
      activeTimelineTarget().totalFrames = v;
    },
    get currentFrame() {
      return activeTimelineTarget().currentFrame;
    },
    set currentFrame(v: number) {
      activeTimelineTarget().currentFrame = v;
    },
    get loopRange() {
      return activeTimelineTarget().loopRange;
    },
    set loopRange(v: LoopRange | null) {
      activeTimelineTarget().loopRange = v;
    },
    get activeCelTrack(): CelTrack {
      return getActiveCelTrackInTarget(activeTimelineTarget());
    },
    get cels() {
      return getActiveCelTrackInTarget(activeTimelineTarget()).cels;
    },
    get activeVectorTrack(): VectorTrack {
      return getActiveVectorTrackInTarget(activeTimelineTarget());
    },
    get vectorCels() {
      return getActiveVectorTrackInTarget(activeTimelineTarget()).cels;
    },
    get bgLayer(): BgLayer {
      return getActiveBgLayerInScene(activeScene());
    },
    get mouthLayer(): MouthLayer {
      return getActiveMouthLayerInScene(activeScene());
    },
    get cameraKeys() {
      return activeScene().cameraKeys;
    },
    get activeAudioTrack(): AudioTrack {
      return getActiveAudioTrackInScene(activeScene());
    },
    get audio() {
      return getActiveAudioTrackInScene(activeScene()).clip;
    },
    set audio(v: AudioClip | null) {
      const trk = getActiveAudioTrackInScene(activeScene());
      trk.clip = v;
      if (v) {
        trk.volume = typeof v.volume === 'number' ? v.volume : trk.volume;
        trk.muted = Boolean(v.muted);
      }
    },
    get fps() {
      return app.fps;
    },
    set fps(v: number) {
      app.fps = v;
    },
    get loop() {
      return app.loop;
    },
    set loop(v: boolean) {
      app.loop = v;
    },
  };

  // DOM References
  const editorView = mustEl<HTMLDivElement>('editorView');
  const scenesView = mustEl<HTMLDivElement>('scenesView');
  const btnModeBasic = mustEl<HTMLButtonElement>('btnModeBasic');
  const btnModePro = mustEl<HTMLButtonElement>('btnModePro');
  const btnModeScenes = mustEl<HTMLButtonElement>('btnModeScenes');
  const activeSceneLabel = mustEl<HTMLSpanElement>('activeSceneLabel');
  const editorOnionGroup = mustEl<HTMLDivElement>('editorOnionGroup');
  const brushSizeBox = mustEl<HTMLDivElement>('brushSizeBox');
  const closeFillBox = mustEl<HTMLDivElement>('closeFillBox');
  const editorLayerTrackGroup = mustEl<HTMLDivElement>('editorLayerTrackGroup');
  const fpsSelect = mustEl<HTMLSelectElement>('fpsSelect');

  const stageContainer = mustEl<HTMLElement>('stageContainer');
  const stage = mustEl<HTMLCanvasElement>('stage');
  const ctx = stage.getContext('2d')!;

  const stageBadge = mustEl<HTMLDivElement>('stageBadge');
  const btnResetView = mustEl<HTMLButtonElement>('btnResetView');
  const nestBreadcrumbBar = mustEl<HTMLDivElement>('nestBreadcrumbBar');
  const nestBreadcrumbs = mustEl<HTMLDivElement>('nestBreadcrumbs');
  const btnExitNest = mustEl<HTMLButtonElement>('btnExitNest');
  const frameIndicator = mustEl<HTMLSpanElement>('frameIndicator');
  const camPopover = mustEl<HTMLDivElement>('camPopover');
  const timelinePanel = mustEl<HTMLElement>('timelinePanel');
  const timelineHeader = mustEl<HTMLDivElement>('timelineHeader');
  const timelineScroll = mustEl<HTMLDivElement>('timelineScroll');
  const timelineGrid = mustEl<HTMLDivElement>('timelineGrid');
  const btnResetTimelineZoom = mustEl<HTMLButtonElement>('btnResetTimelineZoom');
  const btnRemoveFrame = mustEl<HTMLButtonElement>('btnRemoveFrame');
  const loopRow = mustEl<HTMLDivElement>('loopRow');
  const loopSelectionBar = mustEl<HTMLDivElement>('loopSelectionBar');
  const loopHighlightOverlay = mustEl<HTMLDivElement>('loopHighlightOverlay');
  const loopRangeBadge = mustEl<HTMLSpanElement>('loopRangeBadge');
  const rulerRow = mustEl<HTMLDivElement>('rulerRow');
  const layerLabelsContainer = mustEl<HTMLDivElement>('layerLabelsContainer');
  const layerRowsContainer = mustEl<HTMLDivElement>('layerRowsContainer');
  const layerRightsContainer = mustEl<HTMLDivElement>('layerRightsContainer');
  const audioLabelsContainer = mustEl<HTMLDivElement>('audioLabelsContainer');
  const audioRowsContainer = mustEl<HTMLDivElement>('audioRowsContainer');
  const audioRightsContainer = mustEl<HTMLDivElement>('audioRightsContainer');
  const btnAddCelTrack = mustEl<HTMLButtonElement>('btnAddCelTrack');
  const btnAddVectorTrack = mustEl<HTMLButtonElement>('btnAddVectorTrack');
  const btnAddMouthTrack = mustEl<HTMLButtonElement>('btnAddMouthTrack');
  const btnAddBgTrack = mustEl<HTMLButtonElement>('btnAddBgTrack');
  const btnAddAudioTrack = mustEl<HTMLButtonElement>('btnAddAudioTrack');
  const btnAddCamTrack = mustEl<HTMLButtonElement>('btnAddCamTrack');
  const btnToggleAudioTrack = mustEl<HTMLButtonElement>('btnToggleAudioTrack');
  const camTrackRow = mustEl<HTMLDivElement>('camTrackRow');
  const camTrackLabel = mustEl<HTMLDivElement>('camTrackLabel');
  const camTrackRight = mustEl<HTMLDivElement>('camTrackRight');
  const playheadLine = mustEl<HTMLDivElement>('playheadLine');
  const celContextMenu = mustEl<HTMLDivElement>('celContextMenu');
  const ctxNest = mustEl<HTMLButtonElement>('ctxNest');
  const ctxExitNest = mustEl<HTMLButtonElement>('ctxExitNest');
  const ctxUnnest = mustEl<HTMLButtonElement>('ctxUnnest');
  const ctxClearTween = mustEl<HTMLButtonElement>('ctxClearTween');
  const ctxNestTweenDivider = mustEl<HTMLDivElement>('ctxNestTweenDivider');
  const mouthContextMenu = mustEl<HTMLDivElement>('mouthContextMenu');
  const audioContextMenu = mustEl<HTMLDivElement>('audioContextMenu');
  const ctxAudioAutoLipSync = mustEl<HTMLButtonElement>('ctxAudioAutoLipSync');
  const ctxAudioDeleteTrack = mustEl<HTMLButtonElement>('ctxAudioDeleteTrack');
  const camContextMenu = mustEl<HTMLDivElement>('camContextMenu');
  const layerContextMenu = mustEl<HTMLDivElement>('layerContextMenu');
  const ctxLayerAddChildVec = mustEl<HTMLButtonElement>('ctxLayerAddChildVec');
  const ctxLayerAddChildCel = mustEl<HTMLButtonElement>('ctxLayerAddChildCel');
  const ctxLayerJoinAbove = mustEl<HTMLButtonElement>('ctxLayerJoinAbove');
  const ctxLayerDetach = mustEl<HTMLButtonElement>('ctxLayerDetach');
  const ctxLayerToggleIK = mustEl<HTMLButtonElement>('ctxLayerToggleIK');
  const ctxLayerRename = mustEl<HTMLButtonElement>('ctxLayerRename');
  const ctxLayerClear = mustEl<HTMLButtonElement>('ctxLayerClear');
  const ctxLayerDelete = mustEl<HTMLButtonElement>('ctxLayerDelete');
  const paletteSwatches = mustEl<HTMLDivElement>('paletteSwatches');
  const btnOriginPoint = mustEl<HTMLButtonElement>('btnOriginPoint');
  const btnOriginPointText = mustEl<HTMLSpanElement>('btnOriginPointText');
  const btnVectorPixelPreview = mustEl<HTMLButtonElement>('btnVectorPixelPreview');
  const vectorPointModeGroup = mustEl<HTMLDivElement>('vectorPointModeGroup');
  const btnVectorCorner = mustEl<HTMLButtonElement>('btnVectorCorner');
  const btnVectorCurve = mustEl<HTMLButtonElement>('btnVectorCurve');

  const mouthWidget = mustEl<HTMLDivElement>('mouthWidget');
  const mouthPreviewCanvas = mustEl<HTMLCanvasElement>('mouthPreviewCanvas');
  const mouthFrameBox = mustEl<HTMLDivElement>('mouthFrameBox');
  const mouthFrameLabel = mustEl<HTMLSpanElement>('mouthFrameLabel');
  const mouthLayerNameBadge = mustEl<HTMLSpanElement>('mouthLayerNameBadge');
  const mouthSheetPop = mustEl<HTMLDivElement>('mouthSheetPop');
  const mouthSheetGrid = mustEl<HTMLDivElement>('mouthSheetGrid');
  const btnMouthAddShape = mustEl<HTMLButtonElement>('btnMouthAddShape');
  const btnMouthDraw = mustEl<HTMLButtonElement>('btnMouthDraw');
  const btnMouthMove = mustEl<HTMLButtonElement>('btnMouthMove');
  const mouthScaleSlider = mustEl<HTMLInputElement>('mouthScaleSlider');
  const mouthScaleVal = mustEl<HTMLSpanElement>('mouthScaleVal');
  const btnToolNudge = mustEl<HTMLButtonElement>('btnToolNudge');
  const btnToolVectorEdit = mustEl<HTMLButtonElement>('btnToolVectorEdit');
  const brushSizeHeading = mustEl<HTMLElement>('brushSizeHeading');

  const btnCanvasSize = mustEl<HTMLButtonElement>('btnCanvasSize');
  const sizeMenu = mustEl<HTMLDivElement>('sizeMenu');
  const sizeWrap = mustEl<HTMLDivElement>('sizeWrap');
  const btnExportMenu = mustEl<HTMLButtonElement>('btnExportMenu');
  const exportMenu = mustEl<HTMLDivElement>('exportMenu');
  const exportWrap = mustEl<HTMLDivElement>('exportWrap');

  const camEase = mustEl<HTMLSelectElement>('camEase');
  const camScale = mustEl<HTMLInputElement>('camScale');
  const camX = mustEl<HTMLInputElement>('camX');
  const camY = mustEl<HTMLInputElement>('camY');

  const scenesPreviewCanvas = mustEl<HTMLCanvasElement>('scenesPreviewCanvas');
  const spCtx = scenesPreviewCanvas.getContext('2d')!;
  const scenesBoard = mustEl<HTMLDivElement>('scenesBoard');
  const scenesGrid = mustEl<HTMLDivElement>('scenesGrid');
  const scenesZoomSlider = mustEl<HTMLInputElement>('scenesZoomSlider');
  const scenesScrubber = mustEl<HTMLDivElement>('scenesScrubber');
  const scenesFrameReadout = mustEl<HTMLSpanElement>('scenesFrameReadout');
  const btnScenesPlay = mustEl<HTMLButtonElement>('btnScenesPlay');
  const btnScenesLoop = mustEl<HTMLButtonElement>('btnScenesLoop');

  // ==========================================
  // Page Mode Switching (Basic <-> Pro <-> Scenes)
  // ==========================================
  function saveProPrefs(): void {
    proPrefs.vectorPixelPreview = state.vectorPixelPreview;
    proPrefs.showOriginPoint = state.showOriginPoint;
    proPrefs.onionBefore = state.onionBefore;
    proPrefs.onionAfter = state.onionAfter;
    proPrefs.showCelTrack = state.showCelTrack;
    proPrefs.showVectorTrack = state.showVectorTrack;
    proPrefs.showBgTrack = state.showBgTrack;
    proPrefs.showMouthTrack = state.showMouthTrack;
    proPrefs.showAudioTrack = state.showAudioTrack;
    proPrefs.showCamTrack = state.showCamTrack;
    proPrefs.activeLayer = state.activeLayer;
    proPrefs.selectedTrack = state.selectedTrack;
  }

  function syncAddCamBtnUI(): void {
    const inNest = nestStack.length > 0;
    btnAddCamTrack.disabled = inNest || state.showCamTrack;
    btnAddCamTrack.classList.toggle('active', state.showCamTrack);
    btnAddCamTrack.title = state.showCamTrack
      ? 'Only one Camera layer is allowed (right-click Camera on timeline to delete)'
      : 'Add Camera Layer (max 1)';
  }

  function applyEditorTierUI(): void {
    const basic = isBasicMode();
    const inNest = nestStack.length > 0;
    mustEl<HTMLButtonElement>('btnOnionBefore').classList.toggle('hidden-nest-ui', basic);
    mustEl<HTMLButtonElement>('btnOnionAfter').classList.toggle('hidden-nest-ui', basic);
    mustEl<HTMLButtonElement>('btnOnionBefore').classList.toggle('active', state.onionBefore);
    mustEl<HTMLButtonElement>('btnOnionAfter').classList.toggle('active', state.onionAfter);

    btnOriginPoint.classList.toggle('hidden-nest-ui', basic || state.tool !== 'moveCam');
    btnOriginPoint.classList.toggle('active', state.showOriginPoint);
    btnOriginPointText.textContent = state.showOriginPoint ? 'Origin: On' : 'Origin: Off';

    btnVectorPixelPreview.textContent = `Pixelate: ${state.vectorPixelPreview ? 'On' : 'Off'}`;
    btnVectorPixelPreview.classList.toggle('active', state.vectorPixelPreview);
    btnVectorPixelPreview.classList.toggle('hidden-nest-ui', basic || state.activeLayer !== 'vector');
    vectorPointModeGroup.classList.toggle(
      'hidden-nest-ui',
      basic || state.activeLayer !== 'vector' || state.tool !== 'vectorEdit'
    );
    btnToolNudge.classList.toggle('hidden-tool', basic || (state.activeLayer !== 'vector' && state.activeLayer !== 'cel'));
    btnToolVectorEdit.classList.toggle('hidden-tool', basic || state.activeLayer !== 'vector');

    brushSizeBox.classList.toggle('hidden-nest-ui', basic);
    closeFillBox.classList.toggle('hidden-nest-ui', basic);
    editorLayerTrackGroup.classList.remove('hidden-nest-ui');

    btnAddCelTrack.classList.toggle('hidden-nest-ui', basic);
    btnAddVectorTrack.classList.toggle('hidden-nest-ui', basic);
    btnAddMouthTrack.classList.toggle('hidden-nest-ui', basic);
    btnAddBgTrack.classList.toggle('hidden-nest-ui', basic);
    btnAddAudioTrack.classList.toggle('hidden-nest-ui', basic);
    btnAddCamTrack.classList.toggle('hidden-nest-ui', basic);

    btnAddMouthTrack.disabled = inNest;
    btnAddBgTrack.disabled = inNest;
    btnAddAudioTrack.disabled = inNest;
    syncAddCamBtnUI();

    btnToggleAudioTrack.classList.toggle('hidden-nest-ui', !basic);
    btnToggleAudioTrack.classList.toggle('active', state.showAudioTrack);

    fpsSelect.disabled = basic;
    fpsSelect.title = basic ? 'Frame rate is locked in Basic mode (switch to Pro to change FPS)' : 'Frames Per Second';

    if (basic) {
      toggleCameraPanel(false);
      mouthSheetPop.classList.remove('open');
      camTrackLabel.classList.add('hidden-track');
      camTrackRow.classList.add('hidden-track');
      camTrackRight.classList.add('hidden-track');
    } else {
      camTrackLabel.classList.toggle('hidden-track', !state.showCamTrack);
      camTrackRow.classList.toggle('hidden-track', !state.showCamTrack);
      camTrackRight.classList.toggle('hidden-track', !state.showCamTrack);
    }
  }

  function switchToMode(mode: 'basic' | 'pro' | 'scenes'): void {
    const prevMode = app.mode;
    if (prevMode === mode) return;
    if (state.isPlaying) togglePlay();
    if (app.scenesPlaying) toggleScenesPlay();
    hideMenus();

    if (prevMode === 'pro') {
      saveProPrefs();
    } else if (prevMode === 'basic') {
      basicShowAudioTrack = state.showAudioTrack;
    }
    if (mode !== 'pro' && nestStack.length > 0) {
      exitAllNests(false);
    }

    app.mode = mode;
    if (mode === 'basic' || mode === 'pro') {
      app.lastEditorMode = mode;
    }

    const sc = activeScene();
    if (mode === 'basic') {
      state.vectorPixelPreview = false;
      state.showOriginPoint = false;
      hoverOriginGizmoPart = null;
      state.onionBefore = true;
      state.onionAfter = false;
      state.showCelLayer = true;
      state.showCelTrack = true;
      state.showVectorTrack = false;
      state.showAudioTrack = basicShowAudioTrack;
      if (sc.celTracks.length > 0) {
        sc.activeCelTrackId = sc.celTracks[0].id;
        sc.celTracks[0].visible = true;
      }
      if (sc.audioTracks.length > 0) {
        sc.activeAudioTrackId = sc.audioTracks[0].id;
      }
      state.activeLayer = 'cel';
      state.selectedTrack = 'cel';
      if (state.tool === 'nudge' || state.tool === 'vectorEdit') selectTool('brush');
      if (state.timelineZoom !== 1) applyTimelineZoom(1);
    } else if (mode === 'pro' && prevMode !== 'scenes') {
      state.vectorPixelPreview = proPrefs.vectorPixelPreview;
      state.showOriginPoint = proPrefs.showOriginPoint;
      if (!state.showOriginPoint) hoverOriginGizmoPart = null;
      state.onionBefore = proPrefs.onionBefore;
      state.onionAfter = proPrefs.onionAfter;
      state.showCelTrack = proPrefs.showCelTrack;
      state.showVectorTrack = proPrefs.showVectorTrack;
      state.showBgTrack = proPrefs.showBgTrack;
      state.showMouthTrack = proPrefs.showMouthTrack;
      state.showAudioTrack = proPrefs.showAudioTrack;
      state.showCamTrack = proPrefs.showCamTrack;
      state.activeLayer = proPrefs.activeLayer;
      state.selectedTrack = proPrefs.selectedTrack;
    }

    const isEditor = mode !== 'scenes';
    editorView.classList.toggle('hidden-view', !isEditor);
    scenesView.classList.toggle('hidden-view', isEditor);
    btnModeBasic.classList.toggle('active', mode === 'basic');
    btnModePro.classList.toggle('active', mode === 'pro');
    btnModeScenes.classList.toggle('active', mode === 'scenes');
    editorOnionGroup.style.visibility = isEditor ? 'visible' : 'hidden';

    if (isEditor) {
      loadSceneIntoEditorUI(sc);
      requestAnimationFrame(() => {
        resizeStageCanvas();
        renderTimeline();
        renderAudioTrack();
        renderStage();
      });
    } else {
      renderScenesView();
    }
  }

  btnModeBasic.onclick = () => switchToMode('basic');
  btnModePro.onclick = () => switchToMode('pro');
  btnModeScenes.onclick = () => switchToMode('scenes');

  function selectSceneForEditor(sceneId: string, jumpToEditor = false): void {
    exitAllNests(false);
    app.activeSceneId = sceneId;
    loadSceneIntoEditorUI(activeScene());
    if (jumpToEditor) switchToMode(app.lastEditorMode);
    else renderScenesGrid();
  }

  function loadSceneIntoEditorUI(sc: Scene): void {
    exitAllNests(false);
    activeSceneLabel.textContent = sc.name;
    const activeAt = getActiveAudioTrackInScene(sc);
    state.audioVolume = activeAt.clip && typeof activeAt.clip.volume === 'number' ? activeAt.clip.volume : activeAt.volume;
    updateAudioVolumeUI();

    if (isBasicMode()) {
      state.vectorPixelPreview = false;
      state.showCelLayer = true;
      state.showVectorTrack = false;
      state.showAudioTrack = basicShowAudioTrack;
      if (sc.celTracks.length > 0) {
        sc.activeCelTrackId = sc.celTracks[0].id;
        sc.celTracks[0].visible = true;
      }
      if (sc.audioTracks.length > 0) {
        sc.activeAudioTrackId = sc.audioTracks[0].id;
      }
      state.activeLayer = 'cel';
      if (state.selectedTrack !== 'audio' || !state.showAudioTrack) state.selectedTrack = 'cel';
      if (state.tool === 'nudge' || state.tool === 'vectorEdit') selectTool('brush');
    } else {
      const hasAudioContent = sc.audioTracks.length > 1 || sc.audioTracks.some((t) => Boolean(t.clip));
      if (hasAudioContent && !state.showAudioTrack) toggleAudioTrack(true);
      const hasBgContent = sc.bgLayers.length > 1 || sc.bgLayers.some((b) => b.hasInk);
      if (hasBgContent && !state.showBgTrack) toggleBgTrack(true);
      const hasMouthContent = sc.mouthLayers.length > 1 || sc.mouthLayers.some((m) => m.visible || m.keys.size > 0);
      if (hasMouthContent && !state.showMouthTrack) toggleMouthTrack(true);

      const hasVectorContent =
        sc.vectorTracks.length > 1 ||
        sc.vectorTracks.some(
          (trk) =>
            trk.cels.size > 1 ||
            Array.from(trk.cels.values()).some((vc) => vc.hasInk || vc.items.length > 0 || Boolean(vc.nestId))
        );
      if (hasVectorContent && !state.showVectorTrack) toggleVectorTrack(true);
      if (sc.cameraKeys.size > 0 && !state.showCamTrack) toggleCamTrack(true);
    }

    applyEditorTierUI();
    syncLayerTrackContainers();
    syncAudioTrackContainers();
    updateBgUI();
    updateMouthWidget();
    updateActiveTrackHighlight();
    updateTimelinePanelHeight();
    renderNestBreadcrumbUI();
    syncInspectorUI();
    renderTimeline();
    renderStage();
  }

  function shiftPosKeys(keys: CelPosKey[] | undefined, shiftX: number, shiftY: number): void {
    if (!keys) return;
    for (const k of keys) {
      k.offsetX += shiftX;
      k.offsetY += shiftY;
    }
  }

  function setWorldResolution(newW: number, newH: number): void {
    if (WORLD_W === newW && WORLD_H === newH) return;
    const shiftX = Math.round((newW - WORLD_W) / 2);
    const shiftY = Math.round((newH - WORLD_H) / 2);

    WORLD_W = newW;
    WORLD_H = newH;

    for (const sc of app.scenes) {
      for (const cTrk of sc.celTracks) {
        for (const cel of cTrk.cels.values()) {
          cel.offsetX += shiftX;
          cel.offsetY += shiftY;
          if (typeof cel.originX === 'number') cel.originX += shiftX;
          if (typeof cel.originY === 'number') cel.originY += shiftY;
          shiftPosKeys(cel.posKeys, shiftX, shiftY);
        }
      }
      for (const trk of sc.vectorTracks) {
        for (const vCel of trk.cels.values()) {
          vCel.offsetX += shiftX;
          vCel.offsetY += shiftY;
          if (typeof vCel.originX === 'number') vCel.originX += shiftX;
          if (typeof vCel.originY === 'number') vCel.originY += shiftY;
          shiftPosKeys(vCel.posKeys, shiftX, shiftY);
        }
      }
      for (const clip of sc.nestedClips.values()) {
        for (const cTrk of clip.celTracks) {
          for (const cel of cTrk.cels.values()) {
            cel.offsetX += shiftX;
            cel.offsetY += shiftY;
            if (typeof cel.originX === 'number') cel.originX += shiftX;
            if (typeof cel.originY === 'number') cel.originY += shiftY;
            shiftPosKeys(cel.posKeys, shiftX, shiftY);
          }
        }
        for (const trk of clip.vectorTracks) {
          for (const vCel of trk.cels.values()) {
            vCel.offsetX += shiftX;
            vCel.offsetY += shiftY;
            if (typeof vCel.originX === 'number') vCel.originX += shiftX;
            if (typeof vCel.originY === 'number') vCel.originY += shiftY;
            shiftPosKeys(vCel.posKeys, shiftX, shiftY);
          }
        }
      }
      for (const bg of sc.bgLayers) {
        bg.offsetX += shiftX;
        bg.offsetY += shiftY;
        if (typeof bg.originX === 'number') bg.originX += shiftX;
        if (typeof bg.originY === 'number') bg.originY += shiftY;
      }
      for (const ml of sc.mouthLayers) {
        for (const mk of ml.keys.values()) {
          mk.x += shiftX;
          mk.y += shiftY;
        }
      }
    }

    btnCanvasSize.textContent = `📐 ${WORLD_W}×${WORLD_H} ▾`;
    updateStageBadge();
    if (app.mode !== 'scenes') renderStage();
    else renderScenesView();
  }

  btnCanvasSize.onclick = (e) => {
    e.stopPropagation();
    exportMenu.classList.remove('open');
    sizeMenu.classList.toggle('open');
  };

  sizeMenu.querySelectorAll<HTMLButtonElement>('[data-res]').forEach((btn) => {
    btn.onclick = () => {
      const [w, h] = (btn.dataset.res || '1280x720').split('x').map(Number);
      setWorldResolution(w, h);
      sizeMenu.classList.remove('open');
    };
  });

  let hoverStagePt: Point2D | null = null;
  let isRightErasing = false;
  let hoverOriginGizmoPart: 'origin' | 'rotateHandle' | null = null;

  function resizeStageCanvas(): void {
    const w = Math.max(100, stageContainer.clientWidth);
    const h = Math.max(100, stageContainer.clientHeight);
    if (stage.width !== w || stage.height !== h) {
      stage.width = w;
      stage.height = h;
      ctx.imageSmoothingEnabled = false;
      renderStage();
    }
  }

  const stageRO = new ResizeObserver(() => resizeStageCanvas());
  stageRO.observe(stageContainer);

  function getFitScale(): number {
    return Math.min((stage.width - 36) / WORLD_W, (stage.height - 36) / WORLD_H);
  }

  function getTotalViewScale(): number {
    return getFitScale() * state.viewZoom;
  }

  function triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  btnExportMenu.onclick = (e) => {
    e.stopPropagation();
    sizeMenu.classList.remove('open');
    exportMenu.classList.toggle('open');
  };

  function toggleCameraPanel(forceState?: boolean): void {
    const show = typeof forceState === 'boolean' ? forceState : !camPopover.classList.contains('open');
    camPopover.classList.toggle('open', show);
  }

  mustEl<HTMLButtonElement>('btnCloseCamPanel').onclick = () => toggleCameraPanel(false);

  function getCelEntryInMap(celsMap: Map<number, Cel>, frame: number): { start: number; cel: Cel } | null {
    for (const [start, cel] of celsMap.entries()) {
      if (frame >= start && frame < start + cel.duration) {
        return { start, cel };
      }
    }
    return null;
  }

  function getCelEntryInScene(sc: Scene | NestedClip, frame: number): { start: number; cel: Cel } | null {
    return getCelEntryInMap(getActiveCelTrackInTarget(sc).cels, frame);
  }

  function getCelEntryAt(frame: number, celsMap: Map<number, Cel> = state.cels): { start: number; cel: Cel } | null {
    return getCelEntryInMap(celsMap, frame);
  }

  function getSortedCelStarts(celsMap: Map<number, Cel> = state.cels): number[] {
    return Array.from(celsMap.keys()).sort((a, b) => a - b);
  }

  function getPrevCelBefore(frame: number, celsMap: Map<number, Cel> = state.cels): { start: number; cel: Cel } | null {
    const starts = getSortedCelStarts(celsMap);
    let best: { start: number; cel: Cel } | null = null;
    for (const s of starts) {
      if (s < frame) {
        const cel = celsMap.get(s);
        if (cel) best = { start: s, cel };
      }
    }
    return best;
  }

  function getNextCelAfter(frame: number, celsMap: Map<number, Cel> = state.cels): { start: number; cel: Cel } | null {
    const starts = getSortedCelStarts(celsMap);
    for (const s of starts) {
      if (s > frame) {
        const cel = celsMap.get(s);
        if (cel) return { start: s, cel };
      }
    }
    return null;
  }

  function ensureCelAt(frame: number, clonePrev = false, celsMap: Map<number, Cel> = state.cels): { start: number; cel: Cel } {
    const existing = getCelEntryAt(frame, celsMap);
    if (existing) return existing;

    let canvas = createCelCanvas();
    let offsetX = 0;
    let offsetY = 0;
    let originX: number | undefined;
    let originY: number | undefined;
    let rotation: number | undefined;
    let scale: number | undefined;
    let hasInk = false;
    let nestId: string | undefined;
    let nestOriginFrame: number | undefined;

    if (clonePrev) {
      const prev = getPrevCelBefore(frame, celsMap);
      if (prev) {
        const endOff = getCelOffsetAtFrame(prev.cel, prev.start, prev.start + prev.cel.duration - 1);
        canvas = createCelCanvas(prev.cel.canvas.width, prev.cel.canvas.height);
        canvas.getContext('2d')?.drawImage(prev.cel.canvas, 0, 0);
        offsetX = Math.round(endOff.offsetX);
        offsetY = Math.round(endOff.offsetY);
        originX = prev.cel.originX;
        originY = prev.cel.originY;
        rotation = endOff.rotation === 0 && prev.cel.rotation === undefined ? undefined : endOff.rotation;
        scale = endOff.scale === 1 && prev.cel.scale === undefined ? undefined : endOff.scale;
        hasInk = prev.cel.hasInk;
        nestId = prev.cel.nestId;
        nestOriginFrame = prev.cel.nestOriginFrame;
      }
    }

    const cel: Cel = {
      canvas,
      undoStack: [],
      hasInk,
      duration: 1,
      offsetX,
      offsetY,
      originX,
      originY,
      rotation,
      scale,
      nestId,
      nestOriginFrame,
    };
    celsMap.set(frame, cel);
    return { start: frame, cel };
  }

  function clonePosKeys(keys?: CelPosKey[]): CelPosKey[] | undefined {
    if (!keys || keys.length === 0) return undefined;
    return keys.map((k) => ({ ...k }));
  }

  function sortPosKeys(cel: Cel | VectorCel): void {
    if (!cel.posKeys) return;
    cel.posKeys.sort((a, b) => a.relFrame - b.relFrame);
  }

  function evalSegmentPointWithCtrl(
    a: CelPosKey,
    b: CelPosKey,
    ctrlDx: number,
    ctrlDy: number,
    t: number
  ): { x: number; y: number } {
    const mx = (a.offsetX + b.offsetX) * 0.5;
    const my = (a.offsetY + b.offsetY) * 0.5;
    const cx = mx + ctrlDx;
    const cy = my + ctrlDy;
    const u = 1 - t;
    return {
      x: u * u * a.offsetX + 2 * u * t * cx + t * t * b.offsetX,
      y: u * u * a.offsetY + 2 * u * t * cy + t * t * b.offsetY,
    };
  }

  function evalSegmentPoint(a: CelPosKey, b: CelPosKey, t: number): { x: number; y: number } {
    return evalSegmentPointWithCtrl(a, b, a.ctrlDx ?? 0, a.ctrlDy ?? 0, t);
  }

  function getActivePosKeys(cel: Cel | VectorCel): CelPosKey[] {
    if (!cel.posKeys || cel.posKeys.length === 0) return [];
    const maxRel = Math.max(0, cel.duration - 1);
    return cel.posKeys.filter((k) => k.relFrame >= 0 && k.relFrame <= maxRel);
  }

  function getCelOffsetAtFrame(
    cel: Cel | VectorCel,
    celStart: number,
    frame: number
  ): { offsetX: number; offsetY: number; scale: number; rotation: number } {
    const baseScale = cel.scale ?? 1;
    const baseRot = cel.rotation || 0;
    const keys = getActivePosKeys(cel);
    if (keys.length === 0) return { offsetX: cel.offsetX, offsetY: cel.offsetY, scale: baseScale, rotation: baseRot };
    const maxRel = Math.max(0, cel.duration - 1);
    const relFrame = Math.max(0, Math.min(maxRel, frame - celStart));
    if (keys.length === 1 || relFrame <= keys[0].relFrame) {
      return {
        offsetX: keys[0].offsetX,
        offsetY: keys[0].offsetY,
        scale: keys[0].scale ?? baseScale,
        rotation: keys[0].rotation ?? baseRot,
      };
    }
    const last = keys[keys.length - 1];
    if (relFrame >= last.relFrame) {
      return {
        offsetX: last.offsetX,
        offsetY: last.offsetY,
        scale: last.scale ?? baseScale,
        rotation: last.rotation ?? baseRot,
      };
    }
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      if (relFrame >= a.relFrame && relFrame <= b.relFrame) {
        const sa = a.scale ?? baseScale;
        const sb = b.scale ?? baseScale;
        const ra = a.rotation ?? baseRot;
        const rb = b.rotation ?? baseRot;
        if (relFrame === a.relFrame || b.relFrame === a.relFrame) {
          return { offsetX: a.offsetX, offsetY: a.offsetY, scale: sa, rotation: ra };
        }
        if (relFrame === b.relFrame) {
          return { offsetX: b.offsetX, offsetY: b.offsetY, scale: sb, rotation: rb };
        }
        const t = (relFrame - a.relFrame) / (b.relFrame - a.relFrame);
        const pt = evalSegmentPoint(a, b, t);
        return {
          offsetX: pt.x,
          offsetY: pt.y,
          scale: sa + (sb - sa) * t,
          rotation: ra + (rb - ra) * t,
        };
      }
    }
    return { offsetX: cel.offsetX, offsetY: cel.offsetY, scale: baseScale, rotation: baseRot };
  }

  function pushTweenUndo(cel: Cel | VectorCel): void {
    const entry: TweenUndoEntry = {
      type: 'tween',
      offsetX: cel.offsetX,
      offsetY: cel.offsetY,
      posKeys: clonePosKeys(cel.posKeys),
      rotation: cel.rotation,
      scale: cel.scale,
      originX: cel.originX,
      originY: cel.originY,
    };
    cel.undoStack.push(entry as never);
    if (cel.undoStack.length > 25) cel.undoStack.shift();
  }

  type MotionPathHit =
    | { kind: 'key'; keyIndex: number }
    | { kind: 'curveHandle'; segIndex: number; t: number }
    | { kind: 'segment'; segIndex: number; t: number };

  let hoverMotionHit: MotionPathHit | null = null;
  let celAnchorCache = new WeakMap<
    Cel,
    { w: number; h: number; hasInk: boolean; nestId?: string; undoLen: number; ax: number; ay: number }
  >();
  let vectorAnchorCache = new WeakMap<
    VectorCel,
    { itemLen: number; hasInk: boolean; nestId?: string; undoLen: number; ax: number; ay: number }
  >();

  function computeCanvasInkCenter(canvas: HTMLCanvasElement): { ax: number; ay: number } | null {
    const cctx = canvas.getContext('2d');
    if (!cctx) return null;
    const w = canvas.width;
    const h = canvas.height;
    if (w <= 0 || h <= 0) return null;
    const data = cctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y += 4) {
      const row = y * w * 4;
      for (let x = 0; x < w; x += 4) {
        if (data[row + x * 4 + 3] > 8) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX || maxY < minY) return null;
    return { ax: (minX + maxX) * 0.5, ay: (minY + maxY) * 0.5 };
  }

  function getCelVisualAnchor(rootSc: Scene, cel: Cel): { ax: number; ay: number } {
    const cached = celAnchorCache.get(cel);
    if (
      cached &&
      cached.w === cel.canvas.width &&
      cached.h === cel.canvas.height &&
      cached.hasInk === cel.hasInk &&
      cached.nestId === cel.nestId &&
      cached.undoLen === cel.undoStack.length
    ) {
      return { ax: cached.ax, ay: cached.ay };
    }
    let center: { ax: number; ay: number } | null = null;
    if (cel.nestId) {
      const c = rasterizeNestedClipToWorldCanvas(rootSc, cel.nestId, cel.nestOriginFrame ?? 0, cel.nestOriginFrame ?? 0);
      center = computeCanvasInkCenter(c);
    } else if (cel.hasInk) {
      center = computeCanvasInkCenter(cel.canvas);
    }
    const ax = center ? center.ax : WORLD_W * 0.5;
    const ay = center ? center.ay : WORLD_H * 0.5;
    celAnchorCache.set(cel, {
      w: cel.canvas.width,
      h: cel.canvas.height,
      hasInk: cel.hasInk,
      nestId: cel.nestId,
      undoLen: cel.undoStack.length,
      ax,
      ay,
    });
    return { ax, ay };
  }

  function getVectorCelVisualAnchor(rootSc: Scene, vCel: VectorCel): { ax: number; ay: number } {
    const cached = vectorAnchorCache.get(vCel);
    if (
      cached &&
      cached.itemLen === vCel.items.length &&
      cached.hasInk === vCel.hasInk &&
      cached.nestId === vCel.nestId &&
      cached.undoLen === vCel.undoStack.length
    ) {
      return { ax: cached.ax, ay: cached.ay };
    }
    const center = computeVectorCelCenter(rootSc, vCel);
    vectorAnchorCache.set(vCel, {
      itemLen: vCel.items.length,
      hasInk: vCel.hasInk,
      nestId: vCel.nestId,
      undoLen: vCel.undoStack.length,
      ax: center.ax,
      ay: center.ay,
    });
    return center;
  }

  function hitTestLayerMotionPath(
    rootSc: Scene,
    layerKey: string,
    entry: { start: number; cel: Cel | VectorCel } | null,
    worldPt: Point2D,
    cam: CameraKey,
    totalViewScale: number
  ): MotionPathHit | null {
    if (!entry) return null;
    const keys = getActivePosKeys(entry.cel);
    if (keys.length < 2) return null;
    const pMat = getParentWorldMatrix(rootSc, activeTimelineTarget(), layerKey, state.currentFrame);
    const localWorldPt = isIdentityMat(pMat) ? worldPt : applyMatPt(invMat(pMat), worldPt);
    const fullKeys = entry.cel.posKeys || [];
    const { ax, ay } = layerKey.startsWith('vector:')
      ? getVectorCelVisualAnchor(rootSc, entry.cel as VectorCel)
      : getCelVisualAnchor(rootSc, entry.cel as Cel);
    const inv = 1 / (totalViewScale * (cam.scale / 100));
    const keyHitR = 11 * inv;
    const handleHitR = 10 * inv;
    const curveHitR = 9 * inv;

    const curRel = state.currentFrame - entry.start;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = keys.length - 1; i >= 0; i--) {
        const k = keys[i];
        if ((pass === 0) !== (k.relFrame === curRel)) continue;
        const kx = k.offsetX + ax;
        const ky = k.offsetY + ay;
        if (Math.hypot(localWorldPt.x - kx, localWorldPt.y - ky) <= keyHitR) {
          const fullIdx = fullKeys.indexOf(k);
          if (fullIdx >= 0) return { kind: 'key', keyIndex: fullIdx };
        }
      }
    }

    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      const mid = evalSegmentPoint(a, b, 0.5);
      const hx = mid.x + ax;
      const hy = mid.y + ay;
      if (Math.hypot(localWorldPt.x - hx, localWorldPt.y - hy) <= handleHitR) {
        const fullIdx = fullKeys.indexOf(a);
        if (fullIdx >= 0) return { kind: 'curveHandle', segIndex: fullIdx, t: 0.5 };
      }
    }

    let bestSegFullIdx = -1;
    let bestT = 0.5;
    let bestDist = curveHitR;
    const steps = 20;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i];
      const b = keys[i + 1];
      const fullIdx = fullKeys.indexOf(a);
      if (fullIdx < 0) continue;
      let prevPt = { x: a.offsetX + ax, y: a.offsetY + ay };
      for (let s = 1; s <= steps; s++) {
        const t1 = s / steps;
        const ev = evalSegmentPoint(a, b, t1);
        const curPt = { x: ev.x + ax, y: ev.y + ay };
        const d = distPointToSeg(localWorldPt, prevPt, curPt);
        if (d <= bestDist) {
          const abx = curPt.x - prevPt.x;
          const aby = curPt.y - prevPt.y;
          const len2 = abx * abx + aby * aby;
          const localU =
            len2 > 1e-6 ? Math.max(0, Math.min(1, ((localWorldPt.x - prevPt.x) * abx + (localWorldPt.y - prevPt.y) * aby) / len2)) : 0.5;
          const t0 = (s - 1) / steps;
          bestDist = d;
          bestSegFullIdx = fullIdx;
          bestT = Math.max(0.18, Math.min(0.82, t0 + (t1 - t0) * localU));
        }
        prevPt = curPt;
      }
    }
    if (bestSegFullIdx >= 0) {
      return { kind: 'segment', segIndex: bestSegFullIdx, t: bestT };
    }
    return null;
  }

  function cloneVectorPoint(p: Point2D): Point2D {
    return p.corner ? { x: p.x, y: p.y, corner: true } : { x: p.x, y: p.y };
  }

  function cloneVectorItems(items: VectorItem[]): VectorItem[] {
    return items.map((item) => {
      if (item.kind === 'fill') {
        return {
          kind: 'fill',
          contours: item.contours.map((loop) => loop.map(cloneVectorPoint)),
          color: item.color,
          isErase: item.isErase,
        };
      }
      if (item.kind === 'erase') {
        return {
          kind: 'erase',
          points: item.points.map(cloneVectorPoint),
          size: item.size,
        };
      }
      return {
        kind: 'stroke',
        points: item.points.map(cloneVectorPoint),
        color: item.color,
        size: item.size,
      };
    });
  }

  function getVectorCelEntryInMap(celsMap: Map<number, VectorCel>, frame: number): { start: number; cel: VectorCel } | null {
    for (const [start, cel] of celsMap.entries()) {
      if (frame >= start && frame < start + cel.duration) {
        return { start, cel };
      }
    }
    return null;
  }

  function getVectorCelEntryInScene(sc: Scene | NestedClip, frame: number): { start: number; cel: VectorCel } | null {
    return getVectorCelEntryInMap(getActiveVectorTrackInTarget(sc).cels, frame);
  }

  function getVectorCelEntryAt(frame: number, celsMap: Map<number, VectorCel> = state.vectorCels): { start: number; cel: VectorCel } | null {
    return getVectorCelEntryInMap(celsMap, frame);
  }

  function getSortedVectorCelStarts(celsMap: Map<number, VectorCel> = state.vectorCels): number[] {
    return Array.from(celsMap.keys()).sort((a, b) => a - b);
  }

  function getPrevVectorCelBefore(frame: number, celsMap: Map<number, VectorCel> = state.vectorCels): { start: number; cel: VectorCel } | null {
    const starts = getSortedVectorCelStarts(celsMap);
    let best: { start: number; cel: VectorCel } | null = null;
    for (const s of starts) {
      if (s < frame) {
        const cel = celsMap.get(s);
        if (cel) best = { start: s, cel };
      }
    }
    return best;
  }

  function getNextVectorCelAfter(frame: number, celsMap: Map<number, VectorCel> = state.vectorCels): { start: number; cel: VectorCel } | null {
    const starts = getSortedVectorCelStarts(celsMap);
    for (const s of starts) {
      if (s > frame) {
        const cel = celsMap.get(s);
        if (cel) return { start: s, cel };
      }
    }
    return null;
  }

  function ensureVectorCelAt(frame: number, clonePrev = false, celsMap: Map<number, VectorCel> = state.vectorCels): { start: number; cel: VectorCel } {
    const existing = getVectorCelEntryAt(frame, celsMap);
    if (existing) return existing;

    let items: VectorItem[] = [];
    let offsetX = 0;
    let offsetY = 0;
    let originX: number | undefined;
    let originY: number | undefined;
    let rotation: number | undefined;
    let scale: number | undefined;
    let hasInk = false;
    let nestId: string | undefined;
    let nestOriginFrame: number | undefined;

    if (clonePrev) {
      const prev = getPrevVectorCelBefore(frame, celsMap);
      if (prev) {
        const endOff = getCelOffsetAtFrame(prev.cel, prev.start, prev.start + prev.cel.duration - 1);
        items = cloneVectorItems(prev.cel.items);
        offsetX = Math.round(endOff.offsetX);
        offsetY = Math.round(endOff.offsetY);
        originX = prev.cel.originX;
        originY = prev.cel.originY;
        rotation = endOff.rotation === 0 && prev.cel.rotation === undefined ? undefined : endOff.rotation;
        scale = endOff.scale === 1 && prev.cel.scale === undefined ? undefined : endOff.scale;
        hasInk = prev.cel.hasInk;
        nestId = prev.cel.nestId;
        nestOriginFrame = prev.cel.nestOriginFrame;
      }
    }

    const cel: VectorCel = {
      items,
      undoStack: [],
      hasInk,
      duration: 1,
      offsetX,
      offsetY,
      originX,
      originY,
      rotation,
      scale,
      nestId,
      nestOriginFrame,
    };
    celsMap.set(frame, cel);
    return { start: frame, cel };
  }

  function pushVectorItemsUndo(vCel: VectorCel): void {
    vCel.undoStack.push({
      type: 'items',
      items: cloneVectorItems(vCel.items),
      hasInk: vCel.hasInk,
      offsetX: vCel.offsetX,
      offsetY: vCel.offsetY,
      posKeys: clonePosKeys(vCel.posKeys),
      rotation: vCel.rotation,
      scale: vCel.scale,
      originX: vCel.originX,
      originY: vCel.originY,
    });
    if (vCel.undoStack.length > 25) vCel.undoStack.shift();
  }

  function pushVectorMoveUndo(vCel: VectorCel, offsetX: number, offsetY: number): void {
    vCel.undoStack.push({
      type: 'move',
      offsetX,
      offsetY,
      rotation: vCel.rotation,
      scale: vCel.scale,
      originX: vCel.originX,
      originY: vCel.originY,
    });
    if (vCel.undoStack.length > 25) vCel.undoStack.shift();
  }

  function ensureLayerCoversFrame(layerObj: Cel | BgLayer): void {
    const cw = layerObj.canvas.width;
    const ch = layerObj.canvas.height;
    const ox = layerObj.offsetX;
    const oy = layerObj.offsetY;

    const newOx = Math.min(ox, 0);
    const newOy = Math.min(oy, 0);
    const newMaxX = Math.max(ox + cw, WORLD_W);
    const newMaxY = Math.max(oy + ch, WORLD_H);
    const newW = Math.min(8192, newMaxX - newOx);
    const newH = Math.min(8192, newMaxY - newOy);

    if (newW === cw && newH === ch && newOx === ox && newOy === oy) return;

    const shiftCanvasX = ox - newOx;
    const shiftCanvasY = oy - newOy;
    const nextCanvas = createCelCanvas(newW, newH);
    const nctx = nextCanvas.getContext('2d');
    if (nctx) {
      nctx.imageSmoothingEnabled = false;
      nctx.drawImage(layerObj.canvas, shiftCanvasX, shiftCanvasY);
    }

    layerObj.canvas = nextCanvas;
    layerObj.offsetX = newOx;
    layerObj.offsetY = newOy;
    if (typeof layerObj.originX === 'number') layerObj.originX += shiftCanvasX;
    if (typeof layerObj.originY === 'number') layerObj.originY += shiftCanvasY;
    if ('posKeys' in layerObj && layerObj.posKeys) {
      shiftPosKeys(layerObj.posKeys, -shiftCanvasX, -shiftCanvasY);
    }
  }

  function pushPixelUndo(layerObj: Cel | BgLayer | Viseme, fixedDims = false): void {
    const cctx = layerObj.canvas.getContext('2d');
    if (!cctx) return;
    const w = layerObj.canvas.width;
    const h = layerObj.canvas.height;
    const ox = 'offsetX' in layerObj ? layerObj.offsetX : 0;
    const oy = 'offsetY' in layerObj ? layerObj.offsetY : 0;
    layerObj.undoStack.push({
      type: 'pixels',
      imgData: cctx.getImageData(0, 0, w, h),
      w,
      h,
      offsetX: fixedDims ? 0 : ox,
      offsetY: fixedDims ? 0 : oy,
    });
    if (layerObj.undoStack.length > 20) layerObj.undoStack.shift();
  }

  function pushMoveUndo(layerObj: Cel | BgLayer, offsetX: number, offsetY: number): void {
    layerObj.undoStack.push({
      type: 'move',
      offsetX,
      offsetY,
      rotation: layerObj.rotation,
      scale: layerObj.scale,
      originX: layerObj.originX,
      originY: layerObj.originY,
    });
    if (layerObj.undoStack.length > 25) layerObj.undoStack.shift();
  }

  function worldToLayerLocal(
    worldPt: Point2D,
    offsetX: number,
    offsetY: number,
    ox: number,
    oy: number,
    rotation = 0,
    scale = 1
  ): Point2D {
    const dx = worldPt.x - (offsetX + ox);
    const dy = worldPt.y - (offsetY + oy);
    const c = rotation ? Math.cos(-rotation) : 1;
    const s = rotation ? Math.sin(-rotation) : 0;
    const rx = dx * c - dy * s;
    const ry = dx * s + dy * c;
    const invSc = scale !== 0 ? 1 / scale : 1;
    return { x: rx * invSc + ox, y: ry * invSc + oy };
  }

  function computeVectorCelCenter(rootSc: Scene, vCel: VectorCel): { ax: number; ay: number } {
    if (vCel.nestId) {
      const c = rasterizeNestedClipToWorldCanvas(rootSc, vCel.nestId, vCel.nestOriginFrame ?? 0, vCel.nestOriginFrame ?? 0);
      const center = computeCanvasInkCenter(c);
      if (center) return center;
    }
    if (vCel.items.length > 0) {
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const item of vCel.items) {
        if (item.kind === 'fill') {
          if (item.isErase) continue;
          for (const loop of item.contours) {
            for (const p of loop) {
              if (p.x < minX) minX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.x > maxX) maxX = p.x;
              if (p.y > maxY) maxY = p.y;
            }
          }
        } else if (item.kind === 'stroke') {
          for (const p of item.points) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }
        }
      }
      if (maxX >= minX && maxY >= minY) {
        return { ax: (minX + maxX) * 0.5, ay: (minY + maxY) * 0.5 };
      }
    }
    return { ax: WORLD_W * 0.5, ay: WORLD_H * 0.5 };
  }

  function getLayerPivotLocal(
    rootSc: Scene,
    layer: 'cel' | 'vector' | 'bg',
    obj: Cel | VectorCel | BgLayer
  ): { ox: number; oy: number } {
    if (typeof obj.originX === 'number' && typeof obj.originY === 'number') {
      return { ox: obj.originX, oy: obj.originY };
    }
    if (layer === 'cel') {
      const a = getCelVisualAnchor(rootSc, obj as Cel);
      return { ox: a.ax, oy: a.ay };
    }
    if (layer === 'vector') {
      const a = computeVectorCelCenter(rootSc, obj as VectorCel);
      return { ox: a.ax, oy: a.ay };
    }
    const bg = obj as BgLayer;
    if (bg.hasInk) {
      const c = computeCanvasInkCenter(bg.canvas);
      if (c) return { ox: c.ax, oy: c.ay };
    }
    return { ox: WORLD_W * 0.5, oy: WORLD_H * 0.5 };
  }

  function applyLayerOriginChange(
    layer: 'cel' | 'vector' | 'bg',
    obj: Cel | VectorCel | BgLayer,
    oldOx: number,
    oldOy: number,
    newOx: number,
    newOy: number
  ): void {
    const dx = newOx - oldOx;
    const dy = newOy - oldOy;
    const computeShift = (rot: number, sc: number): { sx: number; sy: number } => {
      if (rot === 0 && sc === 1) return { sx: 0, sy: 0 };
      const c = Math.cos(rot) * sc;
      const s = Math.sin(rot) * sc;
      return { sx: -dx + (dx * c - dy * s), sy: -dy + (dx * s + dy * c) };
    };
    const baseRot = obj.rotation || 0;
    const baseSc = obj.scale ?? 1;
    const baseShift = computeShift(baseRot, baseSc);
    obj.offsetX += baseShift.sx;
    obj.offsetY += baseShift.sy;
    if ((layer === 'cel' || layer === 'vector') && 'posKeys' in obj && obj.posKeys) {
      for (const k of obj.posKeys) {
        const kShift = computeShift(k.rotation ?? baseRot, k.scale ?? baseSc);
        k.offsetX += kShift.sx;
        k.offsetY += kShift.sy;
      }
    }
    obj.originX = newOx;
    obj.originY = newOy;
  }

  type Mat2D = [number, number, number, number, number, number];
  const MAT_ID: Mat2D = [1, 0, 0, 1, 0, 0];

  function isIdentityMat(m: Mat2D): boolean {
    return (
      Math.abs(m[0] - 1) < 1e-6 &&
      Math.abs(m[1]) < 1e-6 &&
      Math.abs(m[2]) < 1e-6 &&
      Math.abs(m[3] - 1) < 1e-6 &&
      Math.abs(m[4]) < 1e-6 &&
      Math.abs(m[5]) < 1e-6
    );
  }

  function mulMat(m1: Mat2D, m2: Mat2D): Mat2D {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
    ];
  }

  function invMat(m: Mat2D): Mat2D {
    const det = m[0] * m[3] - m[1] * m[2];
    if (Math.abs(det) < 1e-10) return [...MAT_ID] as Mat2D;
    const invDet = 1 / det;
    return [
      m[3] * invDet,
      -m[1] * invDet,
      -m[2] * invDet,
      m[0] * invDet,
      (m[2] * m[5] - m[3] * m[4]) * invDet,
      (m[1] * m[4] - m[0] * m[5]) * invDet,
    ];
  }

  function applyMatPt(m: Mat2D, pt: Point2D): Point2D {
    return {
      x: m[0] * pt.x + m[2] * pt.y + m[4],
      y: m[1] * pt.x + m[3] * pt.y + m[5],
    };
  }

  function applyMatVec(m: Mat2D, dx: number, dy: number): Point2D {
    return {
      x: m[0] * dx + m[2] * dy,
      y: m[1] * dx + m[3] * dy,
    };
  }

  function makeLayerLocalTransform(
    offsetX: number,
    offsetY: number,
    ox: number,
    oy: number,
    rotation: number,
    scale = 1
  ): Mat2D {
    if (!rotation && scale === 1) {
      return [1, 0, 0, 1, offsetX, offsetY];
    }
    const cs = Math.cos(rotation) * scale;
    const sn = Math.sin(rotation) * scale;
    return [cs, sn, -sn, cs, offsetX + ox - cs * ox + sn * oy, offsetY + oy - sn * ox - cs * oy];
  }

  function normalizeTargetHierarchy(target: Scene | NestedClip): void {
    const isScene = 'mouthLayers' in target;
    const mouthKeys = isScene ? target.mouthLayers.map((m) => `mouth:${m.id}`) : [];
    const vecKeys = target.vectorTracks.map((t) => `vector:${t.id}`);
    const celKeys = target.celTracks.map((t) => `cel:${t.id}`);
    const bgKeys = isScene ? target.bgLayers.map((b) => `bg:${b.id}`) : [];
    const validSet = new Set<string>([...mouthKeys, ...vecKeys, ...celKeys, ...bgKeys]);

    const mapLegacyKey = (k: string): string => {
      if (k === 'cel' && celKeys[0]) return celKeys[0];
      if (k === 'bg' && isScene && bgKeys[0]) return bgKeys[0];
      if (k === 'mouth' && isScene && mouthKeys[0]) return mouthKeys[0];
      return k;
    };

    if (!Array.isArray(target.layerOrder)) target.layerOrder = [];
    const seen = new Set<string>();
    const nextOrder: string[] = [];
    for (const rawK of target.layerOrder) {
      const k = mapLegacyKey(rawK);
      if (validSet.has(k) && !seen.has(k)) {
        seen.add(k);
        nextOrder.push(k);
      }
    }
    if (isScene) {
      for (const mk of mouthKeys) {
        if (!seen.has(mk)) {
          nextOrder.unshift(mk);
          seen.add(mk);
        }
      }
    }
    for (const vk of vecKeys) {
      if (!seen.has(vk)) {
        const firstCelIdx = nextOrder.findIndex((k) => k.startsWith('cel:'));
        if (firstCelIdx >= 0) nextOrder.splice(firstCelIdx, 0, vk);
        else nextOrder.push(vk);
        seen.add(vk);
      }
    }
    for (const ck of celKeys) {
      if (!seen.has(ck)) {
        const firstBgIdx = nextOrder.findIndex((k) => k.startsWith('bg:'));
        if (firstBgIdx >= 0) nextOrder.splice(firstBgIdx, 0, ck);
        else nextOrder.push(ck);
        seen.add(ck);
      }
    }
    if (isScene) {
      for (const bk of bgKeys) {
        if (!seen.has(bk)) {
          nextOrder.push(bk);
          seen.add(bk);
        }
      }
    }
    target.layerOrder = nextOrder;

    // Keep track arrays aligned with visual order
    const vecMap = new Map(target.vectorTracks.map((t) => [t.id, t]));
    const orderedVecs: VectorTrack[] = [];
    for (const k of nextOrder) {
      if (k.startsWith('vector:')) {
        const trk = vecMap.get(k.slice(7));
        if (trk) orderedVecs.push(trk);
      }
    }
    if (orderedVecs.length === target.vectorTracks.length) target.vectorTracks = orderedVecs;

    const celMap = new Map(target.celTracks.map((t) => [t.id, t]));
    const orderedCels: CelTrack[] = [];
    for (const k of nextOrder) {
      if (k.startsWith('cel:')) {
        const trk = celMap.get(k.slice(4));
        if (trk) orderedCels.push(trk);
      }
    }
    if (orderedCels.length === target.celTracks.length) target.celTracks = orderedCels;

    if (isScene) {
      const bgMap = new Map(target.bgLayers.map((b) => [b.id, b]));
      const orderedBgs: BgLayer[] = [];
      for (const k of nextOrder) {
        if (k.startsWith('bg:')) {
          const b = bgMap.get(k.slice(3));
          if (b) orderedBgs.push(b);
        }
      }
      if (orderedBgs.length === target.bgLayers.length) target.bgLayers = orderedBgs;

      const mMap = new Map(target.mouthLayers.map((m) => [m.id, m]));
      const orderedMs: MouthLayer[] = [];
      for (const k of nextOrder) {
        if (k.startsWith('mouth:')) {
          const m = mMap.get(k.slice(6));
          if (m) orderedMs.push(m);
        }
      }
      if (orderedMs.length === target.mouthLayers.length) target.mouthLayers = orderedMs;
    }

    if (!target.layerParents) target.layerParents = {};
    const nextParents: Record<string, string | null> = {};
    for (const rawK of Object.keys(target.layerParents)) {
      const k = mapLegacyKey(rawK);
      const rawP = target.layerParents[rawK];
      const p = rawP ? mapLegacyKey(rawP) : null;
      if (validSet.has(k) && p && validSet.has(p) && p !== k) {
        nextParents[k] = p;
      }
    }
    target.layerParents = nextParents;

    // Break any accidental cycles
    for (const k of nextOrder) {
      const visited = new Set<string>([k]);
      let cur = target.layerParents[k] || null;
      while (cur) {
        if (visited.has(cur)) {
          delete target.layerParents[k];
          break;
        }
        visited.add(cur);
        cur = target.layerParents[cur] || null;
      }
    }

    const hasChildSet = new Set<string>();
    for (const k of Object.keys(target.layerParents)) {
      const p = target.layerParents[k];
      if (p) hasChildSet.add(p);
    }
    if (!target.layerIK) target.layerIK = {};
    const nextIK: Record<string, boolean> = {};
    for (const rawK of Object.keys(target.layerIK)) {
      const k = mapLegacyKey(rawK);
      if (target.layerIK[rawK] && validSet.has(k) && (target.layerParents[k] || hasChildSet.has(k))) {
        nextIK[k] = true;
      }
    }
    target.layerIK = nextIK;
  }

  function getLayerDepth(target: Scene | NestedClip, key: string): number {
    let depth = 0;
    const visited = new Set<string>([key]);
    let cur = target.layerParents?.[key] || null;
    while (cur && !visited.has(cur) && depth < 16) {
      visited.add(cur);
      depth++;
      cur = target.layerParents?.[cur] || null;
    }
    return depth;
  }

  function isLayerDescendant(target: Scene | NestedClip, ancestorKey: string, candidateKey: string): boolean {
    if (ancestorKey === candidateKey) return true;
    const visited = new Set<string>([candidateKey]);
    let cur = target.layerParents?.[candidateKey] || null;
    while (cur && !visited.has(cur)) {
      if (cur === ancestorKey) return true;
      visited.add(cur);
      cur = target.layerParents?.[cur] || null;
    }
    return false;
  }

  function getLayerDisplayName(target: Scene | NestedClip, key: string): string {
    if (key.startsWith('vector:')) {
      return target.vectorTracks.find((t) => t.id === key.slice(7))?.name || 'Vector';
    }
    if (key.startsWith('cel:') || key === 'cel') {
      const id = key.startsWith('cel:') ? key.slice(4) : target.activeCelTrackId;
      return target.celTracks.find((t) => t.id === id)?.name || 'Bitmap';
    }
    if ('bgLayers' in target && (key.startsWith('bg:') || key === 'bg')) {
      const id = key.startsWith('bg:') ? key.slice(3) : target.activeBgLayerId;
      return target.bgLayers.find((b) => b.id === id)?.trackName || 'Background';
    }
    if ('mouthLayers' in target && (key.startsWith('mouth:') || key === 'mouth')) {
      const id = key.startsWith('mouth:') ? key.slice(6) : target.activeMouthLayerId;
      return target.mouthLayers.find((m) => m.id === id)?.name || 'Picker';
    }
    if (key.startsWith('audio:')) {
      return activeScene().audioTracks.find((a) => a.id === key.slice(6))?.name || 'Sound';
    }
    if (key === 'cam') return 'Camera';
    return key;
  }

  function setLayerDisplayName(target: Scene | NestedClip, key: string, newName: string): void {
    const clean = newName.trim();
    if (!clean) return;
    if (key.startsWith('vector:')) {
      const trk = target.vectorTracks.find((t) => t.id === key.slice(7));
      if (trk) trk.name = clean;
    } else if (key.startsWith('cel:') || key === 'cel') {
      const id = key.startsWith('cel:') ? key.slice(4) : target.activeCelTrackId;
      const trk = target.celTracks.find((t) => t.id === id);
      if (trk) trk.name = clean;
    } else if ('bgLayers' in target && (key.startsWith('bg:') || key === 'bg')) {
      const id = key.startsWith('bg:') ? key.slice(3) : target.activeBgLayerId;
      const bg = target.bgLayers.find((b) => b.id === id);
      if (bg) bg.trackName = clean;
    } else if ('mouthLayers' in target && (key.startsWith('mouth:') || key === 'mouth')) {
      const id = key.startsWith('mouth:') ? key.slice(6) : target.activeMouthLayerId;
      const ml = target.mouthLayers.find((m) => m.id === id);
      if (ml) ml.name = clean;
    } else if (key.startsWith('audio:')) {
      const trk = activeScene().audioTracks.find((a) => a.id === key.slice(6));
      if (trk) trk.name = clean;
    }
  }

  function getLayerKeyForActive(target: Scene | NestedClip): string {
    if (state.activeLayer === 'vector') return `vector:${getActiveVectorTrackInTarget(target).id}`;
    if (state.activeLayer === 'cel') return `cel:${getActiveCelTrackInTarget(target).id}`;
    if ('bgLayers' in target && state.activeLayer === 'bg') return `bg:${getActiveBgLayerInScene(target).id}`;
    if ('mouthLayers' in target && state.activeLayer === 'mouth') return `mouth:${getActiveMouthLayerInScene(target).id}`;
    return `cel:${getActiveCelTrackInTarget(target).id}`;
  }

  function getLayerOwnTransformMatrix(
    rootSc: Scene,
    target: Scene | NestedClip,
    layerKey: string,
    frame: number
  ): Mat2D {
    if (layerKey.startsWith('cel:')) {
      const trk = target.celTracks.find((t) => t.id === layerKey.slice(4));
      if (!trk) return MAT_ID;
      const entry = getCelEntryInMap(trk.cels, frame);
      if (!entry) return MAT_ID;
      const off = getCelOffsetAtFrame(entry.cel, entry.start, frame);
      const rot = off.rotation;
      const sc = off.scale;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'cel', entry.cel) : { ox: 0, oy: 0 };
      return makeLayerLocalTransform(off.offsetX, off.offsetY, piv.ox, piv.oy, rot, sc);
    }
    if (layerKey.startsWith('vector:')) {
      const trk = target.vectorTracks.find((t) => t.id === layerKey.slice(7));
      if (!trk) return MAT_ID;
      const vEntry = getVectorCelEntryInMap(trk.cels, frame);
      if (!vEntry) return MAT_ID;
      const off = getCelOffsetAtFrame(vEntry.cel, vEntry.start, frame);
      const rot = off.rotation;
      const sc = off.scale;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'vector', vEntry.cel) : { ox: 0, oy: 0 };
      return makeLayerLocalTransform(off.offsetX, off.offsetY, piv.ox, piv.oy, rot, sc);
    }
    if (layerKey.startsWith('bg:') && 'bgLayers' in target) {
      const bg = target.bgLayers.find((b) => b.id === layerKey.slice(3));
      if (!bg) return MAT_ID;
      const rot = bg.rotation || 0;
      const sc = bg.scale ?? 1;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'bg', bg) : { ox: 0, oy: 0 };
      return makeLayerLocalTransform(bg.offsetX, bg.offsetY, piv.ox, piv.oy, rot, sc);
    }
    if (layerKey.startsWith('mouth:') && 'mouthLayers' in target) {
      const ml = target.mouthLayers.find((m) => m.id === layerKey.slice(6));
      if (!ml) return MAT_ID;
      const m = getEvaluatedMouthInScene(rootSc, frame, ml);
      if (!m) return MAT_ID;
      const restX = Math.round(WORLD_W / 2);
      const restY = Math.round(WORLD_H * 0.56);
      const odx = m.originDx || 0;
      const ody = m.originDy || 0;
      return makeLayerLocalTransform(m.x - restX, m.y - restY, restX + odx, restY + ody, m.rotation || 0, 1);
    }
    return MAT_ID;
  }

  function getParentWorldMatrix(
    rootSc: Scene,
    target: Scene | NestedClip,
    layerKey: string,
    frame: number
  ): Mat2D {
    const chain: string[] = [];
    const visited = new Set<string>([layerKey]);
    let cur = target.layerParents?.[layerKey] || null;
    while (cur && !visited.has(cur) && chain.length < 16) {
      visited.add(cur);
      chain.push(cur);
      cur = target.layerParents?.[cur] || null;
    }
    if (chain.length === 0) return MAT_ID;
    let mat: Mat2D = MAT_ID;
    for (let i = chain.length - 1; i >= 0; i--) {
      const lm = getLayerOwnTransformMatrix(rootSc, target, chain[i], frame);
      if (!isIdentityMat(lm)) mat = mulMat(mat, lm);
    }
    return mat;
  }

  function setLayerParentKeepWorld(
    rootSc: Scene,
    target: Scene | NestedClip,
    childKey: string,
    newParentKey: string | null,
    frame: number
  ): boolean {
    normalizeTargetHierarchy(target);
    if (newParentKey && isLayerDescendant(target, childKey, newParentKey)) return false;
    const oldParentKey = target.layerParents[childKey] || null;
    if (oldParentKey === newParentKey) return true;

    const oldParentMat = getParentWorldMatrix(rootSc, target, childKey, frame);
    if (newParentKey) target.layerParents[childKey] = newParentKey;
    else {
      delete target.layerParents[childKey];
      if (target.layerIK) delete target.layerIK[childKey];
    }
    const newParentMat = getParentWorldMatrix(rootSc, target, childKey, frame);
    const deltaMat = mulMat(invMat(newParentMat), oldParentMat);

    if (!isIdentityMat(deltaMat)) {
      if (childKey.startsWith('cel:')) {
        const cTrk = target.celTracks.find((t) => t.id === childKey.slice(4));
        const entry = cTrk ? getCelEntryInMap(cTrk.cels, frame) : null;
        if (entry) {
          const cel = entry.cel;
          const piv = getLayerPivotLocal(rootSc, 'cel', cel);
          const off = getCelOffsetAtFrame(cel, entry.start, frame);
          const mOld = makeLayerLocalTransform(off.offsetX, off.offsetY, piv.ox, piv.oy, off.rotation, off.scale);
          const mNew = mulMat(deltaMat, mOld);
          const pPiv = applyMatPt(mNew, { x: piv.ox, y: piv.oy });
          const nextOffX = Math.round((pPiv.x - piv.ox) * 10) / 10;
          const nextOffY = Math.round((pPiv.y - piv.oy) * 10) / 10;
          const nextRot = Math.atan2(mNew[1], mNew[0]);
          const rotDelta = nextRot - off.rotation;
          const nextSc = Math.round(Math.hypot(mNew[0], mNew[1]) * 1000) / 1000;
          const finalSc = Math.abs(nextSc - 1) < 0.002 ? 1 : nextSc;
          cel.scale = finalSc;
          if (cel.posKeys && cel.posKeys.length > 0) {
            const dx = nextOffX - off.offsetX;
            const dy = nextOffY - off.offsetY;
            const scaleRatio = off.scale !== 0 ? finalSc / off.scale : 1;
            for (const k of cel.posKeys) {
              k.offsetX += dx;
              k.offsetY += dy;
              if (scaleRatio !== 1) k.scale = Math.round(((k.scale ?? off.scale) * scaleRatio) * 1000) / 1000;
              if (Math.abs(rotDelta) > 1e-5) k.rotation = (k.rotation ?? (cel.rotation || 0)) + rotDelta;
            }
            cel.offsetX += dx;
            cel.offsetY += dy;
            cel.rotation = (cel.rotation || 0) + rotDelta;
          } else {
            cel.offsetX = nextOffX;
            cel.offsetY = nextOffY;
            cel.rotation = nextRot;
          }
        }
      } else if (childKey.startsWith('vector:')) {
        const trk = target.vectorTracks.find((t) => t.id === childKey.slice(7));
        const vEntry = trk ? getVectorCelEntryInMap(trk.cels, frame) : null;
        if (vEntry) {
          const vCel = vEntry.cel;
          const piv = getLayerPivotLocal(rootSc, 'vector', vCel);
          const off = getCelOffsetAtFrame(vCel, vEntry.start, frame);
          const mOld = makeLayerLocalTransform(off.offsetX, off.offsetY, piv.ox, piv.oy, off.rotation, off.scale);
          const mNew = mulMat(deltaMat, mOld);
          const pPiv = applyMatPt(mNew, { x: piv.ox, y: piv.oy });
          const nextOffX = Math.round((pPiv.x - piv.ox) * 10) / 10;
          const nextOffY = Math.round((pPiv.y - piv.oy) * 10) / 10;
          const nextRot = Math.atan2(mNew[1], mNew[0]);
          const rotDelta = nextRot - off.rotation;
          const nextSc = Math.round(Math.hypot(mNew[0], mNew[1]) * 1000) / 1000;
          const finalSc = Math.abs(nextSc - 1) < 0.002 ? 1 : nextSc;
          vCel.scale = finalSc;
          if (vCel.posKeys && vCel.posKeys.length > 0) {
            const dx = nextOffX - off.offsetX;
            const dy = nextOffY - off.offsetY;
            const scaleRatio = off.scale !== 0 ? finalSc / off.scale : 1;
            for (const k of vCel.posKeys) {
              k.offsetX += dx;
              k.offsetY += dy;
              if (scaleRatio !== 1) k.scale = Math.round(((k.scale ?? off.scale) * scaleRatio) * 1000) / 1000;
              if (Math.abs(rotDelta) > 1e-5) k.rotation = (k.rotation ?? (vCel.rotation || 0)) + rotDelta;
            }
            vCel.offsetX += dx;
            vCel.offsetY += dy;
            vCel.rotation = (vCel.rotation || 0) + rotDelta;
          } else {
            vCel.offsetX = nextOffX;
            vCel.offsetY = nextOffY;
            vCel.rotation = nextRot;
          }
        }
      } else if (childKey.startsWith('bg:') && 'bgLayers' in target) {
        const bg = target.bgLayers.find((b) => b.id === childKey.slice(3));
        if (bg) {
          const piv = getLayerPivotLocal(rootSc, 'bg', bg);
          const mOld = makeLayerLocalTransform(bg.offsetX, bg.offsetY, piv.ox, piv.oy, bg.rotation || 0, bg.scale ?? 1);
          const mNew = mulMat(deltaMat, mOld);
          const pPiv = applyMatPt(mNew, { x: piv.ox, y: piv.oy });
          bg.offsetX = Math.round((pPiv.x - piv.ox) * 10) / 10;
          bg.offsetY = Math.round((pPiv.y - piv.oy) * 10) / 10;
          bg.rotation = Math.atan2(mNew[1], mNew[0]);
          const nextSc = Math.round(Math.hypot(mNew[0], mNew[1]) * 1000) / 1000;
          bg.scale = Math.abs(nextSc - 1) < 0.002 ? 1 : nextSc;
        }
      } else if (childKey.startsWith('mouth:') && 'mouthLayers' in target) {
        const ml = target.mouthLayers.find((m) => m.id === childKey.slice(6));
        const m = ml ? getEvaluatedMouthInScene(rootSc, frame, ml) : null;
        if (ml && m) {
          const odx = m.originDx || 0;
          const ody = m.originDy || 0;
          const pivPt = applyMatPt(deltaMat, { x: m.x + odx, y: m.y + ody });
          const nextRot = (m.rotation || 0) + Math.atan2(deltaMat[1], deltaMat[0]);
          ml.keys.set(frame, {
            viseme: m.viseme,
            x: Math.round(pivPt.x - odx),
            y: Math.round(pivPt.y - ody),
            scale: m.scale,
            originDx: m.originDx,
            originDy: m.originDy,
            rotation: nextRot,
          });
        }
      }
    }

    if (newParentKey) {
      // Position child block immediately below newParentKey (after existing descendants of newParentKey)
      const block = getContiguousLayerSubtree(target, childKey);
      const remaining = target.layerOrder.filter((k) => !block.includes(k));
      const pIdx = remaining.indexOf(newParentKey);
      if (pIdx >= 0) {
        let insertAt = pIdx + 1;
        while (insertAt < remaining.length && isLayerDescendant(target, newParentKey, remaining[insertAt])) {
          insertAt++;
        }
        remaining.splice(insertAt, 0, ...block);
        target.layerOrder = remaining;
      }
    }
    normalizeTargetHierarchy(target);
    return true;
  }

  function getContiguousLayerSubtree(target: Scene | NestedClip, rootKey: string): string[] {
    normalizeTargetHierarchy(target);
    const startIdx = target.layerOrder.indexOf(rootKey);
    if (startIdx < 0) return [rootKey];
    const block = [rootKey];
    for (let i = startIdx + 1; i < target.layerOrder.length; i++) {
      const k = target.layerOrder[i];
      if (isLayerDescendant(target, rootKey, k)) block.push(k);
      else break;
    }
    return block;
  }

  interface IKJointRuntime {
    layerKey: string;
    layerType: 'cel' | 'vector' | 'bg' | 'mouth';
    celObj: Cel | VectorCel | BgLayer | null;
    mouthLayer?: MouthLayer;
    ox: number;
    oy: number;
    offsetX: number;
    offsetY: number;
    startOffsetX: number;
    startOffsetY: number;
    entryStart?: number;
    prevPosKeys?: CelPosKey[];
    scale: number;
    rot: number;
    startRot: number;
    prevOriginX?: number;
    prevOriginY?: number;
    mouthPrevKey?: MouthKey | null;
  }

  function getIKChainForLayer(target: Scene | NestedClip, endKey: string): string[] {
    if (!target.layerParents?.[endKey]) return [];
    const childCount = new Map<string, number>();
    for (const k of Object.keys(target.layerParents)) {
      const p = target.layerParents[k];
      if (p) childCount.set(p, (childCount.get(p) || 0) + 1);
    }
    const rev: string[] = [endKey];
    const visited = new Set<string>([endKey]);
    let cur: string | null = target.layerParents[endKey] || null;
    let stoppedAtBranch: string | null = null;
    while (cur && !visited.has(cur) && rev.length < 16) {
      if (rev.length >= 2 && (childCount.get(cur) || 0) > 1) {
        stoppedAtBranch = cur;
        break;
      }
      visited.add(cur);
      rev.push(cur);
      cur = target.layerParents[cur] || null;
    }
    if (rev.length < 2) return [];
    const hasIKEnabled =
      rev.some((k) => Boolean(target.layerIK?.[k])) ||
      Boolean(stoppedAtBranch && target.layerIK?.[stoppedAtBranch]);
    return hasIKEnabled ? rev.reverse() : [];
  }

  function resolveIKJoints(
    rootSc: Scene,
    target: Scene | NestedClip,
    chain: string[],
    frame: number,
    createMissing: boolean
  ): IKJointRuntime[] {
    const out: IKJointRuntime[] = [];
    for (const key of chain) {
      if (key.startsWith('cel:')) {
        const trk = target.celTracks.find((t) => t.id === key.slice(4));
        if (!trk) return [];
        if (createMissing && !trk.visible) trk.visible = true;
        const entry = createMissing ? ensureCelAt(frame, true, trk.cels) : getCelEntryInMap(trk.cels, frame);
        if (!entry) {
          out.push({
            layerKey: key,
            layerType: 'cel',
            celObj: null,
            ox: WORLD_W * 0.5,
            oy: WORLD_H * 0.5,
            offsetX: 0,
            offsetY: 0,
            startOffsetX: 0,
            startOffsetY: 0,
            scale: 1,
            rot: 0,
            startRot: 0,
          });
          continue;
        }
        const cel = entry.cel;
        const prevOriginX = cel.originX;
        const prevOriginY = cel.originY;
        if (createMissing && (typeof cel.originX !== 'number' || typeof cel.originY !== 'number')) {
          const def = getCelVisualAnchor(rootSc, cel);
          cel.originX = def.ax;
          cel.originY = def.ay;
        }
        const off = getCelOffsetAtFrame(cel, entry.start, frame);
        const piv = getLayerPivotLocal(rootSc, 'cel', cel);
        const rot = off.rotation;
        out.push({
          layerKey: key,
          layerType: 'cel',
          celObj: cel,
          ox: piv.ox,
          oy: piv.oy,
          offsetX: off.offsetX,
          offsetY: off.offsetY,
          startOffsetX: cel.offsetX,
          startOffsetY: cel.offsetY,
          entryStart: entry.start,
          prevPosKeys: clonePosKeys(cel.posKeys),
          scale: off.scale,
          rot,
          startRot: rot,
          prevOriginX,
          prevOriginY,
        });
      } else if (key.startsWith('vector:')) {
        const trk = target.vectorTracks.find((t) => t.id === key.slice(7));
        if (!trk) return [];
        if (createMissing && !trk.visible) trk.visible = true;
        const entry = createMissing ? ensureVectorCelAt(frame, true, trk.cels) : getVectorCelEntryInMap(trk.cels, frame);
        if (!entry) {
          out.push({
            layerKey: key,
            layerType: 'vector',
            celObj: null,
            ox: WORLD_W * 0.5,
            oy: WORLD_H * 0.5,
            offsetX: 0,
            offsetY: 0,
            startOffsetX: 0,
            startOffsetY: 0,
            scale: 1,
            rot: 0,
            startRot: 0,
          });
          continue;
        }
        const cel = entry.cel;
        const prevOriginX = cel.originX;
        const prevOriginY = cel.originY;
        if (createMissing && (typeof cel.originX !== 'number' || typeof cel.originY !== 'number')) {
          const def = computeVectorCelCenter(rootSc, cel);
          cel.originX = def.ax;
          cel.originY = def.ay;
        }
        const off = getCelOffsetAtFrame(cel, entry.start, frame);
        const piv = getLayerPivotLocal(rootSc, 'vector', cel);
        const rot = off.rotation;
        out.push({
          layerKey: key,
          layerType: 'vector',
          celObj: cel,
          ox: piv.ox,
          oy: piv.oy,
          offsetX: off.offsetX,
          offsetY: off.offsetY,
          startOffsetX: cel.offsetX,
          startOffsetY: cel.offsetY,
          entryStart: entry.start,
          prevPosKeys: clonePosKeys(cel.posKeys),
          scale: off.scale,
          rot,
          startRot: rot,
          prevOriginX,
          prevOriginY,
        });
      } else if (key.startsWith('bg:') && 'bgLayers' in target) {
        const bg = target.bgLayers.find((b) => b.id === key.slice(3));
        if (!bg) return [];
        if (createMissing && !bg.visible) bg.visible = true;
        const prevOriginX = bg.originX;
        const prevOriginY = bg.originY;
        if (createMissing && (typeof bg.originX !== 'number' || typeof bg.originY !== 'number')) {
          const def = bg.hasInk
            ? computeCanvasInkCenter(bg.canvas) || { ax: WORLD_W * 0.5, ay: WORLD_H * 0.5 }
            : { ax: WORLD_W * 0.5, ay: WORLD_H * 0.5 };
          bg.originX = def.ax;
          bg.originY = def.ay;
        }
        const piv = getLayerPivotLocal(rootSc, 'bg', bg);
        const rot = bg.rotation || 0;
        out.push({
          layerKey: key,
          layerType: 'bg',
          celObj: bg,
          ox: piv.ox,
          oy: piv.oy,
          offsetX: bg.offsetX,
          offsetY: bg.offsetY,
          startOffsetX: bg.offsetX,
          startOffsetY: bg.offsetY,
          scale: bg.scale ?? 1,
          rot,
          startRot: rot,
          prevOriginX,
          prevOriginY,
        });
      } else if (key.startsWith('mouth:') && 'mouthLayers' in target) {
        const ml = target.mouthLayers.find((m) => m.id === key.slice(6));
        if (!ml) return [];
        if (createMissing && !ml.visible) ml.visible = true;
        const existingKey = ml.keys.get(frame);
        const m: MouthKey = getEvaluatedMouthInScene(rootSc, frame, ml) || {
          viseme: 0,
          x: Math.round(WORLD_W / 2),
          y: Math.round(WORLD_H * 0.56),
          scale: 100,
        };
        const restX = Math.round(WORLD_W / 2);
        const restY = Math.round(WORLD_H * 0.56);
        const odx = m.originDx || 0;
        const ody = m.originDy || 0;
        const rot = m.rotation || 0;
        out.push({
          layerKey: key,
          layerType: 'mouth',
          celObj: null,
          mouthLayer: ml,
          ox: restX + odx,
          oy: restY + ody,
          offsetX: m.x - restX,
          offsetY: m.y - restY,
          startOffsetX: m.x - restX,
          startOffsetY: m.y - restY,
          scale: 1,
          rot,
          startRot: rot,
          mouthPrevKey: existingKey ? { ...existingKey } : null,
        });
      }
    }
    return out;
  }

  function computeIKWorldMats(joints: IKJointRuntime[], rootParentMat: Mat2D): Mat2D[] {
    const mats: Mat2D[] = [];
    let cur = rootParentMat;
    for (let i = 0; i < joints.length; i++) {
      const j = joints[i];
      const lm = makeLayerLocalTransform(j.offsetX, j.offsetY, j.ox, j.oy, j.rot, j.scale);
      cur = mulMat(cur, lm);
      mats.push(cur);
    }
    return mats;
  }

  function solveIKChainToTarget(
    joints: IKJointRuntime[],
    rootParentMat: Mat2D,
    endLocalPt: Point2D,
    targetWorldPt: Point2D,
    frame: number,
    canRootFollow = false
  ): void {
    const n = joints.length;
    if (n < 2) return;
    let worldMats = computeIKWorldMats(joints, rootParentMat);

    // Precompute segment lengths to know total chain reach
    let totalReach = 0;
    let firstSegLen = 0;
    const initPivots = joints.map((j, idx) => applyMatPt(worldMats[idx], { x: j.ox, y: j.oy }));
    for (let i = 0; i < n - 1; i++) {
      const seg = Math.hypot(initPivots[i + 1].x - initPivots[i].x, initPivots[i + 1].y - initPivots[i].y);
      if (i === 0) firstSegLen = seg;
      totalReach += seg;
    }
    const initEndPt = applyMatPt(worldMats[n - 1], endLocalPt);
    const endLeverLen = Math.hypot(initEndPt.x - initPivots[n - 1].x, initEndPt.y - initPivots[n - 1].y);
    totalReach += endLeverLen;

    const maxIters = 40;
    const maxStepRad = 0.38;

    // Solve upper/middle joints first (n-2 down to 0) so parent layers naturally rotate and carry children,
    // then gently allow the end joint (n-1) to orient if the grab point has a lever arm away from its pivot.
    const solveOrder: number[] = [];
    for (let i = n - 2; i >= 0; i--) solveOrder.push(i);
    if (endLeverLen >= 3) solveOrder.push(n - 1);

    for (let iter = 0; iter < maxIters; iter++) {
      let maxDelta = 0;
      for (const i of solveOrder) {
        const j = joints[i];
        const jPivot = applyMatPt(worldMats[i], { x: j.ox, y: j.oy });
        const endPt = applyMatPt(worldMats[n - 1], endLocalPt);
        const vx = endPt.x - jPivot.x;
        const vy = endPt.y - jPivot.y;
        const tx = targetWorldPt.x - jPivot.x;
        const ty = targetWorldPt.y - jPivot.y;
        const vLen = Math.hypot(vx, vy);
        const tLen = Math.hypot(tx, ty);
        if (vLen < 3 || tLen < 2) continue;

        let dAng = Math.atan2(ty, tx) - Math.atan2(vy, vx);
        while (dAng > Math.PI) dAng -= Math.PI * 2;
        while (dAng < -Math.PI) dAng += Math.PI * 2;

        // Break collinear singularity when pulling inward along the bone axis
        if (iter === 0 && i < n - 1 && Math.abs(dAng) < 0.02 && vLen > tLen + 2) {
          dAng = 0.14;
        }
        if (Math.abs(dAng) < 1e-4) continue;
        const stepDamp = i === n - 1 ? (n === 2 ? 0.45 : 0.25) : 0.85;
        dAng *= stepDamp;
        if (dAng > maxStepRad) dAng = maxStepRad;
        else if (dAng < -maxStepRad) dAng = -maxStepRad;

        j.rot += dAng;
        if (Math.abs(dAng) > maxDelta) maxDelta = Math.abs(dAng);

        let cur = i === 0 ? rootParentMat : worldMats[i - 1];
        for (let k = i; k < n; k++) {
          const jk = joints[k];
          const lm = makeLayerLocalTransform(jk.offsetX, jk.offsetY, jk.ox, jk.oy, jk.rot, jk.scale);
          cur = mulMat(cur, lm);
          worldMats[k] = cur;
        }
      }
      const finalEnd = applyMatPt(worldMats[n - 1], endLocalPt);
      if (Math.hypot(targetWorldPt.x - finalEnd.x, targetWorldPt.y - finalEnd.y) < 0.15 && maxDelta < 1e-3) {
        break;
      }
    }

    // If the chain root is free (not attached to a branching parent) and the target pulls beyond
    // rotational reach (or on a 2-link chain with no end lever arm), slide the root so the whole
    // chain smoothly moves AND rotates to follow the end object.
    let rootMoved = false;
    if (canRootFollow) {
      const rootPivot = applyMatPt(worldMats[0], { x: joints[0].ox, y: joints[0].oy });
      const finalEnd = applyMatPt(worldMats[n - 1], endLocalPt);
      const errX = targetWorldPt.x - finalEnd.x;
      const errY = targetWorldPt.y - finalEnd.y;
      const errDist = Math.hypot(errX, errY);
      const rootToTargetDist = Math.hypot(targetWorldPt.x - rootPivot.x, targetWorldPt.y - rootPivot.y);
      const shouldSlideRoot =
        errDist > 0.5 &&
        (rootToTargetDist > totalReach - 0.5 ||
          (n === 2 && (endLeverLen < 3 || rootToTargetDist < Math.abs(firstSegLen - endLeverLen) + 0.5)));

      if (shouldSlideRoot) {
        const localShift = isIdentityMat(rootParentMat)
          ? { x: errX, y: errY }
          : applyMatVec(invMat(rootParentMat), errX, errY);
        joints[0].offsetX += localShift.x;
        joints[0].offsetY += localShift.y;
        rootMoved = true;
      }
    }

    for (let idx = 0; idx < joints.length; idx++) {
      const j = joints[idx];
      if (j.layerType === 'mouth' && j.mouthLayer) {
        if (idx === 0 && rootMoved) {
          const restX = Math.round(WORLD_W / 2);
          const restY = Math.round(WORLD_H * 0.56);
          setMouthKeyAtCurrentFrame(
            { x: Math.round(restX + j.offsetX), y: Math.round(restY + j.offsetY), rotation: j.rot },
            frame,
            j.mouthLayer
          );
        } else {
          setMouthKeyAtCurrentFrame({ rotation: j.rot }, frame, j.mouthLayer);
        }
      } else if (j.celObj) {
        const isTweenable =
          !isBasicMode() &&
          'duration' in j.celObj &&
          typeof j.entryStart === 'number' &&
          (Boolean(j.celObj.posKeys && j.celObj.posKeys.length > 0) ||
            (j.celObj.duration > 1 && frame - j.entryStart > 0));
        if (isTweenable && 'duration' in j.celObj && typeof j.entryStart === 'number') {
          const celObj = j.celObj as Cel | VectorCel;
          const relFrame = frame - j.entryStart;
          if (!celObj.posKeys || celObj.posKeys.length === 0) {
            celObj.posKeys = [
              {
                relFrame: 0,
                offsetX: celObj.offsetX,
                offsetY: celObj.offsetY,
                scale: celObj.scale ?? 1,
                rotation: celObj.rotation || 0,
              },
            ];
          }
          let key = celObj.posKeys.find((k) => k.relFrame === relFrame);
          const nextX = Math.round(j.offsetX * 10) / 10;
          const nextY = Math.round(j.offsetY * 10) / 10;
          if (!key) {
            key = { relFrame, offsetX: nextX, offsetY: nextY, scale: j.scale, rotation: j.rot };
            celObj.posKeys.push(key);
            sortPosKeys(celObj);
          } else {
            key.rotation = j.rot;
            if (idx === 0 && rootMoved) {
              key.offsetX = nextX;
              key.offsetY = nextY;
            }
          }
          if (relFrame === 0) {
            celObj.rotation = j.rot;
            if (idx === 0 && rootMoved) {
              celObj.offsetX = nextX;
              celObj.offsetY = nextY;
            }
          }
        } else {
          j.celObj.rotation = j.rot;
          if (idx === 0 && rootMoved) {
            j.celObj.offsetX = Math.round(j.offsetX * 10) / 10;
            j.celObj.offsetY = Math.round(j.offsetY * 10) / 10;
          }
        }
      }
    }
  }

  function restoreIKSiblings(
    rootSc: Scene,
    target: Scene | NestedClip,
    frame: number,
    siblings: IKSiblingSnapshot[] | undefined
  ): void {
    if (!siblings || siblings.length === 0) return;
    for (const s of siblings) {
      const k = s.layerKey;
      if (k.startsWith('cel:')) {
        const trk = target.celTracks.find((t) => t.id === k.slice(4));
        const entry = trk ? getCelEntryInMap(trk.cels, frame) : null;
        if (entry) {
          entry.cel.rotation = s.rotation;
          if (typeof s.offsetX === 'number') entry.cel.offsetX = s.offsetX;
          if (typeof s.offsetY === 'number') entry.cel.offsetY = s.offsetY;
          if ('posKeys' in s) entry.cel.posKeys = clonePosKeys(s.posKeys);
          entry.cel.originX = s.originX;
          entry.cel.originY = s.originY;
        }
      } else if (k.startsWith('vector:')) {
        const trk = target.vectorTracks.find((t) => t.id === k.slice(7));
        const entry = trk ? getVectorCelEntryInMap(trk.cels, frame) : null;
        if (entry) {
          entry.cel.rotation = s.rotation;
          if (typeof s.offsetX === 'number') entry.cel.offsetX = s.offsetX;
          if (typeof s.offsetY === 'number') entry.cel.offsetY = s.offsetY;
          if ('posKeys' in s) entry.cel.posKeys = clonePosKeys(s.posKeys);
          entry.cel.originX = s.originX;
          entry.cel.originY = s.originY;
        }
      } else if (k.startsWith('bg:') && 'bgLayers' in target) {
        const bg = target.bgLayers.find((b) => b.id === k.slice(3));
        if (bg) {
          bg.rotation = s.rotation;
          if (typeof s.offsetX === 'number') bg.offsetX = s.offsetX;
          if (typeof s.offsetY === 'number') bg.offsetY = s.offsetY;
          bg.originX = s.originX;
          bg.originY = s.originY;
        }
      } else if (k.startsWith('mouth:') && 'mouthLayers' in target) {
        const ml = target.mouthLayers.find((m) => m.id === k.slice(6));
        if (ml && typeof s.mouthFrame === 'number') {
          if (s.mouthPrevKey) ml.keys.set(s.mouthFrame, { ...s.mouthPrevKey });
          else ml.keys.delete(s.mouthFrame);
        }
      }
    }
    void rootSc;
  }

  const brushMaskCache = new Map<number, BrushMask>();

  function getBrushMask(size: number): BrushMask {
    const cached = brushMaskCache.get(size);
    if (cached) return cached;

    const cells: BrushMask['cells'] = [];
    const occupied = new Set<string>();

    if (size <= 1) {
      cells.push({ dx: 0, dy: 0 });
      occupied.add('0,0');
    } else {
      const r = size / 2;
      const rSq = r * r;
      const minOff = -Math.floor(r);
      const maxOff = Math.ceil(r) - 1;
      const centerShift = size % 2 === 0 ? -0.5 : 0;

      for (let dy = minOff; dy <= maxOff; dy++) {
        for (let dx = minOff; dx <= maxOff; dx++) {
          const distSq = (dx - centerShift) * (dx - centerShift) + (dy - centerShift) * (dy - centerShift);
          if (distSq <= rSq) {
            cells.push({ dx, dy });
            occupied.add(`${dx},${dy}`);
          }
        }
      }
    }

    const edges: BrushMask['edges'] = [];
    for (const { dx, dy } of cells) {
      if (!occupied.has(`${dx},${dy - 1}`)) edges.push({ x1: dx, y1: dy, x2: dx + 1, y2: dy });
      if (!occupied.has(`${dx},${dy + 1}`)) edges.push({ x1: dx, y1: dy + 1, x2: dx + 1, y2: dy + 1 });
      if (!occupied.has(`${dx - 1},${dy}`)) edges.push({ x1: dx, y1: dy, x2: dx, y2: dy + 1 });
      if (!occupied.has(`${dx + 1},${dy}`)) edges.push({ x1: dx + 1, y1: dy, x2: dx + 1, y2: dy + 1 });
    }

    const mask = { cells, edges };
    brushMaskCache.set(size, mask);
    return mask;
  }

  function drawPixelDisk(
    cctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    size: number,
    color: string,
    isErase: boolean
  ): void {
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    const { cells } = getBrushMask(size);
    if (!isErase) cctx.fillStyle = color;

    for (const { dx, dy } of cells) {
      if (isErase) cctx.clearRect(x0 + dx, y0 + dy, 1, 1);
      else cctx.fillRect(x0 + dx, y0 + dy, 1, 1);
    }
  }

  function drawPixelLine(
    cctx: CanvasRenderingContext2D,
    p1: Point2D,
    p2: Point2D,
    size: number,
    color: string,
    isErase: boolean
  ): void {
    let x0 = Math.round(p1.x);
    let y0 = Math.round(p1.y);
    const x1 = Math.round(p2.x);
    const y1 = Math.round(p2.y);
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      drawPixelDisk(cctx, x0, y0, size, color, isErase);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x0 += sx;
      }
      if (e2 < dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  function buildClosedBarrier(rawBarrier: Uint8Array, w: number, h: number, r: number): Uint8Array {
    if (r <= 0) return rawBarrier;
    const n = w * h;
    const tmp = new Uint8Array(n);
    const dilated = new Uint8Array(n);
    const closed = new Uint8Array(n);

    for (let y = 0; y < h; y++) {
      const row = y * w;
      let count = 0;
      for (let x = 0; x <= Math.min(w - 1, r); x++) count += rawBarrier[row + x];
      for (let x = 0; x < w; x++) {
        tmp[row + x] = count > 0 ? 1 : 0;
        const addX = x + r + 1;
        const remX = x - r;
        if (addX < w) count += rawBarrier[row + addX];
        if (remX >= 0) count -= rawBarrier[row + remX];
      }
    }

    for (let x = 0; x < w; x++) {
      let count = 0;
      for (let y = 0; y <= Math.min(h - 1, r); y++) count += tmp[y * w + x];
      for (let y = 0; y < h; y++) {
        dilated[y * w + x] = count > 0 ? 1 : 0;
        const addY = y + r + 1;
        const remY = y - r;
        if (addY < h) count += tmp[addY * w + x];
        if (remY >= 0) count -= tmp[remY * w + x];
      }
    }

    for (let y = 0; y < h; y++) {
      const row = y * w;
      let zeroCount = 0;
      for (let x = 0; x <= Math.min(w - 1, r); x++) if (dilated[row + x] === 0) zeroCount++;
      for (let x = 0; x < w; x++) {
        tmp[row + x] = zeroCount === 0 ? 1 : 0;
        const addX = x + r + 1;
        const remX = x - r;
        if (addX < w && dilated[row + addX] === 0) zeroCount++;
        if (remX >= 0 && dilated[row + remX] === 0) zeroCount--;
      }
    }

    for (let x = 0; x < w; x++) {
      let zeroCount = 0;
      for (let y = 0; y <= Math.min(h - 1, r); y++) if (tmp[y * w + x] === 0) zeroCount++;
      for (let y = 0; y < h; y++) {
        closed[y * w + x] = zeroCount === 0 ? 1 : 0;
        const addY = y + r + 1;
        const remY = y - r;
        if (addY < h && tmp[addY * w + x] === 0) zeroCount++;
        if (remY >= 0 && tmp[remY * w + x] === 0) zeroCount--;
      }
    }

    return closed;
  }

  function hexToRgba(hex: string): [number, number, number, number] {
    const clean = hex.replace('#', '');
    const n = parseInt(clean, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }

  function floodFillLayer(
    layerObj: Cel | BgLayer | Viseme,
    localX: number,
    localY: number,
    hexColor: string,
    isErase = false,
    fixedDims = false
  ): boolean {
    if (!fixedDims && 'offsetX' in layerObj) ensureLayerCoversFrame(layerObj);
    const w = layerObj.canvas.width;
    const h = layerObj.canvas.height;
    const sx = Math.round(localX);
    const sy = Math.round(localY);
    if (sx < 0 || sx >= w || sy < 0 || sy >= h) return false;

    const cctx = layerObj.canvas.getContext('2d');
    if (!cctx) return false;
    const imgData = cctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const [fr, fg, fb, fa] = isErase ? [0, 0, 0, 0] : hexToRgba(hexColor);
    const startIdx = (sy * w + sx) * 4;
    const tr = data[startIdx];
    const tg = data[startIdx + 1];
    const tb = data[startIdx + 2];
    const ta = data[startIdx + 3];

    if (tr === fr && tg === fg && tb === fb && ta === fa) return false;

    const totalPx = w * h;
    const rawBarrier = new Uint8Array(totalPx);
    for (let i = 0; i < totalPx; i++) {
      const p = i * 4;
      if (data[p] !== tr || data[p + 1] !== tg || data[p + 2] !== tb || data[p + 3] !== ta) {
        rawBarrier[i] = 1;
      }
    }

    const gapR = !isErase && state.fillGapRadius > 0 ? state.fillGapRadius : 0;
    const barrier = buildClosedBarrier(rawBarrier, w, h, gapR);
    if (barrier[sy * w + sx] === 1) return false;

    pushPixelUndo(layerObj, fixedDims);

    const visited = new Uint8Array(totalPx);
    const stack: number[] = [sx, sy];

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      if (visited[y * w + x] || barrier[y * w + x] || rawBarrier[y * w + x]) continue;

      let lx = x;
      while (lx >= 0 && !visited[y * w + lx] && !barrier[y * w + lx] && !rawBarrier[y * w + lx]) lx--;
      lx++;

      let rx = x;
      while (rx < w && !visited[y * w + rx] && !barrier[y * w + rx] && !rawBarrier[y * w + rx]) rx++;
      rx--;

      let spanUp = false;
      let spanDown = false;

      for (let cx = lx; cx <= rx; cx++) {
        const cellIdx = y * w + cx;
        visited[cellIdx] = 1;
        const dIdx = cellIdx * 4;
        data[dIdx] = fr;
        data[dIdx + 1] = fg;
        data[dIdx + 2] = fb;
        data[dIdx + 3] = fa;

        if (y > 0) {
          const upCell = (y - 1) * w + cx;
          const matchUp = !visited[upCell] && !barrier[upCell] && !rawBarrier[upCell];
          if (!spanUp && matchUp) {
            stack.push(cx, y - 1);
            spanUp = true;
          } else if (spanUp && !matchUp) {
            spanUp = false;
          }
        }

        if (y < h - 1) {
          const downCell = (y + 1) * w + cx;
          const matchDown = !visited[downCell] && !barrier[downCell] && !rawBarrier[downCell];
          if (!spanDown && matchDown) {
            stack.push(cx, y + 1);
            spanDown = true;
          } else if (spanDown && !matchDown) {
            spanDown = false;
          }
        }
      }
    }

    cctx.putImageData(imgData, 0, 0);
    if (!isErase && 'hasInk' in layerObj) layerObj.hasInk = true;
    return true;
  }

  function perpendicularDist(pt: Point2D, a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-6) return Math.hypot(pt.x - a.x, pt.y - a.y);
    return Math.abs(dy * pt.x - dx * pt.y + b.x * a.y - b.y * a.x) / Math.sqrt(lenSq);
  }

  function rdpOpen(pts: Point2D[], epsilon: number): Point2D[] {
    if (pts.length <= 2) return pts;
    let maxDist = 0;
    let maxIdx = 0;
    const start = pts[0];
    const end = pts[pts.length - 1];
    for (let i = 1; i < pts.length - 1; i++) {
      const d = perpendicularDist(pts[i], start, end);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist > epsilon) {
      const left = rdpOpen(pts.slice(0, maxIdx + 1), epsilon);
      const right = rdpOpen(pts.slice(maxIdx), epsilon);
      return left.slice(0, -1).concat(right);
    }
    return [start, end];
  }

  function simplifyClosedPolygon(pts: Point2D[], epsilon: number): Point2D[] {
    if (pts.length <= 4) return pts;
    let farIdx = 0;
    let maxD = -1;
    const p0 = pts[0];
    for (let i = 1; i < pts.length; i++) {
      const d = Math.hypot(pts[i].x - p0.x, pts[i].y - p0.y);
      if (d > maxD) {
        maxD = d;
        farIdx = i;
      }
    }
    const halfA = rdpOpen(pts.slice(0, farIdx + 1), epsilon);
    const halfB = rdpOpen([...pts.slice(farIdx), pts[0]], epsilon);
    return halfA.slice(0, -1).concat(halfB.slice(0, -1));
  }

  function traceMaskContours(
    mask: Uint8Array,
    w: number,
    h: number,
    shiftX: number,
    shiftY: number
  ): Point2D[][] {
    const stride = w + 1;
    const outMap = new Map<number, number[]>();

    const addEdge = (x0: number, y0: number, x1: number, y1: number) => {
      const k0 = y0 * stride + x0;
      const k1 = y1 * stride + x1;
      let arr = outMap.get(k0);
      if (!arr) {
        arr = [];
        outMap.set(k0, arr);
      }
      arr.push(k1);
    };

    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (mask[row + x] === 0) continue;
        if (y === 0 || mask[(y - 1) * w + x] === 0) addEdge(x, y, x + 1, y);
        if (x === w - 1 || mask[row + x + 1] === 0) addEdge(x + 1, y, x + 1, y + 1);
        if (y === h - 1 || mask[(y + 1) * w + x] === 0) addEdge(x + 1, y + 1, x, y + 1);
        if (x === 0 || mask[row + x - 1] === 0) addEdge(x, y + 1, x, y);
      }
    }

    const loops: Point2D[][] = [];
    while (outMap.size > 0) {
      const firstEntry = outMap.entries().next().value as [number, number[]] | undefined;
      if (!firstEntry) break;
      const startKey = firstEntry[0];
      const startList = firstEntry[1];
      let prevKey = startKey;
      let currKey = startList.pop()!;
      if (startList.length === 0) outMap.delete(startKey);

      const loopKeys: number[] = [startKey];
      while (currKey !== startKey) {
        loopKeys.push(currKey);
        const nextList = outMap.get(currKey);
        if (!nextList || nextList.length === 0) break;

        let chosenIdx = nextList.length - 1;
        if (nextList.length > 1) {
          const px = prevKey % stride;
          const py = Math.floor(prevKey / stride);
          const cx = currKey % stride;
          const cy = Math.floor(currKey / stride);
          const dx = cx - px;
          const dy = cy - py;
          for (let i = 0; i < nextList.length; i++) {
            const nk = nextList[i];
            const nx = nk % stride;
            const ny = Math.floor(nk / stride);
            if ((nx - cx) * dx + (ny - cy) * dy === 0) {
              chosenIdx = i;
              break;
            }
          }
        }
        const nextKey = nextList.splice(chosenIdx, 1)[0];
        if (nextList.length === 0) outMap.delete(currKey);
        prevKey = currKey;
        currKey = nextKey;
      }

      if (loopKeys.length >= 3) {
        const pts: Point2D[] = [];
        const len = loopKeys.length;
        for (let i = 0; i < len; i++) {
          const kPrev = loopKeys[(i - 1 + len) % len];
          const kCurr = loopKeys[i];
          const kNext = loopKeys[(i + 1) % len];
          const x0 = kPrev % stride;
          const y0 = Math.floor(kPrev / stride);
          const x1 = kCurr % stride;
          const y1 = Math.floor(kCurr / stride);
          const x2 = kNext % stride;
          const y2 = Math.floor(kNext / stride);
          if ((x1 - x0) * (y2 - y1) - (y1 - y0) * (x2 - x1) !== 0) {
            pts.push({ x: x1 + shiftX, y: y1 + shiftY });
          }
        }
        if (pts.length >= 3) {
          loops.push(simplifyClosedPolygon(pts, 0.35));
        }
      }
    }
    return loops;
  }

  function drawVectorStrokePath(vctx: CanvasRenderingContext2D, points: Point2D[], size: number): void {
    if (points.length === 0) return;
    if (points.length === 1) {
      vctx.beginPath();
      vctx.arc(points[0].x, points[0].y, Math.max(0.5, size / 2), 0, Math.PI * 2);
      vctx.fill();
      return;
    }
    vctx.beginPath();
    vctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      vctx.lineTo(points[1].x, points[1].y);
    } else {
      for (let i = 1; i < points.length - 1; i++) {
        const p = points[i];
        const next = points[i + 1];
        if (p.corner) {
          vctx.lineTo(p.x, p.y);
          if (!next.corner && i < points.length - 2) {
            vctx.lineTo((p.x + next.x) * 0.5, (p.y + next.y) * 0.5);
          }
        } else {
          const mx = (p.x + next.x) * 0.5;
          const my = (p.y + next.y) * 0.5;
          vctx.quadraticCurveTo(p.x, p.y, mx, my);
        }
      }
      const last = points[points.length - 1];
      vctx.lineTo(last.x, last.y);
    }
    vctx.stroke();
  }

  function traceClosedContourPath(vctx: CanvasRenderingContext2D, loop: Point2D[]): void {
    const n = loop.length;
    if (n < 3) return;
    const pLast = loop[n - 1];
    const p0 = loop[0];
    if (p0.corner) {
      vctx.moveTo(p0.x, p0.y);
    } else {
      vctx.moveTo((pLast.x + p0.x) * 0.5, (pLast.y + p0.y) * 0.5);
    }
    for (let i = 0; i < n; i++) {
      const cur = loop[i];
      const next = loop[(i + 1) % n];
      if (cur.corner) {
        vctx.lineTo(cur.x, cur.y);
        if (!next.corner) {
          vctx.lineTo((cur.x + next.x) * 0.5, (cur.y + next.y) * 0.5);
        }
      } else {
        const mx = (cur.x + next.x) * 0.5;
        const my = (cur.y + next.y) * 0.5;
        vctx.quadraticCurveTo(cur.x, cur.y, mx, my);
      }
    }
    vctx.closePath();
  }

  function drawVectorItemsToContext(vctx: CanvasRenderingContext2D, items: VectorItem[], pixelBias = false): void {
    vctx.save();
    vctx.imageSmoothingEnabled = true;
    vctx.lineCap = 'round';
    vctx.lineJoin = 'round';

    for (const item of items) {
      if (item.kind === 'fill') {
        if (item.contours.length === 0) continue;
        vctx.globalCompositeOperation = item.isErase ? 'destination-out' : 'source-over';
        vctx.fillStyle = item.isErase ? '#000000' : item.color;
        vctx.beginPath();
        for (const loop of item.contours) {
          if (loop.length < 3) continue;
          traceClosedContourPath(vctx, loop);
        }
        vctx.fill('evenodd');
        if (!item.isErase) {
          vctx.strokeStyle = item.color;
          vctx.lineWidth = pixelBias ? 1 : 0.75;
          vctx.stroke();
        }
      } else if (item.kind === 'erase') {
        vctx.globalCompositeOperation = 'destination-out';
        vctx.strokeStyle = '#000000';
        vctx.fillStyle = '#000000';
        vctx.lineWidth = item.size;
        drawVectorStrokePath(vctx, item.points, item.size);
      } else {
        vctx.globalCompositeOperation = 'source-over';
        vctx.strokeStyle = item.color;
        vctx.fillStyle = item.color;
        const effectiveSize = pixelBias ? Math.max(1.25, item.size) : item.size;
        vctx.lineWidth = effectiveSize;
        drawVectorStrokePath(vctx, item.points, effectiveSize);
      }
    }
    vctx.restore();
  }

  const vectorFillBufferCanvas = createCelCanvas();
  const vectorFillBufferCtx = vectorFillBufferCanvas.getContext('2d')!;

  function pointInPolygon(pt: Point2D, poly: Point2D[]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i].x;
      const yi = poly[i].y;
      const xj = poly[j].x;
      const yj = poly[j].y;
      const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function pointInContours(pt: Point2D, contours: Point2D[][]): boolean {
    let parity = false;
    for (const c of contours) {
      if (c.length >= 3 && pointInPolygon(pt, c)) parity = !parity;
    }
    return parity;
  }

  function polygonAreaAbs(poly: Point2D[]): number {
    let area = 0;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      area += poly[j].x * poly[i].y - poly[i].x * poly[j].y;
    }
    return Math.abs(area) * 0.5;
  }

  function contoursAreaAbs(contours: Point2D[][]): number {
    let total = 0;
    for (const c of contours) total += polygonAreaAbs(c);
    return total;
  }

  function distPointToSeg(pt: Point2D, a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-8) return Math.hypot(pt.x - a.x, pt.y - a.y);
    const t = Math.max(0, Math.min(1, ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq));
    return Math.hypot(pt.x - (a.x + t * dx), pt.y - (a.y + t * dy));
  }

  function segmentsIntersectPt(a: Point2D, b: Point2D, c: Point2D, d: Point2D): Point2D | null {
    const rX = b.x - a.x;
    const rY = b.y - a.y;
    const sX = d.x - c.x;
    const sY = d.y - c.y;
    const denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-8) return null;
    const qpx = c.x - a.x;
    const qpy = c.y - a.y;
    const t = (qpx * sY - qpy * sX) / denom;
    const u = (qpx * rY - qpy * rX) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { x: a.x + t * rX, y: a.y + t * rY };
    }
    return null;
  }

  function polyBBox(pts: Point2D[]): { minX: number; minY: number; maxX: number; maxY: number } {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { minX, minY, maxX, maxY };
  }

  function sampleVectorStrokeCurve(points: Point2D[]): Point2D[] {
    if (points.length === 0) return [];
    if (points.length <= 2) return points.map((p) => ({ x: p.x, y: p.y }));
    const out: Point2D[] = [{ x: points[0].x, y: points[0].y }];
    let prevX = points[0].x;
    let prevY = points[0].y;
    for (let i = 1; i < points.length - 1; i++) {
      const cx = points[i].x;
      const cy = points[i].y;
      const mx = (cx + points[i + 1].x) * 0.5;
      const my = (cy + points[i + 1].y) * 0.5;
      const steps = 4;
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const omt = 1 - t;
        out.push({
          x: omt * omt * prevX + 2 * omt * t * cx + t * t * mx,
          y: omt * omt * prevY + 2 * omt * t * cy + t * t * my,
        });
      }
      prevX = mx;
      prevY = my;
    }
    const last = points[points.length - 1];
    out.push({ x: last.x, y: last.y });
    return out;
  }

  function extractClosedLoopFromStroke(item: VectorStrokeItem, gapCloseLimit: number): Point2D[] | null {
    const sampled = sampleVectorStrokeCurve(item.points);
    if (sampled.length < 3) return null;

    const first = sampled[0];
    const last = sampled[sampled.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= gapCloseLimit) {
      const simp = simplifyClosedPolygon(sampled, 0.25);
      if (simp.length >= 3 && polygonAreaAbs(simp) >= 16) return simp;
    }

    // Check self-intersection along the stroke to extract a closed loop even with crossing tails
    for (let i = 0; i < sampled.length - 4; i++) {
      const a = sampled[i];
      const b = sampled[i + 1];
      for (let j = sampled.length - 2; j >= i + 3; j--) {
        const inter = segmentsIntersectPt(a, b, sampled[j], sampled[j + 1]);
        if (inter) {
          const loop = [inter, ...sampled.slice(i + 1, j + 1)];
          const simp = simplifyClosedPolygon(loop, 0.25);
          if (simp.length >= 3 && polygonAreaAbs(simp) >= 16) return simp;
        }
      }
    }
    return null;
  }

  function strokeCrossesOrCutsPolygon(otherPts: Point2D[], poly: Point2D[], pad = 0): boolean {
    if (otherPts.length === 0 || poly.length < 3) return false;
    const pb = polyBBox(poly);
    const ob = polyBBox(otherPts);
    if (ob.maxX + pad < pb.minX || ob.minX - pad > pb.maxX || ob.maxY + pad < pb.minY || ob.minY - pad > pb.maxY) {
      return false;
    }
    for (let i = 0; i < otherPts.length; i++) {
      const p = otherPts[i];
      for (let k = 0; k < poly.length; k++) {
        const q1 = poly[k];
        const q2 = poly[(k + 1) % poly.length];
        if (pad > 0 && distPointToSeg(p, q1, q2) <= pad) return true;
        if (i + 1 < otherPts.length && segmentsIntersectPt(p, otherPts[i + 1], q1, q2)) return true;
      }
    }
    return false;
  }

  function itemStrictlyInsidePolygon(item: VectorItem, poly: Point2D[]): boolean {
    const pts = item.kind === 'fill' ? item.contours.flat() : item.points;
    if (pts.length === 0) return false;
    for (const p of pts) {
      if (!pointInPolygon(p, poly)) return false;
    }
    return !strokeCrossesOrCutsPolygon(pts, poly, 0);
  }

  function tryVectorStrokeFill(
    vCel: VectorCel,
    worldX: number,
    worldY: number,
    hexColor: string,
    isErase = false,
    overrideOffsetX?: number,
    overrideOffsetY?: number,
    overrideScale?: number,
    overrideRotation?: number
  ): boolean {
    const ox = typeof overrideOffsetX === 'number' ? overrideOffsetX : vCel.offsetX;
    const oy = typeof overrideOffsetY === 'number' ? overrideOffsetY : vCel.offsetY;
    const sc = typeof overrideScale === 'number' ? overrideScale : vCel.scale ?? 1;
    const rot = typeof overrideRotation === 'number' ? overrideRotation : vCel.rotation || 0;
    const piv = rot || sc !== 1 ? getLayerPivotLocal(activeScene(), 'vector', vCel) : { ox: 0, oy: 0 };
    const localPt = worldToLayerLocal({ x: worldX, y: worldY }, ox, oy, piv.ox, piv.oy, rot, sc);

    if (isErase) {
      for (let i = vCel.items.length - 1; i >= 0; i--) {
        const it = vCel.items[i];
        if (it.kind === 'fill' && !it.isErase && pointInContours(localPt, it.contours)) {
          let blockedByLater = false;
          for (let j = i + 1; j < vCel.items.length; j++) {
            const later = vCel.items[j];
            if (later.kind === 'stroke' || later.kind === 'erase') {
              const b = polyBBox(it.contours.flat());
              const lb = polyBBox(later.points);
              if (lb.maxX >= b.minX && lb.minX <= b.maxX && lb.maxY >= b.minY && lb.minY <= b.maxY) {
                blockedByLater = true;
                break;
              }
            }
          }
          if (!blockedByLater) {
            pushVectorItemsUndo(vCel);
            vCel.items.splice(i, 1);
            return true;
          }
          return false;
        }
      }
      return false;
    }

    const gapTol = Math.max(18, state.fillGapRadius * 2 + 12);
    let bestStroke: { idx: number; poly: Point2D[]; area: number } | null = null;

    for (let i = vCel.items.length - 1; i >= 0; i--) {
      const it = vCel.items[i];
      if (it.kind !== 'stroke') continue;
      const loop = extractClosedLoopFromStroke(it, Math.max(gapTol, it.size * 2.5));
      if (!loop || !pointInPolygon(localPt, loop)) continue;

      let interrupted = false;
      for (let j = i + 1; j < vCel.items.length; j++) {
        const later = vCel.items[j];
        if (later.kind === 'erase' && strokeCrossesOrCutsPolygon(later.points, loop, later.size * 0.5 + 2)) {
          interrupted = true;
          break;
        }
        if (later.kind === 'stroke' && strokeCrossesOrCutsPolygon(later.points, loop, 0)) {
          interrupted = true;
          break;
        }
      }
      if (interrupted) continue;

      const area = polygonAreaAbs(loop);
      if (!bestStroke || area < bestStroke.area) {
        bestStroke = { idx: i, poly: loop, area };
      }
    }

    // Check existing topmost vector fill under cursor
    let existingFillIdx = -1;
    let existingFillArea = Infinity;
    for (let i = vCel.items.length - 1; i >= 0; i--) {
      const it = vCel.items[i];
      if (it.kind === 'fill' && !it.isErase && pointInContours(localPt, it.contours)) {
        let splitAfter = false;
        const mainLoop = it.contours[0];
        if (mainLoop) {
          for (let j = i + 1; j < vCel.items.length; j++) {
            const later = vCel.items[j];
            if (
              (later.kind === 'stroke' || later.kind === 'erase') &&
              strokeCrossesOrCutsPolygon(later.points, mainLoop, later.size * 0.5 + 1)
            ) {
              splitAfter = true;
              break;
            }
          }
        }
        if (!splitAfter) {
          existingFillIdx = i;
          existingFillArea = contoursAreaAbs(it.contours);
        }
        break;
      }
    }

    if (bestStroke && (existingFillIdx === -1 || bestStroke.area <= existingFillArea * 1.05)) {
      // If an existing vector fill directly matches this enclosing stroke, update color cleanly
      if (
        existingFillIdx !== -1 &&
        existingFillIdx < bestStroke.idx &&
        Math.abs(existingFillArea - bestStroke.area) <= Math.max(200, bestStroke.area * 0.25)
      ) {
        const prevFill = vCel.items[existingFillIdx] as VectorFillItem;
        if (prevFill.color.toLowerCase() === hexColor.toLowerCase()) return true;
        pushVectorItemsUndo(vCel);
        prevFill.color = hexColor;
        vCel.hasInk = true;
        return true;
      }

      // Insert right beneath the stroke (and underneath any floating earlier shapes strictly inside it)
      let insertIdx = bestStroke.idx;
      while (insertIdx > 0) {
        const prevItem = vCel.items[insertIdx - 1];
        if (prevItem.kind !== 'erase' && itemStrictlyInsidePolygon(prevItem, bestStroke.poly)) {
          insertIdx--;
        } else {
          break;
        }
      }
      pushVectorItemsUndo(vCel);
      vCel.items.splice(insertIdx, 0, {
        kind: 'fill',
        contours: [bestStroke.poly],
        color: hexColor,
        isErase: false,
      });
      vCel.hasInk = true;
      return true;
    }

    if (existingFillIdx !== -1) {
      const targetFill = vCel.items[existingFillIdx] as VectorFillItem;
      if (targetFill.color.toLowerCase() === hexColor.toLowerCase()) return true;
      pushVectorItemsUndo(vCel);
      targetFill.color = hexColor;
      vCel.hasInk = true;
      return true;
    }

    return false;
  }

  function floodFillVectorCel(
    vCel: VectorCel,
    worldX: number,
    worldY: number,
    hexColor: string,
    isErase = false,
    overrideOffsetX?: number,
    overrideOffsetY?: number,
    overrideScale?: number,
    overrideRotation?: number
  ): boolean {
    const w = WORLD_W;
    const h = WORLD_H;
    const ox = typeof overrideOffsetX === 'number' ? overrideOffsetX : vCel.offsetX;
    const oy = typeof overrideOffsetY === 'number' ? overrideOffsetY : vCel.offsetY;
    const sc = typeof overrideScale === 'number' ? overrideScale : vCel.scale ?? 1;
    const rot = typeof overrideRotation === 'number' ? overrideRotation : vCel.rotation || 0;
    const piv = rot || sc !== 1 ? getLayerPivotLocal(activeScene(), 'vector', vCel) : { ox: 0, oy: 0 };
    const localSeed = worldToLayerLocal({ x: worldX, y: worldY }, ox, oy, piv.ox, piv.oy, rot, sc);
    const sx = Math.round(localSeed.x + ox);
    const sy = Math.round(localSeed.y + oy);
    if (sx < 0 || sx >= w || sy < 0 || sy >= h) return false;

    if (vectorFillBufferCanvas.width !== w || vectorFillBufferCanvas.height !== h) {
      vectorFillBufferCanvas.width = w;
      vectorFillBufferCanvas.height = h;
    }
    vectorFillBufferCtx.clearRect(0, 0, w, h);
    vectorFillBufferCtx.save();
    vectorFillBufferCtx.translate(ox, oy);
    drawVectorItemsToContext(vectorFillBufferCtx, vCel.items);
    vectorFillBufferCtx.restore();

    const imgData = vectorFillBufferCtx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const startIdx = (sy * w + sx) * 4;
    const tr = data[startIdx];
    const tg = data[startIdx + 1];
    const tb = data[startIdx + 2];
    const ta = data[startIdx + 3];

    if (isErase && ta === 0) return false;
    const [fr, fg, fb, fa] = isErase ? [0, 0, 0, 0] : hexToRgba(hexColor);
    if (!isErase && ta > 240 && Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) <= 6) {
      return false;
    }

    const totalPx = w * h;
    const rawBarrier = new Uint8Array(totalPx);
    for (let i = 0; i < totalPx; i++) {
      const p = i * 4;
      const diff =
        Math.abs(data[p] - tr) +
        Math.abs(data[p + 1] - tg) +
        Math.abs(data[p + 2] - tb) +
        Math.abs(data[p + 3] - ta);
      if (diff > 64) {
        rawBarrier[i] = 1;
      }
    }

    const gapR = !isErase && state.fillGapRadius > 0 ? state.fillGapRadius : 0;
    const barrier = buildClosedBarrier(rawBarrier, w, h, gapR);
    if (barrier[sy * w + sx] === 1) return false;

    const visited = new Uint8Array(totalPx);
    const stack: number[] = [sx, sy];
    let filledCount = 0;

    while (stack.length > 0) {
      const y = stack.pop()!;
      const x = stack.pop()!;
      if (visited[y * w + x] || barrier[y * w + x] || rawBarrier[y * w + x]) continue;

      let lx = x;
      while (lx >= 0 && !visited[y * w + lx] && !barrier[y * w + lx] && !rawBarrier[y * w + lx]) lx--;
      lx++;

      let rx = x;
      while (rx < w && !visited[y * w + rx] && !barrier[y * w + rx] && !rawBarrier[y * w + rx]) rx++;
      rx--;

      let spanUp = false;
      let spanDown = false;

      for (let cx = lx; cx <= rx; cx++) {
        const cellIdx = y * w + cx;
        visited[cellIdx] = 1;
        filledCount++;

        if (y > 0) {
          const upCell = (y - 1) * w + cx;
          const matchUp = !visited[upCell] && !barrier[upCell] && !rawBarrier[upCell];
          if (!spanUp && matchUp) {
            stack.push(cx, y - 1);
            spanUp = true;
          } else if (spanUp && !matchUp) {
            spanUp = false;
          }
        }

        if (y < h - 1) {
          const downCell = (y + 1) * w + cx;
          const matchDown = !visited[downCell] && !barrier[downCell] && !rawBarrier[downCell];
          if (!spanDown && matchDown) {
            stack.push(cx, y + 1);
            spanDown = true;
          } else if (spanDown && !matchDown) {
            spanDown = false;
          }
        }
      }
    }

    if (filledCount === 0) return false;
    const contours = traceMaskContours(visited, w, h, -ox, -oy);
    if (contours.length === 0) return false;

    pushVectorItemsUndo(vCel);
    vCel.items.push({
      kind: 'fill',
      contours,
      color: hexColor,
      isErase,
    });
    if (!isErase) vCel.hasInk = true;
    return true;
  }

  const gapCycle = [0, 2, 4, 8, 16, 24, 32];
  const btnGapCycle = mustEl<HTMLButtonElement>('btnGapCycle');
  const setGapRadius = (nextR: number) => {
    state.fillGapRadius = nextR;
    btnGapCycle.textContent = nextR === 0 ? 'Off' : `${nextR * 2}px`;
    btnGapCycle.classList.toggle('active', nextR > 0);
  };
  btnGapCycle.onclick = (e) => {
    const idx = gapCycle.indexOf(state.fillGapRadius);
    const step = e.shiftKey ? -1 : 1;
    const nextR = gapCycle[(idx + step + gapCycle.length) % gapCycle.length];
    setGapRadius(nextR);
  };
  btnGapCycle.oncontextmenu = (e) => {
    e.preventDefault();
    const idx = gapCycle.indexOf(state.fillGapRadius);
    const nextR = gapCycle[(idx - 1 + gapCycle.length) % gapCycle.length];
    setGapRadius(nextR);
  };

  // ==========================================
  // MOUTH SHAPES / VISEMES LAYER
  // ==========================================
  function ensureMouthInitInScene(sc: Scene, ml: MouthLayer = getActiveMouthLayerInScene(sc)): void {
    if (ml.keys.size === 0) {
      ml.keys.set(0, {
        viseme: 0,
        x: Math.round(WORLD_W / 2),
        y: Math.round(WORLD_H * 0.56),
        scale: 100,
      });
    }
  }

  function getEvaluatedMouthInScene(
    sc: Scene,
    frame: number,
    ml: MouthLayer = getActiveMouthLayerInScene(sc)
  ): (MouthKey & { keyFrame: number; isKey: boolean }) | null {
    if (!ml.visible || ml.keys.size === 0) return null;
    const exact = ml.keys.get(frame);
    if (exact) {
      return { keyFrame: frame, ...exact, isKey: true };
    }
    let bestF: number | null = null;
    let firstF: number | null = null;
    for (const f of ml.keys.keys()) {
      if (firstF === null || f < firstF) firstF = f;
      if (f <= frame && (bestF === null || f > bestF)) bestF = f;
    }
    const useF = bestF !== null ? bestF : firstF!;
    const mk = ml.keys.get(useF)!;
    return { keyFrame: useF, ...mk, isKey: false };
  }

  function getActiveMouthState(ml: MouthLayer = state.mouthLayer): MouthKey & { keyFrame: number } {
    const evalM = getEvaluatedMouthInScene(activeScene(), state.currentFrame, ml);
    if (evalM) return evalM;
    return {
      keyFrame: state.currentFrame,
      viseme: 0,
      x: Math.round(WORLD_W / 2),
      y: Math.round(WORLD_H * 0.56),
      scale: 100,
    };
  }

  type MouthUndoAction =
    | { kind: 'viseme'; visemeIdx: number }
    | { kind: 'transform'; frame: number; prevKey?: MouthKey; ikSiblings?: IKSiblingSnapshot[] };
  const mouthUndoStacks = new WeakMap<MouthLayer, MouthUndoAction[]>();

  function pushMouthTransformUndo(frame = state.currentFrame, ml: MouthLayer = state.mouthLayer): void {
    let st = mouthUndoStacks.get(ml);
    if (!st) {
      st = [];
      mouthUndoStacks.set(ml, st);
    }
    const existing = ml.keys.get(frame);
    st.push({
      kind: 'transform',
      frame,
      prevKey: existing ? { ...existing } : undefined,
    });
    if (st.length > 25) st.shift();
  }

  function pushMouthVisemeUndo(visemeIdx: number, ml: MouthLayer = state.mouthLayer): void {
    let st = mouthUndoStacks.get(ml);
    if (!st) {
      st = [];
      mouthUndoStacks.set(ml, st);
    }
    st.push({ kind: 'viseme', visemeIdx });
    if (st.length > 25) st.shift();
  }

  function setMouthKeyAtCurrentFrame(
    patch: Partial<MouthKey>,
    targetFrame = state.currentFrame,
    ml: MouthLayer = state.mouthLayer
  ): void {
    const cur = getActiveMouthState(ml);
    ml.keys.set(targetFrame, {
      viseme: patch.viseme !== undefined ? patch.viseme : cur.viseme,
      x: patch.x !== undefined ? patch.x : cur.x,
      y: patch.y !== undefined ? patch.y : cur.y,
      scale: patch.scale !== undefined ? patch.scale : cur.scale,
      originDx: patch.originDx !== undefined ? patch.originDx : cur.originDx,
      originDy: patch.originDy !== undefined ? patch.originDy : cur.originDy,
      rotation: patch.rotation !== undefined ? patch.rotation : cur.rotation,
    });
  }

  function applyMouthOriginChange(
    mk: Partial<MouthKey> & { x: number; y: number; originDx?: number; originDy?: number; rotation?: number },
    newOdx: number,
    newOdy: number
  ): void {
    const oldOdx = mk.originDx || 0;
    const oldOdy = mk.originDy || 0;
    const rot = mk.rotation || 0;
    const dx = newOdx - oldOdx;
    const dy = newOdy - oldOdy;
    if (rot !== 0) {
      const c = Math.cos(rot);
      const s = Math.sin(rot);
      mk.x += -dx + (dx * c - dy * s);
      mk.y += -dy + (dx * s + dy * c);
    }
    mk.originDx = newOdx;
    mk.originDy = newOdy;
  }

  function deleteMouthKeyAtFrame(frame: number, ml: MouthLayer = state.mouthLayer): boolean {
    if (!ml.keys.has(frame)) return false;
    ml.keys.delete(frame);
    updateMouthWidget();
    renderTimeline();
    renderStage();
    return true;
  }

  function toggleMouthTrack(forceState?: boolean): void {
    state.showMouthTrack = typeof forceState === 'boolean' ? forceState : !state.showMouthTrack;
    syncLayerTrackContainers();

    if (state.showMouthTrack) {
      state.mouthLayer.visible = true;
      ensureMouthInitInScene(activeScene(), state.mouthLayer);
      if (typeof forceState !== 'boolean') {
        selectTimelineTrack('mouth');
      }
    } else if (state.activeLayer === 'mouth') {
      setActiveLayer('cel');
    }
    updateMouthWidget();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function updateMouthWidget(): void {
    const ml = state.mouthLayer;
    const showWidget = !isBasicMode() && state.showMouthTrack && ml.visible;
    mouthWidget.classList.toggle('open', showWidget);
    mouthLayerNameBadge.textContent = ml.name;
    btnMouthDraw.classList.toggle('active', state.activeLayer === 'mouth' && state.tool !== 'moveCam');
    btnMouthMove.classList.toggle('active', state.activeLayer === 'mouth' && state.tool === 'moveCam');
    syncLayerTrackContainers();

    if (!showWidget) return;
    const cur = getActiveMouthState(ml);
    const vis = ml.visemes[cur.viseme] || ml.visemes[0];
    mouthFrameLabel.textContent = vis.name;
    const scalePct = Math.round(cur.scale || 100);
    mouthScaleSlider.value = String(scalePct);
    mouthScaleVal.textContent = `${scalePct}%`;

    const pctx = mouthPreviewCanvas.getContext('2d');
    if (pctx) {
      pctx.imageSmoothingEnabled = false;
      pctx.clearRect(0, 0, MOUTH_W, MOUTH_H);
      pctx.drawImage(vis.canvas, 0, 0);
    }

    if (mouthSheetPop.classList.contains('open')) renderMouthSheet();
  }

  mouthScaleSlider.oninput = () => {
    if (!state.mouthLayer.visible) state.mouthLayer.visible = true;
    const nextScale = Number(mouthScaleSlider.value);
    setMouthKeyAtCurrentFrame({ scale: nextScale });
    mouthScaleVal.textContent = `${nextScale}%`;
    updateStageBadge();
    renderTimeline();
    renderStage();
  };

  function renderMouthSheet(): void {
    mouthSheetGrid.innerHTML = '';
    const ml = state.mouthLayer;
    const cur = getActiveMouthState(ml);
    ml.visemes.forEach((vis, idx) => {
      const slot = document.createElement('button');
      slot.className = 'mouth-slot' + (idx === cur.viseme ? ' active' : '');
      const c = document.createElement('canvas');
      c.width = MOUTH_W;
      c.height = MOUTH_H;
      const sctx = c.getContext('2d');
      if (sctx) {
        sctx.imageSmoothingEnabled = false;
        sctx.drawImage(vis.canvas, 0, 0);
      }
      slot.appendChild(c);

      const lbl = document.createElement('span');
      lbl.textContent = vis.name;
      slot.appendChild(lbl);

      slot.onclick = () => {
        setMouthKeyAtCurrentFrame({ viseme: idx }, state.currentFrame, ml);
        updateMouthWidget();
        renderTimeline();
        renderStage();
      };
      mouthSheetGrid.appendChild(slot);
    });
  }

  function cycleMouthViseme(dir: number): void {
    const ml = state.mouthLayer;
    if (!ml.visible) ml.visible = true;
    const cur = getActiveMouthState(ml);
    const len = ml.visemes.length;
    const nextIdx = (cur.viseme + dir + len) % len;
    setMouthKeyAtCurrentFrame({ viseme: nextIdx }, state.currentFrame, ml);
    updateMouthWidget();
    renderTimeline();
    renderStage();
  }

  mustEl<HTMLButtonElement>('btnMouthPrev').onclick = () => cycleMouthViseme(-1);
  mustEl<HTMLButtonElement>('btnMouthNext').onclick = () => cycleMouthViseme(1);

  mouthFrameBox.onclick = () => {
    mouthSheetPop.classList.toggle('open');
    if (mouthSheetPop.classList.contains('open')) renderMouthSheet();
  };
  mustEl<HTMLButtonElement>('btnMouthAll').onclick = () => {
    mouthSheetPop.classList.toggle('open');
    if (mouthSheetPop.classList.contains('open')) renderMouthSheet();
  };
  mustEl<HTMLButtonElement>('btnMouthClosePop').onclick = () => mouthSheetPop.classList.remove('open');

  btnMouthDraw.onclick = () => {
    setActiveLayer('mouth');
    if (state.tool === 'moveCam') selectTool('brush');
    updateMouthWidget();
    renderStage();
  };

  btnMouthMove.onclick = () => {
    setActiveLayer('mouth');
    selectTool('moveCam');
    updateMouthWidget();
    renderStage();
  };

  mustEl<HTMLButtonElement>('btnMouthClearShape').onclick = () => {
    const ml = state.mouthLayer;
    const cur = getActiveMouthState(ml);
    const vis = ml.visemes[cur.viseme];
    pushPixelUndo(vis, true);
    pushMouthVisemeUndo(cur.viseme, ml);
    vis.canvas.getContext('2d')?.clearRect(0, 0, MOUTH_W, MOUTH_H);
    updateMouthWidget();
    renderStage();
  };

  mustEl<HTMLButtonElement>('btnMouthResetShape').onclick = () => {
    const ml = state.mouthLayer;
    const cur = getActiveMouthState(ml);
    const vis = ml.visemes[cur.viseme];
    pushPixelUndo(vis, true);
    pushMouthVisemeUndo(cur.viseme, ml);
    if (cur.viseme < VISEME_NAMES.length) {
      drawStarterViseme(vis.canvas, cur.viseme);
    } else {
      vis.canvas.getContext('2d')?.clearRect(0, 0, MOUTH_W, MOUTH_H);
    }
    updateMouthWidget();
    renderStage();
  };

  btnMouthAddShape.onclick = () => {
    const ml = state.mouthLayer;
    if (!ml.visible) ml.visible = true;
    const nextIdx = ml.visemes.length;
    ml.visemes.push({
      name: `Shape ${nextIdx + 1}`,
      canvas: createCelCanvas(MOUTH_W, MOUTH_H),
      undoStack: [],
    });
    setMouthKeyAtCurrentFrame({ viseme: nextIdx }, state.currentFrame, ml);
    updateMouthWidget();
    renderMouthSheet();
    mouthSheetGrid.scrollTop = mouthSheetGrid.scrollHeight;
    renderTimeline();
    renderStage();
    onNotify(`Added Picker shape "${ml.visemes[nextIdx].name}".`);
  };

  let contextMouthFrame = 0;
  let contextMouthLayerId: string | null = null;

  mustEl<HTMLButtonElement>('ctxMouthDelete').onclick = () => {
    const ml =
      (contextMouthLayerId && activeScene().mouthLayers.find((m) => m.id === contextMouthLayerId)) || state.mouthLayer;
    deleteMouthKeyAtFrame(contextMouthFrame, ml);
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxMouthKey').onclick = () => {
    const ml =
      (contextMouthLayerId && activeScene().mouthLayers.find((m) => m.id === contextMouthLayerId)) || state.mouthLayer;
    if (!ml.visible) ml.visible = true;
    setMouthKeyAtCurrentFrame({}, contextMouthFrame, ml);
    updateMouthWidget();
    renderTimeline();
    renderStage();
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxMouthClearAll').onclick = () => {
    const ml =
      (contextMouthLayerId && activeScene().mouthLayers.find((m) => m.id === contextMouthLayerId)) || state.mouthLayer;
    ml.keys.clear();
    updateMouthWidget();
    renderTimeline();
    renderStage();
    hideMenus();
  };

  function getEvaluatedCameraInScene(sc: Scene, frame: number): CameraKey {
    if (!state.applyCamera || sc.cameraKeys.size === 0) {
      return { x: 0, y: 0, scale: 100, ease: 'easeInOut' };
    }
    const exact = sc.cameraKeys.get(frame);
    if (exact) return { ...exact };

    let prevF: number | null = null;
    let nextF: number | null = null;
    for (const f of sc.cameraKeys.keys()) {
      if (f < frame && (prevF === null || f > prevF)) prevF = f;
      if (f > frame && (nextF === null || f < nextF)) nextF = f;
    }

    if (prevF !== null && nextF !== null) {
      const a = sc.cameraKeys.get(prevF)!;
      const b = sc.cameraKeys.get(nextF)!;
      let t = (frame - prevF) / (nextF - prevF);
      if (a.ease === 'easeInOut') {
        t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      }
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        scale: a.scale + (b.scale - a.scale) * t,
        ease: a.ease,
      };
    }

    if (prevF !== null) return { ...sc.cameraKeys.get(prevF)! };
    if (nextF !== null) return { ...sc.cameraKeys.get(nextF)! };
    return { x: 0, y: 0, scale: 100, ease: 'easeInOut' };
  }

  function getEvaluatedCamera(frame: number): CameraKey {
    if (nestStack.length > 0) return { x: 0, y: 0, scale: 100, ease: 'linear' };
    return getEvaluatedCameraInScene(activeScene(), frame);
  }

  const onionCanvas = createCelCanvas();
  const onionCtx = onionCanvas.getContext('2d')!;
  onionCtx.imageSmoothingEnabled = false;

  const nestOnionCanvas = createCelCanvas();
  const nestOnionCtx = nestOnionCanvas.getContext('2d')!;
  nestOnionCtx.imageSmoothingEnabled = false;

  const vectorScratchCanvas = createCelCanvas();
  const vectorScratchCtx = vectorScratchCanvas.getContext('2d')!;
  const vectorPixelCanvas = createCelCanvas();
  const vectorPixelCtx = vectorPixelCanvas.getContext('2d')!;
  vectorPixelCtx.imageSmoothingEnabled = false;

  function getClipLoopFrame(clip: NestedClip, outerFrame: number, originFrame = 0): number {
    const len = Math.max(1, clip.totalFrames);
    const rel = outerFrame - originFrame;
    return ((rel % len) + len) % len;
  }

  function doesClipHaveInk(sc: Scene, clipId: string, depth = 0): boolean {
    if (depth > 12) return false;
    const clip = sc.nestedClips.get(clipId);
    if (!clip) return false;
    for (const cTrk of clip.celTracks) {
      for (const c of cTrk.cels.values()) {
        if (c.nestId) {
          if (doesClipHaveInk(sc, c.nestId, depth + 1)) return true;
        } else if (c.hasInk) {
          return true;
        }
      }
    }
    for (const trk of clip.vectorTracks) {
      for (const vc of trk.cels.values()) {
        if (vc.nestId) {
          if (doesClipHaveInk(sc, vc.nestId, depth + 1)) return true;
        } else if (vc.hasInk || vc.items.length > 0) {
          return true;
        }
      }
    }
    return false;
  }

  function isCelInkFilled(sc: Scene, cel: Cel): boolean {
    if (cel.nestId) return doesClipHaveInk(sc, cel.nestId);
    return cel.hasInk;
  }

  function isVectorCelInkFilled(sc: Scene, vCel: VectorCel): boolean {
    if (vCel.nestId) return doesClipHaveInk(sc, vCel.nestId);
    return vCel.hasInk || vCel.items.length > 0;
  }

  function drawTransformedCanvas(
    targetCtx: CanvasRenderingContext2D,
    srcCanvas: HTMLCanvasElement,
    offsetX: number,
    offsetY: number,
    ox = 0,
    oy = 0,
    rotation = 0,
    dw?: number,
    dh?: number,
    scale = 1
  ): void {
    targetCtx.save();
    targetCtx.imageSmoothingEnabled = false;
    if (rotation || scale !== 1) {
      targetCtx.translate(offsetX + ox, offsetY + oy);
      if (rotation) targetCtx.rotate(rotation);
      if (scale !== 1) targetCtx.scale(scale, scale);
      targetCtx.translate(-ox, -oy);
    } else {
      targetCtx.translate(offsetX, offsetY);
    }
    if (typeof dw === 'number' && typeof dh === 'number') {
      targetCtx.drawImage(srcCanvas, 0, 0, dw, dh);
    } else {
      targetCtx.drawImage(srcCanvas, 0, 0);
    }
    targetCtx.restore();
  }

  function renderVectorItemsWithOffset(
    targetCtx: CanvasRenderingContext2D,
    items: VectorItem[],
    offsetX: number,
    offsetY: number,
    targetW: number,
    targetH: number,
    cam: CameraKey,
    totalViewScale: number,
    vx: number,
    vy: number,
    alpha = 1,
    tintColor?: string,
    ox = 0,
    oy = 0,
    rotation = 0,
    parentMat: Mat2D = MAT_ID,
    scale = 1
  ): void {
    if (items.length === 0) return;
    if (state.vectorPixelPreview) {
      if (vectorPixelCanvas.width !== WORLD_W || vectorPixelCanvas.height !== WORLD_H) {
        vectorPixelCanvas.width = WORLD_W;
        vectorPixelCanvas.height = WORLD_H;
      }
      vectorPixelCtx.setTransform(1, 0, 0, 1, 0, 0);
      vectorPixelCtx.clearRect(0, 0, WORLD_W, WORLD_H);
      vectorPixelCtx.save();
      if (!isIdentityMat(parentMat)) {
        vectorPixelCtx.transform(...parentMat);
      }
      if (rotation || scale !== 1) {
        vectorPixelCtx.translate(offsetX + ox, offsetY + oy);
        if (rotation) vectorPixelCtx.rotate(rotation);
        if (scale !== 1) vectorPixelCtx.scale(scale, scale);
        vectorPixelCtx.translate(-ox, -oy);
      } else {
        vectorPixelCtx.translate(offsetX, offsetY);
      }
      drawVectorItemsToContext(vectorPixelCtx, items, true);
      vectorPixelCtx.restore();

      const imgData = vectorPixelCtx.getImageData(0, 0, WORLD_W, WORLD_H);
      const d = imgData.data;
      // Coverage bias toward solid pixels so thin strokes never drop out
      for (let i = 3; i < d.length; i += 4) {
        const a = d[i];
        if (a > 0) d[i] = a >= 12 ? 255 : 0;
      }
      vectorPixelCtx.putImageData(imgData, 0, 0);

      if (tintColor) {
        drawTintedCanvas(targetCtx, vectorPixelCanvas, 0, 0, tintColor, alpha);
      } else {
        targetCtx.save();
        targetCtx.imageSmoothingEnabled = false;
        targetCtx.globalAlpha = alpha;
        targetCtx.drawImage(vectorPixelCanvas, 0, 0);
        targetCtx.restore();
      }
      return;
    }

    if (vectorScratchCanvas.width !== targetW || vectorScratchCanvas.height !== targetH) {
      vectorScratchCanvas.width = targetW;
      vectorScratchCanvas.height = targetH;
    }
    const cs = cam.scale / 100;
    vectorScratchCtx.setTransform(1, 0, 0, 1, 0, 0);
    vectorScratchCtx.clearRect(0, 0, targetW, targetH);

    vectorScratchCtx.save();
    vectorScratchCtx.imageSmoothingEnabled = true;
    vectorScratchCtx.translate(targetW / 2 + vx, targetH / 2 + vy);
    vectorScratchCtx.scale(totalViewScale, totalViewScale);
    vectorScratchCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

    // Clip to the fixed canvas frame before applying camera pan/scale
    vectorScratchCtx.beginPath();
    vectorScratchCtx.rect(0, 0, WORLD_W, WORLD_H);
    vectorScratchCtx.clip();

    vectorScratchCtx.translate(WORLD_W / 2 + cam.x, WORLD_H / 2 + cam.y);
    vectorScratchCtx.scale(cs, cs);
    vectorScratchCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

    if (!isIdentityMat(parentMat)) {
      vectorScratchCtx.transform(...parentMat);
    }

    if (rotation || scale !== 1) {
      vectorScratchCtx.translate(offsetX + ox, offsetY + oy);
      if (rotation) vectorScratchCtx.rotate(rotation);
      if (scale !== 1) vectorScratchCtx.scale(scale, scale);
      vectorScratchCtx.translate(-ox, -oy);
    } else {
      vectorScratchCtx.translate(offsetX, offsetY);
    }
    drawVectorItemsToContext(vectorScratchCtx, items);
    vectorScratchCtx.restore();

    if (tintColor) {
      vectorScratchCtx.save();
      vectorScratchCtx.setTransform(1, 0, 0, 1, 0, 0);
      vectorScratchCtx.globalCompositeOperation = 'source-in';
      vectorScratchCtx.fillStyle = tintColor;
      vectorScratchCtx.fillRect(0, 0, targetW, targetH);
      vectorScratchCtx.restore();
    }

    targetCtx.save();
    targetCtx.setTransform(1, 0, 0, 1, 0, 0);
    targetCtx.globalAlpha = alpha;
    targetCtx.imageSmoothingEnabled = true;
    targetCtx.drawImage(vectorScratchCanvas, 0, 0);
    targetCtx.restore();
  }

  function renderVectorCelToContext(
    rootSc: Scene,
    targetCtx: CanvasRenderingContext2D,
    vCel: VectorCel,
    targetW: number,
    targetH: number,
    cam: CameraKey,
    totalViewScale: number,
    vx: number,
    vy: number,
    alpha = 1,
    tintColor?: string,
    parentMat: Mat2D = MAT_ID,
    overrideOffsetX?: number,
    overrideOffsetY?: number,
    overrideScale?: number,
    overrideRotation?: number
  ): void {
    const ox = typeof overrideOffsetX === 'number' ? overrideOffsetX : vCel.offsetX;
    const oy = typeof overrideOffsetY === 'number' ? overrideOffsetY : vCel.offsetY;
    const rot = typeof overrideRotation === 'number' ? overrideRotation : vCel.rotation || 0;
    const sc = typeof overrideScale === 'number' ? overrideScale : vCel.scale ?? 1;
    const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'vector', vCel) : { ox: 0, oy: 0 };
    renderVectorItemsWithOffset(
      targetCtx,
      vCel.items,
      ox,
      oy,
      targetW,
      targetH,
      cam,
      totalViewScale,
      vx,
      vy,
      alpha,
      tintColor,
      piv.ox,
      piv.oy,
      rot,
      parentMat,
      sc
    );
  }

  function renderNestedClipAtFrame(
    sc: Scene,
    targetCtx: CanvasRenderingContext2D,
    clipId: string,
    outerFrame: number,
    originFrame: number,
    outerMat: Mat2D,
    targetW: number,
    targetH: number,
    cam: CameraKey,
    totalViewScale: number,
    vx: number,
    vy: number,
    depth = 0
  ): void {
    if (depth > 12) return;
    const clip = sc.nestedClips.get(clipId);
    if (!clip) return;
    normalizeTargetHierarchy(clip);
    const clipFrame = getClipLoopFrame(clip, outerFrame, originFrame);

    for (let li = clip.layerOrder.length - 1; li >= 0; li--) {
      const layerKey = clip.layerOrder[li];
      const pMat = getParentWorldMatrix(sc, clip, layerKey, clipFrame);
      const combMat: Mat2D = isIdentityMat(outerMat) ? pMat : mulMat(outerMat, pMat);

      if (layerKey.startsWith('cel:')) {
        const cTrk = clip.celTracks.find((t) => t.id === layerKey.slice(4));
        if (!cTrk || !cTrk.visible) continue;
        const subCel = getCelEntryInMap(cTrk.cels, clipFrame);
        if (!subCel) continue;
        const subOff = getCelOffsetAtFrame(subCel.cel, subCel.start, clipFrame);
        const subRot = subOff.rotation;
        const subSc = subOff.scale;
        const subPiv = subRot || subSc !== 1 ? getLayerPivotLocal(sc, 'cel', subCel.cel) : { ox: 0, oy: 0 };
        if (subCel.cel.nestId) {
          const selfMat = makeLayerLocalTransform(subOff.offsetX, subOff.offsetY, subPiv.ox, subPiv.oy, subRot, subSc);
          const nextOuter = mulMat(combMat, selfMat);
          renderNestedClipAtFrame(
            sc,
            targetCtx,
            subCel.cel.nestId,
            clipFrame,
            subCel.cel.nestOriginFrame ?? 0,
            nextOuter,
            targetW,
            targetH,
            cam,
            totalViewScale,
            vx,
            vy,
            depth + 1
          );
        } else {
          targetCtx.save();
          if (!isIdentityMat(combMat)) targetCtx.transform(...combMat);
          drawTransformedCanvas(targetCtx, subCel.cel.canvas, subOff.offsetX, subOff.offsetY, subPiv.ox, subPiv.oy, subRot, undefined, undefined, subSc);
          targetCtx.restore();
        }
      } else if (layerKey.startsWith('vector:')) {
        const trk = clip.vectorTracks.find((t) => t.id === layerKey.slice(7));
        if (!trk || !trk.visible) continue;
        const subVCel = getVectorCelEntryInMap(trk.cels, clipFrame);
        if (!subVCel) continue;
        const vOff = getCelOffsetAtFrame(subVCel.cel, subVCel.start, clipFrame);
        const vRot = vOff.rotation;
        const vSc = vOff.scale;
        const vPiv = vRot || vSc !== 1 ? getLayerPivotLocal(sc, 'vector', subVCel.cel) : { ox: 0, oy: 0 };
        if (subVCel.cel.nestId) {
          const selfMat = makeLayerLocalTransform(vOff.offsetX, vOff.offsetY, vPiv.ox, vPiv.oy, vRot, vSc);
          const nextOuter = mulMat(combMat, selfMat);
          renderNestedClipAtFrame(
            sc,
            targetCtx,
            subVCel.cel.nestId,
            clipFrame,
            subVCel.cel.nestOriginFrame ?? 0,
            nextOuter,
            targetW,
            targetH,
            cam,
            totalViewScale,
            vx,
            vy,
            depth + 1
          );
        } else if (subVCel.cel.items.length > 0) {
          renderVectorItemsWithOffset(
            targetCtx,
            subVCel.cel.items,
            vOff.offsetX,
            vOff.offsetY,
            targetW,
            targetH,
            cam,
            totalViewScale,
            vx,
            vy,
            1,
            undefined,
            vPiv.ox,
            vPiv.oy,
            vRot,
            combMat,
            vSc
          );
        }
      }
    }
  }

  function rasterizeNestedClipToWorldCanvas(sc: Scene, clipId: string, outerFrame: number, originFrame: number): HTMLCanvasElement {
    if (nestOnionCanvas.width !== WORLD_W || nestOnionCanvas.height !== WORLD_H) {
      nestOnionCanvas.width = WORLD_W;
      nestOnionCanvas.height = WORLD_H;
    }
    nestOnionCtx.setTransform(1, 0, 0, 1, 0, 0);
    nestOnionCtx.clearRect(0, 0, WORLD_W, WORLD_H);
    const idCam: CameraKey = { x: 0, y: 0, scale: 100, ease: 'linear' };
    renderNestedClipAtFrame(
      sc,
      nestOnionCtx,
      clipId,
      outerFrame,
      originFrame,
      MAT_ID,
      WORLD_W,
      WORLD_H,
      idCam,
      1,
      0,
      0,
      0
    );
    return nestOnionCanvas;
  }

  function drawTintedCanvas(
    targetCtx: CanvasRenderingContext2D,
    srcCanvas: HTMLCanvasElement,
    offsetX: number,
    offsetY: number,
    tintColor: string,
    alpha: number,
    ox = 0,
    oy = 0,
    rotation = 0,
    scale = 1
  ): void {
    const w = srcCanvas.width;
    const h = srcCanvas.height;
    if (onionCanvas.width !== w || onionCanvas.height !== h) {
      onionCanvas.width = w;
      onionCanvas.height = h;
    }
    onionCtx.imageSmoothingEnabled = false;
    onionCtx.clearRect(0, 0, w, h);
    onionCtx.globalCompositeOperation = 'source-over';
    onionCtx.drawImage(srcCanvas, 0, 0);
    onionCtx.globalCompositeOperation = 'source-in';
    onionCtx.fillStyle = tintColor;
    onionCtx.fillRect(0, 0, w, h);
    onionCtx.globalCompositeOperation = 'source-over';

    targetCtx.save();
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.globalAlpha = alpha;
    if (rotation || scale !== 1) {
      targetCtx.translate(offsetX + ox, offsetY + oy);
      if (rotation) targetCtx.rotate(rotation);
      if (scale !== 1) targetCtx.scale(scale, scale);
      targetCtx.translate(-ox, -oy);
    } else {
      targetCtx.translate(offsetX, offsetY);
    }
    targetCtx.drawImage(onionCanvas, 0, 0);
    targetCtx.restore();
  }

  function drawTintedCel(
    rootSc: Scene,
    targetCtx: CanvasRenderingContext2D,
    cel: Cel,
    tintColor: string,
    alpha: number,
    overrideOffsetX?: number,
    overrideOffsetY?: number,
    overrideScale?: number,
    overrideRotation?: number
  ): void {
    const rot = typeof overrideRotation === 'number' ? overrideRotation : cel.rotation || 0;
    const sc = typeof overrideScale === 'number' ? overrideScale : cel.scale ?? 1;
    const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'cel', cel) : { ox: 0, oy: 0 };
    drawTintedCanvas(
      targetCtx,
      cel.canvas,
      typeof overrideOffsetX === 'number' ? overrideOffsetX : cel.offsetX,
      typeof overrideOffsetY === 'number' ? overrideOffsetY : cel.offsetY,
      tintColor,
      alpha,
      piv.ox,
      piv.oy,
      rot,
      sc
    );
  }


  type ActiveLayerGizmoInfo = {
    layer: 'cel' | 'vector' | 'bg' | 'mouth';
    layerKey: string;
    worldOx: number;
    worldOy: number;
    ox: number;
    oy: number;
    rotation: number;
    localRotation: number;
    scale: number;
    parentRot: number;
    parentMat: Mat2D;
    defaultOx: number;
    defaultOy: number;
    orbitRadius: number;
    handleX: number;
    handleY: number;
    celEntry?: { start: number; cel: Cel } | null;
    vecEntry?: { start: number; cel: VectorCel } | null;
  };

  function getActiveLayerGizmoInfo(rootSc: Scene, frame: number, invScale = 1): ActiveLayerGizmoInfo | null {
    if (isBasicMode() || state.tool !== 'moveCam') return null;
    const target = activeTimelineTarget();
    const orbitRadius = 52 * invScale;
    const makeResult = (
      layer: 'cel' | 'vector' | 'bg' | 'mouth',
      layerKey: string,
      localWorldOx: number,
      localWorldOy: number,
      ox: number,
      oy: number,
      localRotation: number,
      scale: number,
      defaultOx: number,
      defaultOy: number,
      extra?: { celEntry?: { start: number; cel: Cel } | null; vecEntry?: { start: number; cel: VectorCel } | null }
    ): ActiveLayerGizmoInfo => {
      const parentMat = getParentWorldMatrix(rootSc, target, layerKey, frame);
      const parentRot = isIdentityMat(parentMat) ? 0 : Math.atan2(parentMat[1], parentMat[0]);
      const wp = isIdentityMat(parentMat) ? { x: localWorldOx, y: localWorldOy } : applyMatPt(parentMat, { x: localWorldOx, y: localWorldOy });
      const totalRot = parentRot + localRotation;
      const ang = totalRot - Math.PI / 2;
      return {
        layer,
        layerKey,
        worldOx: wp.x,
        worldOy: wp.y,
        ox,
        oy,
        rotation: totalRot,
        localRotation,
        scale,
        parentRot,
        parentMat,
        defaultOx,
        defaultOy,
        orbitRadius,
        handleX: wp.x + Math.cos(ang) * orbitRadius,
        handleY: wp.y + Math.sin(ang) * orbitRadius,
        ...extra,
      };
    };

    if (state.activeLayer === 'cel') {
      const activeTrk = getActiveCelTrackInTarget(target);
      if (!activeTrk.visible) return null;
      const key = `cel:${activeTrk.id}`;
      const entry = getCelEntryInMap(activeTrk.cels, frame);
      if (entry) {
        const off = getCelOffsetAtFrame(entry.cel, entry.start, frame);
        const def = getCelVisualAnchor(rootSc, entry.cel);
        const piv = getLayerPivotLocal(rootSc, 'cel', entry.cel);
        return makeResult(
          'cel',
          key,
          off.offsetX + piv.ox,
          off.offsetY + piv.oy,
          piv.ox,
          piv.oy,
          off.rotation,
          off.scale,
          def.ax,
          def.ay,
          { celEntry: entry }
        );
      }
      return makeResult('cel', key, WORLD_W * 0.5, WORLD_H * 0.5, WORLD_W * 0.5, WORLD_H * 0.5, 0, 1, WORLD_W * 0.5, WORLD_H * 0.5, {
        celEntry: null,
      });
    }

    if (state.activeLayer === 'vector') {
      const activeTrk = getActiveVectorTrackInTarget(target);
      if (!activeTrk.visible) return null;
      const key = `vector:${activeTrk.id}`;
      const entry = getVectorCelEntryInMap(activeTrk.cels, frame);
      if (entry) {
        const off = getCelOffsetAtFrame(entry.cel, entry.start, frame);
        const def = computeVectorCelCenter(rootSc, entry.cel);
        const piv = getLayerPivotLocal(rootSc, 'vector', entry.cel);
        return makeResult(
          'vector',
          key,
          off.offsetX + piv.ox,
          off.offsetY + piv.oy,
          piv.ox,
          piv.oy,
          off.rotation,
          off.scale,
          def.ax,
          def.ay,
          { vecEntry: entry }
        );
      }
      return makeResult('vector', key, WORLD_W * 0.5, WORLD_H * 0.5, WORLD_W * 0.5, WORLD_H * 0.5, 0, 1, WORLD_W * 0.5, WORLD_H * 0.5, {
        vecEntry: null,
      });
    }

    if (state.activeLayer === 'bg' && nestStack.length === 0) {
      const bg = getActiveBgLayerInScene(rootSc);
      if (!bg.visible) return null;
      const key = `bg:${bg.id}`;
      const def = bg.hasInk ? computeCanvasInkCenter(bg.canvas) || { ax: WORLD_W * 0.5, ay: WORLD_H * 0.5 } : { ax: WORLD_W * 0.5, ay: WORLD_H * 0.5 };
      const piv = getLayerPivotLocal(rootSc, 'bg', bg);
      return makeResult('bg', key, bg.offsetX + piv.ox, bg.offsetY + piv.oy, piv.ox, piv.oy, bg.rotation || 0, bg.scale ?? 1, def.ax, def.ay);
    }

    if (state.activeLayer === 'mouth' && nestStack.length === 0) {
      const ml = getActiveMouthLayerInScene(rootSc);
      if (!ml.visible) return null;
      const key = `mouth:${ml.id}`;
      const m: MouthKey = getEvaluatedMouthInScene(rootSc, frame, ml) || {
        viseme: 0,
        x: Math.round(WORLD_W / 2),
        y: Math.round(WORLD_H * 0.56),
        scale: 100,
      };
      const odx = m.originDx || 0;
      const ody = m.originDy || 0;
      return makeResult('mouth', key, m.x + odx, m.y + ody, odx, ody, m.rotation || 0, (m.scale || 100) / 100, 0, 0);
    }

    return null;
  }

  function renderStageOverlayGuides(
    targetCtx: CanvasRenderingContext2D,
    cam: CameraKey,
    totalViewScale: number,
    frame = state.currentFrame,
    rootSc: Scene = activeScene()
  ): void {
    const cs = cam.scale / 100;
    const inv = 1 / (totalViewScale * cs);

    if (!state.isPlaying && !isBasicMode() && (state.activeLayer === 'cel' || state.activeLayer === 'vector')) {
      const target = activeTimelineTarget();
      const isVec = state.activeLayer === 'vector';
      const activeKey = getLayerKeyForActive(target);
      const trkVisible = isVec
        ? getActiveVectorTrackInTarget(target).visible
        : getActiveCelTrackInTarget(target).visible;
      const motionEntry: { start: number; cel: Cel | VectorCel } | null = trkVisible
        ? isVec
          ? getVectorCelEntryInMap(getActiveVectorTrackInTarget(target).cels, frame)
          : getCelEntryInScene(target, frame)
        : null;
      const keys = motionEntry ? getActivePosKeys(motionEntry.cel) : [];
      if (motionEntry && keys.length >= 2) {
        const { ax, ay } = isVec
          ? computeVectorCelCenter(rootSc, motionEntry.cel as VectorCel)
          : getCelVisualAnchor(rootSc, motionEntry.cel as Cel);
        const curRel = frame - motionEntry.start;
        const fullKeys = motionEntry.cel.posKeys || [];
        const isMoveTool = state.tool === 'moveCam';
        const celParentMat = getParentWorldMatrix(rootSc, target, activeKey, frame);

        targetCtx.save();
        if (!isIdentityMat(celParentMat)) targetCtx.transform(...celParentMat);

        for (let i = 0; i < keys.length - 1; i++) {
          const a = keys[i];
          const b = keys[i + 1];
          const fullIdx = fullKeys.indexOf(a);
          const p0 = { x: a.offsetX + ax, y: a.offsetY + ay };
          const p2 = { x: b.offsetX + ax, y: b.offsetY + ay };
          const mx = (p0.x + p2.x) * 0.5;
          const my = (p0.y + p2.y) * 0.5;
          const pc = { x: mx + (a.ctrlDx ?? 0), y: my + (a.ctrlDy ?? 0) };
          const isCurved = Math.hypot(a.ctrlDx ?? 0, a.ctrlDy ?? 0) > 1;
          const isHoverSeg =
            hoverMotionHit &&
            (hoverMotionHit.kind === 'curveHandle' || hoverMotionHit.kind === 'segment') &&
            hoverMotionHit.segIndex === fullIdx;

          if (isMoveTool && (isCurved || isHoverSeg)) {
            targetCtx.beginPath();
            targetCtx.moveTo(p0.x, p0.y);
            targetCtx.lineTo(pc.x, pc.y);
            targetCtx.lineTo(p2.x, p2.y);
            targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
            targetCtx.lineWidth = 1 * inv;
            targetCtx.setLineDash([3 * inv, 3 * inv]);
            targetCtx.stroke();
            targetCtx.setLineDash([]);
          }

          if (b.relFrame <= curRel) {
            targetCtx.beginPath();
            targetCtx.moveTo(p0.x, p0.y);
            targetCtx.quadraticCurveTo(pc.x, pc.y, p2.x, p2.y);
            targetCtx.strokeStyle = isHoverSeg ? '#7dd3fc' : '#38bdf8';
            targetCtx.lineWidth = (isHoverSeg ? 3.2 : 2.3) * inv;
            targetCtx.setLineDash([]);
            targetCtx.stroke();
          } else if (a.relFrame >= curRel) {
            targetCtx.beginPath();
            targetCtx.moveTo(p0.x, p0.y);
            targetCtx.quadraticCurveTo(pc.x, pc.y, p2.x, p2.y);
            targetCtx.strokeStyle = isHoverSeg ? '#fde68a' : '#fbbf24';
            targetCtx.lineWidth = (isHoverSeg ? 3.0 : 2.1) * inv;
            targetCtx.setLineDash([7 * inv, 5 * inv]);
            targetCtx.stroke();
            targetCtx.setLineDash([]);
          } else {
            const t = (curRel - a.relFrame) / Math.max(1, b.relFrame - a.relFrame);
            const q0 = { x: p0.x + (pc.x - p0.x) * t, y: p0.y + (pc.y - p0.y) * t };
            const q1 = { x: pc.x + (p2.x - pc.x) * t, y: pc.y + (p2.y - pc.y) * t };
            const pm = { x: q0.x + (q1.x - q0.x) * t, y: q0.y + (q1.y - q0.y) * t };

            targetCtx.beginPath();
            targetCtx.moveTo(p0.x, p0.y);
            targetCtx.quadraticCurveTo(q0.x, q0.y, pm.x, pm.y);
            targetCtx.strokeStyle = isHoverSeg ? '#7dd3fc' : '#38bdf8';
            targetCtx.lineWidth = (isHoverSeg ? 3.2 : 2.3) * inv;
            targetCtx.setLineDash([]);
            targetCtx.stroke();

            targetCtx.beginPath();
            targetCtx.moveTo(pm.x, pm.y);
            targetCtx.quadraticCurveTo(q1.x, q1.y, p2.x, p2.y);
            targetCtx.strokeStyle = isHoverSeg ? '#fde68a' : '#fbbf24';
            targetCtx.lineWidth = (isHoverSeg ? 3.0 : 2.1) * inv;
            targetCtx.setLineDash([7 * inv, 5 * inv]);
            targetCtx.stroke();
            targetCtx.setLineDash([]);
          }

          for (let f = a.relFrame + 1; f < b.relFrame; f++) {
            const t = (f - a.relFrame) / (b.relFrame - a.relFrame);
            const pt = evalSegmentPoint(a, b, t);
            targetCtx.beginPath();
            targetCtx.arc(pt.x + ax, pt.y + ay, 2.2 * inv, 0, Math.PI * 2);
            targetCtx.fillStyle = f <= curRel ? 'rgba(56, 189, 248, 0.9)' : 'rgba(251, 191, 36, 0.8)';
            targetCtx.fill();
          }

          if (isMoveTool) {
            const mid = evalSegmentPoint(a, b, 0.5);
            const hx = mid.x + ax;
            const hy = mid.y + ay;
            const isHandleHover = hoverMotionHit?.kind === 'curveHandle' && hoverMotionHit.segIndex === fullIdx;
            const hr = (isHandleHover ? 5.6 : 4.2) * inv;
            targetCtx.beginPath();
            targetCtx.arc(hx, hy, hr, 0, Math.PI * 2);
            targetCtx.fillStyle = isCurved ? '#f59e0b' : '#181a1f';
            targetCtx.fill();
            targetCtx.strokeStyle = isHandleHover ? '#ffffff' : '#fbbf24';
            targetCtx.lineWidth = 1.6 * inv;
            targetCtx.stroke();
          }
        }

        if (isMoveTool) {
          const curOff = getCelOffsetAtFrame(motionEntry.cel, motionEntry.start, frame);
          const cx = curOff.offsetX + ax;
          const cy = curOff.offsetY + ay;
          targetCtx.beginPath();
          targetCtx.arc(cx, cy, 4.5 * inv, 0, Math.PI * 2);
          targetCtx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
          targetCtx.lineWidth = 1.4 * inv;
          targetCtx.stroke();
        }

        targetCtx.font = `600 ${Math.round(10 * inv)}px system-ui, sans-serif`;
        targetCtx.textAlign = 'center';
        targetCtx.textBaseline = 'bottom';

        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          const fullIdx = fullKeys.indexOf(k);
          const kx = k.offsetX + ax;
          const ky = k.offsetY + ay;
          const isCurr = k.relFrame === curRel;
          const isPast = k.relFrame < curRel;
          const isHoverKey = hoverMotionHit?.kind === 'key' && hoverMotionHit.keyIndex === fullIdx;
          const kr = (isCurr ? 6.5 : isHoverKey ? 6.2 : 5) * inv;

          targetCtx.beginPath();
          targetCtx.moveTo(kx, ky - kr);
          targetCtx.lineTo(kx + kr, ky);
          targetCtx.lineTo(kx, ky + kr);
          targetCtx.lineTo(kx - kr, ky);
          targetCtx.closePath();
          targetCtx.fillStyle = isCurr ? '#4ade80' : isPast ? '#38bdf8' : '#fbbf24';
          targetCtx.fill();
          targetCtx.strokeStyle = isHoverKey ? '#ffffff' : '#0f1115';
          targetCtx.lineWidth = 1.5 * inv;
          targetCtx.stroke();

          if (isMoveTool || isCurr) {
            const label = `F${motionEntry.start + k.relFrame + 1}`;
            targetCtx.fillStyle = 'rgba(15, 17, 21, 0.78)';
            const tw = targetCtx.measureText(label).width + 6 * inv;
            const th = 12 * inv;
            targetCtx.fillRect(kx - tw * 0.5, ky - kr - th - 2 * inv, tw, th);
            targetCtx.fillStyle = isCurr ? '#4ade80' : isPast ? '#bae6fd' : '#fde68a';
            targetCtx.fillText(label, kx, ky - kr - 2.5 * inv);
          }
        }

        targetCtx.restore();
      }
    }

    const showBrushPreview =
      !state.isPlaying &&
      hoverStagePt &&
      (state.tool === 'brush' || state.tool === 'eraser' || isRightErasing);
    if (showBrushPreview && hoverStagePt) {
      const wp = stageToWorld(hoverStagePt, cam);
      const eraseStyle = state.tool === 'eraser' || isRightErasing;
      const invScale = 1 / (totalViewScale * cs);

      if (state.activeLayer === 'vector') {
        const r = Math.max(0.5, state.brushSize / 2);
        targetCtx.save();
        targetCtx.beginPath();
        targetCtx.arc(wp.x, wp.y, r, 0, Math.PI * 2);
        targetCtx.fillStyle = eraseStyle ? 'rgba(239, 68, 68, 0.22)' : state.brushColor;
        targetCtx.globalAlpha = eraseStyle ? 1 : 0.35;
        targetCtx.fill();
        targetCtx.globalAlpha = 1;
        targetCtx.strokeStyle = 'rgba(255,255,255,0.9)';
        targetCtx.lineWidth = Math.max(1.2 * invScale, 0.12);
        targetCtx.stroke();
        targetCtx.strokeStyle = eraseStyle ? '#ef4444' : 'rgba(0,0,0,0.9)';
        targetCtx.lineWidth = Math.max(0.75 * invScale, 0.06);
        targetCtx.stroke();
        targetCtx.restore();
      } else {
        const wx = Math.round(wp.x);
        const wy = Math.round(wp.y);
        const { cells, edges } = getBrushMask(state.brushSize);

        targetCtx.fillStyle = eraseStyle ? 'rgba(239, 68, 68, 0.22)' : state.brushColor;
        targetCtx.globalAlpha = eraseStyle ? 1 : 0.35;
        for (const { dx, dy } of cells) {
          targetCtx.fillRect(wx + dx, wy + dy, 1, 1);
        }

        targetCtx.globalAlpha = 1;
        targetCtx.beginPath();
        for (const ed of edges) {
          targetCtx.moveTo(wx + ed.x1, wy + ed.y1);
          targetCtx.lineTo(wx + ed.x2, wy + ed.y2);
        }
        targetCtx.strokeStyle = 'rgba(255,255,255,0.9)';
        targetCtx.lineWidth = Math.max(1.2 * invScale, 0.12);
        targetCtx.stroke();

        targetCtx.strokeStyle = eraseStyle ? '#ef4444' : 'rgba(0,0,0,0.9)';
        targetCtx.lineWidth = Math.max(0.75 * invScale, 0.06);
        targetCtx.stroke();
      }
    } else if (
      !state.isPlaying &&
      hoverStagePt &&
      (state.activeLayer === 'vector' || state.activeLayer === 'cel') &&
      state.tool === 'nudge'
    ) {
      const wp = stageToWorld(hoverStagePt, cam);
      const r = state.nudgeRadius;
      const invScale = 1 / (totalViewScale * cs);
      const isCelNudge = state.activeLayer === 'cel';
      targetCtx.save();
      targetCtx.beginPath();
      targetCtx.arc(wp.x, wp.y, r, 0, Math.PI * 2);
      targetCtx.fillStyle = isCelNudge ? 'rgba(74, 222, 128, 0.08)' : 'rgba(56, 189, 248, 0.08)';
      targetCtx.fill();
      targetCtx.strokeStyle = isCelNudge ? '#4ade80' : '#38bdf8';
      targetCtx.lineWidth = Math.max(1.6 * invScale, 0.2);
      if (!isCelNudge) targetCtx.setLineDash([6 * invScale, 4 * invScale]);
      targetCtx.stroke();

      if (!isCelNudge) {
        targetCtx.beginPath();
        targetCtx.arc(wp.x, wp.y, r * 0.5, 0, Math.PI * 2);
        targetCtx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
        targetCtx.lineWidth = Math.max(1 * invScale, 0.12);
        targetCtx.setLineDash([3 * invScale, 3 * invScale]);
        targetCtx.stroke();
      }

      targetCtx.setLineDash([]);
      targetCtx.beginPath();
      const cross = 5 * invScale;
      targetCtx.moveTo(wp.x - cross, wp.y);
      targetCtx.lineTo(wp.x + cross, wp.y);
      targetCtx.moveTo(wp.x, wp.y - cross);
      targetCtx.lineTo(wp.x, wp.y + cross);
      targetCtx.strokeStyle = '#ffffff';
      targetCtx.lineWidth = Math.max(1.4 * invScale, 0.15);
      targetCtx.stroke();
      targetCtx.restore();
    }

    if (!state.isPlaying && !isBasicMode() && state.tool === 'moveCam' && state.showOriginPoint) {
      const gizmo = getActiveLayerGizmoInfo(rootSc, frame, inv);
      if (gizmo) {
        const showRotateControls =
          state.tool === 'moveCam' ||
          moveCamState?.mode === 'moveOrigin' ||
          moveCamState?.mode === 'rotateLayer';
        const isHoverOrigin = hoverOriginGizmoPart === 'origin' || moveCamState?.mode === 'moveOrigin';
        const isHoverHandle = hoverOriginGizmoPart === 'rotateHandle' || moveCamState?.mode === 'rotateLayer';
        const oR = (isHoverOrigin ? 15 : 12) * inv;

        targetCtx.save();
        if (showRotateControls) {
          targetCtx.beginPath();
          targetCtx.arc(gizmo.worldOx, gizmo.worldOy, gizmo.orbitRadius, 0, Math.PI * 2);
          targetCtx.strokeStyle = 'rgba(249, 115, 22, 0.52)';
          targetCtx.lineWidth = 1.6 * inv;
          targetCtx.setLineDash([4 * inv, 4 * inv]);
          targetCtx.stroke();
          targetCtx.setLineDash([]);

          targetCtx.beginPath();
          targetCtx.moveTo(gizmo.worldOx, gizmo.worldOy);
          targetCtx.lineTo(gizmo.handleX, gizmo.handleY);
          targetCtx.strokeStyle = 'rgba(249, 115, 22, 0.88)';
          targetCtx.lineWidth = 2 * inv;
          targetCtx.stroke();

          const hR = (isHoverHandle ? 7.8 : 6.2) * inv;
          targetCtx.beginPath();
          targetCtx.arc(gizmo.handleX, gizmo.handleY, hR, 0, Math.PI * 2);
          targetCtx.fillStyle = isHoverHandle ? '#fbbf24' : '#fb923c';
          targetCtx.fill();
          targetCtx.strokeStyle = '#0f1115';
          targetCtx.lineWidth = 1.8 * inv;
          targetCtx.stroke();

          if (Math.abs(gizmo.rotation) > 0.004 || moveCamState?.mode === 'rotateLayer') {
            const deg = Math.round(((gizmo.rotation * 180) / Math.PI) * 10) / 10;
            const degTxt = `${deg}°`;
            targetCtx.font = `600 ${Math.round(10 * inv)}px system-ui, sans-serif`;
            targetCtx.textAlign = 'center';
            targetCtx.textBaseline = 'bottom';
            const tw = targetCtx.measureText(degTxt).width + 8 * inv;
            const th = 14 * inv;
            const tx = gizmo.handleX;
            const ty = gizmo.handleY - hR - 3 * inv;
            targetCtx.fillStyle = 'rgba(15, 17, 21, 0.82)';
            targetCtx.fillRect(tx - tw * 0.5, ty - th, tw, th);
            targetCtx.fillStyle = '#fdba74';
            targetCtx.fillText(degTxt, tx, ty - 1.5 * inv);
          }
        }

        // Always render twice-as-wide orange circle origin point on stage
        targetCtx.beginPath();
        targetCtx.arc(gizmo.worldOx, gizmo.worldOy, oR + 2 * inv, 0, Math.PI * 2);
        targetCtx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
        targetCtx.lineWidth = 2 * inv;
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.arc(gizmo.worldOx, gizmo.worldOy, oR, 0, Math.PI * 2);
        targetCtx.fillStyle = isHoverOrigin ? '#fb923c' : '#f97316';
        targetCtx.fill();
        targetCtx.strokeStyle = '#fff7ed';
        targetCtx.lineWidth = 2.2 * inv;
        targetCtx.stroke();

        targetCtx.beginPath();
        targetCtx.arc(gizmo.worldOx, gizmo.worldOy, 3.4 * inv, 0, Math.PI * 2);
        targetCtx.fillStyle = '#0f1115';
        targetCtx.fill();

        targetCtx.restore();
      }
    }

    if (!state.isPlaying && !isBasicMode() && state.tool === 'moveCam') {
      const target = activeTimelineTarget();
      const activeKey = getLayerKeyForActive(target);
      const ikChain = getIKChainForLayer(target, activeKey);
      if (ikChain.length >= 2) {
        const joints = resolveIKJoints(rootSc, target, ikChain, frame, false);
        if (joints.length >= 2) {
          const rootParentMat = getParentWorldMatrix(rootSc, target, ikChain[0], frame);
          const worldMats = computeIKWorldMats(joints, rootParentMat);
          const pts = joints.map((j, idx) => applyMatPt(worldMats[idx], { x: j.ox, y: j.oy }));
          const isActIK = moveCamState?.mode === 'moveIK';

          targetCtx.save();
          targetCtx.beginPath();
          for (let i = 0; i < pts.length; i++) {
            if (i === 0) targetCtx.moveTo(pts[i].x, pts[i].y);
            else targetCtx.lineTo(pts[i].x, pts[i].y);
          }
          targetCtx.strokeStyle = isActIK ? 'rgba(56, 189, 248, 0.95)' : 'rgba(56, 189, 248, 0.65)';
          targetCtx.lineWidth = (isActIK ? 2.4 : 1.8) * inv;
          targetCtx.setLineDash([5 * inv, 4 * inv]);
          targetCtx.stroke();
          targetCtx.setLineDash([]);

          for (let i = 0; i < pts.length; i++) {
            const pt = pts[i];
            const isEnd = i === pts.length - 1;
            targetCtx.beginPath();
            targetCtx.arc(pt.x, pt.y, (isEnd ? 5.2 : 4.2) * inv, 0, Math.PI * 2);
            targetCtx.fillStyle = isEnd ? '#38bdf8' : '#0f172a';
            targetCtx.fill();
            targetCtx.strokeStyle = '#7dd3fc';
            targetCtx.lineWidth = 1.6 * inv;
            targetCtx.stroke();
          }
          targetCtx.restore();
        }
      }
    }

    if (!state.isPlaying && !isBasicMode() && state.activeLayer === 'vector' && state.tool === 'vectorEdit') {
      const target = activeTimelineTarget();
      const activeTrk = getActiveVectorTrackInTarget(target);
      const vEntry = activeTrk.visible ? getVectorCelEntryInMap(activeTrk.cels, frame) : null;
      if (vEntry && !vEntry.cel.nestId && vEntry.cel.items.length > 0) {
        const wMat = getVectorEditWorldMat(rootSc, target, vEntry.cel, vEntry.start, frame, activeTrk.id);
        targetCtx.save();
        for (let ii = 0; ii < vEntry.cel.items.length; ii++) {
          const item = vEntry.cel.items[ii];
          if (item.kind === 'erase') continue;
          const contours: Point2D[][] = item.kind === 'fill' ? item.contours : [item.points];
          const isClosed = item.kind === 'fill';
          const isSelItem = vectorEditSelection?.itemIndex === ii;

          for (let ci = 0; ci < contours.length; ci++) {
            const pts = contours[ci];
            if (pts.length === 0) continue;
            const wPts = pts.map((p) => applyMatPt(wMat, p));

            if (wPts.length >= 2) {
              targetCtx.beginPath();
              targetCtx.moveTo(wPts[0].x, wPts[0].y);
              for (let pi = 1; pi < wPts.length; pi++) {
                targetCtx.lineTo(wPts[pi].x, wPts[pi].y);
              }
              if (isClosed) targetCtx.closePath();
              targetCtx.strokeStyle = isSelItem ? 'rgba(56, 189, 248, 0.72)' : 'rgba(148, 163, 184, 0.42)';
              targetCtx.lineWidth = (isSelItem ? 1.4 : 1.0) * inv;
              targetCtx.setLineDash([3 * inv, 3 * inv]);
              targetCtx.stroke();
              targetCtx.setLineDash([]);
            }

            for (let pi = 0; pi < wPts.length; pi++) {
              const wp = wPts[pi];
              const pt = pts[pi];
              const isSel =
                vectorEditSelection?.itemIndex === ii &&
                vectorEditSelection.contourIndex === ci &&
                vectorEditSelection.pointIndex === pi;
              const isHov =
                vectorEditHover?.itemIndex === ii &&
                vectorEditHover.contourIndex === ci &&
                vectorEditHover.pointIndex === pi;
              const isCorner = Boolean(pt.corner);
              const r = (isSel ? 5.6 : isHov ? 5.0 : 3.8) * inv;

              targetCtx.beginPath();
              if (isCorner) {
                targetCtx.rect(wp.x - r, wp.y - r, r * 2, r * 2);
              } else {
                targetCtx.arc(wp.x, wp.y, r, 0, Math.PI * 2);
              }
              targetCtx.fillStyle = isSel ? '#ffffff' : isCorner ? '#f59e0b' : '#38bdf8';
              targetCtx.fill();
              targetCtx.strokeStyle = isSel ? (isCorner ? '#f59e0b' : '#0284c7') : '#0f1115';
              targetCtx.lineWidth = (isSel ? 2.2 : 1.4) * inv;
              targetCtx.stroke();
            }
          }
        }
        targetCtx.restore();
      }
    }
  }

  function renderSingleLayerToCtx(
    rootSc: Scene,
    target: Scene | NestedClip,
    layerKey: string,
    targetCtx: CanvasRenderingContext2D,
    targetW: number,
    targetH: number,
    cam: CameraKey,
    totalViewScale: number,
    vx: number,
    vy: number,
    frame: number,
    forExport: boolean,
    useViewport: boolean,
    isNestView: boolean
  ): void {
    const cs = cam.scale / 100;
    const parentMat = getParentWorldMatrix(rootSc, target, layerKey, frame);

    if (!isNestView && layerKey.startsWith('bg:') && 'bgLayers' in target) {
      const bg = target.bgLayers.find((b) => b.id === layerKey.slice(3));
      if (!bg || !bg.visible || !bg.hasInk) return;
      const bgRot = bg.rotation || 0;
      const bgSc = bg.scale ?? 1;
      const bgPiv = bgRot || bgSc !== 1 ? getLayerPivotLocal(rootSc, 'bg', bg) : { ox: 0, oy: 0 };
      targetCtx.save();
      if (!isIdentityMat(parentMat)) targetCtx.transform(...parentMat);
      drawTransformedCanvas(targetCtx, bg.canvas, bg.offsetX, bg.offsetY, bgPiv.ox, bgPiv.oy, bgRot, undefined, undefined, bgSc);
      targetCtx.restore();
    } else if (layerKey.startsWith('cel:')) {
      const cTrk = target.celTracks.find((t) => t.id === layerKey.slice(4));
      if (!cTrk || !cTrk.visible) return;
      const activeCTrk = getActiveCelTrackInTarget(target);
      const activeEntry = getCelEntryInMap(cTrk.cels, frame);
      const showOnion =
        cTrk.id === activeCTrk.id &&
        (isNestView || (!forExport && useViewport)) &&
        !state.isPlaying &&
        state.onionSkin &&
        state.showCelLayer;

      if (showOnion) {
        targetCtx.save();
        if (!isIdentityMat(parentMat)) targetCtx.transform(...parentMat);
        if (state.onionBefore) {
          const prevEntry = activeEntry ? getPrevCelBefore(activeEntry.start, cTrk.cels) : getPrevCelBefore(frame, cTrk.cels);
          if (prevEntry && isCelInkFilled(rootSc, prevEntry.cel)) {
            const prevFrame = prevEntry.start + Math.max(0, prevEntry.cel.duration - 1);
            const prevOff = getCelOffsetAtFrame(prevEntry.cel, prevEntry.start, prevFrame);
            const rot = prevOff.rotation;
            const sc = prevOff.scale;
            const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'cel', prevEntry.cel) : { ox: 0, oy: 0 };
            if (prevEntry.cel.nestId) {
              const c = rasterizeNestedClipToWorldCanvas(rootSc, prevEntry.cel.nestId, prevFrame, prevEntry.cel.nestOriginFrame ?? 0);
              drawTintedCanvas(targetCtx, c, prevOff.offsetX, prevOff.offsetY, '#ef4444', 0.25, piv.ox, piv.oy, rot, sc);
            } else {
              drawTintedCel(rootSc, targetCtx, prevEntry.cel, '#ef4444', 0.25, prevOff.offsetX, prevOff.offsetY, prevOff.scale, rot);
            }
          }
        }
        if (state.onionAfter) {
          const nextEntry = activeEntry ? getNextCelAfter(activeEntry.start, cTrk.cels) : getNextCelAfter(frame, cTrk.cels);
          if (nextEntry && isCelInkFilled(rootSc, nextEntry.cel)) {
            const nextOff = getCelOffsetAtFrame(nextEntry.cel, nextEntry.start, nextEntry.start);
            const rot = nextOff.rotation;
            const sc = nextOff.scale;
            const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'cel', nextEntry.cel) : { ox: 0, oy: 0 };
            if (nextEntry.cel.nestId) {
              const c = rasterizeNestedClipToWorldCanvas(rootSc, nextEntry.cel.nestId, nextEntry.start, nextEntry.cel.nestOriginFrame ?? 0);
              drawTintedCanvas(targetCtx, c, nextOff.offsetX, nextOff.offsetY, '#3b82f6', 0.22, piv.ox, piv.oy, rot, sc);
            } else {
              drawTintedCel(rootSc, targetCtx, nextEntry.cel, '#3b82f6', 0.22, nextOff.offsetX, nextOff.offsetY, nextOff.scale, rot);
            }
          }
        }
        targetCtx.restore();
      }

      if ((forExport || !useViewport || state.showCelLayer) && activeEntry) {
        const activeOff = getCelOffsetAtFrame(activeEntry.cel, activeEntry.start, frame);
        const rot = activeOff.rotation;
        const sc = activeOff.scale;
        const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'cel', activeEntry.cel) : { ox: 0, oy: 0 };
        if (activeEntry.cel.nestId) {
          const selfMat = makeLayerLocalTransform(activeOff.offsetX, activeOff.offsetY, piv.ox, piv.oy, rot, sc);
          const combOuter = mulMat(parentMat, selfMat);
          renderNestedClipAtFrame(
            rootSc,
            targetCtx,
            activeEntry.cel.nestId,
            frame,
            activeEntry.cel.nestOriginFrame ?? 0,
            combOuter,
            targetW,
            targetH,
            cam,
            totalViewScale,
            vx,
            vy,
            0
          );
        } else {
          targetCtx.save();
          if (!isIdentityMat(parentMat)) targetCtx.transform(...parentMat);
          drawTransformedCanvas(targetCtx, activeEntry.cel.canvas, activeOff.offsetX, activeOff.offsetY, piv.ox, piv.oy, rot, undefined, undefined, sc);
          targetCtx.restore();
        }
      }
    } else if (layerKey.startsWith('vector:')) {
      const trk = target.vectorTracks.find((t) => t.id === layerKey.slice(7));
      if (!trk || !trk.visible) return;
      const activeVecTrack = getActiveVectorTrackInTarget(target);
      const activeVectorEntry = getVectorCelEntryInMap(activeVecTrack.cels, frame);
      const shouldShowVector = forExport || !useViewport || state.showVectorLayer;

      if (
        trk.id === activeVecTrack.id &&
        (isNestView || (!forExport && useViewport)) &&
        !state.isPlaying &&
        state.onionSkin &&
        state.showVectorLayer
      ) {
        if (state.onionBefore) {
          const prevV = activeVectorEntry
            ? getPrevVectorCelBefore(activeVectorEntry.start, activeVecTrack.cels)
            : getPrevVectorCelBefore(frame, activeVecTrack.cels);
          if (prevV && isVectorCelInkFilled(rootSc, prevV.cel)) {
            const prevFrame = prevV.start + Math.max(0, prevV.cel.duration - 1);
            const vOff = getCelOffsetAtFrame(prevV.cel, prevV.start, prevFrame);
            const vRot = vOff.rotation;
            const vSc = vOff.scale;
            const vPiv = vRot || vSc !== 1 ? getLayerPivotLocal(rootSc, 'vector', prevV.cel) : { ox: 0, oy: 0 };
            if (prevV.cel.nestId) {
              targetCtx.save();
              if (!isIdentityMat(parentMat)) targetCtx.transform(...parentMat);
              const c = rasterizeNestedClipToWorldCanvas(rootSc, prevV.cel.nestId, prevFrame, prevV.cel.nestOriginFrame ?? 0);
              drawTintedCanvas(targetCtx, c, vOff.offsetX, vOff.offsetY, '#ef4444', 0.25, vPiv.ox, vPiv.oy, vRot, vSc);
              targetCtx.restore();
            } else {
              renderVectorCelToContext(
                rootSc,
                targetCtx,
                prevV.cel,
                targetW,
                targetH,
                cam,
                totalViewScale,
                vx,
                vy,
                0.25,
                '#ef4444',
                parentMat,
                vOff.offsetX,
                vOff.offsetY,
                vSc,
                vRot
              );
            }
          }
        }
        if (state.onionAfter) {
          const nextV = activeVectorEntry
            ? getNextVectorCelAfter(activeVectorEntry.start, activeVecTrack.cels)
            : getNextVectorCelAfter(frame, activeVecTrack.cels);
          if (nextV && isVectorCelInkFilled(rootSc, nextV.cel)) {
            const vOff = getCelOffsetAtFrame(nextV.cel, nextV.start, nextV.start);
            const vRot = vOff.rotation;
            const vSc = vOff.scale;
            const vPiv = vRot || vSc !== 1 ? getLayerPivotLocal(rootSc, 'vector', nextV.cel) : { ox: 0, oy: 0 };
            if (nextV.cel.nestId) {
              targetCtx.save();
              if (!isIdentityMat(parentMat)) targetCtx.transform(...parentMat);
              const c = rasterizeNestedClipToWorldCanvas(rootSc, nextV.cel.nestId, nextV.start, nextV.cel.nestOriginFrame ?? 0);
              drawTintedCanvas(targetCtx, c, vOff.offsetX, vOff.offsetY, '#3b82f6', 0.22, vPiv.ox, vPiv.oy, vRot, vSc);
              targetCtx.restore();
            } else {
              renderVectorCelToContext(
                rootSc,
                targetCtx,
                nextV.cel,
                targetW,
                targetH,
                cam,
                totalViewScale,
                vx,
                vy,
                0.22,
                '#3b82f6',
                parentMat,
                vOff.offsetX,
                vOff.offsetY,
                vSc,
                vRot
              );
            }
          }
        }
      }

      if (isNestView ? state.showVectorLayer : shouldShowVector) {
        const vEntry = getVectorCelEntryInMap(trk.cels, frame);
        if (!vEntry) return;
        const vOff = getCelOffsetAtFrame(vEntry.cel, vEntry.start, frame);
        const vRot = vOff.rotation;
        const vSc = vOff.scale;
        const vPiv = vRot || vSc !== 1 ? getLayerPivotLocal(rootSc, 'vector', vEntry.cel) : { ox: 0, oy: 0 };
        if (vEntry.cel.nestId) {
          const selfMat = makeLayerLocalTransform(vOff.offsetX, vOff.offsetY, vPiv.ox, vPiv.oy, vRot, vSc);
          const combOuter = mulMat(parentMat, selfMat);
          renderNestedClipAtFrame(
            rootSc,
            targetCtx,
            vEntry.cel.nestId,
            frame,
            vEntry.cel.nestOriginFrame ?? 0,
            combOuter,
            targetW,
            targetH,
            cam,
            totalViewScale,
            vx,
            vy,
            0
          );
        } else if (vEntry.cel.items.length > 0) {
          renderVectorCelToContext(
            rootSc,
            targetCtx,
            vEntry.cel,
            targetW,
            targetH,
            cam,
            totalViewScale,
            vx,
            vy,
            1,
            undefined,
            parentMat,
            vOff.offsetX,
            vOff.offsetY,
            vSc,
            vRot
          );
        }
      }
    } else if (!isNestView && layerKey.startsWith('mouth:') && 'mouthLayers' in target) {
      const ml = target.mouthLayers.find((m) => m.id === layerKey.slice(6));
      if (!ml || !ml.visible) return;
      const mouthEval = getEvaluatedMouthInScene(rootSc, frame, ml);
      if (mouthEval) {
        const vis = ml.visemes[mouthEval.viseme] || ml.visemes[0];
        const ms = (mouthEval.scale || 100) / 100;
        const dw = Math.round(MOUTH_W * ms);
        const dh = Math.round(MOUTH_H * ms);
        const odx = mouthEval.originDx || 0;
        const ody = mouthEval.originDy || 0;
        const mRot = mouthEval.rotation || 0;

        targetCtx.save();
        if (!isIdentityMat(parentMat)) targetCtx.transform(...parentMat);
        targetCtx.imageSmoothingEnabled = false;
        targetCtx.translate(mouthEval.x + odx, mouthEval.y + ody);
        if (mRot) targetCtx.rotate(mRot);
        targetCtx.translate(-dw / 2 - odx, -dh / 2 - ody);
        targetCtx.drawImage(vis.canvas, 0, 0, dw, dh);

        if (!forExport && useViewport && !state.isPlaying && state.activeLayer === 'mouth' && ml.id === getActiveMouthLayerInScene(rootSc).id) {
          const inv = 1 / (totalViewScale * cs);
          targetCtx.strokeStyle = '#f472b6';
          targetCtx.lineWidth = 1.5 * inv;
          targetCtx.setLineDash([5 * inv, 3 * inv]);
          targetCtx.strokeRect(0, 0, dw, dh);
          targetCtx.setLineDash([]);
        }
        targetCtx.restore();
      }
    }
  }

  const HIT_S = 13;
  const hitTestCanvas = document.createElement('canvas');
  hitTestCanvas.width = HIT_S;
  hitTestCanvas.height = HIT_S;
  const hitTestCtx = hitTestCanvas.getContext('2d', { willReadFrequently: true })!;

  function hitTestTopDrawableLayerAt(
    rootSc: Scene,
    target: Scene | NestedClip,
    frame: number,
    stagePt: Point2D,
    cam: CameraKey,
    totalViewScale: number,
    vx: number,
    vy: number
  ): string | null {
    normalizeTargetHierarchy(target);
    const isNestView = nestStack.length > 0;
    const cs = cam.scale / 100;
    const hitVx = vx + (stage.width * 0.5 - stagePt.x);
    const hitVy = vy + (stage.height * 0.5 - stagePt.y);
    const half = Math.floor(HIT_S / 2);
    let outerFallback: string | null = null;

    const basicCelKey = isBasicMode() && target.celTracks[0] ? `cel:${target.celTracks[0].id}` : null;
    for (let li = 0; li < target.layerOrder.length; li++) {
      const layerKey = target.layerOrder[li];
      if (basicCelKey && layerKey !== basicCelKey) continue;
      if (!isBasicMode() && !state.showCelTrack && layerKey.startsWith('cel:')) continue;
      if ((!state.showVectorLayer || !state.showVectorTrack) && layerKey.startsWith('vector:')) continue;
      if (!state.showCelLayer && layerKey.startsWith('cel:')) continue;
      if (!state.showBgTrack && layerKey.startsWith('bg:')) continue;
      if (!state.showMouthTrack && layerKey.startsWith('mouth:')) continue;

      hitTestCtx.setTransform(1, 0, 0, 1, 0, 0);
      hitTestCtx.clearRect(0, 0, HIT_S, HIT_S);
      hitTestCtx.save();
      hitTestCtx.imageSmoothingEnabled = false;
      hitTestCtx.translate(HIT_S / 2 + hitVx, HIT_S / 2 + hitVy);
      hitTestCtx.scale(totalViewScale, totalViewScale);
      hitTestCtx.translate(-WORLD_W / 2, -WORLD_H / 2);
      // Clip to fixed canvas frame before applying camera pan/scale
      hitTestCtx.beginPath();
      hitTestCtx.rect(0, 0, WORLD_W, WORLD_H);
      hitTestCtx.clip();
      hitTestCtx.translate(WORLD_W / 2 + cam.x, WORLD_H / 2 + cam.y);
      hitTestCtx.scale(cs, cs);
      hitTestCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

      renderSingleLayerToCtx(
        rootSc,
        target,
        layerKey,
        hitTestCtx,
        HIT_S,
        HIT_S,
        cam,
        totalViewScale,
        hitVx,
        hitVy,
        frame,
        true,
        false,
        isNestView
      );
      hitTestCtx.restore();

      const data = hitTestCtx.getImageData(0, 0, HIT_S, HIT_S).data;
      let hitCenter = false;
      let hitRing = false;
      for (let py = 0; py < HIT_S; py++) {
        const dy = py - half;
        for (let px = 0; px < HIT_S; px++) {
          const dx = px - half;
          const d2 = dx * dx + dy * dy;
          if (d2 > 25) continue;
          const a = data[(py * HIT_S + px) * 4 + 3];
          if (a > 8) {
            if (d2 <= 2) {
              hitCenter = true;
              break;
            }
            hitRing = true;
          }
        }
        if (hitCenter) break;
      }
      if (hitCenter) return layerKey;
      if (hitRing && outerFallback === null) outerFallback = layerKey;
    }

    return outerFallback;
  }

  function renderNestToContext(
    rootSc: Scene,
    clip: NestedClip,
    targetCtx: CanvasRenderingContext2D,
    targetW: number,
    targetH: number,
    frame: number
  ): void {
    normalizeTargetHierarchy(clip);
    const cam: CameraKey = { x: 0, y: 0, scale: 100, ease: 'linear' };
    const totalViewScale = getTotalViewScale();
    const vx = state.viewPanX;
    const vy = state.viewPanY;

    targetCtx.imageSmoothingEnabled = false;
    targetCtx.clearRect(0, 0, targetW, targetH);
    targetCtx.fillStyle = '#121418';
    targetCtx.fillRect(0, 0, targetW, targetH);

    targetCtx.save();
    targetCtx.imageSmoothingEnabled = false;
    targetCtx.translate(targetW / 2 + vx, targetH / 2 + vy);
    targetCtx.scale(totalViewScale, totalViewScale);
    targetCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, WORLD_W, WORLD_H);
    targetCtx.clip();

    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(0, 0, WORLD_W, WORLD_H);

    for (let li = clip.layerOrder.length - 1; li >= 0; li--) {
      renderSingleLayerToCtx(
        rootSc,
        clip,
        clip.layerOrder[li],
        targetCtx,
        targetW,
        targetH,
        cam,
        totalViewScale,
        vx,
        vy,
        frame,
        false,
        true,
        true
      );
    }

    targetCtx.restore();
    const invFrame = 1 / totalViewScale;
    targetCtx.strokeStyle = state.tool === 'moveCam' ? '#fbbf24' : 'rgba(255,255,255,0.28)';
    targetCtx.lineWidth = (state.tool === 'moveCam' ? 2 : 1) * invFrame;
    if (state.tool === 'moveCam') targetCtx.setLineDash([6 * invFrame, 4 * invFrame]);
    targetCtx.strokeRect(0, 0, WORLD_W, WORLD_H);
    targetCtx.setLineDash([]);
    renderStageOverlayGuides(targetCtx, cam, totalViewScale, frame, rootSc);
    targetCtx.restore();
  }

  function renderSceneToContext(
    sc: Scene,
    targetCtx: CanvasRenderingContext2D,
    targetW: number,
    targetH: number,
    frame: number,
    forExport = false,
    useViewport = false
  ): void {
    normalizeTargetHierarchy(sc);
    const cam = getEvaluatedCameraInScene(sc, frame);
    const cs = cam.scale / 100;
    const fit = Math.min(targetW / WORLD_W, targetH / WORLD_H);
    const totalViewScale = useViewport ? getTotalViewScale() : fit;
    const vx = useViewport ? state.viewPanX : 0;
    const vy = useViewport ? state.viewPanY : 0;

    targetCtx.imageSmoothingEnabled = false;
    targetCtx.clearRect(0, 0, targetW, targetH);
    targetCtx.fillStyle = !forExport && useViewport ? '#121418' : '#000000';
    targetCtx.fillRect(0, 0, targetW, targetH);

    targetCtx.save();
    targetCtx.imageSmoothingEnabled = false;

    // Position the fixed canvas frame in the viewport
    targetCtx.translate(targetW / 2 + vx, targetH / 2 + vy);
    targetCtx.scale(totalViewScale, totalViewScale);
    targetCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

    // Clip to the fixed canvas frame and paint white paper backdrop BEFORE camera pan/scale
    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, WORLD_W, WORLD_H);
    targetCtx.clip();

    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Camera pan/scale affects only the layers and their contents inside the fixed canvas frame
    targetCtx.translate(WORLD_W / 2 + cam.x, WORLD_H / 2 + cam.y);
    targetCtx.scale(cs, cs);
    targetCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

    // Composite layers from bottom to top of timeline (higher in timeline renders on top)
    const basicCelKey = app.mode === 'basic' && sc.celTracks[0] ? `cel:${sc.celTracks[0].id}` : null;
    for (let li = sc.layerOrder.length - 1; li >= 0; li--) {
      const lk = sc.layerOrder[li];
      if (basicCelKey && lk !== basicCelKey) continue;
      renderSingleLayerToCtx(
        sc,
        sc,
        lk,
        targetCtx,
        targetW,
        targetH,
        cam,
        totalViewScale,
        vx,
        vy,
        frame,
        forExport,
        useViewport,
        false
      );
    }

    targetCtx.restore();

    if (!forExport && useViewport) {
      // Draw fixed canvas frame outline in un-camera-transformed canvas space
      const invFrame = 1 / totalViewScale;
      targetCtx.strokeStyle = state.tool === 'moveCam' ? '#fbbf24' : 'rgba(255,255,255,0.28)';
      targetCtx.lineWidth = (state.tool === 'moveCam' ? 2 : 1) * invFrame;
      if (state.tool === 'moveCam') targetCtx.setLineDash([6 * invFrame, 4 * invFrame]);
      targetCtx.strokeRect(0, 0, WORLD_W, WORLD_H);
      targetCtx.setLineDash([]);

      // Draw world-space interactive overlays aligned with camera-transformed artwork
      targetCtx.save();
      targetCtx.translate(WORLD_W / 2 + cam.x, WORLD_H / 2 + cam.y);
      targetCtx.scale(cs, cs);
      targetCtx.translate(-WORLD_W / 2, -WORLD_H / 2);
      renderStageOverlayGuides(targetCtx, cam, totalViewScale, frame, sc);
      targetCtx.restore();
    }

    targetCtx.restore();
  }

  function renderStage(targetCtx: CanvasRenderingContext2D = ctx, frame = state.currentFrame, forExport = false): void {
    const w = forExport ? WORLD_W : stage.width;
    const h = forExport ? WORLD_H : stage.height;
    const openNest = !forExport ? activeNestedClip() : null;
    if (openNest) {
      renderNestToContext(activeScene(), openNest, targetCtx, w, h, frame);
    } else {
      renderSceneToContext(activeScene(), targetCtx, w, h, frame, forExport, !forExport);
    }
  }

  function getStageCoords(e: { clientX: number; clientY: number }): Point2D {
    const rect = stage.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * stage.width,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * stage.height,
    };
  }

  function stageToCameraSpace(pt: Point2D): Point2D {
    const s = getTotalViewScale();
    return {
      x: (pt.x - stage.width / 2 - state.viewPanX) / s + WORLD_W / 2,
      y: (pt.y - stage.height / 2 - state.viewPanY) / s + WORLD_H / 2,
    };
  }

  function stageToWorld(pt: Point2D, cam: CameraKey): Point2D {
    const cp = stageToCameraSpace(pt);
    const cs = cam.scale / 100;
    return {
      x: (cp.x - WORLD_W / 2 - cam.x) / cs + WORLD_W / 2,
      y: (cp.y - WORLD_H / 2 - cam.y) / cs + WORLD_H / 2,
    };
  }

  function worldToVisemeLocal(worldPt: Point2D, mouthEval: MouthKey): Point2D {
    const ms = (mouthEval.scale || 100) / 100;
    const odx = mouthEval.originDx || 0;
    const ody = mouthEval.originDy || 0;
    const rot = mouthEval.rotation || 0;
    const dx = worldPt.x - (mouthEval.x + odx);
    const dy = worldPt.y - (mouthEval.y + ody);
    const c = rot ? Math.cos(-rot) : 1;
    const s = rot ? Math.sin(-rot) : 0;
    const rx = dx * c - dy * s + odx;
    const ry = dx * s + dy * c + ody;
    return {
      x: rx / ms + MOUTH_W / 2,
      y: ry / ms + MOUTH_H / 2,
    };
  }

  stageContainer.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const pt = getStageCoords(e);
      const fit = getFitScale();
      const oldTotal = fit * state.viewZoom;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(0.25, Math.min(20, state.viewZoom * factor));
      const newTotal = fit * newZoom;

      const relCamX = (pt.x - stage.width / 2 - state.viewPanX) / oldTotal;
      const relCamY = (pt.y - stage.height / 2 - state.viewPanY) / oldTotal;

      state.viewZoom = newZoom;
      state.viewPanX = pt.x - stage.width / 2 - relCamX * newTotal;
      state.viewPanY = pt.y - stage.height / 2 - relCamY * newTotal;

      updateViewResetBtn();
      updateStageBadge();
      renderStage();
    },
    { passive: false }
  );

  stageContainer.addEventListener('mousedown', (e) => {
    if (e.button === 1) e.preventDefault();
  });

  function updateViewResetBtn(): void {
    const modified = Math.abs(state.viewZoom - 1) > 0.01 || Math.abs(state.viewPanX) > 1 || Math.abs(state.viewPanY) > 1;
    btnResetView.classList.toggle('hidden-nest-ui', !modified);
  }

  btnResetView.onclick = () => {
    state.viewZoom = 1;
    state.viewPanX = 0;
    state.viewPanY = 0;
    updateViewResetBtn();
    updateStageBadge();
    renderStage();
  };

  let isPointerDown = false;
  let isViewPanning = false;
  let viewPanStart: { clientX: number; clientY: number; panX: number; panY: number } | null = null;
  let lastWorldPt: Point2D | null = null;
  let activeDrawTarget: Cel | BgLayer | Viseme | null = null;
  let activeDrawVector: { cel: VectorCel; item: VectorStrokeItem | VectorEraseItem } | null = null;
  let activeDrawIsMouth = false;
  let activeNudgeState: {
    cel: VectorCel;
    trackId: string;
    startLocalPt: Point2D;
    radius: number;
    targets: Array<{ pt: Point2D; origX: number; origY: number; weight: number }>;
    moved: boolean;
  } | null = null;
  let activeBitmapNudgeState: {
    cel: Cel;
    imgData: ImageData;
    pixels32: Uint32Array;
    lastLocalPt: Point2D;
    accX: number;
    accY: number;
    radius: number;
    moved: boolean;
  } | null = null;
  let bitmapNudgePatchBuf = new Uint32Array(0);
  let moveCamState:
    | { mode: 'camScale'; startStagePt: Point2D; startScale: number }
    | { mode: 'camPan'; startStagePt: Point2D; startX: number; startY: number }
    | { mode: 'mouthScale'; startStagePt: Point2D; startScale: number; mouthLayer: MouthLayer }
    | {
        mode: 'scaleLayer';
        layer: 'cel' | 'vector' | 'bg';
        targetObj: Cel | VectorCel | BgLayer;
        tweenKeyIndex?: number;
        startScale: number;
        startStagePt: Point2D;
        moved: boolean;
      }
    | { mode: 'moveMouth'; startX: number; startY: number; startStagePt: Point2D; totalScale: number; parentMat: Mat2D; mouthLayer: MouthLayer }
    | {
        mode: 'moveVector';
        cel: VectorCel;
        startOffsetX: number;
        startOffsetY: number;
        startStagePt: Point2D;
        totalScale: number;
        parentMat: Mat2D;
        moved: boolean;
      }
    | {
        mode: 'moveFrame';
        cel: Cel | BgLayer;
        startOffsetX: number;
        startOffsetY: number;
        startStagePt: Point2D;
        totalScale: number;
        parentMat: Mat2D;
        moved: boolean;
      }
    | {
        mode: 'moveTweenKey';
        layerType: 'cel' | 'vector';
        cel: Cel | VectorCel;
        keyIndex: number;
        startKeyOffsetX: number;
        startKeyOffsetY: number;
        startStagePt: Point2D;
        totalScale: number;
        parentMat: Mat2D;
        moved: boolean;
      }
    | {
        mode: 'moveTweenCurve';
        layerType: 'cel' | 'vector';
        cel: Cel | VectorCel;
        segIndex: number;
        t: number;
        startCtrlDx: number;
        startCtrlDy: number;
        startStagePt: Point2D;
        totalScale: number;
        parentMat: Mat2D;
        moved: boolean;
      }
    | {
        mode: 'moveOrigin';
        layer: 'cel' | 'vector' | 'bg' | 'mouth';
        layerKey: string;
        mouthLayer?: MouthLayer;
        targetObj: Cel | VectorCel | BgLayer | null;
        startWorldPt: Point2D;
        startOx: number;
        startOy: number;
        parentMat: Mat2D;
        moved: boolean;
      }
    | {
        mode: 'rotateLayer';
        layer: 'cel' | 'vector' | 'bg' | 'mouth';
        layerKey: string;
        mouthLayer?: MouthLayer;
        targetObj: Cel | VectorCel | BgLayer | null;
        tweenKeyIndex?: number;
        pivotWorldX: number;
        pivotWorldY: number;
        startAngle: number;
        startRotation: number;
        parentRot: number;
        moved: boolean;
      }
    | {
        mode: 'moveIK';
        endLayerType: 'cel' | 'vector' | 'bg' | 'mouth';
        endLayerKey: string;
        endTargetObj: Cel | VectorCel | BgLayer | null;
        endMouthLayer?: MouthLayer;
        joints: IKJointRuntime[];
        rootParentMat: Mat2D;
        endLocalPt: Point2D;
        canRootFollow: boolean;
        siblingsSnapshot: IKSiblingSnapshot[];
        moved: boolean;
      }
    | null = null;

  type VectorPointRef = { itemIndex: number; contourIndex: number; pointIndex: number };
  let vectorPointMode: 'curve' | 'corner' = 'curve';
  let vectorEditSelection: VectorPointRef | null = null;
  let vectorEditHover: VectorPointRef | null = null;
  let vectorEditDrag: {
    cel: VectorCel;
    trackId: string;
    itemIndex: number;
    contourIndex: number;
    pointIndex: number;
    moved: boolean;
  } | null = null;

  function syncVectorPointModeUI(): void {
    btnVectorCorner.classList.toggle('active', vectorPointMode === 'corner');
    btnVectorCurve.classList.toggle('active', vectorPointMode === 'curve');
  }

  function getVectorPointByRef(cel: VectorCel, ref: VectorPointRef | null): Point2D | null {
    if (!ref) return null;
    const item = cel.items[ref.itemIndex];
    if (!item || item.kind === 'erase') return null;
    if (item.kind === 'fill') {
      return item.contours[ref.contourIndex]?.[ref.pointIndex] ?? null;
    }
    if (ref.contourIndex !== 0) return null;
    return item.points[ref.pointIndex] ?? null;
  }

  function getVectorEditWorldMat(
    rootSc: Scene,
    target: Scene | NestedClip,
    cel: VectorCel,
    start: number,
    frame: number,
    trackId: string
  ): Mat2D {
    const vOff = getCelOffsetAtFrame(cel, start, frame);
    const rot = vOff.rotation;
    const sc = vOff.scale;
    const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'vector', cel) : { ox: 0, oy: 0 };
    const pMat = getParentWorldMatrix(rootSc, target, `vector:${trackId}`, frame);
    const localMat = makeLayerLocalTransform(vOff.offsetX, vOff.offsetY, piv.ox, piv.oy, rot, sc);
    return isIdentityMat(pMat) ? localMat : mulMat(pMat, localMat);
  }

  function hitTestVectorEditPoint(
    rootSc: Scene,
    target: Scene | NestedClip,
    frame: number,
    worldPt: Point2D,
    inv: number
  ): VectorPointRef | null {
    const activeTrk = getActiveVectorTrackInTarget(target);
    if (!activeTrk.visible) return null;
    const vEntry = getVectorCelEntryInMap(activeTrk.cels, frame);
    if (!vEntry || vEntry.cel.nestId || vEntry.cel.items.length === 0) return null;
    const wMat = getVectorEditWorldMat(rootSc, target, vEntry.cel, vEntry.start, frame, activeTrk.id);
    const threshold = 10 * inv;
    let bestRef: VectorPointRef | null = null;
    let bestDist = threshold;

    for (let ii = vEntry.cel.items.length - 1; ii >= 0; ii--) {
      const item = vEntry.cel.items[ii];
      if (item.kind === 'erase') continue;
      const contours: Point2D[][] = item.kind === 'fill' ? item.contours : [item.points];
      for (let ci = 0; ci < contours.length; ci++) {
        const pts = contours[ci];
        for (let pi = 0; pi < pts.length; pi++) {
          const wp = applyMatPt(wMat, pts[pi]);
          const d = Math.hypot(wp.x - worldPt.x, wp.y - worldPt.y);
          if (d <= bestDist) {
            bestDist = d;
            bestRef = { itemIndex: ii, contourIndex: ci, pointIndex: pi };
          }
        }
      }
    }
    return bestRef;
  }

  function simplifyVectorStrokePoints(pts: Point2D[], eps = 1.5): Point2D[] {
    if (pts.length <= 4) return pts;
    const rdp = (start: number, end: number): Point2D[] => {
      let maxDist = 0;
      let index = start;
      const a = pts[start];
      const b = pts[end];
      for (let i = start + 1; i < end; i++) {
        const d = distPointToSeg(pts[i], a, b);
        if (d > maxDist) {
          maxDist = d;
          index = i;
        }
      }
      if (maxDist > eps && index > start && index < end) {
        const left = rdp(start, index);
        const right = rdp(index, end);
        return left.slice(0, -1).concat(right);
      }
      return [a, b];
    };
    return rdp(0, pts.length - 1);
  }

  function applyVectorPointMode(mode: 'curve' | 'corner'): void {
    vectorPointMode = mode;
    syncVectorPointModeUI();
    if (isBasicMode() || state.activeLayer !== 'vector') return;
    const entry = getVectorCelEntryAt(state.currentFrame);
    if (!entry || entry.cel.nestId || entry.cel.items.length === 0) return;

    const selPt = getVectorPointByRef(entry.cel, vectorEditSelection);
    if (selPt) {
      pushVectorItemsUndo(entry.cel);
      if (mode === 'corner') selPt.corner = true;
      else delete selPt.corner;
      renderStage();
      return;
    }

    pushVectorItemsUndo(entry.cel);
    for (const item of entry.cel.items) {
      if (item.kind === 'stroke') {
        for (const pt of item.points) {
          if (mode === 'corner') pt.corner = true;
          else delete pt.corner;
        }
      } else if (item.kind === 'fill') {
        for (const loop of item.contours) {
          for (const pt of loop) {
            if (mode === 'corner') pt.corner = true;
            else delete pt.corner;
          }
        }
      }
    }
    renderStage();
  }

  btnVectorCorner.onclick = () => applyVectorPointMode('corner');
  btnVectorCurve.onclick = () => applyVectorPointMode('curve');
  syncVectorPointModeUI();

  const activeTouchPointers = new Map<number, Point2D>();
  let isPinching = false;
  let pinchState: {
    startDist: number;
    startZoom: number;
    startPanX: number;
    startPanY: number;
    startMid: Point2D;
  } | null = null;

  function cancelInProgressSinglePointerWork(): void {
    const hadWork =
      isPointerDown ||
      activeDrawTarget !== null ||
      activeDrawVector !== null ||
      activeNudgeState !== null ||
      activeBitmapNudgeState !== null ||
      vectorEditDrag !== null ||
      moveCamState !== null;
    if (!hadWork) return;

    isPointerDown = false;
    isRightErasing = false;

    if (activeDrawVector) {
      const cel = activeDrawVector.cel;
      const undone = cel.undoStack.pop();
      if (undone && undone.type === 'items') {
        cel.items = cloneVectorItems(undone.items);
        cel.hasInk = undone.hasInk;
      }
    }

    if (activeDrawTarget) {
      const undone = activeDrawTarget.undoStack.pop();
      if (undone && undone.type === 'pixels') {
        const cctx = activeDrawTarget.canvas.getContext('2d');
        if (cctx) {
          cctx.imageSmoothingEnabled = false;
          cctx.putImageData(undone.imgData, 0, 0);
        }
      }
      if (activeDrawIsMouth) {
        mouthUndoStacks.get(state.mouthLayer)?.pop();
      }
    }

    if (activeNudgeState) {
      const cel = activeNudgeState.cel;
      const undone = cel.undoStack.pop();
      if (undone && undone.type === 'items') {
        cel.items = cloneVectorItems(undone.items);
        cel.hasInk = undone.hasInk;
      }
    }

    if (activeBitmapNudgeState) {
      const cel = activeBitmapNudgeState.cel;
      const undone = cel.undoStack.pop();
      if (undone && undone.type === 'pixels') {
        const cctx = cel.canvas.getContext('2d');
        if (cctx) {
          cctx.imageSmoothingEnabled = false;
          cctx.putImageData(undone.imgData, 0, 0);
        }
      }
    }

    if (moveCamState) {
      if (moveCamState.mode === 'moveFrame' || moveCamState.mode === 'moveVector') {
        const undone = moveCamState.cel.undoStack.pop();
        if (undone && undone.type === 'move') {
          moveCamState.cel.offsetX = undone.offsetX;
          moveCamState.cel.offsetY = undone.offsetY;
        }
      } else if (
        moveCamState.mode === 'moveOrigin' ||
        moveCamState.mode === 'rotateLayer' ||
        moveCamState.mode === 'scaleLayer'
      ) {
        if (moveCamState.layer === 'mouth') {
          const ml = moveCamState.mouthLayer || state.mouthLayer;
          const act = mouthUndoStacks.get(ml)?.pop();
          if (act && act.kind === 'transform') {
            if (act.prevKey) ml.keys.set(act.frame, { ...act.prevKey });
            else ml.keys.delete(act.frame);
          }
        } else if (moveCamState.targetObj) {
          const obj = moveCamState.targetObj;
          const undone = obj.undoStack.pop();
          if (undone && (undone.type === 'move' || undone.type === 'tween' || undone.type === 'items')) {
            obj.offsetX = undone.offsetX;
            obj.offsetY = undone.offsetY;
            obj.rotation = undone.rotation;
            obj.scale = undone.scale;
            obj.originX = undone.originX;
            obj.originY = undone.originY;
            if (undone.type === 'tween' && 'posKeys' in obj) {
              obj.posKeys = clonePosKeys(undone.posKeys);
            }
          }
        }
      } else if (moveCamState.mode === 'moveTweenKey' || moveCamState.mode === 'moveTweenCurve') {
        const undone = moveCamState.cel.undoStack.pop();
        if (undone && undone.type === 'tween') {
          moveCamState.cel.offsetX = undone.offsetX;
          moveCamState.cel.offsetY = undone.offsetY;
          moveCamState.cel.posKeys = clonePosKeys(undone.posKeys);
        }
      } else if (moveCamState.mode === 'mouthScale' || moveCamState.mode === 'moveMouth') {
        const ml = moveCamState.mouthLayer;
        const act = mouthUndoStacks.get(ml)?.pop();
        if (act && act.kind === 'transform') {
          if (act.prevKey) ml.keys.set(act.frame, { ...act.prevKey });
          else ml.keys.delete(act.frame);
        }
      } else if (moveCamState.mode === 'moveIK') {
        if (moveCamState.endLayerType === 'mouth') {
          const ml = moveCamState.endMouthLayer || state.mouthLayer;
          const act = mouthUndoStacks.get(ml)?.pop();
          if (act && act.kind === 'transform') {
            if (act.prevKey) ml.keys.set(act.frame, { ...act.prevKey });
            else ml.keys.delete(act.frame);
          }
        } else if (moveCamState.endTargetObj) {
          const obj = moveCamState.endTargetObj;
          const undone = obj.undoStack.pop();
          if (undone && (undone.type === 'move' || undone.type === 'tween' || undone.type === 'items')) {
            obj.rotation = undone.rotation;
            obj.originX = undone.originX;
            obj.originY = undone.originY;
          }
        }
        restoreIKSiblings(activeScene(), activeTimelineTarget(), state.currentFrame, moveCamState.siblingsSnapshot);
      }
    }

    if (vectorEditDrag) {
      const cel = vectorEditDrag.cel;
      const undone = cel.undoStack.pop();
      if (undone && undone.type === 'items') {
        cel.items = cloneVectorItems(undone.items);
        cel.hasInk = undone.hasInk;
      }
    }

    lastWorldPt = null;
    activeDrawTarget = null;
    activeDrawVector = null;
    activeDrawIsMouth = false;
    activeNudgeState = null;
    activeBitmapNudgeState = null;
    vectorEditDrag = null;
    moveCamState = null;
    stage.style.cursor = state.tool === 'moveCam' ? 'move' : state.tool === 'vectorEdit' ? 'default' : 'crosshair';
    updateMouthWidget();
    updateStageBadge();
    renderTimeline();
    renderStage();
  }

  function subdividePointsNearCircle(
    pts: Point2D[],
    center: Point2D,
    radius: number,
    closed: boolean
  ): Point2D[] {
    if (pts.length < 2) return pts;
    const maxSegLen = Math.max(6, radius * 0.2);
    const hitLimit = radius * 1.3;
    const out: Point2D[] = [];
    const segCount = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < segCount; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      out.push(a);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len > maxSegLen && distPointToSeg(center, a, b) <= hitLimit) {
        const parts = Math.min(24, Math.ceil(len / maxSegLen));
        for (let k = 1; k < parts; k++) {
          const t = k / parts;
          out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
        }
      }
    }
    if (!closed) out.push(pts[pts.length - 1]);
    return out;
  }

  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  stageContainer.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch') {
        activeTouchPointers.set(e.pointerId, getStageCoords(e));
        if (activeTouchPointers.size >= 2) {
          e.preventDefault();
          cancelInProgressSinglePointerWork();
          const pts = Array.from(activeTouchPointers.values());
          const p1 = pts[0];
          const p2 = pts[1];
          isPinching = true;
          pinchState = {
            startDist: Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
            startZoom: state.viewZoom,
            startPanX: state.viewPanX,
            startPanY: state.viewPanY,
            startMid: { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 },
          };
          return;
        }
      }
      if (e.button === 1) {
        e.preventDefault();
        isViewPanning = true;
        stageContainer.setPointerCapture(e.pointerId);
        viewPanStart = {
          clientX: e.clientX,
          clientY: e.clientY,
          panX: state.viewPanX,
          panY: state.viewPanY,
        };
        stage.style.cursor = 'grabbing';
      }
    },
    { capture: true }
  );

  stageContainer.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length >= 2) e.preventDefault();
    },
    { passive: false }
  );
  stageContainer.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length >= 2) e.preventDefault();
    },
    { passive: false }
  );
  stageContainer.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  stageContainer.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'touch' || !activeTouchPointers.has(e.pointerId)) return;
      activeTouchPointers.set(e.pointerId, getStageCoords(e));
      if (!isPinching || !pinchState || activeTouchPointers.size < 2) return;
      const pts = Array.from(activeTouchPointers.values());
      const p1 = pts[0];
      const p2 = pts[1];
      const curDist = Math.max(10, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const curMid = { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
      const fit = getFitScale();
      const oldTotal = fit * pinchState.startZoom;
      const newZoom = Math.max(0.25, Math.min(20, pinchState.startZoom * (curDist / pinchState.startDist)));
      const newTotal = fit * newZoom;
      const relCamX = (pinchState.startMid.x - stage.width / 2 - pinchState.startPanX) / oldTotal;
      const relCamY = (pinchState.startMid.y - stage.height / 2 - pinchState.startPanY) / oldTotal;

      state.viewZoom = newZoom;
      state.viewPanX = curMid.x - stage.width / 2 - relCamX * newTotal;
      state.viewPanY = curMid.y - stage.height / 2 - relCamY * newTotal;

      updateViewResetBtn();
      updateStageBadge();
      renderStage();
    },
    { signal }
  );

  const endTouchPointer = (e: PointerEvent) => {
    if (e.pointerType !== 'touch' || !activeTouchPointers.has(e.pointerId)) return;
    activeTouchPointers.delete(e.pointerId);
    if (activeTouchPointers.size < 2) {
      pinchState = null;
    }
    if (activeTouchPointers.size === 0) {
      isPinching = false;
    }
  };
  window.addEventListener('pointerup', endTouchPointer, { signal });
  window.addEventListener('pointercancel', endTouchPointer, { signal });

  stageContainer.addEventListener('pointermove', (e) => {
    if (!isViewPanning || !viewPanStart) return;
    const rect = stage.getBoundingClientRect();
    const scaleX = stage.width / Math.max(1, rect.width);
    const scaleY = stage.height / Math.max(1, rect.height);
    state.viewPanX = viewPanStart.panX + (e.clientX - viewPanStart.clientX) * scaleX;
    state.viewPanY = viewPanStart.panY + (e.clientY - viewPanStart.clientY) * scaleY;
    updateViewResetBtn();
    renderStage();
  });

  stageContainer.addEventListener('pointerup', (e) => {
    if (isViewPanning && e.button === 1) {
      isViewPanning = false;
      viewPanStart = null;
      stage.style.cursor = state.tool === 'moveCam' ? 'move' : 'crosshair';
    }
  });

  function getTargetLayerForEdit(
    createIfMissing: boolean,
    clonePrev: boolean
  ): { obj: Cel | BgLayer | null; created: boolean } {
    if (state.activeLayer === 'bg') {
      if (!state.bgLayer.visible) {
        state.bgLayer.visible = true;
        updateBgUI();
      }
      return { obj: state.bgLayer, created: false };
    }
    const existed = Boolean(getCelEntryAt(state.currentFrame));
    const entry = createIfMissing ? ensureCelAt(state.currentFrame, clonePrev) : getCelEntryAt(state.currentFrame);
    return { obj: entry ? entry.cel : null, created: !existed && Boolean(entry) };
  }

  function worldToTargetParentLocal(
    rootSc: Scene,
    target: Scene | NestedClip,
    layerKey: string,
    frame: number,
    worldPt: Point2D
  ): Point2D {
    const pMat = getParentWorldMatrix(rootSc, target, layerKey, frame);
    return isIdentityMat(pMat) ? worldPt : applyMatPt(invMat(pMat), worldPt);
  }

  function startOriginOrRotateDrag(
    layer: 'cel' | 'vector' | 'bg' | 'mouth',
    mode: 'moveOrigin' | 'rotateLayer',
    worldPt: Point2D
  ): boolean {
    const rootSc = activeScene();
    const target = activeTimelineTarget();
    const totalViewScale = getTotalViewScale();
    const cam = getEvaluatedCamera(state.currentFrame);
    const inv = 1 / (totalViewScale * (cam.scale / 100));
    const layerKey = getLayerKeyForActive(target);

    if (layer === 'mouth') {
      if (nestStack.length > 0) return false;
      const ml = state.mouthLayer;
      if (!ml.visible) ml.visible = true;
      pushMouthTransformUndo(state.currentFrame, ml);
      const curM = getActiveMouthState(ml);
      if (!ml.keys.has(state.currentFrame)) {
        setMouthKeyAtCurrentFrame({}, state.currentFrame, ml);
      }
      const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv)!;
      if (mode === 'moveOrigin') {
        moveCamState = {
          mode: 'moveOrigin',
          layer: 'mouth',
          layerKey,
          mouthLayer: ml,
          targetObj: null,
          startWorldPt: worldPt,
          startOx: curM.originDx || 0,
          startOy: curM.originDy || 0,
          parentMat: gizmo.parentMat,
          moved: false,
        };
      } else {
        moveCamState = {
          mode: 'rotateLayer',
          layer: 'mouth',
          layerKey,
          mouthLayer: ml,
          targetObj: null,
          pivotWorldX: gizmo.worldOx,
          pivotWorldY: gizmo.worldOy,
          startAngle: Math.atan2(worldPt.y - gizmo.worldOy, worldPt.x - gizmo.worldOx),
          startRotation: gizmo.localRotation,
          parentRot: gizmo.parentRot,
          moved: false,
        };
      }
      stage.style.cursor = 'grabbing';
      return true;
    }

    if (layer === 'vector') {
      if (!state.showVectorLayer) state.showVectorLayer = true;
      if (!state.activeVectorTrack.visible) {
        state.activeVectorTrack.visible = true;
        renderTimeline();
      }
      const existed = Boolean(getVectorCelEntryAt(state.currentFrame));
      const entry = ensureVectorCelAt(state.currentFrame, true);
      const cel = entry.cel;
      if (typeof cel.originX !== 'number' || typeof cel.originY !== 'number') {
        const def = computeVectorCelCenter(rootSc, cel);
        cel.originX = def.ax;
        cel.originY = def.ay;
      }
      const relFrame = state.currentFrame - entry.start;
      const hasTween = Boolean(cel.posKeys && cel.posKeys.length > 0);
      if (mode === 'moveOrigin') {
        if (hasTween) pushTweenUndo(cel);
        else pushVectorMoveUndo(cel, cel.offsetX, cel.offsetY);
        const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv)!;
        moveCamState = {
          mode: 'moveOrigin',
          layer: 'vector',
          layerKey,
          targetObj: cel,
          startWorldPt: worldPt,
          startOx: gizmo.ox,
          startOy: gizmo.oy,
          parentMat: gizmo.parentMat,
          moved: false,
        };
      } else if (!isBasicMode() && (hasTween || (cel.duration > 1 && relFrame > 0))) {
        pushTweenUndo(cel);
        if (!cel.posKeys || cel.posKeys.length === 0) {
          cel.posKeys = [
            {
              relFrame: 0,
              offsetX: cel.offsetX,
              offsetY: cel.offsetY,
              scale: cel.scale ?? 1,
              rotation: cel.rotation || 0,
            },
          ];
        }
        let key = cel.posKeys.find((k) => k.relFrame === relFrame);
        if (!key) {
          const curOff = getCelOffsetAtFrame(cel, entry.start, state.currentFrame);
          key = {
            relFrame,
            offsetX: Math.round(curOff.offsetX),
            offsetY: Math.round(curOff.offsetY),
            scale: curOff.scale,
            rotation: curOff.rotation,
          };
          cel.posKeys.push(key);
          sortPosKeys(cel);
        } else if (typeof key.rotation !== 'number') {
          key.rotation = getCelOffsetAtFrame(cel, entry.start, state.currentFrame).rotation;
        }
        const tweenKeyIndex = cel.posKeys.indexOf(key);
        const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv)!;
        moveCamState = {
          mode: 'rotateLayer',
          layer: 'vector',
          layerKey,
          targetObj: cel,
          tweenKeyIndex,
          pivotWorldX: gizmo.worldOx,
          pivotWorldY: gizmo.worldOy,
          startAngle: Math.atan2(worldPt.y - gizmo.worldOy, worldPt.x - gizmo.worldOx),
          startRotation: key.rotation ?? gizmo.localRotation,
          parentRot: gizmo.parentRot,
          moved: false,
        };
      } else {
        pushVectorMoveUndo(cel, cel.offsetX, cel.offsetY);
        const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv)!;
        moveCamState = {
          mode: 'rotateLayer',
          layer: 'vector',
          layerKey,
          targetObj: cel,
          pivotWorldX: gizmo.worldOx,
          pivotWorldY: gizmo.worldOy,
          startAngle: Math.atan2(worldPt.y - gizmo.worldOy, worldPt.x - gizmo.worldOx),
          startRotation: gizmo.localRotation,
          parentRot: gizmo.parentRot,
          moved: false,
        };
      }
      if (!existed) renderTimeline();
      stage.style.cursor = 'grabbing';
      return true;
    }

    if (layer === 'bg') {
      if (nestStack.length > 0) return false;
      const { obj } = getTargetLayerForEdit(true, true);
      if (!obj) return false;
      if (typeof obj.originX !== 'number' || typeof obj.originY !== 'number') {
        const def = obj.hasInk ? computeCanvasInkCenter(obj.canvas) || { ax: WORLD_W * 0.5, ay: WORLD_H * 0.5 } : { ax: WORLD_W * 0.5, ay: WORLD_H * 0.5 };
        obj.originX = def.ax;
        obj.originY = def.ay;
      }
      pushMoveUndo(obj, obj.offsetX, obj.offsetY);
      const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv)!;
      if (mode === 'moveOrigin') {
        moveCamState = {
          mode: 'moveOrigin',
          layer: 'bg',
          layerKey,
          targetObj: obj,
          startWorldPt: worldPt,
          startOx: gizmo.ox,
          startOy: gizmo.oy,
          parentMat: gizmo.parentMat,
          moved: false,
        };
      } else {
        moveCamState = {
          mode: 'rotateLayer',
          layer: 'bg',
          layerKey,
          targetObj: obj,
          pivotWorldX: gizmo.worldOx,
          pivotWorldY: gizmo.worldOy,
          startAngle: Math.atan2(worldPt.y - gizmo.worldOy, worldPt.x - gizmo.worldOx),
          startRotation: gizmo.localRotation,
          parentRot: gizmo.parentRot,
          moved: false,
        };
      }
      stage.style.cursor = 'grabbing';
      return true;
    }

    // Bitmap (cel) layer
    if (!state.activeCelTrack.visible) {
      state.activeCelTrack.visible = true;
      renderTimeline();
    }
    const existed = Boolean(getCelEntryAt(state.currentFrame));
    const entry = ensureCelAt(state.currentFrame, true);
    const cel = entry.cel;
    if (typeof cel.originX !== 'number' || typeof cel.originY !== 'number') {
      const def = getCelVisualAnchor(rootSc, cel);
      cel.originX = def.ax;
      cel.originY = def.ay;
    }
    const relFrame = state.currentFrame - entry.start;
    const hasTween = Boolean(cel.posKeys && cel.posKeys.length > 0);
    if (mode === 'moveOrigin') {
      if (hasTween) pushTweenUndo(cel);
      else pushMoveUndo(cel, cel.offsetX, cel.offsetY);
      const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv)!;
      moveCamState = {
        mode: 'moveOrigin',
        layer: 'cel',
        layerKey,
        targetObj: cel,
        startWorldPt: worldPt,
        startOx: gizmo.ox,
        startOy: gizmo.oy,
        parentMat: gizmo.parentMat,
        moved: false,
      };
    } else if (!isBasicMode() && (hasTween || (cel.duration > 1 && relFrame > 0))) {
      pushTweenUndo(cel);
      if (!cel.posKeys || cel.posKeys.length === 0) {
        cel.posKeys = [
          {
            relFrame: 0,
            offsetX: cel.offsetX,
            offsetY: cel.offsetY,
            scale: cel.scale ?? 1,
            rotation: cel.rotation || 0,
          },
        ];
      }
      let key = cel.posKeys.find((k) => k.relFrame === relFrame);
      if (!key) {
        const curOff = getCelOffsetAtFrame(cel, entry.start, state.currentFrame);
        key = {
          relFrame,
          offsetX: Math.round(curOff.offsetX),
          offsetY: Math.round(curOff.offsetY),
          scale: curOff.scale,
          rotation: curOff.rotation,
        };
        cel.posKeys.push(key);
        sortPosKeys(cel);
      } else if (typeof key.rotation !== 'number') {
        key.rotation = getCelOffsetAtFrame(cel, entry.start, state.currentFrame).rotation;
      }
      const tweenKeyIndex = cel.posKeys.indexOf(key);
      const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv)!;
      moveCamState = {
        mode: 'rotateLayer',
        layer: 'cel',
        layerKey,
        targetObj: cel,
        tweenKeyIndex,
        pivotWorldX: gizmo.worldOx,
        pivotWorldY: gizmo.worldOy,
        startAngle: Math.atan2(worldPt.y - gizmo.worldOy, worldPt.x - gizmo.worldOx),
        startRotation: key.rotation ?? gizmo.localRotation,
        parentRot: gizmo.parentRot,
        moved: false,
      };
    } else {
      pushMoveUndo(cel, cel.offsetX, cel.offsetY);
      const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv)!;
      moveCamState = {
        mode: 'rotateLayer',
        layer: 'cel',
        layerKey,
        targetObj: cel,
        pivotWorldX: gizmo.worldOx,
        pivotWorldY: gizmo.worldOy,
        startAngle: Math.atan2(worldPt.y - gizmo.worldOy, worldPt.x - gizmo.worldOx),
        startRotation: gizmo.localRotation,
        parentRot: gizmo.parentRot,
        moved: false,
      };
    }
    if (!existed) renderTimeline();
    stage.style.cursor = 'grabbing';
    return true;
  }

  stage.addEventListener('pointerdown', (e) => {
    if (e.button === 1 || state.isPlaying || isPinching || activeTouchPointers.size >= 2) return;
    stage.setPointerCapture(e.pointerId);
    const stagePt = getStageCoords(e);
    hoverStagePt = stagePt;
    const cam = getEvaluatedCamera(state.currentFrame);
    isPointerDown = true;

    const rootSc = activeScene();
    const target = activeTimelineTarget();

    if (state.tool === 'moveCam') {
      const totalScale = (cam.scale / 100) * getTotalViewScale();
      const worldPt = stageToWorld(stagePt, cam);
      const inv = 1 / totalScale;
      if (e.button === 0 && !e.shiftKey && !isBasicMode() && state.showOriginPoint) {
        const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv);
        if (gizmo) {
          if (Math.hypot(worldPt.x - gizmo.worldOx, worldPt.y - gizmo.worldOy) <= 18 * inv) {
            if (!startOriginOrRotateDrag(state.activeLayer, 'moveOrigin', worldPt)) isPointerDown = false;
            renderStage();
            return;
          }
          if (Math.hypot(worldPt.x - gizmo.handleX, worldPt.y - gizmo.handleY) <= 12 * inv) {
            if (!startOriginOrRotateDrag(state.activeLayer, 'rotateLayer', worldPt)) isPointerDown = false;
            renderStage();
            return;
          }
        }
      }
      if (e.button === 2) {
        if (!isBasicMode() && (state.activeLayer === 'cel' || state.activeLayer === 'vector') && !e.shiftKey) {
          const activeKey = getLayerKeyForActive(target);
          const entry: { start: number; cel: Cel | VectorCel } | null =
            state.activeLayer === 'vector'
              ? getVectorCelEntryAt(state.currentFrame)
              : getCelEntryAt(state.currentFrame);
          const hit = hitTestLayerMotionPath(rootSc, activeKey, entry, worldPt, cam, getTotalViewScale());
          if (hit?.kind === 'key' && entry && entry.cel.posKeys && entry.cel.posKeys.length >= 2) {
            pushTweenUndo(entry.cel);
            const removed = entry.cel.posKeys.splice(hit.keyIndex, 1)[0];
            if (entry.cel.posKeys.length < 2) {
              const keep = entry.cel.posKeys[0];
              if (keep) {
                entry.cel.offsetX = Math.round(keep.offsetX);
                entry.cel.offsetY = Math.round(keep.offsetY);
                if (typeof keep.scale === 'number') entry.cel.scale = keep.scale;
                if (typeof keep.rotation === 'number') entry.cel.rotation = keep.rotation;
              }
              delete entry.cel.posKeys;
            } else if (removed.relFrame === 0) {
              entry.cel.offsetX = Math.round(entry.cel.posKeys[0].offsetX);
              entry.cel.offsetY = Math.round(entry.cel.posKeys[0].offsetY);
              if (typeof entry.cel.posKeys[0].scale === 'number') entry.cel.scale = entry.cel.posKeys[0].scale;
              if (typeof entry.cel.posKeys[0].rotation === 'number') entry.cel.rotation = entry.cel.posKeys[0].rotation;
            }
            isPointerDown = false;
            hoverMotionHit = null;
            renderTimeline();
            renderStage();
            onNotify(`Removed motion key at F${entry.start + removed.relFrame + 1}.`);
            return;
          }
        }
        if (state.selectedTrack === 'cam' && !e.shiftKey) {
          moveCamState = { mode: 'camScale', startStagePt: stagePt, startScale: cam.scale };
        } else if (state.activeLayer === 'mouth' && !e.shiftKey) {
          const ml = state.mouthLayer;
          if (!ml.visible) ml.visible = true;
          pushMouthTransformUndo(state.currentFrame, ml);
          const curM = getActiveMouthState(ml);
          moveCamState = { mode: 'mouthScale', startStagePt: stagePt, startScale: curM.scale || 100, mouthLayer: ml };
        } else if (state.activeLayer === 'vector') {
          if (!state.showVectorLayer) state.showVectorLayer = true;
          if (!state.activeVectorTrack.visible) {
            state.activeVectorTrack.visible = true;
            renderTimeline();
          }
          const existed = Boolean(getVectorCelEntryAt(state.currentFrame));
          const entry = ensureVectorCelAt(state.currentFrame, true);
          const cel = entry.cel;
          const relFrame = state.currentFrame - entry.start;
          const hasTween = Boolean(cel.posKeys && cel.posKeys.length > 0);
          if (!isBasicMode() && (hasTween || (cel.duration > 1 && relFrame > 0))) {
            pushTweenUndo(cel);
            if (!cel.posKeys || cel.posKeys.length === 0) {
              cel.posKeys = [{ relFrame: 0, offsetX: cel.offsetX, offsetY: cel.offsetY, scale: cel.scale ?? 1, rotation: cel.rotation || 0 }];
            }
            let key = cel.posKeys.find((k) => k.relFrame === relFrame);
            if (!key) {
              const curOff = getCelOffsetAtFrame(cel, entry.start, state.currentFrame);
              key = {
                relFrame,
                offsetX: Math.round(curOff.offsetX),
                offsetY: Math.round(curOff.offsetY),
                scale: curOff.scale,
                rotation: curOff.rotation,
              };
              cel.posKeys.push(key);
              sortPosKeys(cel);
            } else if (typeof key.scale !== 'number') {
              key.scale = getCelOffsetAtFrame(cel, entry.start, state.currentFrame).scale;
            }
            const tweenKeyIndex = cel.posKeys.indexOf(key);
            moveCamState = {
              mode: 'scaleLayer',
              layer: 'vector',
              targetObj: cel,
              tweenKeyIndex,
              startScale: key.scale ?? cel.scale ?? 1,
              startStagePt: stagePt,
              moved: false,
            };
          } else {
            pushVectorMoveUndo(cel, cel.offsetX, cel.offsetY);
            moveCamState = {
              mode: 'scaleLayer',
              layer: 'vector',
              targetObj: cel,
              startScale: cel.scale ?? 1,
              startStagePt: stagePt,
              moved: false,
            };
          }
          if (!existed) renderTimeline();
          stage.style.cursor = 'nwse-resize';
        } else if (state.activeLayer === 'bg' && nestStack.length === 0) {
          const { obj } = getTargetLayerForEdit(true, true);
          if (!obj) {
            isPointerDown = false;
            return;
          }
          pushMoveUndo(obj, obj.offsetX, obj.offsetY);
          moveCamState = {
            mode: 'scaleLayer',
            layer: 'bg',
            targetObj: obj,
            startScale: obj.scale ?? 1,
            startStagePt: stagePt,
            moved: false,
          };
          stage.style.cursor = 'nwse-resize';
        } else {
          if (!state.activeCelTrack.visible) {
            state.activeCelTrack.visible = true;
            renderTimeline();
          }
          const existed = Boolean(getCelEntryAt(state.currentFrame));
          const entry = ensureCelAt(state.currentFrame, true);
          const cel = entry.cel;
          const relFrame = state.currentFrame - entry.start;
          const hasTween = Boolean(cel.posKeys && cel.posKeys.length > 0);
          if (!isBasicMode() && (hasTween || (cel.duration > 1 && relFrame > 0))) {
            pushTweenUndo(cel);
            if (!cel.posKeys || cel.posKeys.length === 0) {
              cel.posKeys = [{ relFrame: 0, offsetX: cel.offsetX, offsetY: cel.offsetY, scale: cel.scale ?? 1, rotation: cel.rotation || 0 }];
            }
            let key = cel.posKeys.find((k) => k.relFrame === relFrame);
            if (!key) {
              const curOff = getCelOffsetAtFrame(cel, entry.start, state.currentFrame);
              key = {
                relFrame,
                offsetX: Math.round(curOff.offsetX),
                offsetY: Math.round(curOff.offsetY),
                scale: curOff.scale,
                rotation: curOff.rotation,
              };
              cel.posKeys.push(key);
              sortPosKeys(cel);
            } else if (typeof key.scale !== 'number') {
              key.scale = getCelOffsetAtFrame(cel, entry.start, state.currentFrame).scale;
            }
            const tweenKeyIndex = cel.posKeys.indexOf(key);
            moveCamState = {
              mode: 'scaleLayer',
              layer: 'cel',
              targetObj: cel,
              tweenKeyIndex,
              startScale: key.scale ?? cel.scale ?? 1,
              startStagePt: stagePt,
              moved: false,
            };
          } else {
            pushMoveUndo(cel, cel.offsetX, cel.offsetY);
            moveCamState = {
              mode: 'scaleLayer',
              layer: 'cel',
              targetObj: cel,
              startScale: cel.scale ?? 1,
              startStagePt: stagePt,
              moved: false,
            };
          }
          if (!existed) renderTimeline();
          stage.style.cursor = 'nwse-resize';
        }
      } else if (e.shiftKey) {
        moveCamState = { mode: 'camPan', startStagePt: stagePt, startX: cam.x, startY: cam.y };
      } else {
        // Check active layer's motion path handles before click-to-select layer switching
        let activePathHit: MotionPathHit | null = null;
        const curActiveKey = getLayerKeyForActive(target);
        if (!isBasicMode() && (state.activeLayer === 'cel' || state.activeLayer === 'vector')) {
          const activeEntry: { start: number; cel: Cel | VectorCel } | null =
            state.activeLayer === 'vector'
              ? getVectorCelEntryAt(state.currentFrame)
              : getCelEntryAt(state.currentFrame);
          activePathHit = hitTestLayerMotionPath(rootSc, curActiveKey, activeEntry, worldPt, cam, getTotalViewScale());
        }

        if (!activePathHit) {
          const hitKey = hitTestTopDrawableLayerAt(
            rootSc,
            target,
            state.currentFrame,
            stagePt,
            cam,
            getTotalViewScale(),
            state.viewPanX,
            state.viewPanY
          );
          if (hitKey && hitKey !== curActiveKey) {
            selectLayerByKey(hitKey);
          }
        }

        const activeKey = getLayerKeyForActive(target);
        if (!isBasicMode() && !activePathHit) {
          const ikChain = getIKChainForLayer(target, activeKey);
          if (ikChain.length >= 2) {
            const joints = resolveIKJoints(rootSc, target, ikChain, state.currentFrame, true);
            if (joints.length >= 2) {
              const endJoint = joints[joints.length - 1];
              const rootParentMat = getParentWorldMatrix(rootSc, target, ikChain[0], state.currentFrame);
              const worldMats = computeIKWorldMats(joints, rootParentMat);
              const endWorldMat = worldMats[worldMats.length - 1];
              const endLocalPt = applyMatPt(invMat(endWorldMat), worldPt);

              const siblingsSnapshot: IKSiblingSnapshot[] = [];
              for (let ji = 0; ji < joints.length - 1; ji++) {
                const pj = joints[ji];
                siblingsSnapshot.push({
                  layerKey: pj.layerKey,
                  rotation: pj.startRot,
                  offsetX: pj.startOffsetX,
                  offsetY: pj.startOffsetY,
                  posKeys: clonePosKeys(pj.prevPosKeys),
                  originX: pj.prevOriginX,
                  originY: pj.prevOriginY,
                  mouthFrame: pj.layerType === 'mouth' ? state.currentFrame : undefined,
                  mouthPrevKey: pj.layerType === 'mouth' ? pj.mouthPrevKey : undefined,
                });
              }

              if (endJoint.layerType === 'mouth' && endJoint.mouthLayer) {
                pushMouthTransformUndo(state.currentFrame, endJoint.mouthLayer);
                const mStack = mouthUndoStacks.get(endJoint.mouthLayer);
                const topAct = mStack?.[mStack.length - 1];
                if (topAct && topAct.kind === 'transform') {
                  topAct.prevKey = endJoint.mouthPrevKey ? { ...endJoint.mouthPrevKey } : undefined;
                  topAct.ikSiblings = siblingsSnapshot;
                }
              } else if (endJoint.celObj) {
                if (endJoint.layerType === 'vector') {
                  const vCel = endJoint.celObj as VectorCel;
                  if (vCel.posKeys && vCel.posKeys.length > 0) pushTweenUndo(vCel);
                  else pushVectorMoveUndo(vCel, vCel.offsetX, vCel.offsetY);
                } else {
                  const obj = endJoint.celObj as Cel | BgLayer;
                  if ('posKeys' in obj && obj.posKeys && obj.posKeys.length > 0) pushTweenUndo(obj);
                  else pushMoveUndo(obj, obj.offsetX, obj.offsetY);
                }
                const topUndo = endJoint.celObj.undoStack[endJoint.celObj.undoStack.length - 1];
                if (topUndo && (topUndo.type === 'move' || topUndo.type === 'tween')) {
                  topUndo.originX = endJoint.prevOriginX;
                  topUndo.originY = endJoint.prevOriginY;
                  topUndo.ikSiblings = siblingsSnapshot;
                }
              }

              moveCamState = {
                mode: 'moveIK',
                endLayerType: endJoint.layerType,
                endLayerKey: activeKey,
                endTargetObj: endJoint.celObj,
                endMouthLayer: endJoint.mouthLayer,
                joints,
                rootParentMat,
                endLocalPt,
                canRootFollow: !target.layerParents?.[ikChain[0]],
                siblingsSnapshot,
                moved: false,
              };
              stage.style.cursor = 'grabbing';
              renderTimeline();
              renderStage();
              return;
            }
          }
        }
        if (state.activeLayer === 'mouth') {
          const ml = state.mouthLayer;
          if (!ml.visible) ml.visible = true;
          pushMouthTransformUndo(state.currentFrame, ml);
          const curM = getActiveMouthState(ml);
          const pMat = getParentWorldMatrix(rootSc, target, activeKey, state.currentFrame);
          moveCamState = {
            mode: 'moveMouth',
            mouthLayer: ml,
            startX: curM.x,
            startY: curM.y,
            startStagePt: stagePt,
            totalScale,
            parentMat: pMat,
          };
        } else if (state.activeLayer === 'vector') {
          const curVecEntry = getVectorCelEntryAt(state.currentFrame);
          const pathHit = isBasicMode()
            ? null
            : hitTestLayerMotionPath(rootSc, activeKey, curVecEntry, worldPt, cam, getTotalViewScale());
          const vecParentMat = getParentWorldMatrix(rootSc, target, activeKey, state.currentFrame);

          if (pathHit?.kind === 'key' && curVecEntry?.cel.posKeys?.[pathHit.keyIndex]) {
            const cel = curVecEntry.cel;
            const k = cel.posKeys![pathHit.keyIndex];
            pushTweenUndo(cel);
            moveCamState = {
              mode: 'moveTweenKey',
              layerType: 'vector',
              cel,
              keyIndex: pathHit.keyIndex,
              startKeyOffsetX: k.offsetX,
              startKeyOffsetY: k.offsetY,
              startStagePt: stagePt,
              totalScale,
              parentMat: vecParentMat,
              moved: false,
            };
            stage.style.cursor = 'grabbing';
            return;
          }

          if ((pathHit?.kind === 'curveHandle' || pathHit?.kind === 'segment') && curVecEntry?.cel.posKeys?.[pathHit.segIndex]) {
            const cel = curVecEntry.cel;
            const segA = cel.posKeys![pathHit.segIndex];
            pushTweenUndo(cel);
            moveCamState = {
              mode: 'moveTweenCurve',
              layerType: 'vector',
              cel,
              segIndex: pathHit.segIndex,
              t: pathHit.t,
              startCtrlDx: segA.ctrlDx ?? 0,
              startCtrlDy: segA.ctrlDy ?? 0,
              startStagePt: stagePt,
              totalScale,
              parentMat: vecParentMat,
              moved: false,
            };
            stage.style.cursor = 'grabbing';
            return;
          }

          const existed = Boolean(curVecEntry);
          const entry = curVecEntry || ensureVectorCelAt(state.currentFrame, true);
          const cel = entry.cel;
          const relFrame = state.currentFrame - entry.start;
          const hasTween = Boolean(cel.posKeys && cel.posKeys.length > 0);

          if (!isBasicMode() && (hasTween || (cel.duration > 1 && relFrame > 0))) {
            pushTweenUndo(cel);
            if (!cel.posKeys || cel.posKeys.length === 0) {
              cel.posKeys = [{ relFrame: 0, offsetX: cel.offsetX, offsetY: cel.offsetY, scale: cel.scale ?? 1, rotation: cel.rotation || 0 }];
            }
            let key = cel.posKeys.find((k) => k.relFrame === relFrame);
            if (!key) {
              const curOff = getCelOffsetAtFrame(cel, entry.start, state.currentFrame);
              key = {
                relFrame,
                offsetX: Math.round(curOff.offsetX),
                offsetY: Math.round(curOff.offsetY),
                scale: curOff.scale,
                rotation: curOff.rotation,
              };
              cel.posKeys.push(key);
              sortPosKeys(cel);
            }
            const keyIndex = cel.posKeys.indexOf(key);
            moveCamState = {
              mode: 'moveTweenKey',
              layerType: 'vector',
              cel,
              keyIndex,
              startKeyOffsetX: key.offsetX,
              startKeyOffsetY: key.offsetY,
              startStagePt: stagePt,
              totalScale,
              parentMat: vecParentMat,
              moved: false,
            };
            if (!existed) renderTimeline();
          } else {
            pushVectorMoveUndo(cel, cel.offsetX, cel.offsetY);
            moveCamState = {
              mode: 'moveVector',
              cel,
              startOffsetX: cel.offsetX,
              startOffsetY: cel.offsetY,
              startStagePt: stagePt,
              totalScale,
              parentMat: vecParentMat,
              moved: false,
            };
            if (!existed) renderTimeline();
          }
        } else if (state.activeLayer === 'bg') {
          const { obj } = getTargetLayerForEdit(true, true);
          if (!obj) return;
          pushMoveUndo(obj, obj.offsetX, obj.offsetY);
          const pMat = getParentWorldMatrix(rootSc, target, activeKey, state.currentFrame);
          moveCamState = {
            mode: 'moveFrame',
            cel: obj,
            startOffsetX: obj.offsetX,
            startOffsetY: obj.offsetY,
            startStagePt: stagePt,
            totalScale,
            parentMat: pMat,
            moved: false,
          };
        } else {
          const curEntry = getCelEntryAt(state.currentFrame);
          const pathHit = isBasicMode()
            ? null
            : hitTestLayerMotionPath(rootSc, activeKey, curEntry, worldPt, cam, getTotalViewScale());
          const celParentMat = getParentWorldMatrix(rootSc, target, activeKey, state.currentFrame);

          if (pathHit?.kind === 'key' && curEntry?.cel.posKeys?.[pathHit.keyIndex]) {
            const cel = curEntry.cel;
            const k = cel.posKeys![pathHit.keyIndex];
            pushTweenUndo(cel);
            moveCamState = {
              mode: 'moveTweenKey',
              layerType: 'cel',
              cel,
              keyIndex: pathHit.keyIndex,
              startKeyOffsetX: k.offsetX,
              startKeyOffsetY: k.offsetY,
              startStagePt: stagePt,
              totalScale,
              parentMat: celParentMat,
              moved: false,
            };
            stage.style.cursor = 'grabbing';
            return;
          }

          if ((pathHit?.kind === 'curveHandle' || pathHit?.kind === 'segment') && curEntry?.cel.posKeys?.[pathHit.segIndex]) {
            const cel = curEntry.cel;
            const segA = cel.posKeys![pathHit.segIndex];
            pushTweenUndo(cel);
            moveCamState = {
              mode: 'moveTweenCurve',
              layerType: 'cel',
              cel,
              segIndex: pathHit.segIndex,
              t: pathHit.t,
              startCtrlDx: segA.ctrlDx ?? 0,
              startCtrlDy: segA.ctrlDy ?? 0,
              startStagePt: stagePt,
              totalScale,
              parentMat: celParentMat,
              moved: false,
            };
            stage.style.cursor = 'grabbing';
            return;
          }

          const existed = Boolean(curEntry);
          const entry = curEntry || ensureCelAt(state.currentFrame, true);
          const cel = entry.cel;
          const relFrame = state.currentFrame - entry.start;
          const hasTween = Boolean(cel.posKeys && cel.posKeys.length > 0);

          if (!isBasicMode() && (hasTween || (cel.duration > 1 && relFrame > 0))) {
            pushTweenUndo(cel);
            if (!cel.posKeys || cel.posKeys.length === 0) {
              cel.posKeys = [{ relFrame: 0, offsetX: cel.offsetX, offsetY: cel.offsetY, scale: cel.scale ?? 1, rotation: cel.rotation || 0 }];
            }
            let key = cel.posKeys.find((k) => k.relFrame === relFrame);
            if (!key) {
              const curOff = getCelOffsetAtFrame(cel, entry.start, state.currentFrame);
              key = {
                relFrame,
                offsetX: Math.round(curOff.offsetX),
                offsetY: Math.round(curOff.offsetY),
                scale: curOff.scale,
                rotation: curOff.rotation,
              };
              cel.posKeys.push(key);
              sortPosKeys(cel);
            }
            const keyIndex = cel.posKeys.indexOf(key);
            moveCamState = {
              mode: 'moveTweenKey',
              layerType: 'cel',
              cel,
              keyIndex,
              startKeyOffsetX: key.offsetX,
              startKeyOffsetY: key.offsetY,
              startStagePt: stagePt,
              totalScale,
              parentMat: celParentMat,
              moved: false,
            };
            if (!existed) renderTimeline();
          } else {
            pushMoveUndo(cel, cel.offsetX, cel.offsetY);
            moveCamState = {
              mode: 'moveFrame',
              cel,
              startOffsetX: cel.offsetX,
              startOffsetY: cel.offsetY,
              startStagePt: stagePt,
              totalScale,
              parentMat: celParentMat,
              moved: false,
            };
            if (!existed) renderTimeline();
          }
        }
      }
      renderStage();
      return;
    }

    const rightErase = e.button === 2;
    if (rightErase) isRightErasing = true;
    const worldPt = stageToWorld(stagePt, cam);

    if (state.activeLayer === 'mouth') {
      const ml = state.mouthLayer;
      if (!ml.visible) ml.visible = true;
      const mouthEval = getActiveMouthState(ml);
      const vis = ml.visemes[mouthEval.viseme];
      const pLocalPt = worldToTargetParentLocal(rootSc, target, `mouth:${ml.id}`, state.currentFrame, worldPt);
      const mp = worldToVisemeLocal(pLocalPt, mouthEval);

      if (state.tool === 'fill' && !rightErase) {
        if (floodFillLayer(vis, mp.x, mp.y, state.brushColor, false, true)) {
          pushMouthVisemeUndo(mouthEval.viseme, ml);
        }
        updateMouthWidget();
        renderStage();
        return;
      }

      const eraseMode = rightErase || state.tool === 'eraser';
      activeDrawTarget = vis;
      activeDrawVector = null;
      activeDrawIsMouth = true;
      pushPixelUndo(vis, true);
      pushMouthVisemeUndo(mouthEval.viseme, ml);
      const vctx = vis.canvas.getContext('2d');
      if (vctx) {
        vctx.imageSmoothingEnabled = false;
        drawPixelDisk(vctx, mp.x, mp.y, state.brushSize, state.brushColor, eraseMode);
      }
      lastWorldPt = worldPt;
      updateMouthWidget();
      renderStage();
      return;
    }

    if (state.activeLayer === 'vector') {
      activeDrawIsMouth = false;
      activeDrawTarget = null;
      const activeTrackId = state.activeVectorTrack.id;
      const vectorLayerKey = `vector:${activeTrackId}`;
      const pLocalPt = worldToTargetParentLocal(rootSc, target, vectorLayerKey, state.currentFrame, worldPt);
      const curVecEntry = getVectorCelEntryAt(state.currentFrame);
      if (curVecEntry?.cel.nestId) {
        isPointerDown = false;
        isRightErasing = false;
        onNotify('Nested clip — right-click frame (or double-click) to edit inside nest, or use Move tool.');
        return;
      }
      if (!state.showVectorLayer) state.showVectorLayer = true;
      if (!state.activeVectorTrack.visible) {
        state.activeVectorTrack.visible = true;
        renderTimeline();
      }

      if (state.tool === 'vectorEdit' && !rightErase) {
        const inv = 1 / (getTotalViewScale() * (cam.scale / 100));
        const hit = hitTestVectorEditPoint(rootSc, target, state.currentFrame, worldPt, inv);
        if (hit && curVecEntry) {
          vectorEditSelection = hit;
          const pt = getVectorPointByRef(curVecEntry.cel, hit);
          if (pt) {
            vectorPointMode = pt.corner ? 'corner' : 'curve';
            syncVectorPointModeUI();
          }
          pushVectorItemsUndo(curVecEntry.cel);
          vectorEditDrag = {
            cel: curVecEntry.cel,
            trackId: activeTrackId,
            itemIndex: hit.itemIndex,
            contourIndex: hit.contourIndex,
            pointIndex: hit.pointIndex,
            moved: false,
          };
          stage.style.cursor = 'grabbing';
          renderStage();
          return;
        }
        vectorEditSelection = null;
        isPointerDown = false;
        renderStage();
        return;
      }

      if (state.tool === 'nudge' && !rightErase) {
        const activeEntry = getVectorCelEntryAt(state.currentFrame);
        if (!activeEntry || activeEntry.cel.items.length === 0) return;
        const existed = Boolean(getVectorCelEntryAt(state.currentFrame));
        const { start, cel } = ensureVectorCelAt(state.currentFrame, true);
        pushVectorItemsUndo(cel);

        const vOff = getCelOffsetAtFrame(cel, start, state.currentFrame);
        const sc = vOff.scale;
        const rot = vOff.rotation;
        const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'vector', cel) : { ox: 0, oy: 0 };
        const localPt = worldToLayerLocal(pLocalPt, vOff.offsetX, vOff.offsetY, piv.ox, piv.oy, rot, sc);
        const r = state.nudgeRadius;
        const targets: Array<{ pt: Point2D; origX: number; origY: number; weight: number }> = [];

        for (const item of cel.items) {
          if (item.kind === 'fill') {
            item.contours = item.contours.map((loop) => subdividePointsNearCircle(loop, localPt, r, true));
            for (const loop of item.contours) {
              for (const pt of loop) {
                const d = Math.hypot(pt.x - localPt.x, pt.y - localPt.y);
                if (d < r) {
                  const weight = 0.5 * (1 + Math.cos(Math.PI * (d / r)));
                  targets.push({ pt, origX: pt.x, origY: pt.y, weight });
                }
              }
            }
          } else {
            item.points = subdividePointsNearCircle(item.points, localPt, r, false);
            for (const pt of item.points) {
              const d = Math.hypot(pt.x - localPt.x, pt.y - localPt.y);
              if (d < r) {
                const weight = 0.5 * (1 + Math.cos(Math.PI * (d / r)));
                targets.push({ pt, origX: pt.x, origY: pt.y, weight });
              }
            }
          }
        }

        if (targets.length === 0) {
          cel.undoStack.pop();
          activeNudgeState = null;
          return;
        }

        activeNudgeState = { cel, trackId: activeTrackId, startLocalPt: localPt, radius: r, targets, moved: false };
        if (!existed) renderTimeline();
        renderStage();
        return;
      }

      if (state.tool === 'fill') {
        const existed = Boolean(getVectorCelEntryAt(state.currentFrame));
        const { start, cel } = ensureVectorCelAt(state.currentFrame, rightErase);
        const vOff = getCelOffsetAtFrame(cel, start, state.currentFrame);
        const vecFilled = tryVectorStrokeFill(
          cel,
          pLocalPt.x,
          pLocalPt.y,
          state.brushColor,
          rightErase,
          vOff.offsetX,
          vOff.offsetY,
          vOff.scale,
          vOff.rotation
        );
        if (!vecFilled) {
          floodFillVectorCel(
            cel,
            pLocalPt.x,
            pLocalPt.y,
            state.brushColor,
            rightErase,
            vOff.offsetX,
            vOff.offsetY,
            vOff.scale,
            vOff.rotation
          );
        }
        if (!existed || vecFilled || cel.items.length > 0) renderTimeline();
        renderStage();
        return;
      }

      const eraseMode = rightErase || state.tool === 'eraser';
      const existed = Boolean(getVectorCelEntryAt(state.currentFrame));
      const { start, cel } = ensureVectorCelAt(state.currentFrame, eraseMode);
      pushVectorItemsUndo(cel);
      const vOff = getCelOffsetAtFrame(cel, start, state.currentFrame);
      const sc = vOff.scale;
      const rot = vOff.rotation;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'vector', cel) : { ox: 0, oy: 0 };
      const localPt = worldToLayerLocal(pLocalPt, vOff.offsetX, vOff.offsetY, piv.ox, piv.oy, rot, sc);
      const item: VectorStrokeItem | VectorEraseItem = eraseMode
        ? { kind: 'erase', points: [localPt], size: state.brushSize }
        : { kind: 'stroke', points: [localPt], color: state.brushColor, size: state.brushSize };
      cel.items.push(item);
      if (!eraseMode) cel.hasInk = true;
      activeDrawVector = { cel, item };
      lastWorldPt = worldPt;
      if (!existed) renderTimeline();
      renderStage();
      return;
    }

    activeDrawIsMouth = false;
    activeDrawVector = null;
    if (state.activeLayer === 'cel') {
      const curCelEntry = getCelEntryAt(state.currentFrame);
      if (curCelEntry?.cel.nestId) {
        isPointerDown = false;
        isRightErasing = false;
        onNotify('Nested clip — right-click frame (or double-click) to edit inside nest, or use Move tool.');
        return;
      }
      if (!state.activeCelTrack.visible) {
        state.activeCelTrack.visible = true;
        renderTimeline();
      }
    }
    const layerType: 'cel' | 'bg' = state.activeLayer === 'bg' ? 'bg' : 'cel';
    const editLayerKey = getLayerKeyForActive(target);
    const pLocalPt = worldToTargetParentLocal(rootSc, target, editLayerKey, state.currentFrame, worldPt);

    if (state.activeLayer === 'cel' && state.tool === 'nudge' && !rightErase) {
      const activeEntry = getCelEntryAt(state.currentFrame);
      if (!activeEntry || !activeEntry.cel.hasInk) return;
      const cel = activeEntry.cel;
      ensureLayerCoversFrame(cel);
      const cctx = cel.canvas.getContext('2d');
      if (!cctx) return;
      pushPixelUndo(cel);
      const w = cel.canvas.width;
      const h = cel.canvas.height;
      const imgData = cctx.getImageData(0, 0, w, h);
      const pixels32 = new Uint32Array(imgData.data.buffer);
      const celOff = getCelOffsetAtFrame(cel, activeEntry.start, state.currentFrame);
      const sc = celOff.scale;
      const rot = celOff.rotation;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'cel', cel) : { ox: 0, oy: 0 };
      activeBitmapNudgeState = {
        cel,
        imgData,
        pixels32,
        lastLocalPt: worldToLayerLocal(pLocalPt, celOff.offsetX, celOff.offsetY, piv.ox, piv.oy, rot, sc),
        accX: 0,
        accY: 0,
        radius: state.nudgeRadius,
        moved: false,
      };
      renderStage();
      return;
    }

    if (state.tool === 'fill' && !rightErase) {
      const { obj, created } = getTargetLayerForEdit(true, false);
      if (obj) {
        const curCelEntry = layerType === 'cel' ? getCelEntryAt(state.currentFrame) : null;
        const off = curCelEntry
          ? getCelOffsetAtFrame(curCelEntry.cel, curCelEntry.start, state.currentFrame)
          : { offsetX: obj.offsetX, offsetY: obj.offsetY, scale: obj.scale ?? 1, rotation: obj.rotation || 0 };
        const sc = off.scale;
        const rot = off.rotation;
        const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, layerType, obj) : { ox: 0, oy: 0 };
        const lp = worldToLayerLocal(pLocalPt, off.offsetX, off.offsetY, piv.ox, piv.oy, rot, sc);
        floodFillLayer(obj, lp.x, lp.y, state.brushColor, false, false);
      }
      if (created) renderTimeline();
      updateBgUI();
      renderStage();
      return;
    }

    const eraseMode = rightErase || state.tool === 'eraser';
    const { obj, created } = getTargetLayerForEdit(true, eraseMode);
    if (!obj) return;
    ensureLayerCoversFrame(obj);
    activeDrawTarget = obj;
    pushPixelUndo(activeDrawTarget);

    const cctx = activeDrawTarget.canvas.getContext('2d');
    if (cctx) {
      cctx.imageSmoothingEnabled = false;
      const curCelEntry = layerType === 'cel' ? getCelEntryAt(state.currentFrame) : null;
      const off = curCelEntry
        ? getCelOffsetAtFrame(curCelEntry.cel, curCelEntry.start, state.currentFrame)
        : { offsetX: obj.offsetX, offsetY: obj.offsetY, scale: obj.scale ?? 1, rotation: obj.rotation || 0 };
      const sc = off.scale;
      const rot = off.rotation;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, layerType, obj) : { ox: 0, oy: 0 };
      const lp = worldToLayerLocal(pLocalPt, off.offsetX, off.offsetY, piv.ox, piv.oy, rot, sc);
      drawPixelDisk(cctx, lp.x, lp.y, state.brushSize, state.brushColor, eraseMode);
    }
    obj.hasInk = true;
    lastWorldPt = worldPt;

    if (created) renderTimeline();
    updateBgUI();
    renderStage();
  });

  stage.addEventListener('pointermove', (e) => {
    if (isPinching || activeTouchPointers.size >= 2 || isViewPanning) return;
    const stagePt = getStageCoords(e);
    hoverStagePt = stagePt;

    if (!isPointerDown) {
      if (state.tool === 'moveCam' && !state.isPlaying) {
        const cam = getEvaluatedCamera(state.currentFrame);
        const worldPt = stageToWorld(stagePt, cam);
        const inv = 1 / (getTotalViewScale() * (cam.scale / 100));
        const gizmo = !isBasicMode() && state.showOriginPoint ? getActiveLayerGizmoInfo(activeScene(), state.currentFrame, inv) : null;
        let nextGizmoHit: 'origin' | 'rotateHandle' | null = null;
        if (gizmo) {
          if (Math.hypot(worldPt.x - gizmo.worldOx, worldPt.y - gizmo.worldOy) <= 18 * inv) {
            nextGizmoHit = 'origin';
          } else if (Math.hypot(worldPt.x - gizmo.handleX, worldPt.y - gizmo.handleY) <= 12 * inv) {
            nextGizmoHit = 'rotateHandle';
          }
        }
        const gizmoChanged = nextGizmoHit !== hoverOriginGizmoPart;
        hoverOriginGizmoPart = nextGizmoHit;

        if (!isBasicMode() && (state.activeLayer === 'cel' || state.activeLayer === 'vector')) {
          const entry: { start: number; cel: Cel | VectorCel } | null =
            state.activeLayer === 'vector'
              ? getVectorCelEntryAt(state.currentFrame)
              : getCelEntryAt(state.currentFrame);
          const nextHit = nextGizmoHit
            ? null
            : hitTestLayerMotionPath(activeScene(), getLayerKeyForActive(activeTimelineTarget()), entry, worldPt, cam, getTotalViewScale());
          stage.style.cursor = nextGizmoHit ? 'grab' : nextHit ? (nextHit.kind === 'key' ? 'grab' : 'pointer') : 'move';
          const changed =
            nextHit?.kind !== hoverMotionHit?.kind ||
            (nextHit?.kind === 'key' && hoverMotionHit?.kind === 'key' && nextHit.keyIndex !== hoverMotionHit.keyIndex) ||
            ((nextHit?.kind === 'curveHandle' || nextHit?.kind === 'segment') &&
              (hoverMotionHit?.kind === 'curveHandle' || hoverMotionHit?.kind === 'segment') &&
              nextHit.segIndex !== hoverMotionHit.segIndex);
          if (changed || gizmoChanged) {
            hoverMotionHit = nextHit;
            renderStage();
          }
        } else {
          stage.style.cursor = nextGizmoHit ? 'grab' : 'move';
          if (gizmoChanged) renderStage();
        }
      } else if (!state.isPlaying && !isBasicMode() && state.activeLayer === 'vector' && state.tool === 'vectorEdit') {
        const cam = getEvaluatedCamera(state.currentFrame);
        const worldPt = stageToWorld(stagePt, cam);
        const inv = 1 / (getTotalViewScale() * (cam.scale / 100));
        const nextHover = hitTestVectorEditPoint(activeScene(), activeTimelineTarget(), state.currentFrame, worldPt, inv);
        stage.style.cursor = nextHover ? 'grab' : 'default';
        const changed =
          nextHover?.itemIndex !== vectorEditHover?.itemIndex ||
          nextHover?.contourIndex !== vectorEditHover?.contourIndex ||
          nextHover?.pointIndex !== vectorEditHover?.pointIndex;
        if (changed) {
          vectorEditHover = nextHover;
          renderStage();
        }
      } else if (
        state.tool === 'brush' ||
        state.tool === 'eraser' ||
        (state.tool === 'nudge' && (state.activeLayer === 'vector' || state.activeLayer === 'cel'))
      ) {
        if (hoverOriginGizmoPart !== null) hoverOriginGizmoPart = null;
        renderStage();
      }
      return;
    }

    if (vectorEditDrag) {
      const cam = getEvaluatedCamera(state.currentFrame);
      const worldPt = stageToWorld(stagePt, cam);
      const rootSc = activeScene();
      const target = activeTimelineTarget();
      const cel = vectorEditDrag.cel;
      const curEntry = getVectorCelEntryAt(state.currentFrame);
      const vOff =
        curEntry && curEntry.cel === cel
          ? getCelOffsetAtFrame(cel, curEntry.start, state.currentFrame)
          : { offsetX: cel.offsetX, offsetY: cel.offsetY, scale: cel.scale ?? 1, rotation: cel.rotation || 0 };
      const pLocalPt = worldToTargetParentLocal(rootSc, target, `vector:${vectorEditDrag.trackId}`, state.currentFrame, worldPt);
      const sc = vOff.scale;
      const rot = vOff.rotation;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'vector', cel) : { ox: 0, oy: 0 };
      const localPt = worldToLayerLocal(pLocalPt, vOff.offsetX, vOff.offsetY, piv.ox, piv.oy, rot, sc);
      const pt = getVectorPointByRef(cel, vectorEditDrag);
      if (pt) {
        const nx = Math.round(localPt.x * 10) / 10;
        const ny = Math.round(localPt.y * 10) / 10;
        if (Math.hypot(nx - pt.x, ny - pt.y) > 0.05) vectorEditDrag.moved = true;
        pt.x = nx;
        pt.y = ny;
      }
      renderStage();
      return;
    }

    if (activeNudgeState) {
      const cam = getEvaluatedCamera(state.currentFrame);
      const worldPt = stageToWorld(stagePt, cam);
      const rootSc = activeScene();
      const target = activeTimelineTarget();
      const cel = activeNudgeState.cel;
      const curEntry = getVectorCelEntryAt(state.currentFrame);
      const vOff =
        curEntry && curEntry.cel === cel
          ? getCelOffsetAtFrame(cel, curEntry.start, state.currentFrame)
          : { offsetX: cel.offsetX, offsetY: cel.offsetY, scale: cel.scale ?? 1, rotation: cel.rotation || 0 };
      const pLocalPt = worldToTargetParentLocal(rootSc, target, `vector:${activeNudgeState.trackId}`, state.currentFrame, worldPt);
      const sc = vOff.scale;
      const rot = vOff.rotation;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'vector', cel) : { ox: 0, oy: 0 };
      const localPt = worldToLayerLocal(pLocalPt, vOff.offsetX, vOff.offsetY, piv.ox, piv.oy, rot, sc);
      const dx = localPt.x - activeNudgeState.startLocalPt.x;
      const dy = localPt.y - activeNudgeState.startLocalPt.y;
      if (Math.hypot(dx, dy) > 0.15) activeNudgeState.moved = true;
      for (const t of activeNudgeState.targets) {
        t.pt.x = t.origX + dx * t.weight;
        t.pt.y = t.origY + dy * t.weight;
      }
      renderStage();
      return;
    }

    if (activeBitmapNudgeState) {
      const cam = getEvaluatedCamera(state.currentFrame);
      const worldPt = stageToWorld(stagePt, cam);
      const rootSc = activeScene();
      const target = activeTimelineTarget();
      const { cel, imgData, pixels32, radius } = activeBitmapNudgeState;
      const curEntry = getCelEntryAt(state.currentFrame);
      const celOff =
        curEntry && curEntry.cel === cel
          ? getCelOffsetAtFrame(cel, curEntry.start, state.currentFrame)
          : { offsetX: cel.offsetX, offsetY: cel.offsetY, scale: cel.scale ?? 1, rotation: cel.rotation || 0 };
      const pLocalPt = worldToTargetParentLocal(rootSc, target, getLayerKeyForActive(target), state.currentFrame, worldPt);
      const sc = celOff.scale;
      const rot = celOff.rotation;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'cel', cel) : { ox: 0, oy: 0 };
      const curLocalPt = worldToLayerLocal(pLocalPt, celOff.offsetX, celOff.offsetY, piv.ox, piv.oy, rot, sc);
      const dx = curLocalPt.x - activeBitmapNudgeState.lastLocalPt.x;
      const dy = curLocalPt.y - activeBitmapNudgeState.lastLocalPt.y;
      const dist = Math.hypot(dx, dy);

      if (dist >= 0.35) {
        const w = imgData.width;
        const h = imgData.height;
        const steps = Math.max(1, Math.ceil(dist));
        const ux = dx / steps;
        const uy = dy / steps;
        const r2 = radius * radius;
        let stepMoved = false;

        for (let s = 1; s <= steps; s++) {
          const cx = activeBitmapNudgeState.lastLocalPt.x + ux * s;
          const cy = activeBitmapNudgeState.lastLocalPt.y + uy * s;

          activeBitmapNudgeState.accX += ux;
          activeBitmapNudgeState.accY += uy;
          const sx =
            Math.abs(activeBitmapNudgeState.accX) >= 0.5
              ? Math.max(-1, Math.min(1, Math.round(activeBitmapNudgeState.accX)))
              : 0;
          const sy =
            Math.abs(activeBitmapNudgeState.accY) >= 0.5
              ? Math.max(-1, Math.min(1, Math.round(activeBitmapNudgeState.accY)))
              : 0;
          activeBitmapNudgeState.accX -= sx;
          activeBitmapNudgeState.accY -= sy;

          if (sx === 0 && sy === 0) continue;

          const wx0 = Math.max(0, Math.floor(cx - radius));
          const wx1 = Math.min(w - 1, Math.ceil(cx + radius));
          const wy0 = Math.max(0, Math.floor(cy - radius));
          const wy1 = Math.min(h - 1, Math.ceil(cy + radius));
          if (wx0 > wx1 || wy0 > wy1) continue;

          const bx0 = Math.max(0, wx0 - 1);
          const bx1 = Math.min(w - 1, wx1 + 1);
          const by0 = Math.max(0, wy0 - 1);
          const by1 = Math.min(h - 1, wy1 + 1);
          const patchW = bx1 - bx0 + 1;
          const patchH = by1 - by0 + 1;
          const needed = patchW * patchH;
          if (bitmapNudgePatchBuf.length < needed) {
            bitmapNudgePatchBuf = new Uint32Array(needed);
          }

          for (let py = by0; py <= by1; py++) {
            const rowOff = py * w + bx0;
            const patchOff = (py - by0) * patchW;
            bitmapNudgePatchBuf.set(pixels32.subarray(rowOff, rowOff + patchW), patchOff);
          }

          for (let y = wy0; y <= wy1; y++) {
            const dyPix = y - cy;
            const dy2 = dyPix * dyPix;
            const rowBase = y * w;
            const srcY = y - sy;
            const validY = srcY >= by0 && srcY <= by1;
            const patchRowBase = (srcY - by0) * patchW;
            for (let x = wx0; x <= wx1; x++) {
              const dxPix = x - cx;
              if (dxPix * dxPix + dy2 > r2) continue;
              const srcX = x - sx;
              pixels32[rowBase + x] =
                validY && srcX >= bx0 && srcX <= bx1 ? bitmapNudgePatchBuf[patchRowBase + (srcX - bx0)] : 0;
              stepMoved = true;
            }
          }
        }

        if (stepMoved) activeBitmapNudgeState.moved = true;
        activeBitmapNudgeState.lastLocalPt = curLocalPt;
        const cctx = cel.canvas.getContext('2d');
        if (cctx) {
          cctx.imageSmoothingEnabled = false;
          cctx.putImageData(imgData, 0, 0);
        }
      }
      renderStage();
      return;
    }

    if (state.tool === 'moveCam' && moveCamState) {
      if (moveCamState.mode === 'moveOrigin') {
        const cam = getEvaluatedCamera(state.currentFrame);
        const worldPt = stageToWorld(stagePt, cam);
        const dwx = worldPt.x - moveCamState.startWorldPt.x;
        const dwy = worldPt.y - moveCamState.startWorldPt.y;
        if (Math.hypot(dwx, dwy) > 0.25) moveCamState.moved = true;
        const pDelta = isIdentityMat(moveCamState.parentMat)
          ? { x: dwx, y: dwy }
          : applyMatVec(invMat(moveCamState.parentMat), dwx, dwy);

        if (moveCamState.layer === 'mouth') {
          const ml = moveCamState.mouthLayer || state.mouthLayer;
          const curM = getActiveMouthState(ml);
          const copy = { ...curM };
          const mRot = curM.rotation || 0;
          const mc = mRot ? Math.cos(-mRot) : 1;
          const ms = mRot ? Math.sin(-mRot) : 0;
          const mlDx = pDelta.x * mc - pDelta.y * ms;
          const mlDy = pDelta.x * ms + pDelta.y * mc;
          applyMouthOriginChange(copy, Math.round(moveCamState.startOx + mlDx), Math.round(moveCamState.startOy + mlDy));
          setMouthKeyAtCurrentFrame({ x: copy.x, y: copy.y, originDx: copy.originDx, originDy: copy.originDy }, state.currentFrame, ml);
        } else if (moveCamState.targetObj) {
          const obj = moveCamState.targetObj;
          const oldOx = typeof obj.originX === 'number' ? obj.originX : moveCamState.startOx;
          const oldOy = typeof obj.originY === 'number' ? obj.originY : moveCamState.startOy;
          let rot = obj.rotation || 0;
          let sc = obj.scale ?? 1;
          if (moveCamState.layer === 'cel' || moveCamState.layer === 'vector') {
            const curE =
              moveCamState.layer === 'vector'
                ? getVectorCelEntryAt(state.currentFrame)
                : getCelEntryAt(state.currentFrame);
            if (curE && curE.cel === obj) {
              const curOff = getCelOffsetAtFrame(curE.cel, curE.start, state.currentFrame);
              rot = curOff.rotation;
              sc = curOff.scale;
            }
          }
          const invSc = sc !== 0 ? 1 / sc : 1;
          const c = rot ? Math.cos(-rot) : 1;
          const s = rot ? Math.sin(-rot) : 0;
          const dlx = (pDelta.x * c - pDelta.y * s) * invSc;
          const dly = (pDelta.x * s + pDelta.y * c) * invSc;
          const newOx = Math.round((moveCamState.startOx + dlx) * 10) / 10;
          const newOy = Math.round((moveCamState.startOy + dly) * 10) / 10;
          applyLayerOriginChange(moveCamState.layer, obj, oldOx, oldOy, newOx, newOy);
        }
        renderStage();
        return;
      }

      if (moveCamState.mode === 'rotateLayer') {
        const cam = getEvaluatedCamera(state.currentFrame);
        const worldPt = stageToWorld(stagePt, cam);
        const ang = Math.atan2(worldPt.y - moveCamState.pivotWorldY, worldPt.x - moveCamState.pivotWorldX);
        let deltaAng = ang - moveCamState.startAngle;
        while (deltaAng > Math.PI) deltaAng -= Math.PI * 2;
        while (deltaAng < -Math.PI) deltaAng += Math.PI * 2;
        let nextRot = moveCamState.startRotation + deltaAng;
        if (e.shiftKey) {
          const snapRad = (15 * Math.PI) / 180;
          const snappedWorldRot = Math.round((moveCamState.parentRot + nextRot) / snapRad) * snapRad;
          nextRot = snappedWorldRot - moveCamState.parentRot;
        }
        if (Math.abs(deltaAng) > 0.002) moveCamState.moved = true;

        if (moveCamState.layer === 'mouth') {
          setMouthKeyAtCurrentFrame({ rotation: nextRot }, state.currentFrame, moveCamState.mouthLayer || state.mouthLayer);
        } else if (moveCamState.targetObj) {
          if (
            typeof moveCamState.tweenKeyIndex === 'number' &&
            'posKeys' in moveCamState.targetObj &&
            moveCamState.targetObj.posKeys &&
            moveCamState.targetObj.posKeys[moveCamState.tweenKeyIndex]
          ) {
            const k = moveCamState.targetObj.posKeys[moveCamState.tweenKeyIndex];
            k.rotation = nextRot;
            if (k.relFrame === 0) {
              moveCamState.targetObj.rotation = nextRot;
            }
          } else {
            moveCamState.targetObj.rotation = nextRot;
          }
        }
        updateStageBadge();
        renderStage();
        return;
      }

      if (moveCamState.mode === 'moveIK') {
        const cam = getEvaluatedCamera(state.currentFrame);
        const worldPt = stageToWorld(stagePt, cam);
        moveCamState.moved = true;
        solveIKChainToTarget(
          moveCamState.joints,
          moveCamState.rootParentMat,
          moveCamState.endLocalPt,
          worldPt,
          state.currentFrame,
          moveCamState.canRootFollow
        );
        updateStageBadge();
        renderStage();
        return;
      }

      const dx = stagePt.x - moveCamState.startStagePt.x;
      const dy = stagePt.y - moveCamState.startStagePt.y;

      if (moveCamState.mode === 'camScale') {
        const deltaScale = (dx - dy) * 0.55;
        camScale.value = String(Math.round(Math.max(20, Math.min(500, moveCamState.startScale + deltaScale))));
        setCameraKeyframeFromUI(state.currentFrame);
        syncInspectorUI();
        renderTimeline();
        renderStage();
      } else if (moveCamState.mode === 'camPan') {
        const vs = getTotalViewScale();
        camX.value = String(Math.round(Math.max(-1200, Math.min(1200, moveCamState.startX + dx / vs))));
        camY.value = String(Math.round(Math.max(-800, Math.min(800, moveCamState.startY + dy / vs))));
        setCameraKeyframeFromUI(state.currentFrame);
        syncInspectorUI();
        renderTimeline();
        renderStage();
      } else if (moveCamState.mode === 'mouthScale') {
        const deltaScale = (dx - dy) * 0.55;
        const nextScale = Math.round(Math.max(20, Math.min(500, moveCamState.startScale + deltaScale)));
        setMouthKeyAtCurrentFrame({ scale: nextScale }, state.currentFrame, moveCamState.mouthLayer);
        updateMouthWidget();
        updateStageBadge();
        renderTimeline();
        renderStage();
      } else if (moveCamState.mode === 'scaleLayer') {
        const factor = Math.exp((dx - dy) * 0.005);
        const rawNext = Math.max(0.05, Math.min(10, moveCamState.startScale * factor));
        const snappedNext = Math.abs(rawNext - 1) < 0.004 ? 1 : Math.round(rawNext * 1000) / 1000;
        if (Math.abs(snappedNext - moveCamState.startScale) > 0.002) moveCamState.moved = true;
        if (
          typeof moveCamState.tweenKeyIndex === 'number' &&
          'posKeys' in moveCamState.targetObj &&
          moveCamState.targetObj.posKeys &&
          moveCamState.targetObj.posKeys[moveCamState.tweenKeyIndex]
        ) {
          const k = moveCamState.targetObj.posKeys[moveCamState.tweenKeyIndex];
          k.scale = snappedNext;
          if (k.relFrame === 0) {
            moveCamState.targetObj.scale = snappedNext;
          }
        } else {
          moveCamState.targetObj.scale = snappedNext;
        }
        updateStageBadge();
        renderStage();
      } else if (moveCamState.mode === 'moveMouth') {
        const dWorldX = dx / moveCamState.totalScale;
        const dWorldY = dy / moveCamState.totalScale;
        const localD = isIdentityMat(moveCamState.parentMat)
          ? { x: dWorldX, y: dWorldY }
          : applyMatVec(invMat(moveCamState.parentMat), dWorldX, dWorldY);
        setMouthKeyAtCurrentFrame(
          {
            x: Math.round(moveCamState.startX + localD.x),
            y: Math.round(moveCamState.startY + localD.y),
          },
          state.currentFrame,
          moveCamState.mouthLayer
        );
        renderTimeline();
        renderStage();
      } else if (moveCamState.mode === 'moveVector') {
        const dWorldX = dx / moveCamState.totalScale;
        const dWorldY = dy / moveCamState.totalScale;
        const localD = isIdentityMat(moveCamState.parentMat)
          ? { x: dWorldX, y: dWorldY }
          : applyMatVec(invMat(moveCamState.parentMat), dWorldX, dWorldY);
        const ldx = Math.round(localD.x);
        const ldy = Math.round(localD.y);
        if (ldx !== 0 || ldy !== 0) moveCamState.moved = true;

        moveCamState.cel.offsetX = moveCamState.startOffsetX + ldx;
        moveCamState.cel.offsetY = moveCamState.startOffsetY + ldy;
        renderStage();
      } else if (moveCamState.mode === 'moveFrame') {
        const dWorldX = dx / moveCamState.totalScale;
        const dWorldY = dy / moveCamState.totalScale;
        const localD = isIdentityMat(moveCamState.parentMat)
          ? { x: dWorldX, y: dWorldY }
          : applyMatVec(invMat(moveCamState.parentMat), dWorldX, dWorldY);
        const ldx = Math.round(localD.x);
        const ldy = Math.round(localD.y);
        if (ldx !== 0 || ldy !== 0) moveCamState.moved = true;

        moveCamState.cel.offsetX = moveCamState.startOffsetX + ldx;
        moveCamState.cel.offsetY = moveCamState.startOffsetY + ldy;
        renderStage();
      } else if (moveCamState.mode === 'moveTweenKey') {
        const dWorldX = dx / moveCamState.totalScale;
        const dWorldY = dy / moveCamState.totalScale;
        const localD = isIdentityMat(moveCamState.parentMat)
          ? { x: dWorldX, y: dWorldY }
          : applyMatVec(invMat(moveCamState.parentMat), dWorldX, dWorldY);
        const ldx = Math.round(localD.x);
        const ldy = Math.round(localD.y);
        if (ldx !== 0 || ldy !== 0) moveCamState.moved = true;
        const keys = moveCamState.cel.posKeys;
        if (keys && keys[moveCamState.keyIndex]) {
          const k = keys[moveCamState.keyIndex];
          k.offsetX = moveCamState.startKeyOffsetX + ldx;
          k.offsetY = moveCamState.startKeyOffsetY + ldy;
          if (k.relFrame === 0) {
            moveCamState.cel.offsetX = k.offsetX;
            moveCamState.cel.offsetY = k.offsetY;
          }
        }
        renderStage();
      } else if (moveCamState.mode === 'moveTweenCurve') {
        const dWorldX = dx / moveCamState.totalScale;
        const dWorldY = dy / moveCamState.totalScale;
        const localD = isIdentityMat(moveCamState.parentMat)
          ? { x: dWorldX, y: dWorldY }
          : applyMatVec(invMat(moveCamState.parentMat), dWorldX, dWorldY);
        if (Math.hypot(localD.x, localD.y) > 0.25) moveCamState.moved = true;
        const keys = moveCamState.cel.posKeys;
        if (keys && keys[moveCamState.segIndex] && keys[moveCamState.segIndex + 1]) {
          const a = keys[moveCamState.segIndex];
          const b = keys[moveCamState.segIndex + 1];
          const t = moveCamState.t;
          const u = 1 - t;
          const denom = 2 * u * t;
          if (denom > 0.02) {
            const mx = (a.offsetX + b.offsetX) * 0.5;
            const my = (a.offsetY + b.offsetY) * 0.5;
            const initCx = mx + moveCamState.startCtrlDx;
            const initCy = my + moveCamState.startCtrlDy;
            const initPx = u * u * a.offsetX + 2 * u * t * initCx + t * t * b.offsetX;
            const initPy = u * u * a.offsetY + 2 * u * t * initCy + t * t * b.offsetY;
            const targetX = initPx + localD.x;
            const targetY = initPy + localD.y;
            const nextCx = (targetX - u * u * a.offsetX - t * t * b.offsetX) / denom;
            const nextCy = (targetY - u * u * a.offsetY - t * t * b.offsetY) / denom;
            a.ctrlDx = Math.round((nextCx - mx) * 10) / 10;
            a.ctrlDy = Math.round((nextCy - my) * 10) / 10;
          }
        }
        renderStage();
      }
      return;
    }

    if (activeDrawVector && (isRightErasing || state.tool === 'brush' || state.tool === 'eraser')) {
      const cam = getEvaluatedCamera(state.currentFrame);
      const worldPt = stageToWorld(stagePt, cam);
      const rootSc = activeScene();
      const target = activeTimelineTarget();
      const vCel = activeDrawVector.cel;
      const curVec = getVectorCelEntryAt(state.currentFrame);
      const vOff =
        curVec && curVec.cel === vCel
          ? getCelOffsetAtFrame(vCel, curVec.start, state.currentFrame)
          : { offsetX: vCel.offsetX, offsetY: vCel.offsetY, scale: vCel.scale ?? 1, rotation: vCel.rotation || 0 };
      const pLocalPt = worldToTargetParentLocal(rootSc, target, `vector:${state.activeVectorTrack.id}`, state.currentFrame, worldPt);
      const sc = vOff.scale;
      const rot = vOff.rotation;
      const piv = rot || sc !== 1 ? getLayerPivotLocal(rootSc, 'vector', vCel) : { ox: 0, oy: 0 };
      const localPt = worldToLayerLocal(pLocalPt, vOff.offsetX, vOff.offsetY, piv.ox, piv.oy, rot, sc);
      const pts = activeDrawVector.item.points;
      const prev = pts[pts.length - 1];
      if (!prev || Math.hypot(localPt.x - prev.x, localPt.y - prev.y) >= 0.4) {
        pts.push(localPt);
      }
      lastWorldPt = worldPt;
      renderStage();
      return;
    }

    if (activeDrawTarget && lastWorldPt && (isRightErasing || state.tool === 'brush' || state.tool === 'eraser')) {
      const eraseMode = isRightErasing || state.tool === 'eraser';
      const cam = getEvaluatedCamera(state.currentFrame);
      const worldPt = stageToWorld(stagePt, cam);
      const rootSc = activeScene();
      const target = activeTimelineTarget();
      const cctx = activeDrawTarget.canvas.getContext('2d');
      if (cctx) {
        cctx.imageSmoothingEnabled = false;
        if (activeDrawIsMouth) {
          const ml = state.mouthLayer;
          const mouthEval = getActiveMouthState(ml);
          const mKey = `mouth:${ml.id}`;
          const pLast = worldToTargetParentLocal(rootSc, target, mKey, state.currentFrame, lastWorldPt);
          const pCur = worldToTargetParentLocal(rootSc, target, mKey, state.currentFrame, worldPt);
          const p1 = worldToVisemeLocal(pLast, mouthEval);
          const p2 = worldToVisemeLocal(pCur, mouthEval);
          drawPixelLine(cctx, p1, p2, state.brushSize, state.brushColor, eraseMode);
          updateMouthWidget();
        } else if ('offsetX' in activeDrawTarget) {
          const layerType: 'cel' | 'bg' = state.activeLayer === 'bg' ? 'bg' : 'cel';
          const drawKey = getLayerKeyForActive(target);
          const curCel = layerType === 'cel' ? getCelEntryAt(state.currentFrame) : null;
          const off =
            curCel && curCel.cel === activeDrawTarget
              ? getCelOffsetAtFrame(curCel.cel, curCel.start, state.currentFrame)
              : {
                  offsetX: activeDrawTarget.offsetX,
                  offsetY: activeDrawTarget.offsetY,
                  scale: activeDrawTarget.scale ?? 1,
                  rotation: activeDrawTarget.rotation || 0,
                };
          const pLast = worldToTargetParentLocal(rootSc, target, drawKey, state.currentFrame, lastWorldPt);
          const pCur = worldToTargetParentLocal(rootSc, target, drawKey, state.currentFrame, worldPt);
          const sc = off.scale;
          const rot = off.rotation;
          const piv = rot || sc !== 1
            ? getLayerPivotLocal(rootSc, layerType, activeDrawTarget)
            : { ox: 0, oy: 0 };
          const p1 = worldToLayerLocal(pLast, off.offsetX, off.offsetY, piv.ox, piv.oy, rot, sc);
          const p2 = worldToLayerLocal(pCur, off.offsetX, off.offsetY, piv.ox, piv.oy, rot, sc);
          drawPixelLine(cctx, p1, p2, state.brushSize, state.brushColor, eraseMode);
          activeDrawTarget.hasInk = true;
        }
      }
      lastWorldPt = worldPt;
      renderStage();
    }
  });

  stage.addEventListener('pointerup', () => {
    if (!isPointerDown) return;
    isPointerDown = false;
    isRightErasing = false;

    if (moveCamState && (moveCamState.mode === 'moveFrame' || moveCamState.mode === 'moveVector') && !moveCamState.moved) {
      moveCamState.cel.undoStack.pop();
    }
    let updatedTween = false;
    if (moveCamState && (moveCamState.mode === 'moveOrigin' || moveCamState.mode === 'rotateLayer' || moveCamState.mode === 'scaleLayer')) {
      if (!moveCamState.moved) {
        if (moveCamState.layer === 'mouth') {
          mouthUndoStacks.get(moveCamState.mouthLayer || state.mouthLayer)?.pop();
        } else if (moveCamState.targetObj) {
          const undone = moveCamState.targetObj.undoStack.pop();
          if (
            undone &&
            undone.type === 'tween' &&
            (moveCamState.mode === 'scaleLayer' || moveCamState.mode === 'rotateLayer') &&
            typeof moveCamState.tweenKeyIndex === 'number' &&
            'posKeys' in moveCamState.targetObj
          ) {
            moveCamState.targetObj.offsetX = undone.offsetX;
            moveCamState.targetObj.offsetY = undone.offsetY;
            moveCamState.targetObj.scale = undone.scale;
            moveCamState.targetObj.rotation = undone.rotation;
            moveCamState.targetObj.posKeys = clonePosKeys(undone.posKeys);
          }
        }
      } else if (
        (moveCamState.mode === 'scaleLayer' || moveCamState.mode === 'rotateLayer') &&
        typeof moveCamState.tweenKeyIndex === 'number'
      ) {
        updatedTween = true;
      }
    }
    if (moveCamState && (moveCamState.mode === 'moveTweenKey' || moveCamState.mode === 'moveTweenCurve')) {
      if (!moveCamState.moved) {
        const undone = moveCamState.cel.undoStack.pop();
        if (undone && undone.type === 'tween') {
          moveCamState.cel.offsetX = undone.offsetX;
          moveCamState.cel.offsetY = undone.offsetY;
          moveCamState.cel.posKeys = clonePosKeys(undone.posKeys);
        }
      } else {
        updatedTween = true;
      }
    }
    if (moveCamState && moveCamState.mode === 'moveIK') {
      if (!moveCamState.moved) {
        if (moveCamState.endLayerType === 'mouth') {
          const ml = moveCamState.endMouthLayer || state.mouthLayer;
          const act = mouthUndoStacks.get(ml)?.pop();
          if (act && act.kind === 'transform') {
            if (act.prevKey) ml.keys.set(act.frame, { ...act.prevKey });
            else ml.keys.delete(act.frame);
          }
        } else if (moveCamState.endTargetObj) {
          const obj = moveCamState.endTargetObj;
          const undone = obj.undoStack.pop();
          if (undone && (undone.type === 'move' || undone.type === 'tween' || undone.type === 'items')) {
            obj.rotation = undone.rotation;
            obj.originX = undone.originX;
            obj.originY = undone.originY;
          }
        }
        restoreIKSiblings(activeScene(), activeTimelineTarget(), state.currentFrame, moveCamState.siblingsSnapshot);
      }
    }
    if (activeNudgeState && !activeNudgeState.moved) {
      activeNudgeState.cel.undoStack.pop();
    }
    if (activeBitmapNudgeState && !activeBitmapNudgeState.moved) {
      activeBitmapNudgeState.cel.undoStack.pop();
    }
    if (vectorEditDrag && !vectorEditDrag.moved) {
      vectorEditDrag.cel.undoStack.pop();
    }
    if (activeDrawVector && activeDrawVector.item.kind === 'stroke' && activeDrawVector.item.points.length > 4) {
      activeDrawVector.item.points = simplifyVectorStrokePoints(activeDrawVector.item.points, 1.5);
    }

    const finishedVector = activeDrawVector !== null || activeNudgeState !== null || vectorEditDrag !== null;
    lastWorldPt = null;
    activeDrawTarget = null;
    activeDrawVector = null;
    activeDrawIsMouth = false;
    activeNudgeState = null;
    activeBitmapNudgeState = null;
    vectorEditDrag = null;
    moveCamState = null;
    stage.style.cursor = state.tool === 'moveCam' ? 'move' : state.tool === 'vectorEdit' ? 'default' : 'crosshair';
    if (finishedVector || updatedTween) renderTimeline();
    renderStage();
  });

  stage.addEventListener('dblclick', (e) => {
    if (state.isPlaying || isBasicMode()) return;
    const stagePt = getStageCoords(e);
    const cam = getEvaluatedCamera(state.currentFrame);
    const worldPt = stageToWorld(stagePt, cam);
    const inv = 1 / (getTotalViewScale() * (cam.scale / 100));

    if (state.tool === 'moveCam' && state.showOriginPoint) {
      const rootSc = activeScene();
      const gizmo = getActiveLayerGizmoInfo(rootSc, state.currentFrame, inv);
      if (gizmo) {
        const hitOrigin = Math.hypot(worldPt.x - gizmo.worldOx, worldPt.y - gizmo.worldOy) <= 18 * inv;
        const hitHandle = Math.hypot(worldPt.x - gizmo.handleX, worldPt.y - gizmo.handleY) <= 12 * inv;
        if (hitOrigin) {
          if (gizmo.layer === 'mouth') {
            const ml = state.mouthLayer;
            pushMouthTransformUndo(state.currentFrame, ml);
            const curM = getActiveMouthState(ml);
            const copy = { ...curM };
            applyMouthOriginChange(copy, 0, 0);
            setMouthKeyAtCurrentFrame({ x: copy.x, y: copy.y, originDx: 0, originDy: 0 }, state.currentFrame, ml);
          } else {
            const targetObj =
              gizmo.layer === 'bg' ? state.bgLayer : gizmo.layer === 'vector' ? gizmo.vecEntry?.cel : gizmo.celEntry?.cel;
            if (targetObj) {
              if ((gizmo.layer === 'cel' || gizmo.layer === 'vector') && (targetObj as Cel | VectorCel).posKeys?.length) {
                pushTweenUndo(targetObj as Cel | VectorCel);
              } else if (gizmo.layer === 'vector') {
                pushVectorMoveUndo(targetObj as VectorCel, targetObj.offsetX, targetObj.offsetY);
              } else {
                pushMoveUndo(targetObj as Cel | BgLayer, targetObj.offsetX, targetObj.offsetY);
              }
              applyLayerOriginChange(gizmo.layer, targetObj, gizmo.ox, gizmo.oy, gizmo.defaultOx, gizmo.defaultOy);
              delete targetObj.originX;
              delete targetObj.originY;
            }
          }
          renderStage();
          onNotify('Reset origin point to layer center.');
          return;
        }
        if (hitHandle) {
          if (gizmo.layer === 'mouth') {
            const ml = state.mouthLayer;
            pushMouthTransformUndo(state.currentFrame, ml);
            setMouthKeyAtCurrentFrame({ rotation: 0 }, state.currentFrame, ml);
          } else {
            const targetObj =
              gizmo.layer === 'bg' ? state.bgLayer : gizmo.layer === 'vector' ? gizmo.vecEntry?.cel : gizmo.celEntry?.cel;
            const entryStart = gizmo.layer === 'vector' ? gizmo.vecEntry?.start : gizmo.celEntry?.start;
            if (targetObj) {
              if ((gizmo.layer === 'cel' || gizmo.layer === 'vector') && (targetObj as Cel | VectorCel).posKeys?.length) {
                const animObj = targetObj as Cel | VectorCel;
                pushTweenUndo(animObj);
                const relFrame = typeof entryStart === 'number' ? state.currentFrame - entryStart : 0;
                let k = animObj.posKeys!.find((pk) => pk.relFrame === relFrame);
                if (!k && typeof entryStart === 'number') {
                  const curOff = getCelOffsetAtFrame(animObj, entryStart, state.currentFrame);
                  k = {
                    relFrame,
                    offsetX: Math.round(curOff.offsetX),
                    offsetY: Math.round(curOff.offsetY),
                    scale: curOff.scale,
                    rotation: 0,
                  };
                  animObj.posKeys!.push(k);
                  sortPosKeys(animObj);
                } else if (k) {
                  k.rotation = 0;
                }
                if (relFrame === 0) animObj.rotation = 0;
              } else if (gizmo.layer === 'vector') {
                pushVectorMoveUndo(targetObj as VectorCel, targetObj.offsetX, targetObj.offsetY);
                targetObj.rotation = 0;
              } else {
                pushMoveUndo(targetObj as Cel | BgLayer, targetObj.offsetX, targetObj.offsetY);
                targetObj.rotation = 0;
              }
            }
          }
          updateStageBadge();
          renderTimeline();
          renderStage();
          onNotify('Reset layer rotation to 0°.');
          return;
        }
      }
    }

    if (state.tool !== 'moveCam' || (state.activeLayer !== 'cel' && state.activeLayer !== 'vector')) return;
    const entry: { start: number; cel: Cel | VectorCel } | null =
      state.activeLayer === 'vector'
        ? getVectorCelEntryAt(state.currentFrame)
        : getCelEntryAt(state.currentFrame);
    const hit = hitTestLayerMotionPath(
      activeScene(),
      getLayerKeyForActive(activeTimelineTarget()),
      entry,
      worldPt,
      cam,
      getTotalViewScale()
    );
    if (!entry || !hit || !entry.cel.posKeys) return;

    if (hit.kind === 'curveHandle' || hit.kind === 'segment') {
      const segA = entry.cel.posKeys[hit.segIndex];
      if (!segA) return;
      pushTweenUndo(entry.cel);
      delete segA.ctrlDx;
      delete segA.ctrlDy;
      renderStage();
      onNotify('Reset motion arc segment to straight line.');
    } else if (hit.kind === 'key') {
      const k = entry.cel.posKeys[hit.keyIndex];
      if (k) goToFrame(entry.start + k.relFrame);
    }
  });

  stage.addEventListener('pointerleave', () => {
    hoverStagePt = null;
    hoverMotionHit = null;
    vectorEditHover = null;
    if (!isPointerDown) renderStage();
  });

  function drawImageFittedOnLayer(targetLayerObj: Cel | BgLayer, img: HTMLImageElement, fileName?: string): void {
    ensureLayerCoversFrame(targetLayerObj);
    pushPixelUndo(targetLayerObj);
    const cctx = targetLayerObj.canvas.getContext('2d');
    if (!cctx) return;
    cctx.imageSmoothingEnabled = false;

    let dw = img.width;
    let dh = img.height;
    if (dw > WORLD_W || dh > WORLD_H) {
      const scale = Math.min(WORLD_W / dw, WORLD_H / dh);
      dw = Math.round(dw * scale);
      dh = Math.round(dh * scale);
    }
    const dx = Math.round((WORLD_W - dw) / 2) - targetLayerObj.offsetX;
    const dy = Math.round((WORLD_H - dh) / 2) - targetLayerObj.offsetY;

    cctx.drawImage(img, dx, dy, dw, dh);
    targetLayerObj.hasInk = true;
    if (fileName && 'name' in targetLayerObj) targetLayerObj.name = fileName;
  }

  let pendingBgUploadId: string | null = null;

  function loadImageFile(
    file: File,
    destination: 'bg' | 'cel',
    targetFrame = state.currentFrame,
    targetId?: string
  ): void {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (destination === 'bg') {
        const sc = activeScene();
        const bg = (targetId && sc.bgLayers.find((b) => b.id === targetId)) || state.bgLayer;
        sc.activeBgLayerId = bg.id;
        bg.visible = true;
        if (!state.showBgTrack) toggleBgTrack(true);
        drawImageFittedOnLayer(bg, img, file.name);
        updateBgUI();
      } else {
        const target = activeTimelineTarget();
        const cTrk = (targetId && target.celTracks.find((t) => t.id === targetId)) || state.activeCelTrack;
        target.activeCelTrackId = cTrk.id;
        goToFrame(targetFrame);
        const { cel } = ensureCelAt(targetFrame, false, cTrk.cels);
        drawImageFittedOnLayer(cel, img, file.name);
        renderTimeline();
      }
      renderStage();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  let timelineCustomExtraHeight = 0;

  function getTimelineBaseExtra(): number {
    if (isBasicMode()) {
      return state.showAudioTrack ? 42 : 0;
    }
    const target = activeTimelineTarget();
    const isScene = 'mouthLayers' in target;
    let extra = state.showCelTrack ? Math.max(0, target.celTracks.length - 1) * 36 : -36;
    if (isScene && state.showMouthTrack) extra += Math.max(1, target.mouthLayers.length) * 38;
    if (state.showVectorTrack) extra += Math.max(1, target.vectorTracks.length) * 36;
    if (isScene && state.showBgTrack) extra += Math.max(1, target.bgLayers.length) * 36;
    if (isScene && state.showAudioTrack) extra += Math.max(1, target.audioTracks.length) * 42;
    if (isScene && state.showCamTrack) extra += 36;
    return extra;
  }

  function updateTimelinePanelHeight(): void {
    const baseH = 144 + getTimelineBaseExtra();
    const minH = Math.min(baseH, 112 + getTimelineBaseExtra());
    const maxH = Math.max(240, Math.floor(window.innerHeight * 0.68));
    const finalH = Math.max(minH, Math.min(maxH, baseH + timelineCustomExtraHeight));
    timelineCustomExtraHeight = finalH - baseH;
    timelinePanel.style.height = `${finalH}px`;
  }

  let timelineResizeDrag: { startY: number; startOffset: number } | null = null;
  timelineHeader.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement)?.closest('button, select, input, .cam-popover, .dropdown-menu')) return;
    e.preventDefault();
    timelineHeader.setPointerCapture(e.pointerId);
    timelineResizeDrag = { startY: e.clientY, startOffset: timelineCustomExtraHeight };
  });
  timelineHeader.addEventListener('pointermove', (e) => {
    if (!timelineResizeDrag) return;
    const dy = timelineResizeDrag.startY - e.clientY;
    timelineCustomExtraHeight = timelineResizeDrag.startOffset + dy;
    updateTimelinePanelHeight();
    resizeStageCanvas();
    renderAudioTrack();
  });
  const stopTimelineResize = () => {
    if (!timelineResizeDrag) return;
    timelineResizeDrag = null;
    resizeStageCanvas();
    renderAudioTrack();
  };
  timelineHeader.addEventListener('pointerup', stopTimelineResize);
  timelineHeader.addEventListener('pointercancel', stopTimelineResize);
  timelineHeader.addEventListener('dblclick', (e) => {
    if ((e.target as HTMLElement)?.closest('button, select, input, .cam-popover, .dropdown-menu')) return;
    timelineCustomExtraHeight = 0;
    updateTimelinePanelHeight();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  });

  interface CelTrackDom {
    trackId: string;
    labelEl: HTMLDivElement;
    rowEl: HTMLDivElement;
    rightEl: HTMLDivElement;
    tagSpan: HTMLSpanElement;
    tagTextSpan: HTMLSpanElement;
    btnAddChild: HTMLButtonElement;
    btnAdd: HTMLButtonElement;
    btnVis: HTMLButtonElement;
    btnRemove: HTMLButtonElement;
  }

  interface VectorTrackDom {
    trackId: string;
    labelEl: HTMLDivElement;
    rowEl: HTMLDivElement;
    rightEl: HTMLDivElement;
    tagSpan: HTMLSpanElement;
    tagTextSpan: HTMLSpanElement;
    btnAddChild: HTMLButtonElement;
    btnAdd: HTMLButtonElement;
    btnVis: HTMLButtonElement;
    btnRemove: HTMLButtonElement;
  }

  interface BgTrackDom {
    layerId: string;
    labelEl: HTMLDivElement;
    rowEl: HTMLDivElement;
    rightEl: HTMLDivElement;
    tagSpan: HTMLSpanElement;
    tagTextSpan: HTMLSpanElement;
    spanBarEl: HTMLDivElement;
    btnVis: HTMLButtonElement;
    btnRemove: HTMLButtonElement;
  }

  interface MouthTrackDom {
    layerId: string;
    labelEl: HTMLDivElement;
    rowEl: HTMLDivElement;
    rightEl: HTMLDivElement;
    tagSpan: HTMLSpanElement;
    tagTextSpan: HTMLSpanElement;
    btnVis: HTMLButtonElement;
    btnRemove: HTMLButtonElement;
  }

  let renderedCelTrackIds: string[] = [];
  let renderedVectorTrackIds: string[] = [];
  let renderedBgLayerIds: string[] = [];
  let renderedMouthLayerIds: string[] = [];
  const celTrackDomMap = new Map<string, CelTrackDom>();
  const vectorTrackDomMap = new Map<string, VectorTrackDom>();
  const bgTrackDomMap = new Map<string, BgTrackDom>();
  const mouthTrackDomMap = new Map<string, MouthTrackDom>();
  const boundLayerLabelEls = new WeakSet<HTMLElement>();
  let renamingLayerKey: string | null = null;
  let lastLayerDragEndTime = 0;
  let contextMenuLayerKey: string | null = null;

  let layerDragState: {
    dragKey: string;
    labelEl: HTMLElement;
    startY: number;
    started: boolean;
    dropTargetKey: string | null;
    dropPos: 'above' | 'below';
  } | null = null;

  let celStretchState: {
    trackId: string;
    celsMap: Map<number, Cel>;
    targetStart: number;
    origTotalFrames: number;
    origCels: Array<{ start: number; cel: Cel; duration: number }>;
    lastTargetFrame: number;
  } | null = null;

  let vectorStretchState: {
    trackId: string;
    celsMap: Map<number, VectorCel>;
    targetStart: number;
    origTotalFrames: number;
    origCels: Array<{ start: number; cel: VectorCel; duration: number }>;
    lastTargetFrame: number;
  } | null = null;

  let contextTargetFrame = 0;
  let contextTargetLayer: 'cel' | 'vector' = 'cel';
  let contextTargetCelTrackId: string | null = null;
  let contextTargetVectorTrackId: string | null = null;

  function selectLayerByKey(key: string): void {
    if (key.startsWith('mouth:')) selectMouthLayer(key.slice(6));
    else if (key.startsWith('cel:')) selectCelTrack(key.slice(4));
    else if (key.startsWith('bg:')) selectBgLayer(key.slice(3));
    else if (key.startsWith('vector:')) selectVectorTrack(key.slice(7));
    else if (key.startsWith('audio:')) selectAudioTrack(key.slice(6));
    else if (key === 'cam') selectTimelineTrack('cam');
    else if (key === 'mouth') selectTimelineTrack('mouth');
    else if (key === 'cel') selectTimelineTrack('cel');
    else if (key === 'bg') selectTimelineTrack('bg');
  }

  function startLayerRename(key: string): void {
    const labelEl = getLayerLabelElement(key);
    if (!labelEl) return;
    const tagSpan = labelEl.querySelector<HTMLElement>('.track-tag');
    const textSpan = labelEl.querySelector<HTMLElement>('.track-tag-text');
    if (!tagSpan || !textSpan) return;

    const existingInput = tagSpan.querySelector<HTMLInputElement>('.layer-rename-input');
    if (existingInput) {
      existingInput.focus();
      existingInput.select();
      return;
    }

    renamingLayerKey = key;
    const curName = getLayerDisplayName(activeTimelineTarget(), key);
    textSpan.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'layer-rename-input';
    input.value = curName;
    input.maxLength = 36;
    tagSpan.appendChild(input);

    let finished = false;
    const finishRename = (commit: boolean) => {
      if (finished) return;
      finished = true;
      const nextVal = input.value.trim();
      input.remove();
      textSpan.style.display = '';
      renamingLayerKey = null;
      if (commit && nextVal) {
        setLayerDisplayName(activeTimelineTarget(), key, nextVal);
        updateMouthWidget();
        updateStageBadge();
        updateBgUI();
      }
      syncLayerTrackContainers();
      syncAudioTrackContainers();
    };

    input.addEventListener('pointerdown', (e) => e.stopPropagation());
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('dblclick', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        finishRename(true);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        finishRename(false);
      }
    });
    input.addEventListener('blur', () => finishRename(true));

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
  }

  function getLayerLabelElement(key: string): HTMLDivElement | null {
    if (key.startsWith('mouth:')) return mouthTrackDomMap.get(key.slice(6))?.labelEl || null;
    if (key.startsWith('cel:')) return celTrackDomMap.get(key.slice(4))?.labelEl || null;
    if (key.startsWith('bg:')) return bgTrackDomMap.get(key.slice(3))?.labelEl || null;
    if (key.startsWith('vector:')) return vectorTrackDomMap.get(key.slice(7))?.labelEl || null;
    if (key.startsWith('audio:')) return audioTrackDomMap.get(key.slice(6))?.labelEl || null;
    if (key === 'cam') return camTrackLabel;
    return null;
  }

  function getLayerRowElement(key: string): HTMLDivElement | null {
    if (key.startsWith('mouth:')) return mouthTrackDomMap.get(key.slice(6))?.rowEl || null;
    if (key.startsWith('cel:')) return celTrackDomMap.get(key.slice(4))?.rowEl || null;
    if (key.startsWith('bg:')) return bgTrackDomMap.get(key.slice(3))?.rowEl || null;
    if (key.startsWith('vector:')) return vectorTrackDomMap.get(key.slice(7))?.rowEl || null;
    return null;
  }

  function getLayerRightElement(key: string): HTMLDivElement | null {
    if (key.startsWith('mouth:')) return mouthTrackDomMap.get(key.slice(6))?.rightEl || null;
    if (key.startsWith('cel:')) return celTrackDomMap.get(key.slice(4))?.rightEl || null;
    if (key.startsWith('bg:')) return bgTrackDomMap.get(key.slice(3))?.rightEl || null;
    if (key.startsWith('vector:')) return vectorTrackDomMap.get(key.slice(7))?.rightEl || null;
    return null;
  }

  function clearLayerDragDropIndicators(): void {
    layerLabelsContainer.querySelectorAll('.layer-dragging, .drop-above, .drop-below').forEach((el) => {
      el.classList.remove('layer-dragging', 'drop-above', 'drop-below');
    });
  }

  function getNearestVisibleLayerAbove(target: Scene | NestedClip, key: string): string | null {
    normalizeTargetHierarchy(target);
    const idx = target.layerOrder.indexOf(key);
    for (let i = idx - 1; i >= 0; i--) {
      const k = target.layerOrder[i];
      const lbl = getLayerLabelElement(k);
      if (lbl && !lbl.classList.contains('hidden-track')) return k;
    }
    return null;
  }

  function canDeleteLayerKey(_target: Scene | NestedClip, key: string): boolean {
    if (isBasicMode()) return false;
    return (
      key.startsWith('vector:') ||
      key.startsWith('cel:') ||
      key.startsWith('bg:') ||
      key.startsWith('mouth:') ||
      key.startsWith('audio:') ||
      key === 'cam'
    );
  }

  function openLayerContextMenu(key: string, clientX: number, clientY: number): void {
    hideMenus();
    selectLayerByKey(key);
    contextMenuLayerKey = key;

    const target = activeTimelineTarget();
    normalizeTargetHierarchy(target);
    const isSpecialTrack = key.startsWith('audio:') || key === 'cam';

    ctxLayerAddChildVec.classList.toggle('hidden-nest-ui', isSpecialTrack);
    ctxLayerAddChildCel.classList.toggle('hidden-nest-ui', isSpecialTrack);
    ctxLayerJoinAbove.classList.toggle('hidden-nest-ui', isSpecialTrack);
    ctxLayerDetach.classList.toggle('hidden-nest-ui', isSpecialTrack);
    ctxLayerToggleIK.classList.toggle('hidden-nest-ui', isSpecialTrack);
    layerContextMenu.querySelectorAll<HTMLElement>('.ctx-divider').forEach((d) => {
      d.classList.toggle('hidden-nest-ui', isSpecialTrack);
    });

    if (!isSpecialTrack) {
      const prevAbove = getNearestVisibleLayerAbove(target, key);
      const canJoinAbove = Boolean(prevAbove && !isLayerDescendant(target, key, prevAbove));
      ctxLayerJoinAbove.disabled = !canJoinAbove;
      ctxLayerJoinAbove.textContent = prevAbove
        ? `Join as Child of ${getLayerDisplayName(target, prevAbove)}`
        : 'Join as Child of Above';

      ctxLayerDetach.disabled = !target.layerParents?.[key];
      const hasParent = Boolean(target.layerParents?.[key]);
      const hasChild = Object.values(target.layerParents || {}).includes(key);
      const canIK = hasParent || hasChild;
      const isIKOn = Boolean(target.layerIK?.[key]);
      ctxLayerToggleIK.disabled = !canIK;
      ctxLayerToggleIK.textContent = isIKOn ? 'Disable Inverse Kinematics' : 'Enable Inverse Kinematics';
      ctxLayerToggleIK.title = canIK
        ? 'Move the end layer to make other layers in the chain move and rotate to follow'
        : 'Join this layer into a parent-child chain first to enable Inverse Kinematics';
    }

    ctxLayerRename.classList.toggle('hidden-nest-ui', key === 'cam');
    ctxLayerClear.classList.toggle('hidden-nest-ui', !key.startsWith('bg:'));
    ctxLayerDelete.classList.toggle('hidden-nest-ui', !canDeleteLayerKey(target, key));

    layerContextMenu.style.display = 'flex';
    const menuW = 228;
    const menuH = isSpecialTrack ? 96 : 250;
    const left = Math.min(window.innerWidth - menuW - 6, clientX);
    const top = Math.min(window.innerHeight - menuH - 6, clientY);
    layerContextMenu.style.left = `${left}px`;
    layerContextMenu.style.top = `${top}px`;
  }

  function setupLayerLabelInteractions(labelEl: HTMLDivElement, getKey: () => string): void {
    if (boundLayerLabelEls.has(labelEl)) return;
    boundLayerLabelEls.add(labelEl);

    labelEl.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || isBasicMode()) return;
      if ((e.target as HTMLElement)?.closest('button, input, select')) return;
      if (renamingLayerKey !== null) return;
      layerDragState = {
        dragKey: getKey(),
        labelEl,
        startY: e.clientY,
        started: false,
        dropTargetKey: null,
        dropPos: 'above',
      };
    });

    labelEl.addEventListener('click', (e) => {
      if ((e.target as HTMLElement)?.closest('button, input, select')) return;
      if (renamingLayerKey !== null) return;
      if (performance.now() - lastLayerDragEndTime < 220) return;
      selectLayerByKey(getKey());
    });

    labelEl.addEventListener('dblclick', (e) => {
      if (isBasicMode()) return;
      if ((e.target as HTMLElement)?.closest('button, input, select')) return;
      e.stopPropagation();
      startLayerRename(getKey());
    });

    labelEl.addEventListener('contextmenu', (e) => {
      if (isBasicMode()) return;
      if ((e.target as HTMLElement)?.closest('input, select')) return;
      e.preventDefault();
      e.stopPropagation();
      openLayerContextMenu(getKey(), e.clientX, e.clientY);
    });
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (!layerDragState) return;
      if (!layerDragState.started) {
        if (Math.abs(e.clientY - layerDragState.startY) <= 5) return;
        layerDragState.started = true;
        layerDragState.labelEl.classList.add('layer-dragging');
        document.body.style.cursor = 'grabbing';
      }

      clearLayerDragDropIndicators();
      layerDragState.labelEl.classList.add('layer-dragging');

      const target = activeTimelineTarget();
      normalizeTargetHierarchy(target);
      const dragBlock = getContiguousLayerSubtree(target, layerDragState.dragKey);
      let nextDropKey: string | null = null;
      let nextDropPos: 'above' | 'below' = 'above';

      const visibleEntries: Array<{ key: string; el: HTMLElement; rect: DOMRect }> = [];
      for (const k of target.layerOrder) {
        const el = getLayerLabelElement(k);
        if (!el || el.classList.contains('hidden-track')) continue;
        visibleEntries.push({ key: k, el, rect: el.getBoundingClientRect() });
      }

      for (const item of visibleEntries) {
        if (dragBlock.includes(item.key)) continue;
        if (e.clientY >= item.rect.top && e.clientY <= item.rect.bottom) {
          nextDropKey = item.key;
          nextDropPos = e.clientY < item.rect.top + item.rect.height / 2 ? 'above' : 'below';
          break;
        }
      }

      if (!nextDropKey && visibleEntries.length > 0) {
        const first = visibleEntries[0];
        const last = visibleEntries[visibleEntries.length - 1];
        if (e.clientY < first.rect.top && !dragBlock.includes(first.key)) {
          nextDropKey = first.key;
          nextDropPos = 'above';
        } else if (e.clientY > last.rect.bottom && !dragBlock.includes(last.key)) {
          nextDropKey = last.key;
          nextDropPos = 'below';
        }
      }

      layerDragState.dropTargetKey = nextDropKey;
      layerDragState.dropPos = nextDropPos;
      if (nextDropKey) {
        const dropEl = getLayerLabelElement(nextDropKey);
        dropEl?.classList.add(nextDropPos === 'above' ? 'drop-above' : 'drop-below');
      }
    },
    { signal }
  );

  const finishLayerDrag = () => {
    if (!layerDragState) return;
    const ds = layerDragState;
    layerDragState = null;
    clearLayerDragDropIndicators();
    document.body.style.cursor = '';

    if (!ds.started) return;
    lastLayerDragEndTime = performance.now();

    if (!ds.dropTargetKey || ds.dropTargetKey === ds.dragKey) return;
    const rootSc = activeScene();
    const target = activeTimelineTarget();
    normalizeTargetHierarchy(target);

    const block = getContiguousLayerSubtree(target, ds.dragKey);
    if (block.includes(ds.dropTargetKey)) return;

    const oldParent = target.layerParents?.[ds.dragKey] || null;
    const remaining = target.layerOrder.filter((k) => !block.includes(k));
    const targetIdx = remaining.indexOf(ds.dropTargetKey);
    if (targetIdx < 0) return;

    const insertIdx = ds.dropPos === 'above' ? targetIdx : targetIdx + 1;
    const aboveKey = insertIdx > 0 ? remaining[insertIdx - 1] : null;
    if (oldParent && (!aboveKey || (aboveKey !== oldParent && !isLayerDescendant(target, oldParent, aboveKey)))) {
      setLayerParentKeepWorld(rootSc, target, ds.dragKey, null, state.currentFrame);
    }

    const updatedRemaining = target.layerOrder.filter((k) => !block.includes(k));
    const updatedTargetIdx = updatedRemaining.indexOf(ds.dropTargetKey);
    if (updatedTargetIdx < 0) return;
    const finalInsertIdx = ds.dropPos === 'above' ? updatedTargetIdx : updatedTargetIdx + 1;
    updatedRemaining.splice(finalInsertIdx, 0, ...block);
    target.layerOrder = updatedRemaining;
    normalizeTargetHierarchy(target);

    syncLayerTrackContainers();
    updateActiveTrackHighlight();
    updateStageBadge();
    renderTimeline();
    renderStage();
  };

  window.addEventListener('pointerup', finishLayerDrag, { signal });
  window.addEventListener('pointercancel', finishLayerDrag, { signal });

  function createLayerTagDom(colorClass: string, initialText: string, titleText: string): {
    tagSpan: HTMLSpanElement;
    tagTextSpan: HTMLSpanElement;
  } {
    const tagSpan = document.createElement('span');
    tagSpan.className = 'track-tag';
    tagSpan.title = titleText;
    const icon = document.createElement('i');
    icon.className = colorClass;
    const childArrow = document.createElement('span');
    childArrow.className = 'layer-child-arrow';
    childArrow.textContent = '↳';
    const tagTextSpan = document.createElement('span');
    tagTextSpan.className = 'track-tag-text';
    tagTextSpan.textContent = initialText;
    const ikBadge = document.createElement('span');
    ikBadge.className = 'layer-ik-badge';
    ikBadge.textContent = 'IK';
    ikBadge.title = 'Inverse Kinematics Enabled';
    tagSpan.append(icon, childArrow, tagTextSpan, ikBadge);
    return { tagSpan, tagTextSpan };
  }

  function syncLayerTrackContainers(): void {
    const target = activeTimelineTarget();
    const isScene = 'mouthLayers' in target;
    if (target.celTracks.length === 0) getActiveCelTrackInTarget(target);
    if (target.vectorTracks.length === 0) getActiveVectorTrackInTarget(target);
    if (isScene && target.bgLayers.length === 0) getActiveBgLayerInScene(target);
    if (isScene && target.mouthLayers.length === 0) getActiveMouthLayerInScene(target);
    normalizeTargetHierarchy(target);

    const celTracks = target.celTracks;
    const vecTracks = target.vectorTracks;
    const bgLayers = isScene ? target.bgLayers : [];
    const mouthLayers = isScene ? target.mouthLayers : [];

    const canRebuild =
      !celStretchState && !vectorStretchState && !layerDragState && renamingLayerKey === null;

    if (canRebuild) {
      // 1. Cel Tracks
      const celIdSet = new Set(celTracks.map((t) => t.id));
      const celIdsMatch =
        renderedCelTrackIds.length === celTracks.length && celTracks.every((t) => celTrackDomMap.has(t.id));
      if (!celIdsMatch) {
        for (const [oldId, dom] of celTrackDomMap.entries()) {
          if (!celIdSet.has(oldId)) {
            dom.labelEl.remove();
            dom.rowEl.remove();
            dom.rightEl.remove();
            celTrackDomMap.delete(oldId);
          }
        }
        for (const trk of celTracks) {
          if (celTrackDomMap.has(trk.id)) continue;
          const trackId = trk.id;
          const labelEl = document.createElement('div');
          labelEl.className = 'track-label cel-track-label';
          labelEl.title = 'Drag up/down to reorder • Double-click name to rename • Right-click for Child options';
          const { tagSpan, tagTextSpan } = createLayerTagDom(
            'bg-[#4ade80]',
            trk.name,
            `Click to draw on ${trk.name} • Double-click to rename`
          );
          const btnGroup = document.createElement('div');
          btnGroup.className = 'flex gap-[3px] shrink-0';

          const btnAddChild = document.createElement('button');
          btnAddChild.type = 'button';
          btnAddChild.className = 'mini-btn';
          btnAddChild.textContent = '+↳';
          btnAddChild.title = `Add Child Bitmap Layer under ${trk.name}`;
          btnAddChild.onclick = (e) => {
            e.stopPropagation();
            addChildCelTrack(`cel:${trackId}`);
          };

          const btnAdd = document.createElement('button');
          btnAdd.type = 'button';
          btnAdd.className = 'mini-btn';
          btnAdd.textContent = '+';
          btnAdd.title = 'Add Bitmap Layer';
          btnAdd.onclick = (e) => {
            e.stopPropagation();
            addCelTrack();
          };

          const btnVis = document.createElement('button');
          btnVis.type = 'button';
          btnVis.className = 'mini-btn';
          btnVis.textContent = '👁';
          btnVis.title = 'Toggle Bitmap Layer Visibility';
          btnVis.onclick = (e) => {
            e.stopPropagation();
            const curTrk = activeTimelineTarget().celTracks.find((t) => t.id === trackId);
            if (!curTrk) return;
            curTrk.visible = !curTrk.visible;
            btnVis.style.opacity = curTrk.visible ? '1' : '0.35';
            renderStage();
          };

          const btnRemove = document.createElement('button');
          btnRemove.type = 'button';
          btnRemove.className = 'mini-btn danger';
          btnRemove.textContent = '✕';
          btnRemove.title = 'Delete Bitmap Layer';
          btnRemove.onclick = (e) => {
            e.stopPropagation();
            removeCelTrack(trackId);
          };

          btnGroup.append(btnAddChild, btnAdd, btnVis, btnRemove);
          labelEl.append(tagSpan, btnGroup);
          setupLayerLabelInteractions(labelEl, () => `cel:${trackId}`);

          const rowEl = document.createElement('div');
          rowEl.className = 'track-row cel-track-row';
          rowEl.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            selectCelTrack(trackId);
            if (state.isPlaying) togglePlay();
            const clickFrame = frameFromClientX(e.clientX);
            goToFrame(clickFrame);

            const curTrk = activeTimelineTarget().celTracks.find((t) => t.id === trackId);
            if (!curTrk) return;
            const entry = getCelEntryAt(clickFrame, curTrk.cels);
            if (!entry) return;

            rowEl.setPointerCapture(e.pointerId);
            const origCels: Array<{ start: number; cel: Cel; duration: number }> = [];
            for (const s of getSortedCelStarts(curTrk.cels)) {
              const c = curTrk.cels.get(s);
              if (c) origCels.push({ start: s, cel: c, duration: c.duration });
            }
            celStretchState = {
              trackId,
              celsMap: curTrk.cels,
              targetStart: entry.start,
              origTotalFrames: state.totalFrames,
              origCels,
              lastTargetFrame: clickFrame,
            };
          });

          rowEl.addEventListener('pointermove', (e) => {
            if (!celStretchState || celStretchState.trackId !== trackId) return;
            const rect = timelineGrid.getBoundingClientRect();
            let dragFrame = Math.floor(((e.clientX - rect.left) / rect.width) * state.totalFrames);
            dragFrame = Math.max(celStretchState.targetStart, dragFrame);
            if (dragFrame === celStretchState.lastTargetFrame) return;
            celStretchState.lastTargetFrame = dragFrame;

            const { targetStart, origCels, origTotalFrames, celsMap } = celStretchState;
            const newDur = Math.max(1, dragFrame - targetStart + 1);
            const nextOrig = origCels.find((item) => item.start > targetStart);
            let pushShift = 0;
            if (nextOrig) {
              const neededNextStart = targetStart + newDur;
              if (neededNextStart > nextOrig.start) pushShift = neededNextStart - nextOrig.start;
            }

            celsMap.clear();
            let maxEnd = origTotalFrames;
            for (const item of origCels) {
              if (item.start < targetStart) {
                item.cel.duration = item.duration;
                celsMap.set(item.start, item.cel);
              } else if (item.start === targetStart) {
                item.cel.duration = newDur;
                celsMap.set(item.start, item.cel);
                maxEnd = Math.max(maxEnd, item.start + newDur);
              } else {
                const newStart = item.start + pushShift;
                item.cel.duration = item.duration;
                celsMap.set(newStart, item.cel);
                maxEnd = Math.max(maxEnd, newStart + item.duration);
              }
            }

            state.totalFrames = Math.max(origTotalFrames, maxEnd);
            state.currentFrame = Math.min(state.totalFrames - 1, dragFrame);
            renderTimeline();
            renderStage();
          });

          rowEl.addEventListener('pointerup', () => {
            if (celStretchState?.trackId === trackId) celStretchState = null;
          });
          rowEl.addEventListener('pointercancel', () => {
            if (celStretchState?.trackId === trackId) celStretchState = null;
          });

          rowEl.addEventListener('dblclick', (e) => {
            if (e.button !== 0 || isBasicMode()) return;
            selectCelTrack(trackId);
            const f = frameFromClientX(e.clientX);
            const curTrk = activeTimelineTarget().celTracks.find((t) => t.id === trackId);
            const entry = curTrk ? getCelEntryAt(f, curTrk.cels) : null;
            if (entry?.cel.nestId) {
              openNestedAnimationAt('cel', f, trackId);
            } else if (nestStack.length > 0) {
              exitNestLevel();
            }
          });

          rowEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (state.isPlaying) togglePlay();
            selectCelTrack(trackId);
            contextTargetLayer = 'cel';
            contextTargetCelTrackId = trackId;
            contextTargetVectorTrackId = null;
            contextTargetFrame = frameFromClientX(e.clientX);
            goToFrame(contextTargetFrame);

            const basic = isBasicMode();
            const curTrk = activeTimelineTarget().celTracks.find((t) => t.id === trackId);
            const entry = curTrk ? getCelEntryAt(contextTargetFrame, curTrk.cels) : null;
            const hasEntry = Boolean(entry);
            const hasNest = Boolean(entry?.cel.nestId);
            const hasTween = Boolean(entry && getActivePosKeys(entry.cel).length >= 2);
            mustEl<HTMLButtonElement>('ctxDelete').disabled = !hasEntry;
            mustEl<HTMLButtonElement>('ctxClear').disabled = !hasEntry;
            ctxExitNest.classList.toggle('hidden-nest-ui', basic || nestStack.length === 0);
            ctxNest.classList.toggle('hidden-nest-ui', basic);
            ctxNest.textContent = hasNest
              ? 'Open Nested Animation'
              : hasEntry
                ? 'Open Nested Animation'
                : 'New Nested Animation';
            ctxUnnest.classList.toggle('hidden-nest-ui', basic || !hasNest);
            ctxClearTween.classList.toggle('hidden-nest-ui', basic || !hasTween);
            ctxNestTweenDivider.classList.toggle('hidden-nest-ui', basic);

            celContextMenu.style.display = 'flex';
            const menuW = 190;
            const menuH = 250;
            const left = Math.min(window.innerWidth - menuW - 6, e.clientX);
            const top = Math.min(window.innerHeight - menuH - 6, e.clientY);
            celContextMenu.style.left = `${left}px`;
            celContextMenu.style.top = `${top}px`;
          });

          const rightEl = document.createElement('div');
          rightEl.className = 'track-right-cell cel-track-right';
          rightEl.onclick = () => selectCelTrack(trackId);

          layerLabelsContainer.appendChild(labelEl);
          layerRowsContainer.appendChild(rowEl);
          layerRightsContainer.appendChild(rightEl);
          celTrackDomMap.set(trackId, {
            trackId,
            labelEl,
            rowEl,
            rightEl,
            tagSpan,
            tagTextSpan,
            btnAddChild,
            btnAdd,
            btnVis,
            btnRemove,
          });
        }
        renderedCelTrackIds = celTracks.map((t) => t.id);
      }

      // 2. Vector Tracks
      const vecIdSet = new Set(vecTracks.map((t) => t.id));
      const vecIdsMatch =
        renderedVectorTrackIds.length === vecTracks.length && vecTracks.every((t) => vectorTrackDomMap.has(t.id));
      if (!vecIdsMatch) {
        for (const [oldId, dom] of vectorTrackDomMap.entries()) {
          if (!vecIdSet.has(oldId)) {
            dom.labelEl.remove();
            dom.rowEl.remove();
            dom.rightEl.remove();
            vectorTrackDomMap.delete(oldId);
          }
        }
        for (const trk of vecTracks) {
          if (vectorTrackDomMap.has(trk.id)) continue;
          const trackId = trk.id;
          const labelEl = document.createElement('div');
          labelEl.className = 'track-label vector-track-label' + (state.showVectorTrack ? '' : ' hidden-track');
          labelEl.title = 'Drag up/down to reorder • Double-click name to rename • Right-click for Child options';
          const { tagSpan, tagTextSpan } = createLayerTagDom(
            'bg-[#38bdf8]',
            trk.name,
            `Click to draw on ${trk.name} • Double-click to rename`
          );

          const btnGroup = document.createElement('div');
          btnGroup.className = 'flex gap-[3px] shrink-0';

          const btnAddChild = document.createElement('button');
          btnAddChild.type = 'button';
          btnAddChild.className = 'mini-btn';
          btnAddChild.textContent = '+↳';
          btnAddChild.title = `Add Child Layer under ${trk.name}`;
          btnAddChild.onclick = (e) => {
            e.stopPropagation();
            addChildVectorTrack(`vector:${trackId}`);
          };

          const btnAdd = document.createElement('button');
          btnAdd.type = 'button';
          btnAdd.className = 'mini-btn';
          btnAdd.textContent = '+';
          btnAdd.title = 'Add Vector Layer';
          btnAdd.onclick = (e) => {
            e.stopPropagation();
            addVectorTrack();
          };

          const btnVis = document.createElement('button');
          btnVis.type = 'button';
          btnVis.className = 'mini-btn';
          btnVis.textContent = '👁';
          btnVis.title = 'Toggle Vector Layer Visibility';
          btnVis.onclick = (e) => {
            e.stopPropagation();
            const curTrk = activeTimelineTarget().vectorTracks.find((t) => t.id === trackId);
            if (!curTrk) return;
            curTrk.visible = !curTrk.visible;
            btnVis.style.opacity = curTrk.visible ? '1' : '0.35';
            renderStage();
          };

          const btnRemove = document.createElement('button');
          btnRemove.type = 'button';
          btnRemove.className = 'mini-btn danger';
          btnRemove.textContent = '✕';
          btnRemove.title = 'Delete Vector Layer';
          btnRemove.onclick = (e) => {
            e.stopPropagation();
            removeVectorTrack(trackId);
          };

          btnGroup.append(btnAddChild, btnAdd, btnVis, btnRemove);
          labelEl.append(tagSpan, btnGroup);
          setupLayerLabelInteractions(labelEl, () => `vector:${trackId}`);

          const rowEl = document.createElement('div');
          rowEl.className = 'track-row vector-track-row' + (state.showVectorTrack ? '' : ' hidden-track');

          rowEl.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            selectVectorTrack(trackId);
            if (state.isPlaying) togglePlay();
            const clickFrame = frameFromClientX(e.clientX);
            goToFrame(clickFrame);

            const curTrk = activeTimelineTarget().vectorTracks.find((t) => t.id === trackId);
            if (!curTrk) return;
            const entry = getVectorCelEntryAt(clickFrame, curTrk.cels);
            if (!entry) return;

            rowEl.setPointerCapture(e.pointerId);
            const origCels: Array<{ start: number; cel: VectorCel; duration: number }> = [];
            for (const s of getSortedVectorCelStarts(curTrk.cels)) {
              const c = curTrk.cels.get(s);
              if (c) origCels.push({ start: s, cel: c, duration: c.duration });
            }
            vectorStretchState = {
              trackId,
              celsMap: curTrk.cels,
              targetStart: entry.start,
              origTotalFrames: state.totalFrames,
              origCels,
              lastTargetFrame: clickFrame,
            };
          });

          rowEl.addEventListener('pointermove', (e) => {
            if (!vectorStretchState || vectorStretchState.trackId !== trackId) return;
            const rect = timelineGrid.getBoundingClientRect();
            let dragFrame = Math.floor(((e.clientX - rect.left) / rect.width) * state.totalFrames);
            dragFrame = Math.max(vectorStretchState.targetStart, dragFrame);
            if (dragFrame === vectorStretchState.lastTargetFrame) return;
            vectorStretchState.lastTargetFrame = dragFrame;

            const { targetStart, origCels, origTotalFrames, celsMap } = vectorStretchState;
            const newDur = Math.max(1, dragFrame - targetStart + 1);
            const nextOrig = origCels.find((item) => item.start > targetStart);
            let pushShift = 0;
            if (nextOrig) {
              const neededNextStart = targetStart + newDur;
              if (neededNextStart > nextOrig.start) pushShift = neededNextStart - nextOrig.start;
            }

            celsMap.clear();
            let maxEnd = origTotalFrames;
            for (const item of origCels) {
              if (item.start < targetStart) {
                item.cel.duration = item.duration;
                celsMap.set(item.start, item.cel);
              } else if (item.start === targetStart) {
                item.cel.duration = newDur;
                celsMap.set(item.start, item.cel);
                maxEnd = Math.max(maxEnd, item.start + newDur);
              } else {
                const newStart = item.start + pushShift;
                item.cel.duration = item.duration;
                celsMap.set(newStart, item.cel);
                maxEnd = Math.max(maxEnd, newStart + item.duration);
              }
            }

            state.totalFrames = Math.max(origTotalFrames, maxEnd);
            state.currentFrame = Math.min(state.totalFrames - 1, dragFrame);
            renderTimeline();
            renderStage();
          });

          rowEl.addEventListener('pointerup', () => {
            if (vectorStretchState?.trackId === trackId) vectorStretchState = null;
          });
          rowEl.addEventListener('pointercancel', () => {
            if (vectorStretchState?.trackId === trackId) vectorStretchState = null;
          });

          rowEl.addEventListener('dblclick', (e) => {
            if (e.button !== 0 || isBasicMode()) return;
            selectVectorTrack(trackId);
            const f = frameFromClientX(e.clientX);
            const curTrk = activeTimelineTarget().vectorTracks.find((t) => t.id === trackId);
            const entry = curTrk ? getVectorCelEntryAt(f, curTrk.cels) : null;
            if (entry?.cel.nestId) {
              openNestedAnimationAt('vector', f, trackId);
            } else if (nestStack.length > 0) {
              exitNestLevel();
            }
          });

          rowEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (state.isPlaying) togglePlay();
            selectVectorTrack(trackId);
            contextTargetLayer = 'vector';
            contextTargetCelTrackId = null;
            contextTargetVectorTrackId = trackId;
            contextTargetFrame = frameFromClientX(e.clientX);
            goToFrame(contextTargetFrame);

            const basic = isBasicMode();
            const curTrk = activeTimelineTarget().vectorTracks.find((t) => t.id === trackId);
            const entry = curTrk ? getVectorCelEntryAt(contextTargetFrame, curTrk.cels) : null;
            const hasEntry = Boolean(entry);
            const hasNest = Boolean(entry?.cel.nestId);
            const hasTween = Boolean(entry && getActivePosKeys(entry.cel).length >= 2);
            mustEl<HTMLButtonElement>('ctxDelete').disabled = !hasEntry;
            mustEl<HTMLButtonElement>('ctxClear').disabled = !hasEntry;
            ctxExitNest.classList.toggle('hidden-nest-ui', basic || nestStack.length === 0);
            ctxNest.classList.toggle('hidden-nest-ui', basic);
            ctxNest.textContent = hasNest
              ? 'Open Nested Animation'
              : hasEntry
                ? 'Open Nested Animation'
                : 'New Nested Animation';
            ctxUnnest.classList.toggle('hidden-nest-ui', basic || !hasNest);
            ctxClearTween.classList.toggle('hidden-nest-ui', basic || !hasTween);
            ctxNestTweenDivider.classList.toggle('hidden-nest-ui', basic);

            celContextMenu.style.display = 'flex';
            const menuW = 190;
            const menuH = 250;
            const left = Math.min(window.innerWidth - menuW - 6, e.clientX);
            const top = Math.min(window.innerHeight - menuH - 6, e.clientY);
            celContextMenu.style.left = `${left}px`;
            celContextMenu.style.top = `${top}px`;
          });

          const rightEl = document.createElement('div');
          rightEl.className = 'track-right-cell vector-track-right' + (state.showVectorTrack ? '' : ' hidden-track');
          rightEl.onclick = () => selectVectorTrack(trackId);

          layerLabelsContainer.appendChild(labelEl);
          layerRowsContainer.appendChild(rowEl);
          layerRightsContainer.appendChild(rightEl);
          vectorTrackDomMap.set(trackId, {
            trackId,
            labelEl,
            rowEl,
            rightEl,
            tagSpan,
            tagTextSpan,
            btnAddChild,
            btnAdd,
            btnVis,
            btnRemove,
          });
        }
        renderedVectorTrackIds = vecTracks.map((t) => t.id);
      }

      // 3. Background Layers (root scene only)
      const bgIdSet = new Set(bgLayers.map((b) => b.id));
      const bgIdsMatch =
        renderedBgLayerIds.length === bgLayers.length && bgLayers.every((b) => bgTrackDomMap.has(b.id));
      if (!bgIdsMatch) {
        for (const [oldId, dom] of bgTrackDomMap.entries()) {
          if (!bgIdSet.has(oldId)) {
            dom.labelEl.remove();
            dom.rowEl.remove();
            dom.rightEl.remove();
            bgTrackDomMap.delete(oldId);
          }
        }
        for (const bg of bgLayers) {
          if (bgTrackDomMap.has(bg.id)) continue;
          const layerId = bg.id;
          const labelEl = document.createElement('div');
          labelEl.className = 'track-label bg-track-label' + (state.showBgTrack ? '' : ' hidden-track');
          labelEl.title = 'Drag up/down to reorder • Double-click name to rename • Right-click for Child options';
          const { tagSpan, tagTextSpan } = createLayerTagDom(
            'bg-[#94a3b8]',
            bg.trackName,
            `Click to edit ${bg.trackName} • Double-click to rename`
          );

          const btnGroup = document.createElement('div');
          btnGroup.className = 'flex gap-[3px] shrink-0';

          const btnImg = document.createElement('button');
          btnImg.type = 'button';
          btnImg.className = 'mini-btn';
          btnImg.textContent = '📷';
          btnImg.title = 'Upload Background Image';
          btnImg.onclick = (e) => {
            e.stopPropagation();
            pendingBgUploadId = layerId;
            bgFileInput.click();
          };

          const btnClear = document.createElement('button');
          btnClear.type = 'button';
          btnClear.className = 'mini-btn danger';
          btnClear.textContent = '⌫';
          btnClear.title = 'Clear Background Artwork';
          btnClear.onclick = (e) => {
            e.stopPropagation();
            const curBg = activeScene().bgLayers.find((b) => b.id === layerId);
            if (!curBg) return;
            pushPixelUndo(curBg);
            curBg.canvas = createCelCanvas();
            curBg.offsetX = 0;
            curBg.offsetY = 0;
            curBg.hasInk = false;
            curBg.name = '';
            updateBgUI();
            renderStage();
          };

          const btnAdd = document.createElement('button');
          btnAdd.type = 'button';
          btnAdd.className = 'mini-btn';
          btnAdd.textContent = '+';
          btnAdd.title = 'Add Background Layer';
          btnAdd.onclick = (e) => {
            e.stopPropagation();
            addBgTrack();
          };

          const btnVis = document.createElement('button');
          btnVis.type = 'button';
          btnVis.className = 'mini-btn';
          btnVis.textContent = '👁';
          btnVis.title = 'Toggle Background Visibility';
          btnVis.onclick = (e) => {
            e.stopPropagation();
            const curBg = activeScene().bgLayers.find((b) => b.id === layerId);
            if (!curBg) return;
            curBg.visible = !curBg.visible;
            updateBgUI();
            renderStage();
          };

          const btnRemove = document.createElement('button');
          btnRemove.type = 'button';
          btnRemove.className = 'mini-btn danger';
          btnRemove.textContent = '✕';
          btnRemove.title = 'Delete Background Layer';
          btnRemove.onclick = (e) => {
            e.stopPropagation();
            removeBgTrack(layerId);
          };

          btnGroup.append(btnImg, btnClear, btnAdd, btnVis, btnRemove);
          labelEl.append(tagSpan, btnGroup);
          setupLayerLabelInteractions(labelEl, () => `bg:${layerId}`);

          const rowEl = document.createElement('div');
          rowEl.className = 'track-row bg-track-row' + (state.showBgTrack ? '' : ' hidden-track');
          const spanBarEl = document.createElement('div');
          spanBarEl.className = 'bg-span-bar';
          rowEl.appendChild(spanBarEl);
          rowEl.onclick = () => selectBgLayer(layerId);

          const rightEl = document.createElement('div');
          rightEl.className = 'track-right-cell bg-track-right' + (state.showBgTrack ? '' : ' hidden-track');
          rightEl.onclick = () => selectBgLayer(layerId);

          layerLabelsContainer.appendChild(labelEl);
          layerRowsContainer.appendChild(rowEl);
          layerRightsContainer.appendChild(rightEl);
          bgTrackDomMap.set(layerId, {
            layerId,
            labelEl,
            rowEl,
            rightEl,
            tagSpan,
            tagTextSpan,
            spanBarEl,
            btnVis,
            btnRemove,
          });
        }
        renderedBgLayerIds = bgLayers.map((b) => b.id);
      }

      // 4. Mouth Layers (root scene only)
      const mouthIdSet = new Set(mouthLayers.map((m) => m.id));
      const mouthIdsMatch =
        renderedMouthLayerIds.length === mouthLayers.length && mouthLayers.every((m) => mouthTrackDomMap.has(m.id));
      if (!mouthIdsMatch) {
        for (const [oldId, dom] of mouthTrackDomMap.entries()) {
          if (!mouthIdSet.has(oldId)) {
            dom.labelEl.remove();
            dom.rowEl.remove();
            dom.rightEl.remove();
            mouthTrackDomMap.delete(oldId);
          }
        }
        for (const ml of mouthLayers) {
          if (mouthTrackDomMap.has(ml.id)) continue;
          const layerId = ml.id;
          const labelEl = document.createElement('div');
          labelEl.className = 'track-label mouth-track-label' + (state.showMouthTrack ? '' : ' hidden-track');
          labelEl.title = 'Drag up/down to reorder • Double-click name to rename • Right-click for Child options';
          const { tagSpan, tagTextSpan } = createLayerTagDom(
            'bg-[#f472b6]',
            ml.name,
            `Click to edit ${ml.name} • Double-click to rename`
          );

          const btnGroup = document.createElement('div');
          btnGroup.className = 'flex gap-[3px] shrink-0';

          const btnAddChild = document.createElement('button');
          btnAddChild.type = 'button';
          btnAddChild.className = 'mini-btn';
          btnAddChild.textContent = '+↳';
          btnAddChild.title = `Add Child Layer under ${ml.name}`;
          btnAddChild.onclick = (e) => {
            e.stopPropagation();
            addChildVectorTrack(`mouth:${layerId}`);
          };

          const btnAdd = document.createElement('button');
          btnAdd.type = 'button';
          btnAdd.className = 'mini-btn';
          btnAdd.textContent = '+';
          btnAdd.title = 'Add Picker Layer';
          btnAdd.onclick = (e) => {
            e.stopPropagation();
            addMouthTrack();
          };

          const btnVis = document.createElement('button');
          btnVis.type = 'button';
          btnVis.className = 'mini-btn';
          btnVis.textContent = '👁';
          btnVis.title = 'Toggle Picker Layer Visibility';
          btnVis.onclick = (e) => {
            e.stopPropagation();
            const curMl = activeScene().mouthLayers.find((m) => m.id === layerId);
            if (!curMl) return;
            curMl.visible = !curMl.visible;
            if (curMl.visible) ensureMouthInitInScene(activeScene(), curMl);
            btnVis.style.opacity = curMl.visible ? '1' : '0.35';
            updateMouthWidget();
            renderStage();
          };

          const btnRemove = document.createElement('button');
          btnRemove.type = 'button';
          btnRemove.className = 'mini-btn danger';
          btnRemove.textContent = '✕';
          btnRemove.title = 'Delete Picker Layer';
          btnRemove.onclick = (e) => {
            e.stopPropagation();
            removeMouthTrack(layerId);
          };

          btnGroup.append(btnAddChild, btnAdd, btnVis, btnRemove);
          labelEl.append(tagSpan, btnGroup);
          setupLayerLabelInteractions(labelEl, () => `mouth:${layerId}`);

          const rowEl = document.createElement('div');
          rowEl.className = 'track-row mouth-track-row' + (state.showMouthTrack ? '' : ' hidden-track');
          let mouthScrubbing = false;
          rowEl.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            if (state.isPlaying) togglePlay();
            selectMouthLayer(layerId);
            mouthScrubbing = true;
            rowEl.setPointerCapture(e.pointerId);
            goToFrame(frameFromClientX(e.clientX));
          });
          rowEl.addEventListener('pointermove', (e) => {
            if (!mouthScrubbing) return;
            const f = frameFromClientX(e.clientX);
            if (f !== state.currentFrame) goToFrame(f);
          });
          const endMouthScrub = () => {
            mouthScrubbing = false;
          };
          rowEl.addEventListener('pointerup', endMouthScrub);
          rowEl.addEventListener('pointercancel', endMouthScrub);

          rowEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (state.isPlaying) togglePlay();
            selectMouthLayer(layerId);
            contextMouthLayerId = layerId;
            contextMouthFrame = frameFromClientX(e.clientX);
            goToFrame(contextMouthFrame);
            const curMl = activeScene().mouthLayers.find((m) => m.id === layerId);
            mustEl<HTMLButtonElement>('ctxMouthDelete').disabled = !(curMl && curMl.keys.has(contextMouthFrame));
            mouthContextMenu.style.display = 'flex';
            const left = Math.min(window.innerWidth - 175, e.clientX);
            const top = Math.min(window.innerHeight - 115, e.clientY);
            mouthContextMenu.style.left = `${left}px`;
            mouthContextMenu.style.top = `${top}px`;
          });

          const rightEl = document.createElement('div');
          rightEl.className = 'track-right-cell mouth-track-right' + (state.showMouthTrack ? '' : ' hidden-track');
          rightEl.onclick = () => selectMouthLayer(layerId);

          layerLabelsContainer.appendChild(labelEl);
          layerRowsContainer.appendChild(rowEl);
          layerRightsContainer.appendChild(rightEl);
          mouthTrackDomMap.set(layerId, {
            layerId,
            labelEl,
            rowEl,
            rightEl,
            tagSpan,
            tagTextSpan,
            btnVis,
            btnRemove,
          });
        }
        renderedMouthLayerIds = mouthLayers.map((m) => m.id);
      }

      // Reorder DOM nodes inside unified layer containers to match target.layerOrder
      const desiredOrder = [...target.layerOrder];
      const desiredLabels = desiredOrder.map(getLayerLabelElement).filter((x): x is HTMLDivElement => Boolean(x));
      const desiredRows = desiredOrder.map(getLayerRowElement).filter((x): x is HTMLDivElement => Boolean(x));
      const desiredRights = desiredOrder.map(getLayerRightElement).filter((x): x is HTMLDivElement => Boolean(x));

      const applyOrderIfNeeded = (container: HTMLElement, els: HTMLElement[]) => {
        const cur = Array.from(container.children);
        const matches = cur.length === els.length && cur.every((node, i) => node === els[i]);
        if (!matches) {
          for (const el of els) container.appendChild(el);
        }
      };

      applyOrderIfNeeded(layerLabelsContainer, desiredLabels);
      applyOrderIfNeeded(layerRowsContainer, desiredRows);
      applyOrderIfNeeded(layerRightsContainer, desiredRights);
    }

    const basic = isBasicMode();

    // Sync cel tracks
    celTracks.forEach((trk, idx) => {
      const dom = celTrackDomMap.get(trk.id);
      if (!dom) return;
      const showCel = basic ? idx === 0 : state.showCelTrack;
      dom.labelEl.classList.toggle('hidden-track', !showCel);
      dom.rowEl.classList.toggle('hidden-track', !showCel);
      dom.rightEl.classList.toggle('hidden-track', !showCel);
      dom.btnAddChild.style.display = basic ? 'none' : '';
      dom.btnAdd.style.display = basic ? 'none' : '';
      dom.btnVis.style.opacity = trk.visible ? '1' : '0.35';
      dom.btnRemove.style.display = !basic ? '' : 'none';
      if (renamingLayerKey !== `cel:${trk.id}` && dom.tagTextSpan.textContent !== trk.name) {
        dom.tagTextSpan.textContent = trk.name;
      }
    });

    // Sync vector tracks
    vecTracks.forEach((trk) => {
      const dom = vectorTrackDomMap.get(trk.id);
      if (!dom) return;
      const showVec = !basic && state.showVectorTrack;
      dom.labelEl.classList.toggle('hidden-track', !showVec);
      dom.rowEl.classList.toggle('hidden-track', !showVec);
      dom.rightEl.classList.toggle('hidden-track', !showVec);
      dom.btnAddChild.style.display = basic ? 'none' : '';
      dom.btnAdd.style.display = basic ? 'none' : '';
      dom.btnVis.style.opacity = trk.visible ? '1' : '0.35';
      dom.btnRemove.style.display = !basic ? '' : 'none';
      if (renamingLayerKey !== `vector:${trk.id}` && dom.tagTextSpan.textContent !== trk.name) {
        dom.tagTextSpan.textContent = trk.name;
      }
    });

    // Sync background layers
    for (const bg of bgLayers) {
      const dom = bgTrackDomMap.get(bg.id);
      if (!dom) continue;
      const showBg = !basic && state.showBgTrack;
      dom.labelEl.classList.toggle('hidden-track', !showBg);
      dom.rowEl.classList.toggle('hidden-track', !showBg);
      dom.rightEl.classList.toggle('hidden-track', !showBg);
      dom.btnVis.style.opacity = bg.visible ? '1' : '0.35';
      dom.btnRemove.style.display = !basic ? '' : 'none';
      if (renamingLayerKey !== `bg:${bg.id}` && dom.tagTextSpan.textContent !== bg.trackName) {
        dom.tagTextSpan.textContent = bg.trackName;
      }
      dom.spanBarEl.textContent = bg.hasInk
        ? bg.name
          ? `BG: ${bg.name}`
          : `${bg.trackName} Artwork (Active)`
        : `${bg.trackName} (Drop image here or click to draw)`;
    }

    // Sync picker layers
    for (const ml of mouthLayers) {
      const dom = mouthTrackDomMap.get(ml.id);
      if (!dom) continue;
      const showMouth = !basic && state.showMouthTrack;
      dom.labelEl.classList.toggle('hidden-track', !showMouth);
      dom.rowEl.classList.toggle('hidden-track', !showMouth);
      dom.rightEl.classList.toggle('hidden-track', !showMouth);
      dom.btnVis.style.opacity = ml.visible ? '1' : '0.35';
      dom.btnRemove.style.display = !basic ? '' : 'none';
      if (renamingLayerKey !== `mouth:${ml.id}` && dom.tagTextSpan.textContent !== ml.name) {
        dom.tagTextSpan.textContent = ml.name;
      }
    }

    // Sync indentation + child badges + IK badges for all layers
    for (const k of target.layerOrder) {
      const lbl = getLayerLabelElement(k);
      const rightEl = getLayerRightElement(k);
      const depth = basic ? 0 : getLayerDepth(target, k);
      const hasIK = !basic && Boolean(target.layerIK?.[k]);
      if (lbl) {
        lbl.style.paddingLeft = `${8 + depth * 14}px`;
        lbl.classList.toggle('is-child-layer', depth > 0);
        lbl.classList.toggle('has-ik-chain', hasIK);
      }
      if (rightEl) {
        rightEl.classList.toggle('is-child-right', depth > 0);
      }
    }
  }

  function selectFallbackVisibleLayerAfterDelete(): void {
    if (state.showCelTrack) {
      selectTimelineTrack('cel');
    } else if (state.showVectorTrack) {
      selectTimelineTrack('vector');
    } else if (state.showBgTrack && nestStack.length === 0) {
      selectTimelineTrack('bg');
    } else if (state.showMouthTrack && nestStack.length === 0) {
      selectTimelineTrack('mouth');
    } else if (state.showAudioTrack && nestStack.length === 0) {
      selectTimelineTrack('audio');
    } else if (state.showCamTrack && nestStack.length === 0) {
      selectTimelineTrack('cam');
    }
  }

  function addCelTrack(): void {
    const target = activeTimelineTarget();
    if (!state.showCelTrack && target.celTracks.length >= 1) {
      const first = target.celTracks[0];
      first.visible = true;
      target.activeCelTrackId = first.id;
      state.showCelTrack = true;
      state.showCelLayer = true;
    } else {
      let idx = target.celTracks.length + 1;
      while (target.celTracks.some((t) => t.name === `Bitmap ${idx}`)) idx++;
      const trk = createCelTrack(`Bitmap ${idx}`, true);
      target.celTracks.push(trk);
      target.layerOrder.unshift(`cel:${trk.id}`);
      target.activeCelTrackId = trk.id;
      state.showCelTrack = true;
      state.showCelLayer = true;
    }
    normalizeTargetHierarchy(target);
    selectTimelineTrack('cel');
    syncLayerTrackContainers();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function addChildCelTrack(parentKey: string): void {
    const target = activeTimelineTarget();
    normalizeTargetHierarchy(target);
    if (!target.layerOrder.includes(parentKey)) return;

    let idx = target.celTracks.length + 1;
    while (target.celTracks.some((t) => t.name === `Bitmap ${idx}`)) idx++;
    const trk = createCelTrack(`Bitmap ${idx}`, true);
    const childKey = `cel:${trk.id}`;
    target.celTracks.push(trk);

    const pIdx = target.layerOrder.indexOf(parentKey);
    let insertAt = pIdx + 1;
    while (insertAt < target.layerOrder.length && isLayerDescendant(target, parentKey, target.layerOrder[insertAt])) {
      insertAt++;
    }
    target.layerOrder.splice(insertAt, 0, childKey);
    target.layerParents[childKey] = parentKey;
    target.activeCelTrackId = trk.id;
    normalizeTargetHierarchy(target);

    state.showCelTrack = true;
    state.showCelLayer = true;
    selectTimelineTrack('cel');
    syncLayerTrackContainers();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
    onNotify(`Added child bitmap layer under ${getLayerDisplayName(target, parentKey)}.`);
  }

  function removeCelTrack(trackId: string): void {
    const rootSc = activeScene();
    const target = activeTimelineTarget();
    const idx = target.celTracks.findIndex((t) => t.id === trackId);
    if (idx < 0) return;

    const removedKey = `cel:${trackId}`;
    const grandParent = target.layerParents?.[removedKey] || null;
    for (const k of [...target.layerOrder]) {
      if (target.layerParents?.[k] === removedKey) {
        setLayerParentKeepWorld(rootSc, target, k, grandParent, state.currentFrame);
      }
    }
    delete target.layerParents[removedKey];
    if (target.layerIK) delete target.layerIK[removedKey];

    if (target.celTracks.length <= 1) {
      const trk = target.celTracks[0];
      trk.cels.clear();
      trk.name = 'Bitmap 1';
      trk.visible = false;
      state.showCelTrack = false;
      normalizeTargetHierarchy(target);
      if (state.selectedTrack === 'cel' || state.activeLayer === 'cel') {
        selectFallbackVisibleLayerAfterDelete();
      }
    } else {
      target.layerOrder = target.layerOrder.filter((k) => k !== removedKey);
      target.celTracks.splice(idx, 1);
      if (target.activeCelTrackId === trackId) {
        target.activeCelTrackId = target.celTracks[Math.max(0, idx - 1)].id;
      }
      normalizeTargetHierarchy(target);
    }

    syncLayerTrackContainers();
    updateActiveTrackHighlight();
    updateStageBadge();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function selectCelTrack(trackId: string): void {
    const target = activeTimelineTarget();
    if (target.celTracks.some((t) => t.id === trackId)) {
      target.activeCelTrackId = trackId;
    }
    selectTimelineTrack('cel');
  }

  function addVectorTrack(): void {
    const target = activeTimelineTarget();
    if (!state.showVectorTrack && target.vectorTracks.length >= 1) {
      const first = target.vectorTracks[0];
      first.visible = true;
      target.activeVectorTrackId = first.id;
      state.showVectorTrack = true;
      state.showVectorLayer = true;
    } else {
      let idx = target.vectorTracks.length + 1;
      while (target.vectorTracks.some((t) => t.name === `Vector ${idx}`)) idx++;
      const trk = createVectorTrack(`Vector ${idx}`, true);
      target.vectorTracks.push(trk);
      target.layerOrder.unshift(`vector:${trk.id}`);
      target.activeVectorTrackId = trk.id;
      state.showVectorTrack = true;
      state.showVectorLayer = true;
    }
    normalizeTargetHierarchy(target);
    selectTimelineTrack('vector');
    syncLayerTrackContainers();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function addChildVectorTrack(parentKey: string): void {
    const target = activeTimelineTarget();
    normalizeTargetHierarchy(target);
    if (!target.layerOrder.includes(parentKey)) return;

    let idx = target.vectorTracks.length + 1;
    while (target.vectorTracks.some((t) => t.name === `Vector ${idx}`)) idx++;
    const trk = createVectorTrack(`Vector ${idx}`, true);
    const childKey = `vector:${trk.id}`;
    target.vectorTracks.push(trk);

    const pIdx = target.layerOrder.indexOf(parentKey);
    let insertAt = pIdx + 1;
    while (insertAt < target.layerOrder.length && isLayerDescendant(target, parentKey, target.layerOrder[insertAt])) {
      insertAt++;
    }
    target.layerOrder.splice(insertAt, 0, childKey);
    target.layerParents[childKey] = parentKey;
    target.activeVectorTrackId = trk.id;
    normalizeTargetHierarchy(target);

    state.showVectorTrack = true;
    state.showVectorLayer = true;
    selectTimelineTrack('vector');
    syncLayerTrackContainers();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
    onNotify(`Added child layer under ${getLayerDisplayName(target, parentKey)}.`);
  }

  function removeVectorTrack(trackId: string): void {
    const rootSc = activeScene();
    const target = activeTimelineTarget();
    const idx = target.vectorTracks.findIndex((t) => t.id === trackId);
    if (idx < 0) return;

    const removedKey = `vector:${trackId}`;
    const grandParent = target.layerParents?.[removedKey] || null;
    for (const k of [...target.layerOrder]) {
      if (target.layerParents?.[k] === removedKey) {
        setLayerParentKeepWorld(rootSc, target, k, grandParent, state.currentFrame);
      }
    }
    delete target.layerParents[removedKey];
    if (target.layerIK) delete target.layerIK[removedKey];

    if (target.vectorTracks.length <= 1) {
      const trk = target.vectorTracks[0];
      trk.cels.clear();
      trk.name = 'Vector 1';
      trk.visible = false;
      state.showVectorTrack = false;
      vectorEditSelection = null;
      vectorEditHover = null;
      if (state.tool === 'vectorEdit') selectTool('brush');
      normalizeTargetHierarchy(target);
      if (state.selectedTrack === 'vector' || state.activeLayer === 'vector') {
        selectFallbackVisibleLayerAfterDelete();
      }
    } else {
      target.layerOrder = target.layerOrder.filter((k) => k !== removedKey);
      target.vectorTracks.splice(idx, 1);
      if (target.activeVectorTrackId === trackId) {
        target.activeVectorTrackId = target.vectorTracks[Math.max(0, idx - 1)].id;
      }
      normalizeTargetHierarchy(target);
    }

    syncLayerTrackContainers();
    updateActiveTrackHighlight();
    updateStageBadge();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function selectVectorTrack(trackId: string): void {
    const target = activeTimelineTarget();
    if (target.vectorTracks.some((t) => t.id === trackId)) {
      target.activeVectorTrackId = trackId;
    }
    selectTimelineTrack('vector');
  }

  function addBgTrack(): void {
    if (nestStack.length > 0) return;
    const sc = activeScene();
    if (!state.showBgTrack && sc.bgLayers.length >= 1) {
      const first = sc.bgLayers[0];
      first.visible = true;
      sc.activeBgLayerId = first.id;
      state.showBgTrack = true;
    } else {
      let idx = sc.bgLayers.length + 1;
      while (sc.bgLayers.some((b) => b.trackName === `Background ${idx}`)) idx++;
      const bg = createBgLayer(`Background ${idx}`, true);
      sc.bgLayers.push(bg);
      sc.layerOrder.push(`bg:${bg.id}`);
      sc.activeBgLayerId = bg.id;
      state.showBgTrack = true;
    }
    normalizeTargetHierarchy(sc);
    selectTimelineTrack('bg');
    syncLayerTrackContainers();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function removeBgTrack(layerId: string): void {
    const sc = activeScene();
    const idx = sc.bgLayers.findIndex((b) => b.id === layerId);
    if (idx < 0) return;

    const removedKey = `bg:${layerId}`;
    const grandParent = sc.layerParents?.[removedKey] || null;
    for (const k of [...sc.layerOrder]) {
      if (sc.layerParents?.[k] === removedKey) {
        setLayerParentKeepWorld(sc, sc, k, grandParent, state.currentFrame);
      }
    }
    delete sc.layerParents[removedKey];
    if (sc.layerIK) delete sc.layerIK[removedKey];

    if (sc.bgLayers.length <= 1) {
      const bg = sc.bgLayers[0];
      bg.canvas = createCelCanvas();
      bg.undoStack = [];
      bg.hasInk = false;
      bg.name = '';
      bg.trackName = 'Background 1';
      bg.offsetX = 0;
      bg.offsetY = 0;
      delete bg.originX;
      delete bg.originY;
      delete bg.rotation;
      delete bg.scale;
      bg.visible = false;
      state.showBgTrack = false;
      normalizeTargetHierarchy(sc);
      if (state.selectedTrack === 'bg' || state.activeLayer === 'bg') {
        selectFallbackVisibleLayerAfterDelete();
      }
    } else {
      sc.layerOrder = sc.layerOrder.filter((k) => k !== removedKey);
      sc.bgLayers.splice(idx, 1);
      if (sc.activeBgLayerId === layerId) {
        sc.activeBgLayerId = sc.bgLayers[Math.max(0, idx - 1)].id;
      }
      normalizeTargetHierarchy(sc);
    }

    syncLayerTrackContainers();
    updateActiveTrackHighlight();
    updateStageBadge();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function selectBgLayer(layerId: string): void {
    const sc = activeScene();
    if (sc.bgLayers.some((b) => b.id === layerId)) {
      sc.activeBgLayerId = layerId;
    }
    selectTimelineTrack('bg');
  }

  function addMouthTrack(): void {
    if (nestStack.length > 0) return;
    const sc = activeScene();
    if (!state.showMouthTrack && sc.mouthLayers.length >= 1) {
      const first = sc.mouthLayers[0];
      first.visible = true;
      ensureMouthInitInScene(sc, first);
      sc.activeMouthLayerId = first.id;
      state.showMouthTrack = true;
    } else {
      let idx = sc.mouthLayers.length + 1;
      while (sc.mouthLayers.some((m) => m.name === `Picker ${idx}`)) idx++;
      const ml = createMouthLayer(`Picker ${idx}`, true);
      ensureMouthInitInScene(sc, ml);
      sc.mouthLayers.push(ml);
      sc.layerOrder.unshift(`mouth:${ml.id}`);
      sc.activeMouthLayerId = ml.id;
      state.showMouthTrack = true;
    }
    normalizeTargetHierarchy(sc);
    selectTimelineTrack('mouth');
    syncLayerTrackContainers();
    updateMouthWidget();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function removeMouthTrack(layerId: string): void {
    const sc = activeScene();
    const idx = sc.mouthLayers.findIndex((m) => m.id === layerId);
    if (idx < 0) return;

    const removedKey = `mouth:${layerId}`;
    const grandParent = sc.layerParents?.[removedKey] || null;
    for (const k of [...sc.layerOrder]) {
      if (sc.layerParents?.[k] === removedKey) {
        setLayerParentKeepWorld(sc, sc, k, grandParent, state.currentFrame);
      }
    }
    delete sc.layerParents[removedKey];
    if (sc.layerIK) delete sc.layerIK[removedKey];

    if (sc.mouthLayers.length <= 1) {
      const fresh = createMouthLayer('Picker 1', false);
      fresh.id = sc.mouthLayers[0].id;
      sc.mouthLayers[0] = fresh;
      sc.activeMouthLayerId = fresh.id;
      state.showMouthTrack = false;
      mouthSheetPop.classList.remove('open');
      normalizeTargetHierarchy(sc);
      if (state.selectedTrack === 'mouth' || state.activeLayer === 'mouth') {
        selectFallbackVisibleLayerAfterDelete();
      }
    } else {
      sc.layerOrder = sc.layerOrder.filter((k) => k !== removedKey);
      sc.mouthLayers.splice(idx, 1);
      if (sc.activeMouthLayerId === layerId) {
        sc.activeMouthLayerId = sc.mouthLayers[Math.max(0, idx - 1)].id;
      }
      normalizeTargetHierarchy(sc);
    }

    syncLayerTrackContainers();
    updateMouthWidget();
    updateActiveTrackHighlight();
    updateStageBadge();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function selectMouthLayer(layerId: string): void {
    const sc = activeScene();
    if (sc.mouthLayers.some((m) => m.id === layerId)) {
      sc.activeMouthLayerId = layerId;
    }
    selectTimelineTrack('mouth');
  }

  btnAddCelTrack.onclick = () => addCelTrack();
  btnAddVectorTrack.onclick = () => addVectorTrack();
  btnAddMouthTrack.onclick = () => addMouthTrack();
  btnAddBgTrack.onclick = () => addBgTrack();
  btnAddCamTrack.onclick = () => addCamTrack();

  ctxLayerAddChildVec.onclick = () => {
    const key = contextMenuLayerKey;
    hideMenus();
    if (key) addChildVectorTrack(key);
  };
  ctxLayerAddChildCel.onclick = () => {
    const key = contextMenuLayerKey;
    hideMenus();
    if (key) addChildCelTrack(key);
  };
  ctxLayerJoinAbove.onclick = () => {
    const key = contextMenuLayerKey;
    hideMenus();
    if (!key) return;
    const target = activeTimelineTarget();
    const above = getNearestVisibleLayerAbove(target, key);
    if (!above || isLayerDescendant(target, key, above)) return;
    if (setLayerParentKeepWorld(activeScene(), target, key, above, state.currentFrame)) {
      syncLayerTrackContainers();
      updateActiveTrackHighlight();
      renderTimeline();
      renderStage();
      onNotify(`${getLayerDisplayName(target, key)} joined as child of ${getLayerDisplayName(target, above)}.`);
    }
  };
  ctxLayerDetach.onclick = () => {
    const key = contextMenuLayerKey;
    hideMenus();
    if (!key) return;
    const target = activeTimelineTarget();
    if (!target.layerParents?.[key]) return;
    setLayerParentKeepWorld(activeScene(), target, key, null, state.currentFrame);
    syncLayerTrackContainers();
    updateActiveTrackHighlight();
    renderTimeline();
    renderStage();
    onNotify(`${getLayerDisplayName(target, key)} detached from parent.`);
  };
  ctxLayerToggleIK.onclick = () => {
    const key = contextMenuLayerKey;
    hideMenus();
    if (!key) return;
    const target = activeTimelineTarget();
    normalizeTargetHierarchy(target);
    const hasParent = Boolean(target.layerParents?.[key]);
    const hasChild = Object.values(target.layerParents || {}).includes(key);
    if (!hasParent && !hasChild) return;
    if (!target.layerIK) target.layerIK = {};
    const nextVal = !target.layerIK[key];
    if (nextVal) target.layerIK[key] = true;
    else delete target.layerIK[key];
    syncLayerTrackContainers();
    updateStageBadge();
    renderStage();
    onNotify(
      nextVal
        ? `Inverse Kinematics enabled on ${getLayerDisplayName(target, key)}. Move the end object to pose the chain.`
        : `Inverse Kinematics disabled on ${getLayerDisplayName(target, key)}.`
    );
  };
  ctxLayerRename.onclick = () => {
    const key = contextMenuLayerKey;
    hideMenus();
    if (key) startLayerRename(key);
  };
  ctxLayerClear.onclick = () => {
    const key = contextMenuLayerKey;
    hideMenus();
    if (!key || !key.startsWith('bg:')) return;
    const bg = activeScene().bgLayers.find((b) => b.id === key.slice(3));
    if (!bg) return;
    pushPixelUndo(bg);
    bg.canvas = createCelCanvas();
    bg.offsetX = 0;
    bg.offsetY = 0;
    bg.hasInk = false;
    bg.name = '';
    updateBgUI();
    renderStage();
  };
  ctxLayerDelete.onclick = () => {
    const key = contextMenuLayerKey;
    hideMenus();
    if (!key) return;
    if (key.startsWith('vector:')) removeVectorTrack(key.slice(7));
    else if (key.startsWith('cel:')) removeCelTrack(key.slice(4));
    else if (key.startsWith('bg:')) removeBgTrack(key.slice(3));
    else if (key.startsWith('mouth:')) removeMouthTrack(key.slice(6));
    else if (key.startsWith('audio:')) removeAudioTrack(key.slice(6));
    else if (key === 'cam') removeCamTrack();
  };

  function toggleVectorTrack(forceState?: boolean): void {
    state.showVectorTrack = typeof forceState === 'boolean' ? forceState : !state.showVectorTrack;
    syncLayerTrackContainers();
    if (state.showVectorTrack) {
      state.showVectorLayer = true;
      const curTrk = state.activeVectorTrack;
      if (!curTrk.visible) curTrk.visible = true;
      if (typeof forceState !== 'boolean') {
        selectTimelineTrack('vector');
      }
    } else if (state.activeLayer === 'vector') {
      setActiveLayer('cel');
    }
    syncLayerTrackContainers();
    updateActiveTrackHighlight();
    updateTimelinePanelHeight();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function toggleBgTrack(forceState?: boolean): void {
    state.showBgTrack = typeof forceState === 'boolean' ? forceState : !state.showBgTrack;
    syncLayerTrackContainers();
    if (state.showBgTrack) {
      state.bgLayer.visible = true;
      if (typeof forceState !== 'boolean') {
        selectTimelineTrack('bg');
      }
    } else if (state.activeLayer === 'bg') {
      setActiveLayer('cel');
    }
    updateBgUI();
    updateActiveTrackHighlight();
    updateTimelinePanelHeight();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function updateActiveTrackHighlight(): void {
    syncLayerTrackContainers();
    syncAudioTrackContainers();
    const active = state.selectedTrack;
    const target = activeTimelineTarget();
    const sc = activeScene();
    const activeCelId = target.activeCelTrackId;
    const activeVecId = target.activeVectorTrackId;
    const activeBgId = sc.activeBgLayerId;
    const activeMouthId = sc.activeMouthLayerId;
    const activeAudId = sc.activeAudioTrackId;

    for (const dom of celTrackDomMap.values()) {
      const isAct = active === 'cel' && dom.trackId === activeCelId;
      dom.labelEl.classList.toggle('active-draw-layer', isAct);
      dom.rowEl.classList.toggle('active-track-row', isAct);
      dom.rightEl.classList.toggle('active-track-right', isAct);
    }

    for (const dom of vectorTrackDomMap.values()) {
      const isActVec = active === 'vector' && dom.trackId === activeVecId;
      dom.labelEl.classList.toggle('active-draw-layer', isActVec);
      dom.rowEl.classList.toggle('active-track-row', isActVec);
      dom.rightEl.classList.toggle('active-track-right', isActVec);
    }

    for (const dom of bgTrackDomMap.values()) {
      const isActBg = active === 'bg' && dom.layerId === activeBgId;
      dom.labelEl.classList.toggle('active-draw-layer', isActBg);
      dom.rowEl.classList.toggle('active-track-row', isActBg);
      dom.rightEl.classList.toggle('active-track-right', isActBg);
    }

    for (const dom of mouthTrackDomMap.values()) {
      const isActMouth = active === 'mouth' && dom.layerId === activeMouthId;
      dom.labelEl.classList.toggle('active-draw-layer', isActMouth);
      dom.rowEl.classList.toggle('active-track-row', isActMouth);
      dom.rightEl.classList.toggle('active-track-right', isActMouth);
    }

    for (const dom of audioTrackDomMap.values()) {
      const isActAud = active === 'audio' && dom.trackId === activeAudId;
      dom.labelEl.classList.toggle('active-draw-layer', isActAud);
      dom.rowEl.classList.toggle('active-track-row', isActAud);
      dom.rightEl.classList.toggle('active-track-right', isActAud);
      dom.clipBoxEl.classList.toggle('selected', isActAud);
    }

    camTrackLabel.classList.toggle('active-draw-layer', active === 'cam');
    camTrackRow.classList.toggle('active-track-row', active === 'cam');
    camTrackRight.classList.toggle('active-track-right', active === 'cam');

    btnToolNudge.classList.toggle('hidden-tool', isBasicMode() || (state.activeLayer !== 'vector' && state.activeLayer !== 'cel'));
    btnToolVectorEdit.classList.toggle('hidden-tool', isBasicMode() || state.activeLayer !== 'vector');
    btnVectorPixelPreview.classList.toggle('hidden-nest-ui', isBasicMode() || state.activeLayer !== 'vector');
    vectorPointModeGroup.classList.toggle(
      'hidden-nest-ui',
      isBasicMode() || state.activeLayer !== 'vector' || state.tool !== 'vectorEdit'
    );
  }

  function selectTimelineTrack(track: 'cel' | 'vector' | 'bg' | 'mouth' | 'audio' | 'cam'): void {
    const prevLayer = state.activeLayer;
    state.selectedTrack = track;
    if (track === 'cel' || track === 'vector' || track === 'bg' || track === 'mouth') {
      state.activeLayer = track;
    }
    if (state.activeLayer !== 'vector') {
      vectorEditSelection = null;
      vectorEditHover = null;
    }
    if (track === 'mouth' && prevLayer !== 'mouth') {
      selectTool('moveCam');
    } else if (state.activeLayer !== 'vector' && state.tool === 'vectorEdit') {
      selectTool('brush');
    } else if (state.activeLayer !== 'vector' && state.activeLayer !== 'cel' && state.tool === 'nudge') {
      selectTool('brush');
    }
    updateActiveTrackHighlight();
    updateMouthWidget();
    updateAudioVolumeUI();
    updateStageBadge();
    renderStage();
  }

  function setActiveLayer(layer: 'cel' | 'vector' | 'bg' | 'mouth'): void {
    selectTimelineTrack(layer);
  }

  function updateBgUI(): void {
    syncLayerTrackContainers();
  }

  camTrackRight.onclick = () => selectTimelineTrack('cam');

  const bgFileInput = mustEl<HTMLInputElement>('bgFileInput');
  bgFileInput.onchange = () => {
    if (bgFileInput.files && bgFileInput.files[0]) {
      loadImageFile(bgFileInput.files[0], 'bg', state.currentFrame, pendingBgUploadId || undefined);
    }
    pendingBgUploadId = null;
    bgFileInput.value = '';
  };

  // ==========================================
  // Multi-Track Web Audio + Live Mic Waveform Preview + Delete
  // ==========================================
  let audioCtx: AudioContext | null = null;
  let activeAudioSources: AudioBufferSourceNode[] = [];
  let activeAudioGainNodes: Array<{ gain: GainNode; trackId: string }> = [];
  let activeScrubSource: AudioBufferSourceNode | null = null;
  let lastScrubTime = 0;

  let micRecorder: MediaRecorder | null = null;
  let micStream: MediaStream | null = null;
  let micChunks: BlobPart[] = [];
  let micStartFrame = 0;
  let micAnalyser: AnalyserNode | null = null;
  let micSourceNode: MediaStreamAudioSourceNode | null = null;
  let micPreviewRaf: number | null = null;
  let micStartTimestamp = 0;
  let micLivePeaks: number[] = [];
  let activeRecAudioTrackId: string | null = null;
  let contextAudioTrackId: string | null = null;

  interface AudioTrackDom {
    trackId: string;
    labelEl: HTMLDivElement;
    rowEl: HTMLDivElement;
    rightEl: HTMLDivElement;
    volFillEl: HTMLDivElement;
    tagSpan: HTMLSpanElement;
    tagTextSpan: HTMLSpanElement;
    btnAdd: HTMLButtonElement;
    btnRec: HTMLButtonElement;
    btnMute: HTMLButtonElement;
    btnRemove: HTMLButtonElement;
    waveCanvas: HTMLCanvasElement;
    emptyHintEl: HTMLDivElement;
    recBadgeEl: HTMLDivElement;
    clipBoxEl: HTMLDivElement;
    clipLabelEl: HTMLDivElement;
  }

  let renderedAudioTrackIds: string[] = [];
  const audioTrackDomMap = new Map<string, AudioTrackDom>();

  let audioDragState: {
    trackId: string;
    mode: string;
    startX: number;
    origTimelineStart: number;
    origTrimStart: number;
    origTrimEnd: number;
  } | null = null;

  let audioLayerDragState: {
    dragTrackId: string;
    labelEl: HTMLDivElement;
    startY: number;
    started: boolean;
    dropTargetTrackId: string | null;
    dropPos: 'above' | 'below';
  } | null = null;
  let lastAudioLayerDragEndTime = 0;

  function clearAudioLayerDragDropIndicators(): void {
    audioLabelsContainer.querySelectorAll('.layer-dragging, .drop-above, .drop-below').forEach((el) => {
      el.classList.remove('layer-dragging', 'drop-above', 'drop-below');
    });
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (!audioLayerDragState) return;
      if (!audioLayerDragState.started) {
        if (Math.abs(e.clientY - audioLayerDragState.startY) <= 5) return;
        audioLayerDragState.started = true;
        audioLayerDragState.labelEl.classList.add('layer-dragging');
        document.body.style.cursor = 'grabbing';
      }

      clearAudioLayerDragDropIndicators();
      audioLayerDragState.labelEl.classList.add('layer-dragging');

      const sc = activeScene();
      const visibleEntries: Array<{ id: string; el: HTMLElement; rect: DOMRect }> = [];
      for (const trk of sc.audioTracks) {
        const dom = audioTrackDomMap.get(trk.id);
        if (!dom || dom.labelEl.classList.contains('hidden-track')) continue;
        visibleEntries.push({ id: trk.id, el: dom.labelEl, rect: dom.labelEl.getBoundingClientRect() });
      }

      let nextDropId: string | null = null;
      let nextDropPos: 'above' | 'below' = 'above';
      for (const item of visibleEntries) {
        if (item.id === audioLayerDragState.dragTrackId) continue;
        if (e.clientY >= item.rect.top && e.clientY <= item.rect.bottom) {
          nextDropId = item.id;
          nextDropPos = e.clientY < item.rect.top + item.rect.height / 2 ? 'above' : 'below';
          break;
        }
      }

      if (!nextDropId && visibleEntries.length > 0) {
        const first = visibleEntries[0];
        const last = visibleEntries[visibleEntries.length - 1];
        if (e.clientY < first.rect.top && first.id !== audioLayerDragState.dragTrackId) {
          nextDropId = first.id;
          nextDropPos = 'above';
        } else if (e.clientY > last.rect.bottom && last.id !== audioLayerDragState.dragTrackId) {
          nextDropId = last.id;
          nextDropPos = 'below';
        }
      }

      audioLayerDragState.dropTargetTrackId = nextDropId;
      audioLayerDragState.dropPos = nextDropPos;
      if (nextDropId) {
        audioTrackDomMap.get(nextDropId)?.labelEl.classList.add(nextDropPos === 'above' ? 'drop-above' : 'drop-below');
      }
    },
    { signal }
  );

  const finishAudioLayerDrag = () => {
    if (!audioLayerDragState) return;
    const ds = audioLayerDragState;
    audioLayerDragState = null;
    clearAudioLayerDragDropIndicators();
    document.body.style.cursor = '';

    if (!ds.started) return;
    lastAudioLayerDragEndTime = performance.now();

    if (!ds.dropTargetTrackId || ds.dropTargetTrackId === ds.dragTrackId) return;
    const sc = activeScene();
    const fromIdx = sc.audioTracks.findIndex((t) => t.id === ds.dragTrackId);
    if (fromIdx < 0) return;
    const [moved] = sc.audioTracks.splice(fromIdx, 1);
    const toIdx = sc.audioTracks.findIndex((t) => t.id === ds.dropTargetTrackId);
    if (toIdx < 0) {
      sc.audioTracks.splice(fromIdx, 0, moved);
      return;
    }
    const insertIdx = ds.dropPos === 'above' ? toIdx : toIdx + 1;
    sc.audioTracks.splice(insertIdx, 0, moved);

    syncAudioTrackContainers();
    updateActiveTrackHighlight();
    renderAudioTrack();
  };

  window.addEventListener('pointerup', finishAudioLayerDrag, { signal });
  window.addEventListener('pointercancel', finishAudioLayerDrag, { signal });

  function getAudioContext(): AudioContext {
    if (!audioCtx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  }

  function getAudioTrackEffectiveVolume(trk: AudioTrack): number {
    if (trk.clip) {
      return trk.clip.muted || trk.muted ? 0 : Math.max(0, Math.min(1, trk.clip.volume));
    }
    return trk.muted ? 0 : Math.max(0, Math.min(1, trk.volume));
  }

  function getEffectiveAudioVolume(trk?: AudioTrack): number {
    return getAudioTrackEffectiveVolume(trk || state.activeAudioTrack);
  }

  function updateAudioVolumeUI(): void {
    const sc = activeScene();
    for (const trk of sc.audioTracks) {
      const dom = audioTrackDomMap.get(trk.id);
      if (dom) {
        const vol = getAudioTrackEffectiveVolume(trk);
        const pct = Math.round(vol * 100);
        dom.volFillEl.style.width = `${pct}%`;
        dom.volFillEl.classList.toggle('empty', pct <= 0);
        dom.volFillEl.classList.toggle('full', pct >= 100);
        dom.labelEl.title = `Drag up/down to reorder • Scroll wheel here to adjust ${trk.name} volume (${pct}%)`;
        dom.btnMute.textContent = trk.clip?.muted || trk.muted || pct === 0 ? '🔇' : '🔊';
      }
    }
    for (const item of activeAudioGainNodes) {
      const trk = sc.audioTracks.find((t) => t.id === item.trackId);
      const vol = trk ? getAudioTrackEffectiveVolume(trk) : 0;
      try {
        item.gain.gain.value = vol;
      } catch {
        // ignore
      }
    }
  }

  function stopAllAudioPlayback(): void {
    for (const src of activeAudioSources) {
      try {
        src.stop();
      } catch {
        // ignore
      }
      try {
        src.disconnect();
      } catch {
        // ignore
      }
    }
    for (const item of activeAudioGainNodes) {
      try {
        item.gain.disconnect();
      } catch {
        // ignore
      }
    }
    activeAudioSources = [];
    activeAudioGainNodes = [];
  }

  function scheduleAudioAtFrame(frame: number): void {
    stopAllAudioPlayback();
    if (nestStack.length > 0) return;

    const sc = activeScene();
    const playheadSec = frame / state.fps;
    let ac: AudioContext | null = null;

    for (const trk of sc.audioTracks) {
      const clip = trk.clip;
      if (!clip || clip.muted || trk.muted) continue;
      const clipDur = clip.trimEndSec - clip.trimStartSec;
      const clipStart = clip.timelineStartSec;
      const clipEnd = clipStart + clipDur;
      if (playheadSec >= clipEnd || clipDur <= 0) continue;

      if (!ac) ac = getAudioContext();
      const src = ac.createBufferSource();
      src.buffer = clip.buffer;
      const gain = ac.createGain();
      gain.gain.value = getAudioTrackEffectiveVolume(trk);
      src.connect(gain);
      gain.connect(ac.destination);

      if (playheadSec >= clipStart) {
        const intoClip = playheadSec - clipStart;
        const remaining = clipEnd - playheadSec;
        src.start(ac.currentTime, clip.trimStartSec + intoClip, remaining);
      } else {
        const delay = clipStart - playheadSec;
        src.start(ac.currentTime + delay, clip.trimStartSec, clipDur);
      }
      activeAudioSources.push(src);
      activeAudioGainNodes.push({ gain, trackId: trk.id });
    }
  }

  function playAudioScrubGrain(frame: number): void {
    if (nestStack.length > 0) return;
    const trk = state.activeAudioTrack;
    const clip = trk.clip;
    if (!clip || clip.muted || trk.muted) return;
    const vol = getAudioTrackEffectiveVolume(trk);
    if (vol <= 0.001) return;
    const now = performance.now();
    if (now - lastScrubTime < 55) return;
    lastScrubTime = now;

    const ac = getAudioContext();
    const { buffer, timelineStartSec, trimStartSec, trimEndSec } = clip;
    const playheadSec = frame / state.fps;
    const clipEnd = timelineStartSec + (trimEndSec - trimStartSec);

    if (playheadSec < timelineStartSec || playheadSec >= clipEnd) return;
    if (activeScrubSource) {
      try {
        activeScrubSource.stop();
      } catch {
        // ignore
      }
    }

    const offset = trimStartSec + (playheadSec - timelineStartSec);
    const grainDur = Math.min(0.06, trimEndSec - offset);
    if (grainDur <= 0.005) return;

    const src = ac.createBufferSource();
    src.buffer = buffer;
    const gain = ac.createGain();
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(ac.destination);
    src.start(ac.currentTime, offset, grainDur);
    activeScrubSource = src;
  }

  function computePeaks(audioBuffer: AudioBuffer, numBuckets = 1800): Float32Array {
    const ch = audioBuffer.getChannelData(0);
    const step = Math.max(1, Math.floor(ch.length / numBuckets));
    const count = Math.ceil(ch.length / step);
    const peaks = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      let max = 0;
      const start = i * step;
      const end = Math.min(ch.length, start + step);
      for (let j = start; j < end; j++) {
        const v = Math.abs(ch[j]);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    return peaks;
  }

  function selectAudioTrack(trackId: string): void {
    const sc = activeScene();
    if (sc.audioTracks.some((t) => t.id === trackId)) {
      sc.activeAudioTrackId = trackId;
    }
    selectTimelineTrack('audio');
  }

  function addAudioTrack(): void {
    if (nestStack.length > 0) return;
    const sc = activeScene();
    if (!state.showAudioTrack && sc.audioTracks.length >= 1) {
      sc.activeAudioTrackId = sc.audioTracks[0].id;
      state.showAudioTrack = true;
    } else {
      let idx = sc.audioTracks.length + 1;
      while (sc.audioTracks.some((t) => t.name === `Sound ${idx}`)) idx++;
      const trk = createAudioTrack(`Sound ${idx}`);
      sc.audioTracks.push(trk);
      sc.activeAudioTrackId = trk.id;
      state.showAudioTrack = true;
    }
    btnToggleAudioTrack.classList.toggle('active', state.showAudioTrack);
    selectTimelineTrack('audio');
    syncAudioTrackContainers();
    updateAudioVolumeUI();
    updateTimelinePanelHeight();
    renderAudioTrack();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function removeAudioTrack(trackId: string): void {
    const sc = activeScene();
    const idx = sc.audioTracks.findIndex((t) => t.id === trackId);
    if (idx < 0) return;
    if (activeRecAudioTrackId === trackId && micRecorder && micRecorder.state === 'recording') {
      micRecorder.stop();
    }
    stopAllAudioPlayback();

    if (sc.audioTracks.length <= 1) {
      const trk = sc.audioTracks[0];
      trk.clip = null;
      trk.volume = 1;
      trk.muted = false;
      trk.name = 'Sound';
      state.showAudioTrack = false;
      if (isBasicMode()) basicShowAudioTrack = false;
      btnToggleAudioTrack.classList.toggle('active', false);
      if (state.selectedTrack === 'audio') {
        selectFallbackVisibleLayerAfterDelete();
      }
    } else {
      sc.audioTracks.splice(idx, 1);
      if (sc.activeAudioTrackId === trackId) {
        sc.activeAudioTrackId = sc.audioTracks[Math.max(0, idx - 1)].id;
      }
    }
    syncAudioTrackContainers();
    updateActiveTrackHighlight();
    updateAudioVolumeUI();
    updateTimelinePanelHeight();
    if (state.isPlaying) scheduleAudioAtFrame(state.currentFrame);
    renderAudioTrack();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  async function startRecordingOnTrack(trackId: string): Promise<void> {
    if (micRecorder && micRecorder.state === 'recording') {
      micRecorder.stop();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onNotify('Microphone recording is not supported in this browser.');
      return;
    }

    selectAudioTrack(trackId);

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micChunks = [];
      micStartFrame = state.currentFrame;
      activeRecAudioTrackId = trackId;

      const recorder = new MediaRecorder(micStream);
      micRecorder = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) micChunks.push(ev.data);
      };

      recorder.onstop = async () => {
        const recTrackId = activeRecAudioTrackId || trackId;
        stopLiveRecPreview();
        activeRecAudioTrackId = null;
        const dom = audioTrackDomMap.get(recTrackId);
        if (dom) {
          dom.btnRec.textContent = '● Rec';
          dom.btnRec.classList.remove('recording');
        }

        if (micStream) {
          micStream.getTracks().forEach((t) => t.stop());
          micStream = null;
        }

        if (micChunks.length > 0) {
          const blob = new Blob(micChunks, { type: recorder.mimeType || 'audio/webm' });
          const ac = getAudioContext();
          const buf = await blob.arrayBuffer();
          const decoded = await ac.decodeAudioData(buf);
          await setDecodedAudioBuffer(decoded, 'Mic Recording', micStartFrame, recTrackId);
        } else {
          renderAudioTrack();
        }
        micRecorder = null;
      };

      recorder.start();
      const dom = audioTrackDomMap.get(trackId);
      if (dom) {
        dom.btnRec.textContent = '■ Stop';
        dom.btnRec.classList.add('recording');
      }
      startLiveRecPreview(micStream, trackId);
    } catch (err) {
      activeRecAudioTrackId = null;
      const msg = err instanceof Error ? err.message : String(err);
      onNotify('Could not access microphone: ' + msg);
    }
  }

  function syncAudioTrackContainers(): void {
    const sc = activeScene();
    if (sc.audioTracks.length === 0) getActiveAudioTrackInScene(sc);
    const tracks = sc.audioTracks;

    if (!audioDragState && !audioLayerDragState) {
      const idSet = new Set(tracks.map((t) => t.id));
      const idsMatch =
        renderedAudioTrackIds.length === tracks.length &&
        tracks.every((t, i) => renderedAudioTrackIds[i] === t.id && audioTrackDomMap.has(t.id));

      if (!idsMatch) {
        for (const [oldId, dom] of audioTrackDomMap.entries()) {
          if (!idSet.has(oldId)) {
            dom.labelEl.remove();
            dom.rowEl.remove();
            dom.rightEl.remove();
            audioTrackDomMap.delete(oldId);
          }
        }
        for (const trk of tracks) {
          if (audioTrackDomMap.has(trk.id)) continue;
          const trackId = trk.id;

          const labelEl = document.createElement('div');
          labelEl.className = 'track-label audio-track-label' + (state.showAudioTrack ? '' : ' hidden-track');
          labelEl.title = `Drag up/down to reorder • Scroll wheel here to adjust ${trk.name} volume`;

          const volFillEl = document.createElement('div');
          volFillEl.className = 'audio-vol-fill full';

          const { tagSpan, tagTextSpan } = createLayerTagDom(
            'bg-[#c084fc]',
            trk.name,
            `Audio Track (${trk.name})`
          );

          const btnGroup = document.createElement('div');
          btnGroup.className = 'flex gap-[3px] shrink-0';

          const btnAdd = document.createElement('button');
          btnAdd.type = 'button';
          btnAdd.className = 'mini-btn';
          btnAdd.textContent = '+';
          btnAdd.title = 'Add Audio Track';
          btnAdd.onclick = (e) => {
            e.stopPropagation();
            addAudioTrack();
          };

          const btnRec = document.createElement('button');
          btnRec.type = 'button';
          btnRec.className = 'mini-btn rec-btn';
          btnRec.textContent = '● Rec';
          btnRec.title = `Record Microphone onto ${trk.name}`;
          btnRec.onclick = (e) => {
            e.stopPropagation();
            void startRecordingOnTrack(trackId);
          };

          const btnMute = document.createElement('button');
          btnMute.type = 'button';
          btnMute.className = 'mini-btn';
          btnMute.textContent = '🔊';
          btnMute.title = 'Mute/Unmute Track';
          btnMute.onclick = (e) => {
            e.stopPropagation();
            const cur = activeScene().audioTracks.find((t) => t.id === trackId);
            if (!cur) return;
            if (cur.clip) {
              cur.clip.muted = !cur.clip.muted;
              cur.muted = cur.clip.muted;
              if (!cur.clip.muted && cur.clip.volume <= 0) {
                cur.clip.volume = 1;
                cur.volume = 1;
              }
            } else {
              cur.muted = !cur.muted;
              if (!cur.muted && cur.volume <= 0) cur.volume = 1;
            }
            updateAudioVolumeUI();
            if (state.isPlaying) scheduleAudioAtFrame(state.currentFrame);
            renderAudioTrack();
          };

          const btnRemove = document.createElement('button');
          btnRemove.type = 'button';
          btnRemove.className = 'mini-btn danger';
          btnRemove.textContent = '✕';
          btnRemove.title = 'Delete Audio Track';
          btnRemove.onclick = (e) => {
            e.stopPropagation();
            removeAudioTrack(trackId);
          };

          btnGroup.append(btnAdd, btnRec, btnMute, btnRemove);
          labelEl.append(volFillEl, tagSpan, btnGroup);

          labelEl.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 || isBasicMode()) return;
            if ((e.target as HTMLElement)?.closest('button, input, select')) return;
            audioLayerDragState = {
              dragTrackId: trackId,
              labelEl,
              startY: e.clientY,
              started: false,
              dropTargetTrackId: null,
              dropPos: 'above',
            };
          });

          labelEl.onclick = (e) => {
            if ((e.target as HTMLElement)?.closest('button, input, select')) return;
            if (renamingLayerKey !== null) return;
            if (performance.now() - lastAudioLayerDragEndTime < 220) return;
            selectAudioTrack(trackId);
          };

          labelEl.addEventListener('dblclick', (e) => {
            if (isBasicMode()) return;
            if ((e.target as HTMLElement)?.closest('button, input, select')) return;
            e.stopPropagation();
            startLayerRename(`audio:${trackId}`);
          });

          labelEl.addEventListener('contextmenu', (e) => {
            if (isBasicMode()) return;
            if ((e.target as HTMLElement)?.closest('input, select')) return;
            e.preventDefault();
            e.stopPropagation();
            openLayerContextMenu(`audio:${trackId}`, e.clientX, e.clientY);
          });

          labelEl.addEventListener(
            'wheel',
            (e) => {
              if (e.deltaY === 0) return;
              e.preventDefault();
              e.stopPropagation();
              const cur = activeScene().audioTracks.find((t) => t.id === trackId);
              if (!cur) return;
              const step =
                Math.abs(e.deltaY) < 20
                  ? -Math.sign(e.deltaY) * Math.max(0.02, Math.abs(e.deltaY) * 0.0025)
                  : e.deltaY < 0
                    ? 0.05
                    : -0.05;
              const baseVol = cur.clip ? cur.clip.volume : cur.volume;
              const nextVol = Math.max(0, Math.min(1, Math.round((baseVol + step) * 100) / 100));
              if (step > 0) {
                cur.muted = false;
                if (cur.clip) cur.clip.muted = false;
              }
              cur.volume = nextVol;
              if (cur.clip) cur.clip.volume = nextVol;
              if (cur.id === activeScene().activeAudioTrackId) {
                state.audioVolume = nextVol;
              }
              updateAudioVolumeUI();
              if (state.isPlaying && cur.clip && !cur.clip.muted && !cur.muted && activeAudioSources.length === 0) {
                scheduleAudioAtFrame(state.currentFrame);
              }
              renderAudioTrack();
            },
            { passive: false }
          );

          const rowEl = document.createElement('div');
          rowEl.className = 'track-row audio-track-row' + (state.showAudioTrack ? '' : ' hidden-track');

          const waveCanvas = document.createElement('canvas');
          waveCanvas.className = 'audio-wave-canvas';

          const emptyHintEl = document.createElement('div');
          emptyHintEl.className = 'audio-empty-hint';
          emptyHintEl.textContent = 'Drop audio here or click ● Rec';

          const recBadgeEl = document.createElement('div');
          recBadgeEl.className = 'audio-rec-badge';
          recBadgeEl.textContent = '● REC 0.0s';

          const clipBoxEl = document.createElement('div');
          clipBoxEl.className = 'audio-clip-box';

          const leftTrim = document.createElement('div');
          leftTrim.className = 'audio-trim-handle left';
          leftTrim.dataset.trim = 'left';

          const clipLabelEl = document.createElement('div');
          clipLabelEl.className = 'audio-clip-label';

          const rightTrim = document.createElement('div');
          rightTrim.className = 'audio-trim-handle right';
          rightTrim.dataset.trim = 'right';

          clipBoxEl.append(leftTrim, clipLabelEl, rightTrim);
          rowEl.append(waveCanvas, emptyHintEl, recBadgeEl, clipBoxEl);

          rowEl.addEventListener('pointerdown', () => selectAudioTrack(trackId));
          rowEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const curSc = activeScene();
            const cur = curSc.audioTracks.find((t) => t.id === trackId);
            if (!cur) return;
            selectAudioTrack(trackId);
            contextAudioTrackId = trackId;
            const basic = isBasicMode();
            const hasClip = Boolean(cur.clip);
            ctxAudioAutoLipSync.disabled = basic || !hasClip;
            ctxAudioAutoLipSync.classList.toggle('hidden-nest-ui', basic);
            mustEl<HTMLButtonElement>('ctxAudioFit').disabled = !hasClip;
            mustEl<HTMLButtonElement>('ctxAudioMute').disabled = !hasClip;
            mustEl<HTMLButtonElement>('ctxAudioDelete').disabled = !hasClip;
            mustEl<HTMLButtonElement>('ctxAudioMute').textContent = cur.clip?.muted || cur.muted ? 'Unmute Audio' : 'Mute Audio';
            ctxAudioDeleteTrack.classList.toggle('hidden-nest-ui', basic);
            audioContextMenu.style.display = 'flex';
            const left = Math.min(window.innerWidth - 185, e.clientX);
            const top = Math.min(window.innerHeight - 165, e.clientY);
            audioContextMenu.style.left = `${left}px`;
            audioContextMenu.style.top = `${top}px`;
          });

          clipBoxEl.addEventListener('pointerdown', (e) => {
            const cur = activeScene().audioTracks.find((t) => t.id === trackId);
            if (!cur?.clip) return;
            e.stopPropagation();
            selectAudioTrack(trackId);
            if (e.button === 2) return;
            if (state.isPlaying) togglePlay();

            const targetEl = e.target as HTMLElement;
            const trimRole = targetEl.dataset?.trim;
            clipBoxEl.setPointerCapture(e.pointerId);
            audioDragState = {
              trackId,
              mode: trimRole || 'move',
              startX: e.clientX,
              origTimelineStart: cur.clip.timelineStartSec,
              origTrimStart: cur.clip.trimStartSec,
              origTrimEnd: cur.clip.trimEndSec,
            };
          });

          clipBoxEl.addEventListener('pointermove', (e) => {
            if (!audioDragState || audioDragState.trackId !== trackId) return;
            const cur = activeScene().audioTracks.find((t) => t.id === trackId);
            if (!cur?.clip) return;
            const trackW = Math.max(1, rowEl.clientWidth);
            const timelineDurSec = state.totalFrames / state.fps;
            const deltaSec = ((e.clientX - audioDragState.startX) / trackW) * timelineDurSec;
            const frameSec = 1 / state.fps;

            if (audioDragState.mode === 'move') {
              const rawFrame = Math.round((audioDragState.origTimelineStart + deltaSec) * state.fps);
              const snappedFrame = Math.max(0, Math.min(state.totalFrames - 1, rawFrame));
              cur.clip.timelineStartSec = snappedFrame / state.fps;
            } else if (audioDragState.mode === 'left') {
              const origEndSecOnTimeline =
                audioDragState.origTimelineStart + (audioDragState.origTrimEnd - audioDragState.origTrimStart);
              const minPossibleStartSec = Math.max(0, audioDragState.origTimelineStart - audioDragState.origTrimStart);
              const maxPossibleStartSec = origEndSecOnTimeline - frameSec;

              const rawStartSec = audioDragState.origTimelineStart + deltaSec;
              const snappedFrame = Math.round(rawStartSec * state.fps);
              const clampedStartSec = Math.max(minPossibleStartSec, Math.min(maxPossibleStartSec, snappedFrame / state.fps));
              const finalStartSec = Math.max(0, Math.round(clampedStartSec * state.fps) / state.fps);
              const actualDelta = finalStartSec - audioDragState.origTimelineStart;

              if (
                audioDragState.origTrimStart + actualDelta >= 0 &&
                audioDragState.origTrimStart + actualDelta <= audioDragState.origTrimEnd - frameSec * 0.5
              ) {
                cur.clip.timelineStartSec = finalStartSec;
                cur.clip.trimStartSec = audioDragState.origTrimStart + actualDelta;
              }
            } else if (audioDragState.mode === 'right') {
              const origDur = audioDragState.origTrimEnd - audioDragState.origTrimStart;
              const rawEndOnTimeline = audioDragState.origTimelineStart + origDur + deltaSec;
              const startFrame = Math.round(audioDragState.origTimelineStart * state.fps);
              const snappedEndFrame = Math.max(startFrame + 1, Math.round(rawEndOnTimeline * state.fps));
              const snappedDur = snappedEndFrame / state.fps - audioDragState.origTimelineStart;
              const newTrimEnd = Math.min(cur.clip.buffer.duration, audioDragState.origTrimStart + snappedDur);
              cur.clip.trimEndSec = Math.max(audioDragState.origTrimStart + frameSec * 0.5, newTrimEnd);
            }
            renderAudioTrack();
          });

          clipBoxEl.addEventListener('pointerup', () => {
            if (audioDragState?.trackId === trackId) audioDragState = null;
          });
          clipBoxEl.addEventListener('pointercancel', () => {
            if (audioDragState?.trackId === trackId) audioDragState = null;
          });

          const rightEl = document.createElement('div');
          rightEl.className = 'track-right-cell audio-track-right' + (state.showAudioTrack ? '' : ' hidden-track');
          rightEl.onclick = () => selectAudioTrack(trackId);

          audioLabelsContainer.appendChild(labelEl);
          audioRowsContainer.appendChild(rowEl);
          audioRightsContainer.appendChild(rightEl);
          audioTrackDomMap.set(trackId, {
            trackId,
            labelEl,
            rowEl,
            rightEl,
            volFillEl,
            tagSpan,
            tagTextSpan,
            btnAdd,
            btnRec,
            btnMute,
            btnRemove,
            waveCanvas,
            emptyHintEl,
            recBadgeEl,
            clipBoxEl,
            clipLabelEl,
          });
        }
        renderedAudioTrackIds = tracks.map((t) => t.id);

        for (const trk of tracks) {
          const dom = audioTrackDomMap.get(trk.id);
          if (dom) {
            audioLabelsContainer.appendChild(dom.labelEl);
            audioRowsContainer.appendChild(dom.rowEl);
            audioRightsContainer.appendChild(dom.rightEl);
          }
        }
      }
    }

    const basic = isBasicMode();
    tracks.forEach((trk, idx) => {
      const dom = audioTrackDomMap.get(trk.id);
      if (!dom) return;
      const showAud = basic ? idx === 0 && state.showAudioTrack : state.showAudioTrack;
      dom.labelEl.classList.toggle('hidden-track', !showAud);
      dom.rowEl.classList.toggle('hidden-track', !showAud);
      dom.rightEl.classList.toggle('hidden-track', !showAud);
      dom.btnAdd.style.display = basic ? 'none' : '';
      dom.btnRemove.style.display = !basic ? '' : 'none';
      if (renamingLayerKey !== `audio:${trk.id}` && dom.tagTextSpan.textContent !== trk.name) {
        dom.tagTextSpan.textContent = trk.name;
      }
    });
  }

  function toggleAudioTrack(forceState?: boolean): void {
    state.showAudioTrack = typeof forceState === 'boolean' ? forceState : !state.showAudioTrack;
    if (isBasicMode()) basicShowAudioTrack = state.showAudioTrack;
    btnToggleAudioTrack.classList.toggle('active', state.showAudioTrack);
    syncAudioTrackContainers();
    if (state.showAudioTrack && typeof forceState !== 'boolean') {
      selectTimelineTrack('audio');
    } else if (!state.showAudioTrack && state.selectedTrack === 'audio') {
      selectTimelineTrack(state.activeLayer);
    }
    updateActiveTrackHighlight();
    updateAudioVolumeUI();
    updateTimelinePanelHeight();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  btnToggleAudioTrack.onclick = () => {
    if (nestStack.length === 0) toggleAudioTrack();
  };
  btnAddAudioTrack.onclick = () => addAudioTrack();

  async function setDecodedAudioBuffer(
    decoded: AudioBuffer,
    name: string,
    startFrame = 0,
    targetTrackId?: string
  ): Promise<void> {
    const sc = activeScene();
    const trk = (targetTrackId && sc.audioTracks.find((t) => t.id === targetTrackId)) || state.activeAudioTrack;
    sc.activeAudioTrackId = trk.id;
    const peaks = computePeaks(decoded);
    trk.clip = {
      buffer: decoded,
      peaks,
      name,
      timelineStartSec: Math.max(0, startFrame) / state.fps,
      trimStartSec: 0,
      trimEndSec: decoded.duration,
      muted: trk.muted,
      volume: trk.volume,
    };

    syncAudioTrackContainers();
    updateAudioVolumeUI();
    if (!state.showAudioTrack) toggleAudioTrack(true);
    else renderAudioTrack();
  }

  async function loadAudioFile(file: File | undefined, targetTrackId?: string): Promise<void> {
    if (!file) return;
    const ac = getAudioContext();
    const buf = await file.arrayBuffer();
    const decoded = await ac.decodeAudioData(buf);
    await setDecodedAudioBuffer(decoded, file.name, 0, targetTrackId);
  }

  function deleteAudioOnTrack(trackId: string): void {
    const sc = activeScene();
    const trk = sc.audioTracks.find((t) => t.id === trackId);
    if (!trk) return;
    stopAllAudioPlayback();
    trk.clip = null;
    if (state.isPlaying) scheduleAudioAtFrame(state.currentFrame);
    updateAudioVolumeUI();
    renderAudioTrack();
  }

  function deleteActiveAudio(): void {
    deleteAudioOnTrack(state.activeAudioTrack.id);
    if (state.selectedTrack === 'audio' && !state.audio) {
      selectTimelineTrack(state.activeLayer);
    } else {
      updateActiveTrackHighlight();
    }
  }

  function startLiveRecPreview(stream: MediaStream, trackId: string): void {
    const dom = audioTrackDomMap.get(trackId);
    if (!dom) return;

    const ac = getAudioContext();
    micSourceNode = ac.createMediaStreamSource(stream);
    micAnalyser = ac.createAnalyser();
    micAnalyser.fftSize = 256;
    micSourceNode.connect(micAnalyser);

    const timeData = new Uint8Array(micAnalyser.fftSize);
    micLivePeaks = [];
    micStartTimestamp = performance.now();
    dom.emptyHintEl.style.display = 'none';
    dom.clipBoxEl.style.display = 'none';
    dom.recBadgeEl.style.display = 'block';

    const drawLive = () => {
      if (!micRecorder || micRecorder.state !== 'recording' || !micAnalyser) return;
      const curDom = audioTrackDomMap.get(trackId);
      if (!curDom) return;
      micAnalyser.getByteTimeDomainData(timeData);
      let peak = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = Math.abs(timeData[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      micLivePeaks.push(Math.min(1, peak * 2.2));
      if (micLivePeaks.length > 300) micLivePeaks.shift();

      const elapsed = ((performance.now() - micStartTimestamp) / 1000).toFixed(1);
      curDom.recBadgeEl.textContent = `● REC ${elapsed}s`;

      const w = curDom.rowEl.clientWidth;
      const h = curDom.rowEl.clientHeight;
      if (w > 0 && h > 0) {
        curDom.waveCanvas.width = w;
        curDom.waveCanvas.height = h;
        const actx = curDom.waveCanvas.getContext('2d');
        if (actx) {
          actx.clearRect(0, 0, w, h);

          const midY = h / 2;
          const maxAmp = (h - 10) / 2;
          const barStep = 4;
          const totalBars = Math.floor(w / barStep);
          const startIdx = Math.max(0, micLivePeaks.length - totalBars);

          actx.fillStyle = '#ef4444';
          for (let b = 0; b < micLivePeaks.length - startIdx; b++) {
            const amp = Math.max(2, micLivePeaks[startIdx + b] * maxAmp);
            const px = w - (micLivePeaks.length - startIdx - b) * barStep;
            actx.fillRect(px, Math.round(midY - amp), 2, Math.round(amp * 2));
          }
        }
      }
      micPreviewRaf = requestAnimationFrame(drawLive);
    };
    micPreviewRaf = requestAnimationFrame(drawLive);
  }

  function stopLiveRecPreview(): void {
    if (micPreviewRaf !== null) {
      cancelAnimationFrame(micPreviewRaf);
      micPreviewRaf = null;
    }
    if (micSourceNode) {
      try {
        micSourceNode.disconnect();
      } catch {
        // ignore
      }
      micSourceNode = null;
    }
    micAnalyser = null;
    for (const dom of audioTrackDomMap.values()) {
      dom.recBadgeEl.style.display = 'none';
    }
  }

  function renderAudioTrack(): void {
    if (!state.showAudioTrack) return;
    syncAudioTrackContainers();
    const sc = activeScene();
    const isRecording = Boolean(micRecorder && micRecorder.state === 'recording');

    for (const trk of sc.audioTracks) {
      if (isRecording && activeRecAudioTrackId === trk.id) continue;
      const dom = audioTrackDomMap.get(trk.id);
      if (!dom) continue;

      const w = dom.rowEl.clientWidth;
      const h = dom.rowEl.clientHeight;
      if (w <= 0 || h <= 0) continue;

      dom.waveCanvas.width = w;
      dom.waveCanvas.height = h;
      const actx = dom.waveCanvas.getContext('2d');
      if (!actx) continue;
      actx.clearRect(0, 0, w, h);

      const clip = trk.clip;
      if (!clip) {
        dom.emptyHintEl.style.display = 'flex';
        dom.clipBoxEl.style.display = 'none';
        continue;
      }

      dom.emptyHintEl.style.display = 'none';
      dom.clipBoxEl.style.display = 'block';

      const { buffer, peaks, name, timelineStartSec, trimStartSec, trimEndSec, muted, volume } = clip;
      const isMuted = muted || trk.muted;
      const effVol = isMuted ? 0 : Math.max(0, Math.min(1, typeof volume === 'number' ? volume : 1));
      const timelineDurSec = state.totalFrames / state.fps;
      const clipDur = trimEndSec - trimStartSec;

      const leftPct = (timelineStartSec / timelineDurSec) * 100;
      const widthPct = (clipDur / timelineDurSec) * 100;
      dom.clipBoxEl.style.left = `${leftPct}%`;
      dom.clipBoxEl.style.width = `${widthPct}%`;
      dom.clipBoxEl.style.opacity = isMuted || effVol === 0 ? '0.4' : '1';
      dom.clipBoxEl.classList.toggle('selected', state.selectedTrack === 'audio' && sc.activeAudioTrackId === trk.id);

      const startFrameNum = Math.round(timelineStartSec * state.fps) + 1;
      dom.clipLabelEl.textContent = `${name} (F${startFrameNum} • ${clipDur.toFixed(2)}s)`;

      const clipX0 = (timelineStartSec / timelineDurSec) * w;
      const clipX1 = ((timelineStartSec + clipDur) / timelineDurSec) * w;
      const drawStartX = Math.max(0, Math.floor(clipX0));
      const drawEndX = Math.min(w, Math.ceil(clipX1));

      actx.fillStyle = isMuted || effVol === 0 ? 'rgba(192, 132, 252, 0.35)' : '#c084fc';
      const midY = h / 2;
      const maxAmp = (h - 12) / 2;
      const volScale = isMuted ? 0.25 : 0.15 + 0.85 * effVol;

      for (let px = drawStartX; px < drawEndX; px++) {
        const tOnTimeline = (px / w) * timelineDurSec;
        const tInAudio = trimStartSec + (tOnTimeline - timelineStartSec);
        const norm = tInAudio / buffer.duration;
        const idx = Math.max(0, Math.min(peaks.length - 1, Math.floor(norm * peaks.length)));
        const amp = Math.max(1, peaks[idx] * maxAmp * volScale);
        actx.fillRect(px, Math.round(midY - amp), 1, Math.round(amp * 2));
      }
    }
  }

  function autoLipSyncAudioToMouth(targetTrackId?: string): void {
    const sc = activeScene();
    const trk = (targetTrackId && sc.audioTracks.find((t) => t.id === targetTrackId)) || state.activeAudioTrack;
    const clip = trk.clip;
    if (!clip) {
      onNotify('Load or record an audio clip first to run Auto Lip-Sync.');
      return;
    }
    const { buffer, timelineStartSec, trimStartSec, trimEndSec } = clip;
    const clipDur = Math.max(0, trimEndSec - trimStartSec);
    if (clipDur <= 0.01) return;

    const sr = buffer.sampleRate;
    const numCh = buffer.numberOfChannels;
    const ch0 = buffer.getChannelData(0);
    const ch1 = numCh > 1 ? buffer.getChannelData(1) : null;

    const startFrame = Math.max(0, Math.floor(timelineStartSec * state.fps));
    const endFrame = Math.min(state.totalFrames - 1, Math.ceil((timelineStartSec + clipDur) * state.fps));
    if (endFrame < startFrame) return;

    const stats: Array<{ frame: number; rms: number; zcr: number; lowRatio: number }> = [];
    const rmsValues: number[] = [];

    for (let f = startFrame; f <= endFrame; f++) {
      const fStartSec = f / state.fps;
      const fEndSec = (f + 1) / state.fps;
      const aStart = Math.max(trimStartSec, trimStartSec + (fStartSec - timelineStartSec));
      const aEnd = Math.min(trimEndSec, trimStartSec + (fEndSec - timelineStartSec));
      const s0 = Math.max(0, Math.floor(aStart * sr));
      const s1 = Math.min(ch0.length, Math.ceil(aEnd * sr));

      if (s1 <= s0) {
        stats.push({ frame: f, rms: 0, zcr: 0, lowRatio: 0.5 });
        rmsValues.push(0);
        continue;
      }

      let sumSq = 0;
      let zeroCross = 0;
      let prev = 0;
      let lp = 0;
      let lowSq = 0;
      let highSq = 0;
      const alpha = 0.16;

      for (let i = s0; i < s1; i++) {
        const v = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
        sumSq += v * v;
        if (i > s0 && ((v >= 0 && prev < 0) || (v < 0 && prev >= 0))) zeroCross++;
        prev = v;
        lp = lp + alpha * (v - lp);
        const hp = v - lp;
        lowSq += lp * lp;
        highSq += hp * hp;
      }

      const n = s1 - s0;
      const rms = Math.sqrt(sumSq / n);
      const zcr = zeroCross / Math.max(1, n - 1);
      const lowRatio = lowSq / Math.max(1e-9, lowSq + highSq);
      stats.push({ frame: f, rms, zcr, lowRatio });
      rmsValues.push(rms);
    }

    const sortedRms = [...rmsValues].sort((a, b) => a - b);
    const adaptivePeak = Math.max(0.03, sortedRms[Math.floor(sortedRms.length * 0.94)] || 0.1);
    const silenceThresh = Math.max(0.01, adaptivePeak * 0.14);

    const frameVisemes: number[] = [];
    let wasSilent = true;

    for (let i = 0; i < stats.length; i++) {
      const st = stats[i];
      const normVol = Math.min(1.2, st.rms / adaptivePeak);

      let vis = 0;
      if (st.rms < silenceThresh) {
        vis = 0;
        wasSilent = true;
      } else {
        if (wasSilent && i + 1 < stats.length && stats[i + 1].rms >= st.rms * 0.9 && normVol < 0.55) {
          vis = 1;
        } else if (st.zcr > 0.15 && st.lowRatio < 0.42 && normVol < 0.65) {
          vis = 6;
        } else if (normVol >= 0.72) {
          vis = st.lowRatio > 0.62 ? 2 : 3;
        } else if (normVol >= 0.44) {
          if (st.lowRatio > 0.72) vis = 4;
          else if (st.zcr > 0.085) vis = 7;
          else vis = 3;
        } else {
          vis = st.lowRatio > 0.68 ? 5 : 1;
        }
        wasSilent = false;
      }
      frameVisemes.push(vis);
    }

    if (!state.showMouthTrack) toggleMouthTrack(true);
    state.mouthLayer.visible = true;

    const baseMouth = getActiveMouthState();
    for (let f = startFrame; f <= endFrame; f++) {
      state.mouthLayer.keys.delete(f);
    }

    let prevEmitted = -1;
    let count = 0;
    for (let i = 0; i < stats.length; i++) {
      const vis = frameVisemes[i];
      if (i === 0 || vis !== prevEmitted) {
        state.mouthLayer.keys.set(stats[i].frame, {
          viseme: vis,
          x: baseMouth.x,
          y: baseMouth.y,
          scale: baseMouth.scale,
        });
        prevEmitted = vis;
        count++;
      }
    }

    selectTimelineTrack('mouth');
    updateMouthWidget();
    renderTimeline();
    renderStage();
    onNotify(`Auto lip-sync created ${count} Picker keyframes on ${state.mouthLayer.name}.`);
  }

  mustEl<HTMLButtonElement>('ctxAudioAutoLipSync').onclick = () => {
    const tid = contextAudioTrackId;
    hideMenus();
    autoLipSyncAudioToMouth(tid || undefined);
  };
  mustEl<HTMLButtonElement>('ctxAudioDelete').onclick = () => {
    if (contextAudioTrackId) deleteAudioOnTrack(contextAudioTrackId);
    else deleteActiveAudio();
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxAudioMute').onclick = () => {
    const sc = activeScene();
    const trk = (contextAudioTrackId && sc.audioTracks.find((t) => t.id === contextAudioTrackId)) || state.activeAudioTrack;
    if (trk.clip) {
      trk.clip.muted = !trk.clip.muted;
      trk.muted = trk.clip.muted;
      if (!trk.clip.muted && trk.clip.volume <= 0) {
        trk.clip.volume = 1;
        trk.volume = 1;
      }
    } else {
      trk.muted = !trk.muted;
    }
    updateAudioVolumeUI();
    if (trk.muted) stopAllAudioPlayback();
    else if (state.isPlaying) scheduleAudioAtFrame(state.currentFrame);
    renderAudioTrack();
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxAudioFit').onclick = () => {
    const sc = activeScene();
    const trk = (contextAudioTrackId && sc.audioTracks.find((t) => t.id === contextAudioTrackId)) || state.activeAudioTrack;
    if (trk.clip) {
      const neededEndSec = Math.max(
        1,
        trk.clip.timelineStartSec + (trk.clip.trimEndSec - trk.clip.trimStartSec)
      );
      state.totalFrames = Math.max(12, Math.ceil(neededEndSec * state.fps));
      renderTimeline();
    }
    hideMenus();
  };
  ctxAudioDeleteTrack.onclick = () => {
    const tid = contextAudioTrackId;
    hideMenus();
    if (tid) removeAudioTrack(tid);
  };

  function clearDropActiveHighlights(): void {
    stageContainer.classList.remove('drop-active');
    for (const dom of bgTrackDomMap.values()) dom.rowEl.classList.remove('drop-active');
    for (const dom of audioTrackDomMap.values()) dom.rowEl.classList.remove('drop-active');
  }

  function findDropBgLayerId(target: Node | null): string | null {
    if (!target) return null;
    for (const [id, dom] of bgTrackDomMap.entries()) {
      if (dom.rowEl.contains(target) || dom.labelEl.contains(target)) return id;
    }
    return null;
  }

  function findDropAudioTrackId(target: Node | null): string | null {
    if (!target) return null;
    for (const [id, dom] of audioTrackDomMap.entries()) {
      if (dom.rowEl.contains(target) || dom.labelEl.contains(target)) return id;
    }
    return null;
  }

  function findDropCelTrackId(target: Node | null): string | null {
    if (!target) return null;
    for (const [id, dom] of celTrackDomMap.entries()) {
      if (dom.rowEl.contains(target) || dom.labelEl.contains(target)) return id;
    }
    return null;
  }

  window.addEventListener(
    'dragover',
    (e) => {
      if (draggingSceneId) return;
      e.preventDefault();
      if (app.mode === 'scenes') return;
      const target = e.target as Node | null;
      clearDropActiveHighlights();
      const bgId = !isBasicMode() ? findDropBgLayerId(target) : null;
      const audId = findDropAudioTrackId(target);
      if (bgId) {
        bgTrackDomMap.get(bgId)?.rowEl.classList.add('drop-active');
      } else if (audId) {
        audioTrackDomMap.get(audId)?.rowEl.classList.add('drop-active');
      } else if (!isBasicMode()) {
        stageContainer.classList.add('drop-active');
      }
    },
    { signal }
  );

  window.addEventListener(
    'dragleave',
    (e) => {
      if (e.relatedTarget === null) {
        clearDropActiveHighlights();
      }
    },
    { signal }
  );

  window.addEventListener(
    'drop',
    (e) => {
      if (draggingSceneId) return;
      e.preventDefault();
      clearDropActiveHighlights();
      if (app.mode === 'scenes') return;

      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      const target = e.target as Node | null;

      if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) {
        const audId = findDropAudioTrackId(target);
        void loadAudioFile(file, audId || undefined);
        return;
      }

      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)) {
        if (isBasicMode()) {
          onNotify('Image/Bitmap layers are available in Pro mode.');
          return;
        }
        const bgId = findDropBgLayerId(target);
        const celId = findDropCelTrackId(target);
        if (bgId || (target && state.activeLayer === 'bg' && stageContainer.contains(target))) {
          loadImageFile(file, 'bg', state.currentFrame, bgId || undefined);
        } else if (celId) {
          const targetFrame = frameFromClientX(e.clientX);
          loadImageFile(file, 'cel', targetFrame, celId);
        } else {
          loadImageFile(file, 'cel', state.currentFrame);
        }
      }
    },
    { signal }
  );

  window.addEventListener(
    'resize',
    () => {
      if (app.mode !== 'scenes') renderAudioTrack();
      else renderScenesPreview();
    },
    { signal }
  );

  function applyTimelineZoom(newZoom: number, anchorClientX: number | null = null): void {
    state.timelineZoom = Math.max(1, Math.min(10, newZoom));
    const scrollRect = timelineScroll.getBoundingClientRect();

    let anchorRatio = 0;
    let pointerOffsetInScroll = 0;
    if (anchorClientX !== null && scrollRect.width > 0) {
      pointerOffsetInScroll = anchorClientX - scrollRect.left;
      const oldGridW = Math.max(1, timelineGrid.clientWidth);
      anchorRatio = (timelineScroll.scrollLeft + pointerOffsetInScroll) / oldGridW;
    }

    timelineGrid.style.width = `${state.timelineZoom * 100}%`;

    if (anchorClientX !== null) {
      const newGridW = timelineScroll.clientWidth * state.timelineZoom;
      timelineScroll.scrollLeft = Math.max(0, anchorRatio * newGridW - pointerOffsetInScroll);
    } else if (state.timelineZoom === 1) {
      timelineScroll.scrollLeft = 0;
    }

    if (state.timelineZoom > 1.01) {
      btnResetTimelineZoom.classList.remove('hidden-nest-ui');
      btnResetTimelineZoom.textContent = `Zoom: ${state.timelineZoom.toFixed(1)}x ✕`;
    } else {
      btnResetTimelineZoom.classList.add('hidden-nest-ui');
    }
    renderAudioTrack();
  }

  timelineScroll.addEventListener(
    'wheel',
    (e) => {
      if (isBasicMode()) return;
      e.preventDefault();
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        timelineScroll.scrollLeft += e.deltaX !== 0 ? e.deltaX : e.deltaY;
        return;
      }
      const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
      applyTimelineZoom(state.timelineZoom * factor, e.clientX);
    },
    { passive: false }
  );

  let tlPanStart: { x: number; left: number } | null = null;
  timelineScroll.addEventListener('mousedown', (e) => {
    if (e.button === 1) e.preventDefault();
  });
  timelineScroll.addEventListener('pointerdown', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      timelineScroll.setPointerCapture(e.pointerId);
      tlPanStart = { x: e.clientX, left: timelineScroll.scrollLeft };
    }
  });
  timelineScroll.addEventListener('pointermove', (e) => {
    if (!tlPanStart) return;
    timelineScroll.scrollLeft = tlPanStart.left - (e.clientX - tlPanStart.x);
  });
  timelineScroll.addEventListener('pointerup', (e) => {
    if (e.button === 1) tlPanStart = null;
  });

  btnResetTimelineZoom.onclick = () => applyTimelineZoom(1);

  function addFrameAndAdvance(): void {
    state.totalFrames += 1;
    renderNestBreadcrumbUI();
    renderTimeline();
    goToFrame(state.totalFrames - 1);
  }

  function removeLastFrameFromTimeline(): void {
    if (state.totalFrames <= 1) return;
    const newTotal = state.totalFrames - 1;
    const target = activeTimelineTarget();
    for (const trk of target.celTracks) {
      for (const [start, cel] of Array.from(trk.cels.entries())) {
        if (start >= newTotal) trk.cels.delete(start);
        else if (start + cel.duration > newTotal) cel.duration = newTotal - start;
      }
    }
    for (const trk of target.vectorTracks) {
      for (const [start, vCel] of Array.from(trk.cels.entries())) {
        if (start >= newTotal) trk.cels.delete(start);
        else if (start + vCel.duration > newTotal) vCel.duration = newTotal - start;
      }
    }
    if (state.loopRange) {
      if (state.loopRange.start >= newTotal) {
        state.loopRange = null;
      } else {
        state.loopRange = {
          start: state.loopRange.start,
          end: Math.min(state.loopRange.end, newTotal - 1),
        };
      }
    }
    state.totalFrames = newTotal;
    if (state.currentFrame >= newTotal) state.currentFrame = newTotal - 1;
    renderNestBreadcrumbUI();
    syncInspectorUI();
    renderTimeline();
    renderStage();
  }

  mustEl<HTMLButtonElement>('btnAddFrame').onclick = addFrameAndAdvance;
  btnRemoveFrame.onclick = removeLastFrameFromTimeline;

  function ensurePlayheadVisibleInTimeline(): void {
    if (state.timelineZoom <= 1.01) return;
    const gridW = timelineGrid.clientWidth;
    const viewW = timelineScroll.clientWidth;
    const frameX = ((state.currentFrame + 0.5) / state.totalFrames) * gridW;
    if (frameX < timelineScroll.scrollLeft + 24) {
      timelineScroll.scrollLeft = Math.max(0, frameX - 24);
    } else if (frameX > timelineScroll.scrollLeft + viewW - 24) {
      timelineScroll.scrollLeft = frameX - viewW + 24;
    }
  }

  function renderTimeline(): void {
    syncLayerTrackContainers();
    syncAudioTrackContainers();
    updateActiveTrackHighlight();

    rulerRow.innerHTML = '';
    camTrackRow.innerHTML = '';

    const target = activeTimelineTarget();
    const isScene = 'mouthLayers' in target;
    const celTracks = target.celTracks;
    const vecTracks = target.vectorTracks;
    const mouthLayers = isScene ? target.mouthLayers : [];

    for (const trk of celTracks) {
      const dom = celTrackDomMap.get(trk.id);
      if (dom) dom.rowEl.innerHTML = '';
    }
    for (const trk of vecTracks) {
      const dom = vectorTrackDomMap.get(trk.id);
      if (dom) dom.rowEl.innerHTML = '';
    }
    for (const ml of mouthLayers) {
      const dom = mouthTrackDomMap.get(ml.id);
      if (dom) dom.rowEl.innerHTML = '';
    }

    const sortedCamKeys = Array.from(state.cameraKeys.keys()).sort((a, b) => a - b);
    const firstCam = sortedCamKeys[0];
    const lastCam = sortedCamKeys[sortedCamKeys.length - 1];
    const effectiveColsPerScreen = state.totalFrames / state.timelineZoom;
    const labelStep = effectiveColsPerScreen > 48 ? 5 : effectiveColsPerScreen > 30 ? 2 : 1;

    for (let f = 0; f < state.totalFrames; f++) {
      const isCurr = f === state.currentFrame;
      const rCell = document.createElement('div');
      rCell.className = 'ruler-cell' + (isCurr ? ' active' : '');
      if (f === 0 || (f + 1) % labelStep === 0 || isCurr) {
        rCell.textContent = String(f + 1);
      }
      rulerRow.appendChild(rCell);

      for (const ml of mouthLayers) {
        const dom = mouthTrackDomMap.get(ml.id);
        if (dom) {
          const mCell = document.createElement('div');
          mCell.className = 'frame-cell' + (isCurr ? ' current-col' : '');
          dom.rowEl.appendChild(mCell);
        }
      }

      for (const trk of vecTracks) {
        const dom = vectorTrackDomMap.get(trk.id);
        if (dom) {
          const vCell = document.createElement('div');
          vCell.className = 'frame-cell' + (isCurr ? ' current-col' : '');
          dom.rowEl.appendChild(vCell);
        }
      }

      for (const trk of celTracks) {
        const dom = celTrackDomMap.get(trk.id);
        if (dom) {
          const cCell = document.createElement('div');
          cCell.className = 'frame-cell' + (isCurr ? ' current-col' : '');
          dom.rowEl.appendChild(cCell);
        }
      }

      const camCell = document.createElement('div');
      camCell.className = 'frame-cell' + (isCurr ? ' current-col' : '');
      if (sortedCamKeys.length >= 2 && f >= firstCam && f <= lastCam) {
        const bar = document.createElement('div');
        bar.className = 'cam-bar';
        if (f === firstCam) bar.style.left = '50%';
        if (f === lastCam) bar.style.right = '50%';
        camCell.appendChild(bar);
      }
      if (state.cameraKeys.has(f)) {
        const diamond = document.createElement('div');
        diamond.className = 'cam-diamond';
        camCell.appendChild(diamond);
      }
      camTrackRow.appendChild(camCell);
    }

    for (const ml of mouthLayers) {
      const dom = mouthTrackDomMap.get(ml.id);
      if (!dom) continue;
      for (const [f, mk] of ml.keys.entries()) {
        if (f >= state.totalFrames) continue;
        const pill = document.createElement('div');
        pill.className = 'mouth-key-pill';
        pill.style.left = `calc(${(f / state.totalFrames) * 100}% + 1px)`;
        pill.style.width = `calc(${(1 / state.totalFrames) * 100}% - 2px)`;
        pill.textContent = ml.visemes[mk.viseme]?.name || VISEME_NAMES[mk.viseme] || 'P';
        dom.rowEl.appendChild(pill);
      }
    }

    const rootSc = activeScene();
    for (const trk of vecTracks) {
      const dom = vectorTrackDomMap.get(trk.id);
      if (!dom) continue;
      for (const [start, vCel] of trk.cels.entries()) {
        if (start >= state.totalFrames) continue;
        const visibleDur = Math.min(vCel.duration, state.totalFrames - start);
        const basic = isBasicMode();
        const isNested = !basic && Boolean(vCel.nestId);
        const nestClip = isNested && vCel.nestId ? rootSc.nestedClips.get(vCel.nestId) : null;
        const tweenKeys = !basic ? getActivePosKeys(vCel) : [];
        const hasTween = !basic && tweenKeys.length >= 2;
        const spanBar = document.createElement('div');
        spanBar.className = 'vector-span-bar' + (isNested ? ' is-nested' : '') + (hasTween ? ' has-tween' : '');
        spanBar.style.left = `calc(${(start / state.totalFrames) * 100}% + 2px)`;
        spanBar.style.width = `calc(${(visibleDur / state.totalFrames) * 100}% - 4px)`;
        spanBar.title =
          isNested && nestClip
            ? `${nestClip.name} (${nestClip.totalFrames}f loop • Hold: ${vCel.duration}f) — Double-click or Right-click to open nest`
            : hasTween
              ? `${trk.name} Frame ${start + 1} (Hold: ${vCel.duration}f • ${tweenKeys.length} motion keys) — Drag to stretch, Right-click for options`
              : `${trk.name} Frame ${start + 1} (Hold: ${vCel.duration}f) — Drag to stretch, Right-click for options`;

        const dot = document.createElement('div');
        dot.className = 'vector-span-dot' + (isVectorCelInkFilled(rootSc, vCel) ? '' : ' blank');
        spanBar.appendChild(dot);

        if (hasTween) {
          for (const tk of tweenKeys) {
            if (tk.relFrame >= visibleDur) continue;
            const kDot = document.createElement('div');
            const absF = start + tk.relFrame;
            const isCurrKey = absF === state.currentFrame;
            kDot.className = 'cel-tween-key-dot' + (isCurrKey ? ' current' : '');
            kDot.dataset.absFrame = String(absF);
            kDot.style.left = `${((tk.relFrame + 0.5) / visibleDur) * 100}%`;
            kDot.title = `Motion Key F${absF + 1}`;
            spanBar.appendChild(kDot);
          }
        }

        if (isNested && nestClip) {
          const nestPill = document.createElement('span');
          nestPill.className = 'nest-span-pill';
          nestPill.textContent = `⟲ ${nestClip.totalFrames}f`;
          spanBar.appendChild(nestPill);
        }

        const grip = document.createElement('div');
        grip.className = 'vector-span-grip';
        spanBar.appendChild(grip);

        dom.rowEl.appendChild(spanBar);
      }
    }

    for (const trk of celTracks) {
      const dom = celTrackDomMap.get(trk.id);
      if (!dom) continue;
      for (const [start, cel] of trk.cels.entries()) {
        if (start >= state.totalFrames) continue;
        const visibleDur = Math.min(cel.duration, state.totalFrames - start);
        const isNested = Boolean(cel.nestId);
        const nestClip = isNested && cel.nestId ? rootSc.nestedClips.get(cel.nestId) : null;
        const tweenKeys = getActivePosKeys(cel);
        const hasTween = tweenKeys.length >= 2;
        const spanBar = document.createElement('div');
        spanBar.className = 'cel-span-bar' + (isNested ? ' is-nested' : '') + (hasTween ? ' has-tween' : '');
        spanBar.style.left = `calc(${(start / state.totalFrames) * 100}% + 2px)`;
        spanBar.style.width = `calc(${(visibleDur / state.totalFrames) * 100}% - 4px)`;
        spanBar.title =
          isNested && nestClip
            ? `${nestClip.name} (${nestClip.totalFrames}f loop • Hold: ${cel.duration}f) — Double-click or Right-click to open nest`
            : hasTween
              ? `${trk.name} Frame ${start + 1} (Hold: ${cel.duration}f • ${tweenKeys.length} motion keys) — Drag to stretch, Right-click for options`
              : `${trk.name} Frame ${start + 1} (Hold: ${cel.duration}f) — Drag to stretch, Right-click for options`;

        const dot = document.createElement('div');
        dot.className = 'cel-span-dot' + (isCelInkFilled(rootSc, cel) ? '' : ' blank');
        spanBar.appendChild(dot);

        if (hasTween) {
          for (const tk of tweenKeys) {
            if (tk.relFrame >= visibleDur) continue;
            const kDot = document.createElement('div');
            const absF = start + tk.relFrame;
            const isCurrKey = absF === state.currentFrame;
            kDot.className = 'cel-tween-key-dot' + (isCurrKey ? ' current' : '');
            kDot.dataset.absFrame = String(absF);
            kDot.style.left = `${((tk.relFrame + 0.5) / visibleDur) * 100}%`;
            kDot.title = `Motion Key F${absF + 1}`;
            spanBar.appendChild(kDot);
          }
        }

        if (isNested && nestClip) {
          const nestPill = document.createElement('span');
          nestPill.className = 'nest-span-pill';
          nestPill.textContent = `⟲ ${nestClip.totalFrames}f`;
          spanBar.appendChild(nestPill);
        }

        const grip = document.createElement('div');
        grip.className = 'cel-span-grip';
        spanBar.appendChild(grip);

        dom.rowEl.appendChild(spanBar);
      }
    }

    updateLoopRangeUI();
    updatePlayheadUI();
    renderAudioTrack();
  }

  function updatePlayheadUI(): void {
    const rCells = rulerRow.children;
    const kCells = camTrackRow.children;
    const effectiveColsPerScreen = state.totalFrames / state.timelineZoom;
    const labelStep = effectiveColsPerScreen > 48 ? 5 : effectiveColsPerScreen > 30 ? 2 : 1;

    for (let f = 0; f < state.totalFrames; f++) {
      const isCurr = f === state.currentFrame;
      const rCell = rCells[f] as HTMLElement | undefined;
      if (rCell) {
        rCell.classList.toggle('active', isCurr);
        rCell.textContent = f === 0 || (f + 1) % labelStep === 0 || isCurr ? String(f + 1) : '';
      }
      for (const dom of mouthTrackDomMap.values()) {
        const mCell = dom.rowEl.children[f] as HTMLElement | undefined;
        if (mCell && mCell.classList.contains('frame-cell')) {
          mCell.classList.toggle('current-col', isCurr);
        }
      }
      for (const dom of vectorTrackDomMap.values()) {
        const vCell = dom.rowEl.children[f] as HTMLElement | undefined;
        if (vCell && vCell.classList.contains('frame-cell')) {
          vCell.classList.toggle('current-col', isCurr);
        }
      }
      for (const dom of celTrackDomMap.values()) {
        const cCell = dom.rowEl.children[f] as HTMLElement | undefined;
        if (cCell && cCell.classList.contains('frame-cell')) {
          cCell.classList.toggle('current-col', isCurr);
        }
      }
      const kCell = kCells[f] as HTMLElement | undefined;
      if (kCell) kCell.classList.toggle('current-col', isCurr);
    }

    layerRowsContainer.querySelectorAll<HTMLElement>('.cel-tween-key-dot').forEach((kd) => {
      kd.classList.toggle('current', Number(kd.dataset.absFrame) === state.currentFrame);
    });

    playheadLine.style.left = `${((state.currentFrame + 0.5) / state.totalFrames) * 100}%`;
    frameIndicator.textContent = `F ${state.currentFrame + 1} / ${state.totalFrames}`;
    updateStageBadge();
    ensurePlayheadVisibleInTimeline();
  }

  function updateLoopRangeUI(): void {
    if (!state.loopRange) {
      loopSelectionBar.style.display = 'none';
      loopHighlightOverlay.style.display = 'none';
      loopRangeBadge.textContent = 'Loop: All';
      return;
    }
    const { start, end } = state.loopRange;
    const leftPct = (start / state.totalFrames) * 100;
    const widthPct = ((end - start + 1) / state.totalFrames) * 100;

    loopSelectionBar.style.display = 'block';
    loopSelectionBar.style.left = `${leftPct}%`;
    loopSelectionBar.style.width = `${widthPct}%`;

    loopHighlightOverlay.style.display = 'block';
    loopHighlightOverlay.style.left = `${leftPct}%`;
    loopHighlightOverlay.style.width = `${widthPct}%`;

    loopRangeBadge.textContent = `Loop: F ${start + 1}–${end + 1}`;
  }

  function updateStageBadge(): void {
    const cam = getEvaluatedCamera(state.currentFrame);
    let toolLabel = state.tool.toUpperCase();
    if (state.tool === 'moveCam') {
      const gz = getActiveLayerGizmoInfo(activeScene(), state.currentFrame, 1);
      const deg = gz ? Math.round((gz.rotation * 180) / Math.PI) : 0;
      const scPct = gz ? Math.round(gz.scale * 100) : 100;
      if (moveCamState?.mode === 'rotateLayer' && gz) {
        toolLabel = `ROTATE (${deg}°)`;
      } else if (moveCamState?.mode === 'scaleLayer' && gz) {
        toolLabel = `SCALE (${scPct}%)`;
      } else if (moveCamState?.mode === 'moveIK') {
        toolLabel = 'IK POSE';
      } else if (gz && (Math.abs(gz.rotation) > 0.005 || Math.abs(gz.scale - 1) > 0.005)) {
        const parts: string[] = [];
        if (Math.abs(gz.rotation) > 0.005) parts.push(`${deg}°`);
        if (Math.abs(gz.scale - 1) > 0.005) parts.push(`${scPct}%`);
        toolLabel = `MOVE / CAM (${parts.join(' ')})`;
      } else {
        toolLabel = 'MOVE / CAM';
      }
    } else if (state.tool === 'vectorEdit') toolLabel = vectorPointMode === 'corner' ? 'EDIT (CORNERS)' : 'EDIT (CURVES)';
    else if (state.tool === 'nudge') toolLabel = `NUDGE (${state.nudgeRadius}px)`;
    else if (state.tool === 'brush' || state.tool === 'eraser') toolLabel = `${toolLabel} (${state.brushSize}px)`;

    const viewPct = Math.round(state.viewZoom * 100);
    const target = activeTimelineTarget();
    let layerTag = '';
    if (state.activeLayer === 'vector') {
      const vName = state.activeVectorTrack.name.toUpperCase();
      layerTag = state.vectorPixelPreview ? ` | [${vName} • PIXEL]` : ` | [${vName}]`;
    } else if (state.activeLayer === 'bg') {
      layerTag = ` | [${getLayerDisplayName(target, 'bg').toUpperCase()}]`;
    } else if (state.activeLayer === 'mouth') {
      const m = getActiveMouthState();
      layerTag = ` | [${getLayerDisplayName(target, 'mouth').toUpperCase()} ${Math.round(m.scale || 100)}%]`;
    } else {
      const cName = getLayerDisplayName(target, 'cel');
      layerTag = ` | [${cName.toUpperCase()}]`;
    }

    const camTxt = nestStack.length === 0 && cam.scale !== 100 ? ` | Cam ${Math.round(cam.scale)}%` : '';
    const openNest = activeNestedClip();
    const nestTxt = openNest ? ` | [NEST: ${openNest.name} • ${openNest.totalFrames}f]` : '';
    stageBadge.textContent = `${toolLabel}${layerTag}${nestTxt} | F${state.currentFrame + 1} | ${WORLD_W}×${WORLD_H} | View ${viewPct}%${camTxt}`;
  }

  function frameFromClientX(clientX: number): number {
    const rect = timelineGrid.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.99999, (clientX - rect.left) / rect.width));
    return Math.floor(ratio * state.totalFrames);
  }

  let loopDragAnchor: number | null = null;

  loopRow.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    loopDragAnchor = frameFromClientX(e.clientX);
    state.loopRange = { start: loopDragAnchor, end: loopDragAnchor };
    loopRow.setPointerCapture(e.pointerId);
    updateLoopRangeUI();
  });

  loopRow.addEventListener('pointermove', (e) => {
    if (loopDragAnchor === null) return;
    const curr = frameFromClientX(e.clientX);
    state.loopRange = {
      start: Math.min(loopDragAnchor, curr),
      end: Math.max(loopDragAnchor, curr),
    };
    updateLoopRangeUI();
  });

  loopRow.addEventListener('pointerup', () => {
    loopDragAnchor = null;
  });
  loopRow.addEventListener('dblclick', () => {
    state.loopRange = null;
    updateLoopRangeUI();
  });

  mustEl<HTMLButtonElement>('btnClearLoopRange').onclick = () => {
    state.loopRange = null;
    updateLoopRangeUI();
  };

  let isScrubbing = false;
  let rulerLoopAnchor: number | null = null;

  rulerRow.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (state.isPlaying) togglePlay();
    rulerRow.setPointerCapture(e.pointerId);
    const f = frameFromClientX(e.clientX);
    if (e.shiftKey) {
      rulerLoopAnchor = f;
      state.loopRange = { start: f, end: f };
      updateLoopRangeUI();
    } else {
      isScrubbing = true;
      goToFrame(f);
      playAudioScrubGrain(f);
    }
  });

  rulerRow.addEventListener('pointermove', (e) => {
    const f = frameFromClientX(e.clientX);
    if (rulerLoopAnchor !== null) {
      state.loopRange = {
        start: Math.min(rulerLoopAnchor, f),
        end: Math.max(rulerLoopAnchor, f),
      };
      updateLoopRangeUI();
    } else if (isScrubbing && f !== state.currentFrame) {
      goToFrame(f);
      playAudioScrubGrain(f);
    }
  });

  rulerRow.addEventListener('pointerup', () => {
    isScrubbing = false;
    rulerLoopAnchor = null;
  });
  rulerRow.addEventListener('pointercancel', () => {
    isScrubbing = false;
    rulerLoopAnchor = null;
  });
  rulerRow.addEventListener('contextmenu', (e) => {
    if (!state.showCamTrack) return;
    handleCamTimelineContextMenu(e);
  });

  function renderNestBreadcrumbUI(): void {
    const inNest = nestStack.length > 0;
    nestBreadcrumbBar.classList.toggle('open', inNest);
    btnRemoveFrame.classList.toggle('hidden-nest-ui', !inNest);

    btnModeBasic.disabled = inNest;
    btnModePro.disabled = inNest;
    btnModeScenes.disabled = inNest;
    btnAddMouthTrack.disabled = inNest;
    btnAddBgTrack.disabled = inNest;
    btnAddAudioTrack.disabled = inNest;
    btnToggleAudioTrack.disabled = inNest;
    btnAddMouthTrack.classList.toggle('hidden-nest-ui', isBasicMode() || inNest);
    btnAddBgTrack.classList.toggle('hidden-nest-ui', isBasicMode() || inNest);
    btnAddAudioTrack.classList.toggle('hidden-nest-ui', isBasicMode() || inNest);
    btnAddCamTrack.classList.toggle('hidden-nest-ui', isBasicMode() || inNest);
    syncAddCamBtnUI();

    if (!inNest) {
      nestBreadcrumbs.innerHTML = '';
      return;
    }

    const sc = activeScene();
    nestBreadcrumbs.innerHTML = '';

    const rootBtn = document.createElement('button');
    rootBtn.type = 'button';
    rootBtn.className = 'nest-crumb-btn';
    rootBtn.textContent = sc.name;
    rootBtn.title = `Return to ${sc.name}`;
    rootBtn.onclick = () => exitNestLevel(0);
    nestBreadcrumbs.appendChild(rootBtn);

    nestStack.forEach((lvl, idx) => {
      const sep = document.createElement('span');
      sep.textContent = '›';
      sep.style.opacity = '0.55';
      nestBreadcrumbs.appendChild(sep);

      const clip = sc.nestedClips.get(lvl.clipId);
      const label = clip ? `${clip.name} (${clip.totalFrames}f)` : 'Nest';
      if (idx === nestStack.length - 1) {
        const curSpan = document.createElement('span');
        curSpan.className = 'nest-crumb-current';
        curSpan.textContent = label;
        nestBreadcrumbs.appendChild(curSpan);
      } else {
        const lvlBtn = document.createElement('button');
        lvlBtn.type = 'button';
        lvlBtn.className = 'nest-crumb-btn';
        lvlBtn.textContent = label;
        lvlBtn.onclick = () => exitNestLevel(idx + 1);
        nestBreadcrumbs.appendChild(lvlBtn);
      }
    });
  }

  function restoreSavedTracks(saved: NestBreadcrumbEntry['savedTracks']): void {
    if (!saved) return;
    toggleVectorTrack(saved.showVectorTrack);
    toggleBgTrack(saved.showBgTrack);
    toggleMouthTrack(saved.showMouthTrack);
    toggleAudioTrack(saved.showAudioTrack);
    toggleCamTrack(saved.showCamTrack);
  }

  function openNestedAnimationAt(layer: 'cel' | 'vector', frame: number, trackId?: string): void {
    if (isBasicMode()) return;
    if (state.isPlaying) togglePlay();
    hideMenus();
    toggleCameraPanel(false);
    mouthSheetPop.classList.remove('open');

    const sc = activeScene();
    const target = activeTimelineTarget();
    if (layer === 'vector' && trackId) {
      if (target.vectorTracks.some((t) => t.id === trackId)) {
        target.activeVectorTrackId = trackId;
      }
    } else if (layer === 'cel' && trackId) {
      if (target.celTracks.some((t) => t.id === trackId)) {
        target.activeCelTrackId = trackId;
      }
    }
    const returnCelTrackId = layer === 'cel' ? target.activeCelTrackId : undefined;
    const returnVectorTrackId = layer === 'vector' ? target.activeVectorTrackId : undefined;
    const savedTracks =
      nestStack.length === 0
        ? {
            showVectorTrack: state.showVectorTrack,
            showBgTrack: state.showBgTrack,
            showMouthTrack: state.showMouthTrack,
            showAudioTrack: state.showAudioTrack,
            showCamTrack: state.showCamTrack,
          }
        : null;

    let clip: NestedClip | undefined;
    let clipId = '';

    if (layer === 'vector') {
      const existing = getVectorCelEntryAt(frame);
      if (existing?.cel.nestId && sc.nestedClips.has(existing.cel.nestId)) {
        clipId = existing.cel.nestId;
        clip = sc.nestedClips.get(clipId)!;
      } else {
        clipId = 'nest_' + Math.random().toString(36).slice(2, 10);
        const firstCelTrk = createCelTrack('Bitmap 1', false);
        const firstVecTrk = createVectorTrack('Vector 1', false);
        clip = {
          id: clipId,
          name: `Nest ${sc.nestedClips.size + 1}`,
          sourceLayer: 'vector',
          totalFrames: 1,
          currentFrame: 0,
          loopRange: null,
          celTracks: [firstCelTrk],
          activeCelTrackId: firstCelTrk.id,
          vectorTracks: [firstVecTrk],
          activeVectorTrackId: firstVecTrk.id,
          layerOrder: [`vector:${firstVecTrk.id}`, `cel:${firstCelTrk.id}`],
          layerParents: {},
        };
        sc.nestedClips.set(clipId, clip);

        if (existing) {
          const innerItems = cloneVectorItems(existing.cel.items);
          const innerHasInk = existing.cel.hasInk || innerItems.length > 0;
          firstVecTrk.cels.set(0, {
            items: innerItems,
            undoStack: [],
            hasInk: innerHasInk,
            duration: 1,
            offsetX: 0,
            offsetY: 0,
          });
          existing.cel.items = [];
          existing.cel.undoStack = [];
          existing.cel.hasInk = false;
          existing.cel.nestId = clipId;
          existing.cel.nestOriginFrame = existing.start;
        } else {
          firstVecTrk.cels.set(0, {
            items: [],
            undoStack: [],
            hasInk: false,
            duration: 1,
            offsetX: 0,
            offsetY: 0,
          });
          state.vectorCels.set(frame, {
            items: [],
            undoStack: [],
            hasInk: false,
            duration: 1,
            offsetX: 0,
            offsetY: 0,
            nestId: clipId,
            nestOriginFrame: frame,
          });
        }
      }
    } else {
      const existing = getCelEntryAt(frame);
      if (existing?.cel.nestId && sc.nestedClips.has(existing.cel.nestId)) {
        clipId = existing.cel.nestId;
        clip = sc.nestedClips.get(clipId)!;
      } else {
        clipId = 'nest_' + Math.random().toString(36).slice(2, 10);
        const firstCelTrk = createCelTrack('Bitmap 1', false);
        const firstVecTrk = createVectorTrack('Vector 1', false);
        clip = {
          id: clipId,
          name: `Nest ${sc.nestedClips.size + 1}`,
          sourceLayer: 'cel',
          totalFrames: 1,
          currentFrame: 0,
          loopRange: null,
          celTracks: [firstCelTrk],
          activeCelTrackId: firstCelTrk.id,
          vectorTracks: [firstVecTrk],
          activeVectorTrackId: firstVecTrk.id,
          layerOrder: [`vector:${firstVecTrk.id}`, `cel:${firstCelTrk.id}`],
          layerParents: {},
        };
        sc.nestedClips.set(clipId, clip);

        if (existing) {
          const innerCanvas = createCelCanvas(existing.cel.canvas.width, existing.cel.canvas.height);
          innerCanvas.getContext('2d')?.drawImage(existing.cel.canvas, 0, 0);
          firstCelTrk.cels.set(0, {
            canvas: innerCanvas,
            undoStack: [],
            hasInk: existing.cel.hasInk,
            duration: 1,
            offsetX: 0,
            offsetY: 0,
          });
          existing.cel.canvas.getContext('2d')?.clearRect(0, 0, existing.cel.canvas.width, existing.cel.canvas.height);
          existing.cel.undoStack = [];
          existing.cel.hasInk = false;
          existing.cel.nestId = clipId;
          existing.cel.nestOriginFrame = existing.start;
        } else {
          firstCelTrk.cels.set(0, {
            canvas: createCelCanvas(),
            undoStack: [],
            hasInk: false,
            duration: 1,
            offsetX: 0,
            offsetY: 0,
          });
          state.cels.set(frame, {
            canvas: createCelCanvas(),
            undoStack: [],
            hasInk: false,
            duration: 1,
            offsetX: 0,
            offsetY: 0,
            nestId: clipId,
            nestOriginFrame: frame,
          });
        }
      }
    }

    nestStack.push({
      clipId,
      returnFrame: frame,
      returnLayer: layer,
      returnCelTrackId,
      returnVectorTrackId,
      savedTracks,
    });

    toggleMouthTrack(false);
    toggleBgTrack(false);
    toggleAudioTrack(false);
    toggleCamTrack(false);
    toggleVectorTrack(layer === 'vector' || clip.vectorTracks.some((t) => t.cels.size > 0));
    selectTimelineTrack(layer);

    clip.currentFrame = Math.max(0, Math.min(clip.totalFrames - 1, clip.currentFrame));
    renderNestBreadcrumbUI();
    syncInspectorUI();
    renderTimeline();
    goToFrame(clip.currentFrame);
    onNotify(`Opened ${clip.name} (${clip.totalFrames}f loop) — add frames to animate, then double-click a frame or click Exit Nest.`);
  }

  function exitNestLevel(toDepth = nestStack.length - 1): void {
    if (nestStack.length === 0 || toDepth >= nestStack.length) return;
    if (state.isPlaying) togglePlay();
    hideMenus();

    const targetDepth = Math.max(0, toDepth);
    const removed = nestStack.splice(targetDepth);
    const popped = removed[0];
    celAnchorCache = new WeakMap();

    if (nestStack.length === 0 && popped?.savedTracks) {
      restoreSavedTracks(popped.savedTracks);
    } else if (nestStack.length > 0) {
      const parentClip = activeNestedClip();
      toggleVectorTrack(
        Boolean(parentClip && (parentClip.vectorTracks.some((t) => t.cels.size > 0) || popped?.returnLayer === 'vector'))
      );
    }

    if (popped) {
      const target = activeTimelineTarget();
      if (popped.returnCelTrackId && target.celTracks.some((t) => t.id === popped.returnCelTrackId)) {
        target.activeCelTrackId = popped.returnCelTrackId;
      }
      if (popped.returnVectorTrackId && target.vectorTracks.some((t) => t.id === popped.returnVectorTrackId)) {
        target.activeVectorTrackId = popped.returnVectorTrackId;
      }
      selectTimelineTrack(popped.returnLayer);
    }
    renderNestBreadcrumbUI();
    syncInspectorUI();
    renderTimeline();
    goToFrame(popped ? popped.returnFrame : 0);
  }

  function exitAllNests(syncUI = true): void {
    if (nestStack.length === 0) {
      if (syncUI) renderNestBreadcrumbUI();
      return;
    }
    if (state.isPlaying) togglePlay();
    const rootEntry = nestStack[0];
    nestStack = [];
    celAnchorCache = new WeakMap();
    if (rootEntry?.savedTracks) {
      restoreSavedTracks(rootEntry.savedTracks);
    }
    renderNestBreadcrumbUI();
    if (syncUI) {
      const target = activeTimelineTarget();
      if (rootEntry.returnCelTrackId && target.celTracks.some((t) => t.id === rootEntry.returnCelTrackId)) {
        target.activeCelTrackId = rootEntry.returnCelTrackId;
      }
      if (rootEntry.returnVectorTrackId && target.vectorTracks.some((t) => t.id === rootEntry.returnVectorTrackId)) {
        target.activeVectorTrackId = rootEntry.returnVectorTrackId;
      }
      selectTimelineTrack(rootEntry.returnLayer);
      syncInspectorUI();
      renderTimeline();
      goToFrame(rootEntry.returnFrame);
    }
  }

  function unnestFrameAt(layer: 'cel' | 'vector', frame: number): void {
    if (isBasicMode()) return;
    const rootSc = activeScene();
    if (layer === 'vector') {
      const entry = getVectorCelEntryAt(frame);
      if (!entry || !entry.cel.nestId) return;
      const clip = rootSc.nestedClips.get(entry.cel.nestId);
      if (!clip) {
        delete entry.cel.nestId;
        delete entry.cel.nestOriginFrame;
        renderTimeline();
        renderStage();
        return;
      }
      const clipFrame = getClipLoopFrame(clip, frame, entry.cel.nestOriginFrame ?? 0);
      const hasSubCelInk = clip.celTracks.some((cTrk) => {
        const subCel = getCelEntryInMap(cTrk.cels, clipFrame);
        return Boolean(subCel && (subCel.cel.hasInk || subCel.cel.nestId));
      });
      const hasSubVectorNest = clip.vectorTracks.some((t) => Boolean(getVectorCelEntryInMap(t.cels, clipFrame)?.cel.nestId));
      if (hasSubCelInk || hasSubVectorNest) {
        onNotify('Cannot unnest nested bitmap or sub-nest directly into a vector frame.');
        return;
      }
      pushVectorItemsUndo(entry.cel);
      const mergedItems: VectorItem[] = [];
      for (let ti = clip.vectorTracks.length - 1; ti >= 0; ti--) {
        const subTrk = clip.vectorTracks[ti];
        if (!subTrk.visible) continue;
        const subVCel = getVectorCelEntryInMap(subTrk.cels, clipFrame);
        if (!subVCel) continue;
        const off = getCelOffsetAtFrame(subVCel.cel, subVCel.start, clipFrame);
        const sx = off.offsetX;
        const sy = off.offsetY;
        const rot = subVCel.cel.rotation || 0;
        const subSc = subVCel.cel.scale ?? 1;
        const piv = rot || subSc !== 1 ? getLayerPivotLocal(rootSc, 'vector', subVCel.cel) : { ox: 0, oy: 0 };
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        const xform = (p: Point2D) => {
          if (!rot && subSc === 1) {
            p.x += sx;
            p.y += sy;
          } else {
            const dx = (p.x - piv.ox) * subSc;
            const dy = (p.y - piv.oy) * subSc;
            p.x = sx + piv.ox + dx * c - dy * s;
            p.y = sy + piv.oy + dx * s + dy * c;
          }
        };
        const cloned = cloneVectorItems(subVCel.cel.items);
        for (const item of cloned) {
          if (item.kind === 'fill') {
            for (const loop of item.contours) {
              for (const p of loop) xform(p);
            }
          } else {
            for (const p of item.points) xform(p);
          }
          mergedItems.push(item);
        }
      }
      entry.cel.items = mergedItems;
      entry.cel.hasInk = mergedItems.length > 0;
      delete entry.cel.nestId;
      delete entry.cel.nestOriginFrame;
    } else {
      const entry = getCelEntryAt(frame);
      if (!entry || !entry.cel.nestId) return;
      pushPixelUndo(entry.cel);
      const snap = rasterizeNestedClipToWorldCanvas(
        rootSc,
        entry.cel.nestId,
        frame,
        entry.cel.nestOriginFrame ?? 0
      );
      const nextCanvas = createCelCanvas(WORLD_W, WORLD_H);
      nextCanvas.getContext('2d')?.drawImage(snap, 0, 0);
      entry.cel.canvas = nextCanvas;
      entry.cel.hasInk = doesClipHaveInk(rootSc, entry.cel.nestId);
      delete entry.cel.nestId;
      delete entry.cel.nestOriginFrame;
    }
    renderTimeline();
    renderStage();
  }

  btnExitNest.onclick = () => exitNestLevel();

  function hideMenus(): void {
    celContextMenu.style.display = 'none';
    mouthContextMenu.style.display = 'none';
    audioContextMenu.style.display = 'none';
    camContextMenu.style.display = 'none';
    layerContextMenu.style.display = 'none';
    exportMenu.classList.remove('open');
    sizeMenu.classList.remove('open');
  }

  window.addEventListener(
    'pointerdown',
    (e) => {
      const target = e.target as Node | null;
      if (target && !celContextMenu.contains(target)) celContextMenu.style.display = 'none';
      if (target && !mouthContextMenu.contains(target)) mouthContextMenu.style.display = 'none';
      if (target && !audioContextMenu.contains(target)) audioContextMenu.style.display = 'none';
      if (target && !camContextMenu.contains(target)) camContextMenu.style.display = 'none';
      if (target && !layerContextMenu.contains(target)) layerContextMenu.style.display = 'none';
      if (target && !exportWrap.contains(target)) exportMenu.classList.remove('open');
      if (target && !sizeWrap.contains(target)) sizeMenu.classList.remove('open');
    },
    { signal }
  );

  function deleteCelAtFrame(frame: number): void {
    const entry = getCelEntryAt(frame);
    if (!entry) return;
    state.cels.delete(entry.start);
    renderTimeline();
    renderStage();
  }

  function deleteVectorCelAtFrame(frame: number): void {
    const entry = getVectorCelEntryAt(frame);
    if (!entry) return;
    state.vectorCels.delete(entry.start);
    renderTimeline();
    renderStage();
  }

  function ensureContextCelOrVectorTrack(): void {
    const target = activeTimelineTarget();
    if (contextTargetLayer === 'vector' && contextTargetVectorTrackId) {
      if (target.vectorTracks.some((t) => t.id === contextTargetVectorTrackId)) {
        target.activeVectorTrackId = contextTargetVectorTrackId;
      }
    } else if (contextTargetLayer === 'cel' && contextTargetCelTrackId) {
      if (target.celTracks.some((t) => t.id === contextTargetCelTrackId)) {
        target.activeCelTrackId = contextTargetCelTrackId;
      }
    }
  }

  ctxExitNest.onclick = () => {
    hideMenus();
    exitNestLevel();
  };
  ctxNest.onclick = () => {
    hideMenus();
    ensureContextCelOrVectorTrack();
    const tid = contextTargetLayer === 'vector' ? contextTargetVectorTrackId : contextTargetCelTrackId;
    openNestedAnimationAt(contextTargetLayer, contextTargetFrame, tid || undefined);
  };
  ctxUnnest.onclick = () => {
    hideMenus();
    ensureContextCelOrVectorTrack();
    unnestFrameAt(contextTargetLayer, contextTargetFrame);
  };
  ctxClearTween.onclick = () => {
    hideMenus();
    ensureContextCelOrVectorTrack();
    if (contextTargetLayer === 'vector') {
      const entry = getVectorCelEntryAt(contextTargetFrame);
      if (!entry || !entry.cel.posKeys || entry.cel.posKeys.length === 0) return;
      pushTweenUndo(entry.cel);
      const cur = getCelOffsetAtFrame(entry.cel, entry.start, contextTargetFrame);
      entry.cel.offsetX = Math.round(cur.offsetX);
      entry.cel.offsetY = Math.round(cur.offsetY);
      entry.cel.scale = cur.scale === 1 && entry.cel.scale === undefined ? undefined : cur.scale;
      entry.cel.rotation = cur.rotation === 0 && entry.cel.rotation === undefined ? undefined : cur.rotation;
      delete entry.cel.posKeys;
      renderTimeline();
      renderStage();
      onNotify('Cleared vector motion tween.');
      return;
    }
    const entry = getCelEntryAt(contextTargetFrame);
    if (!entry || !entry.cel.posKeys || entry.cel.posKeys.length === 0) return;
    pushTweenUndo(entry.cel);
    const cur = getCelOffsetAtFrame(entry.cel, entry.start, contextTargetFrame);
    entry.cel.offsetX = Math.round(cur.offsetX);
    entry.cel.offsetY = Math.round(cur.offsetY);
    entry.cel.scale = cur.scale === 1 && entry.cel.scale === undefined ? undefined : cur.scale;
    entry.cel.rotation = cur.rotation === 0 && entry.cel.rotation === undefined ? undefined : cur.rotation;
    delete entry.cel.posKeys;
    renderTimeline();
    renderStage();
    onNotify('Cleared bitmap motion tween.');
  };

  mustEl<HTMLButtonElement>('ctxDelete').onclick = () => {
    ensureContextCelOrVectorTrack();
    if (contextTargetLayer === 'vector') deleteVectorCelAtFrame(contextTargetFrame);
    else deleteCelAtFrame(contextTargetFrame);
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxBlank').onclick = () => {
    ensureContextCelOrVectorTrack();
    if (contextTargetLayer === 'vector') splitOrCreateBlankVectorAt(contextTargetFrame, false);
    else splitOrCreateBlankAt(contextTargetFrame, false);
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxDup').onclick = () => {
    ensureContextCelOrVectorTrack();
    if (contextTargetLayer === 'vector') splitOrCreateBlankVectorAt(contextTargetFrame, true);
    else splitOrCreateBlankAt(contextTargetFrame, true);
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxClear').onclick = () => {
    ensureContextCelOrVectorTrack();
    if (contextTargetLayer === 'vector') {
      const entry = getVectorCelEntryAt(contextTargetFrame);
      if (entry) {
        pushVectorItemsUndo(entry.cel);
        entry.cel.items = [];
        entry.cel.hasInk = false;
        delete entry.cel.originX;
        delete entry.cel.originY;
        delete entry.cel.rotation;
        delete entry.cel.posKeys;
        delete entry.cel.nestId;
        delete entry.cel.nestOriginFrame;
        renderTimeline();
        renderStage();
      }
    } else {
      const entry = getCelEntryAt(contextTargetFrame);
      if (entry) {
        pushPixelUndo(entry.cel);
        entry.cel.canvas.getContext('2d')?.clearRect(0, 0, entry.cel.canvas.width, entry.cel.canvas.height);
        entry.cel.hasInk = false;
        delete entry.cel.originX;
        delete entry.cel.originY;
        delete entry.cel.rotation;
        delete entry.cel.posKeys;
        delete entry.cel.nestId;
        delete entry.cel.nestOriginFrame;
        renderTimeline();
        renderStage();
      }
    }
    hideMenus();
  };

  let contextCamFrame = 0;

  function handleCamTimelineContextMenu(e: MouseEvent): void {
    e.preventDefault();
    if (!state.showCamTrack) return;
    if (state.isPlaying) togglePlay();
    const targetFrame = frameFromClientX(e.clientX);
    goToFrame(targetFrame);

    if (!state.cameraKeys.has(targetFrame)) {
      setCameraKeyframeFromUI(targetFrame);
      syncInspectorUI();
      renderTimeline();
      renderStage();
      onNotify(`Inserted camera keyframe at F${targetFrame + 1}.`);
      return;
    }

    contextCamFrame = targetFrame;
    camContextMenu.style.display = 'flex';
    const menuW = 190;
    const menuH = 74;
    const left = Math.min(window.innerWidth - menuW - 6, e.clientX);
    const top = Math.min(window.innerHeight - menuH - 6, e.clientY);
    camContextMenu.style.left = `${left}px`;
    camContextMenu.style.top = `${top}px`;
  }

  mustEl<HTMLButtonElement>('ctxCamSet').onclick = () => {
    goToFrame(contextCamFrame);
    setCameraKeyframeFromUI(contextCamFrame);
    syncInspectorUI();
    renderTimeline();
    renderStage();
    hideMenus();
  };

  mustEl<HTMLButtonElement>('ctxCamDelete').onclick = () => {
    state.cameraKeys.delete(contextCamFrame);
    syncInspectorUI();
    renderTimeline();
    renderStage();
    hideMenus();
  };

  camTrackLabel.onclick = (e) => {
    if ((e.target as HTMLElement)?.closest('button, input, select')) return;
    selectTimelineTrack('cam');
    if (state.showCamTrack) toggleCameraPanel(true);
  };
  camTrackLabel.addEventListener('contextmenu', (e) => {
    if (isBasicMode()) return;
    if ((e.target as HTMLElement)?.closest('input, select')) return;
    e.preventDefault();
    e.stopPropagation();
    openLayerContextMenu('cam', e.clientX, e.clientY);
  });
  camTrackRow.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    if (state.isPlaying) togglePlay();
    selectTimelineTrack('cam');
    goToFrame(frameFromClientX(e.clientX));
  });
  camTrackRow.addEventListener('contextmenu', (e) => {
    selectTimelineTrack('cam');
    handleCamTimelineContextMenu(e);
  });

  function syncInspectorUI(): void {
    const cam = getEvaluatedCamera(state.currentFrame);
    camEase.value = cam.ease;
    camScale.value = String(Math.round(cam.scale));
    camX.value = String(Math.round(cam.x));
    camY.value = String(Math.round(cam.y));

    mustEl<HTMLSpanElement>('camScaleVal').textContent = camScale.value + '%';
    mustEl<HTMLSpanElement>('camXVal').textContent = camX.value;
    mustEl<HTMLSpanElement>('camYVal').textContent = camY.value;
    updateStageBadge();
  }

  function goToFrame(f: number): void {
    state.currentFrame = Math.max(0, Math.min(state.totalFrames - 1, f));
    vectorEditSelection = null;
    vectorEditHover = null;
    syncInspectorUI();
    updatePlayheadUI();
    updateMouthWidget();
    renderStage();
  }

  function stepForwardOrExtend(): void {
    if (state.isPlaying) return;
    if (state.currentFrame + 1 >= state.totalFrames) {
      addFrameAndAdvance();
    } else {
      goToFrame(state.currentFrame + 1);
    }
  }

  function setCameraKeyframeFromUI(frame = state.currentFrame): void {
    state.cameraKeys.set(frame, {
      ease: camEase.value,
      scale: Number(camScale.value),
      x: Number(camX.value),
      y: Number(camY.value),
    });
  }

  [camEase, camScale, camX, camY].forEach((el) => {
    el.addEventListener('input', () => {
      setCameraKeyframeFromUI(state.currentFrame);
      syncInspectorUI();
      renderTimeline();
      renderStage();
    });
  });

  mustEl<HTMLButtonElement>('btnSetCamKey').onclick = () => {
    setCameraKeyframeFromUI(state.currentFrame);
    syncInspectorUI();
    renderTimeline();
    renderStage();
  };

  mustEl<HTMLButtonElement>('btnDelCamKey').onclick = () => {
    state.cameraKeys.delete(state.currentFrame);
    syncInspectorUI();
    renderTimeline();
    renderStage();
  };

  mustEl<HTMLButtonElement>('btnResetCam').onclick = () => {
    camScale.value = '100';
    camX.value = '0';
    camY.value = '0';
    if (state.cameraKeys.size > 0) setCameraKeyframeFromUI(state.currentFrame);
    syncInspectorUI();
    renderTimeline();
    renderStage();
  };

  function syncSizeSliderUI(): void {
    if (state.tool === 'nudge') {
      brushSizeHeading.textContent = 'Radius';
      brushSizeInput.min = '8';
      brushSizeInput.max = '240';
      brushSizeInput.value = String(state.nudgeRadius);
      brushSizeVal.textContent = state.nudgeRadius + 'px';
    } else {
      brushSizeHeading.textContent = 'Size';
      brushSizeInput.min = '1';
      brushSizeInput.max = '32';
      brushSizeInput.value = String(state.brushSize);
      brushSizeVal.textContent = state.brushSize + 'px';
    }
  }

  function selectTool(toolName: 'brush' | 'eraser' | 'fill' | 'moveCam' | 'nudge' | 'vectorEdit'): void {
    let resolvedTool = toolName;
    if (resolvedTool === 'nudge' && (isBasicMode() || (state.activeLayer !== 'vector' && state.activeLayer !== 'cel'))) {
      resolvedTool = 'brush';
    } else if (resolvedTool === 'vectorEdit' && (isBasicMode() || state.activeLayer !== 'vector')) {
      resolvedTool = 'brush';
    }
    state.tool = resolvedTool;
    if (resolvedTool !== 'moveCam') hoverOriginGizmoPart = null;
    if (resolvedTool !== 'vectorEdit') {
      vectorEditSelection = null;
      vectorEditHover = null;
    }
    document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === resolvedTool);
    });
    stage.style.cursor = resolvedTool === 'moveCam' ? 'move' : resolvedTool === 'vectorEdit' ? 'default' : 'crosshair';
    vectorPointModeGroup.classList.toggle(
      'hidden-nest-ui',
      isBasicMode() || state.activeLayer !== 'vector' || resolvedTool !== 'vectorEdit'
    );
    updateOriginPointBtnUI();
    syncSizeSliderUI();
    updateMouthWidget();
    updateStageBadge();
    renderStage();
  }

  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
    btn.onclick = () => {
      const t = btn.dataset.tool as 'brush' | 'eraser' | 'fill' | 'moveCam' | 'nudge' | 'vectorEdit' | undefined;
      if (t) selectTool(t);
    };
  });

  const brushColor = mustEl<HTMLInputElement>('brushColor');
  const brushSizeInput = mustEl<HTMLInputElement>('brushSize');
  const brushSizeVal = mustEl<HTMLSpanElement>('brushSizeVal');

  function setBrushSize(val: number): void {
    if (state.tool === 'nudge') {
      state.nudgeRadius = Math.max(8, Math.min(240, val));
    } else {
      state.brushSize = Math.max(1, Math.min(32, val));
    }
    syncSizeSliderUI();
    updateStageBadge();
    renderStage();
  }

  const paletteColors: string[] = ['#000000', '#f43f5e'];
  let activeSwatchIdx = 0;
  let pickerTargetIdx = 0;

  function renderPalette(): void {
    paletteSwatches.innerHTML = '';
    paletteColors.forEach((col, idx) => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'swatch' + (idx === activeSwatchIdx ? ' active' : '');
      sw.style.backgroundColor = col;
      const keyHint = idx < 9 ? `[${idx + 1}] ` : idx === 9 ? '[0] ' : '';
      sw.title =
        idx === activeSwatchIdx
          ? `${keyHint}Click again to edit color (Right-click to remove)`
          : `${keyHint}Click to select color`;
      sw.onclick = () => {
        if (activeSwatchIdx === idx) {
          pickerTargetIdx = idx;
          brushColor.value = paletteColors[idx];
          brushColor.click();
        } else {
          activeSwatchIdx = idx;
          state.brushColor = paletteColors[idx];
          brushColor.value = state.brushColor;
          renderPalette();
          renderStage();
        }
      };
      sw.oncontextmenu = (e) => {
        e.preventDefault();
        if (paletteColors.length <= 2) return;
        paletteColors.splice(idx, 1);
        if (activeSwatchIdx >= paletteColors.length) activeSwatchIdx = paletteColors.length - 1;
        else if (activeSwatchIdx > idx) activeSwatchIdx--;
        state.brushColor = paletteColors[activeSwatchIdx];
        brushColor.value = state.brushColor;
        renderPalette();
        renderStage();
      };
      paletteSwatches.appendChild(sw);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'swatch add-swatch-btn';
    addBtn.textContent = '+';
    addBtn.title = 'Add color to palette';
    addBtn.onclick = () => {
      const nextCol = state.brushColor === '#000000' ? '#3b82f6' : state.brushColor;
      paletteColors.push(nextCol);
      activeSwatchIdx = paletteColors.length - 1;
      pickerTargetIdx = activeSwatchIdx;
      state.brushColor = nextCol;
      brushColor.value = nextCol;
      renderPalette();
      renderStage();
      brushColor.click();
    };
    paletteSwatches.appendChild(addBtn);
  }

  brushColor.oninput = () => {
    state.brushColor = brushColor.value;
    if (pickerTargetIdx >= 0 && pickerTargetIdx < paletteColors.length) {
      paletteColors[pickerTargetIdx] = brushColor.value;
      activeSwatchIdx = pickerTargetIdx;
      renderPalette();
    }
    renderStage();
  };
  brushSizeInput.oninput = () => setBrushSize(Number(brushSizeInput.value));

  renderPalette();

  function undoActiveLayer(): void {
    if (state.activeLayer === 'vector') {
      const e = getVectorCelEntryAt(state.currentFrame);
      const vCel = e ? e.cel : null;
      if (!vCel || vCel.undoStack.length === 0) return;
      const entry = vCel.undoStack.pop()!;
      if (entry.type === 'tween') {
        vCel.offsetX = entry.offsetX;
        vCel.offsetY = entry.offsetY;
        vCel.posKeys = clonePosKeys(entry.posKeys);
        vCel.rotation = entry.rotation;
        vCel.scale = entry.scale;
        vCel.originX = entry.originX;
        vCel.originY = entry.originY;
        if (entry.ikSiblings) restoreIKSiblings(activeScene(), activeTimelineTarget(), state.currentFrame, entry.ikSiblings);
      } else if (entry.type === 'move') {
        vCel.offsetX = entry.offsetX;
        vCel.offsetY = entry.offsetY;
        vCel.rotation = entry.rotation;
        vCel.scale = entry.scale;
        vCel.originX = entry.originX;
        vCel.originY = entry.originY;
        if (entry.ikSiblings) restoreIKSiblings(activeScene(), activeTimelineTarget(), state.currentFrame, entry.ikSiblings);
      } else {
        vCel.items = cloneVectorItems(entry.items);
        vCel.hasInk = entry.hasInk;
        vCel.offsetX = entry.offsetX;
        vCel.offsetY = entry.offsetY;
        vCel.posKeys = clonePosKeys(entry.posKeys);
        vCel.rotation = entry.rotation;
        vCel.scale = entry.scale;
        vCel.originX = entry.originX;
        vCel.originY = entry.originY;
      }
      updateStageBadge();
      renderTimeline();
      renderStage();
      return;
    }

    if (state.activeLayer === 'mouth') {
      const st = mouthUndoStacks.get(state.mouthLayer);
      const act = st?.pop();
      if (act) {
        if (act.kind === 'transform') {
          if (act.prevKey) state.mouthLayer.keys.set(act.frame, { ...act.prevKey });
          else state.mouthLayer.keys.delete(act.frame);
          if (act.ikSiblings) restoreIKSiblings(activeScene(), activeTimelineTarget(), act.frame, act.ikSiblings);
          updateMouthWidget();
          updateStageBadge();
          renderTimeline();
          renderStage();
          return;
        }
        const vis = state.mouthLayer.visemes[act.visemeIdx];
        if (vis && vis.undoStack.length > 0) {
          const entry = vis.undoStack.pop()!;
          if (entry.type === 'pixels') {
            if (vis.canvas.width !== entry.w || vis.canvas.height !== entry.h) {
              vis.canvas.width = entry.w;
              vis.canvas.height = entry.h;
            }
            const cctx = vis.canvas.getContext('2d');
            if (cctx) {
              cctx.imageSmoothingEnabled = false;
              cctx.putImageData(entry.imgData, 0, 0);
            }
          }
          updateMouthWidget();
          renderStage();
          return;
        }
      }
    }

    let layerObj: Cel | BgLayer | Viseme | null = null;
    if (state.activeLayer === 'bg') layerObj = state.bgLayer;
    else if (state.activeLayer === 'mouth') {
      const m = getActiveMouthState();
      layerObj = state.mouthLayer.visemes[m.viseme];
    } else {
      const e = getCelEntryAt(state.currentFrame);
      layerObj = e ? e.cel : null;
    }
    if (!layerObj || layerObj.undoStack.length === 0) return;

    const entry = layerObj.undoStack.pop()!;
    if (entry.type === 'tween' && 'duration' in layerObj) {
      layerObj.offsetX = entry.offsetX;
      layerObj.offsetY = entry.offsetY;
      layerObj.posKeys = clonePosKeys(entry.posKeys);
      layerObj.rotation = entry.rotation;
      layerObj.scale = entry.scale;
      layerObj.originX = entry.originX;
      layerObj.originY = entry.originY;
      if (entry.ikSiblings) restoreIKSiblings(activeScene(), activeTimelineTarget(), state.currentFrame, entry.ikSiblings);
      renderTimeline();
    } else if (entry.type === 'move' && 'offsetX' in layerObj) {
      layerObj.offsetX = entry.offsetX;
      layerObj.offsetY = entry.offsetY;
      layerObj.rotation = entry.rotation;
      layerObj.scale = entry.scale;
      layerObj.originX = entry.originX;
      layerObj.originY = entry.originY;
      if (entry.ikSiblings) restoreIKSiblings(activeScene(), activeTimelineTarget(), state.currentFrame, entry.ikSiblings);
    } else if (entry.type === 'pixels') {
      if (layerObj.canvas.width !== entry.w || layerObj.canvas.height !== entry.h) {
        layerObj.canvas.width = entry.w;
        layerObj.canvas.height = entry.h;
      }
      const cctx = layerObj.canvas.getContext('2d');
      if (cctx) {
        cctx.imageSmoothingEnabled = false;
        cctx.putImageData(entry.imgData, 0, 0);
      }
      if ('offsetX' in layerObj) {
        layerObj.offsetX = entry.offsetX;
        layerObj.offsetY = entry.offsetY;
      }
    }
    updateMouthWidget();
    updateStageBadge();
    renderStage();
  }

  function splitOrCreateBlankVectorAt(frame: number, clonePrev: boolean): void {
    const existing = getVectorCelEntryAt(frame);
    if (existing) {
      if (existing.start === frame) {
        pushVectorItemsUndo(existing.cel);
        existing.cel.items = [];
        existing.cel.offsetX = 0;
        existing.cel.offsetY = 0;
        delete existing.cel.originX;
        delete existing.cel.originY;
        delete existing.cel.rotation;
        delete existing.cel.scale;
        delete existing.cel.posKeys;
        delete existing.cel.nestId;
        delete existing.cel.nestOriginFrame;
        if (clonePrev) {
          const prev = getPrevVectorCelBefore(frame);
          if (prev) {
            const prevEndOff = getCelOffsetAtFrame(prev.cel, prev.start, prev.start + prev.cel.duration - 1);
            existing.cel.items = cloneVectorItems(prev.cel.items);
            existing.cel.offsetX = Math.round(prevEndOff.offsetX);
            existing.cel.offsetY = Math.round(prevEndOff.offsetY);
            existing.cel.originX = prev.cel.originX;
            existing.cel.originY = prev.cel.originY;
            existing.cel.rotation = prevEndOff.rotation === 0 && prev.cel.rotation === undefined ? undefined : prevEndOff.rotation;
            existing.cel.scale = prevEndOff.scale === 1 && prev.cel.scale === undefined ? undefined : prevEndOff.scale;
            existing.cel.hasInk = prev.cel.hasInk;
            existing.cel.nestId = prev.cel.nestId;
            existing.cel.nestOriginFrame = prev.cel.nestOriginFrame;
          } else {
            existing.cel.hasInk = false;
          }
        } else {
          existing.cel.hasInk = false;
        }
      } else {
        const oldDur = existing.cel.duration;
        const leftDur = frame - existing.start;
        const rightDur = oldDur - leftDur;
        const splitOff = getCelOffsetAtFrame(existing.cel, existing.start, frame);
        const origKeys = clonePosKeys(existing.cel.posKeys) || [];
        existing.cel.duration = leftDur;

        if (origKeys.length > 0) {
          const leftKeys = origKeys.filter((k) => k.relFrame < leftDur);
          if (leftKeys.length >= 2) {
            existing.cel.posKeys = leftKeys;
          } else {
            if (leftKeys[0]) {
              existing.cel.offsetX = Math.round(leftKeys[0].offsetX);
              existing.cel.offsetY = Math.round(leftKeys[0].offsetY);
              if (typeof leftKeys[0].scale === 'number') existing.cel.scale = leftKeys[0].scale;
              if (typeof leftKeys[0].rotation === 'number') existing.cel.rotation = leftKeys[0].rotation;
            }
            delete existing.cel.posKeys;
          }
        }

        let items: VectorItem[] = [];
        let offsetX = 0;
        let offsetY = 0;
        let originX: number | undefined;
        let originY: number | undefined;
        let rotation: number | undefined;
        let scale: number | undefined;
        let hasInk = false;
        let posKeys: CelPosKey[] | undefined;
        let nestId: string | undefined;
        let nestOriginFrame: number | undefined;
        if (clonePrev) {
          items = cloneVectorItems(existing.cel.items);
          offsetX = Math.round(splitOff.offsetX);
          offsetY = Math.round(splitOff.offsetY);
          originX = existing.cel.originX;
          originY = existing.cel.originY;
          rotation = splitOff.rotation === 0 && existing.cel.rotation === undefined ? undefined : splitOff.rotation;
          scale = splitOff.scale === 1 && existing.cel.scale === undefined ? undefined : splitOff.scale;
          hasInk = existing.cel.hasInk;
          nestId = existing.cel.nestId;
          nestOriginFrame = existing.cel.nestOriginFrame;
          const shifted = origKeys
            .filter((k) => k.relFrame >= leftDur)
            .map((k) => ({ ...k, relFrame: k.relFrame - leftDur }));
          if (shifted.length >= 2) {
            posKeys = shifted;
          }
        }
        state.vectorCels.set(frame, {
          items,
          undoStack: [],
          hasInk,
          duration: rightDur,
          offsetX,
          offsetY,
          originX,
          originY,
          rotation,
          scale,
          posKeys,
          nestId,
          nestOriginFrame,
        });
      }
    } else {
      ensureVectorCelAt(frame, clonePrev);
    }
    renderTimeline();
    renderStage();
  }

  function splitOrCreateBlankAt(frame: number, clonePrev: boolean): void {
    const existing = getCelEntryAt(frame);
    if (existing) {
      if (existing.start === frame) {
        pushPixelUndo(existing.cel);
        existing.cel.canvas = createCelCanvas();
        existing.cel.offsetX = 0;
        existing.cel.offsetY = 0;
        delete existing.cel.originX;
        delete existing.cel.originY;
        delete existing.cel.rotation;
        delete existing.cel.scale;
        delete existing.cel.posKeys;
        delete existing.cel.nestId;
        delete existing.cel.nestOriginFrame;
        if (clonePrev) {
          const prev = getPrevCelBefore(frame);
          if (prev) {
            const prevEndOff = getCelOffsetAtFrame(prev.cel, prev.start, prev.start + prev.cel.duration - 1);
            existing.cel.canvas = createCelCanvas(prev.cel.canvas.width, prev.cel.canvas.height);
            existing.cel.canvas.getContext('2d')?.drawImage(prev.cel.canvas, 0, 0);
            existing.cel.offsetX = Math.round(prevEndOff.offsetX);
            existing.cel.offsetY = Math.round(prevEndOff.offsetY);
            existing.cel.originX = prev.cel.originX;
            existing.cel.originY = prev.cel.originY;
            existing.cel.rotation = prevEndOff.rotation === 0 && prev.cel.rotation === undefined ? undefined : prevEndOff.rotation;
            existing.cel.scale = prevEndOff.scale === 1 && prev.cel.scale === undefined ? undefined : prevEndOff.scale;
            existing.cel.hasInk = prev.cel.hasInk;
            existing.cel.nestId = prev.cel.nestId;
            existing.cel.nestOriginFrame = prev.cel.nestOriginFrame;
          } else {
            existing.cel.hasInk = false;
          }
        } else {
          existing.cel.hasInk = false;
        }
      } else {
        const oldDur = existing.cel.duration;
        const leftDur = frame - existing.start;
        const rightDur = oldDur - leftDur;
        const splitOff = getCelOffsetAtFrame(existing.cel, existing.start, frame);
        const origKeys = clonePosKeys(existing.cel.posKeys) || [];
        existing.cel.duration = leftDur;

        if (origKeys.length > 0) {
          const leftKeys = origKeys.filter((k) => k.relFrame < leftDur);
          if (leftKeys.length >= 2) {
            existing.cel.posKeys = leftKeys;
          } else {
            if (leftKeys[0]) {
              existing.cel.offsetX = Math.round(leftKeys[0].offsetX);
              existing.cel.offsetY = Math.round(leftKeys[0].offsetY);
              if (typeof leftKeys[0].scale === 'number') existing.cel.scale = leftKeys[0].scale;
              if (typeof leftKeys[0].rotation === 'number') existing.cel.rotation = leftKeys[0].rotation;
            }
            delete existing.cel.posKeys;
          }
        }

        let canvas = createCelCanvas();
        let offsetX = 0;
        let offsetY = 0;
        let originX: number | undefined;
        let originY: number | undefined;
        let rotation: number | undefined;
        let scale: number | undefined;
        let hasInk = false;
        let posKeys: CelPosKey[] | undefined;
        let nestId: string | undefined;
        let nestOriginFrame: number | undefined;
        if (clonePrev) {
          canvas = createCelCanvas(existing.cel.canvas.width, existing.cel.canvas.height);
          canvas.getContext('2d')?.drawImage(existing.cel.canvas, 0, 0);
          offsetX = Math.round(splitOff.offsetX);
          offsetY = Math.round(splitOff.offsetY);
          originX = existing.cel.originX;
          originY = existing.cel.originY;
          rotation = splitOff.rotation === 0 && existing.cel.rotation === undefined ? undefined : splitOff.rotation;
          scale = splitOff.scale === 1 && existing.cel.scale === undefined ? undefined : splitOff.scale;
          hasInk = existing.cel.hasInk;
          nestId = existing.cel.nestId;
          nestOriginFrame = existing.cel.nestOriginFrame;
          const shifted = origKeys
            .filter((k) => k.relFrame >= leftDur)
            .map((k) => ({ ...k, relFrame: k.relFrame - leftDur }));
          if (shifted.length >= 2) {
            posKeys = shifted;
          }
        }
        state.cels.set(frame, {
          canvas,
          undoStack: [],
          hasInk,
          duration: rightDur,
          offsetX,
          offsetY,
          originX,
          originY,
          rotation,
          scale,
          posKeys,
          nestId,
          nestOriginFrame,
        });
      }
    } else {
      ensureCelAt(frame, clonePrev);
    }
    renderTimeline();
    renderStage();
  }

  // Editor Playback Loop
  let lastTick = 0;

  function getPlaybackBounds(): { minF: number; maxF: number } {
    if (state.loopRange) {
      return {
        minF: Math.max(0, state.loopRange.start),
        maxF: Math.min(state.totalFrames - 1, state.loopRange.end),
      };
    }
    return { minF: 0, maxF: state.totalFrames - 1 };
  }

  function togglePlay(): void {
    state.isPlaying = !state.isPlaying;
    const btn = mustEl<HTMLButtonElement>('btnPlay');
    btn.textContent = state.isPlaying ? '⏸ Pause' : '▶ Play';

    if (state.isPlaying) {
      const { minF, maxF } = getPlaybackBounds();
      if (state.currentFrame < minF || state.currentFrame > maxF) {
        goToFrame(minF);
      }
      scheduleAudioAtFrame(state.currentFrame);
      lastTick = performance.now();
      requestAnimationFrame(playStep);
    } else {
      stopAllAudioPlayback();
      renderStage();
    }
  }

  function playStep(now: number): void {
    if (!state.isPlaying) return;
    const interval = 1000 / state.fps;
    if (now - lastTick >= interval) {
      lastTick = now - ((now - lastTick) % interval);
      const { minF, maxF } = getPlaybackBounds();
      if (state.currentFrame + 1 > maxF) {
        if (state.loop || nestStack.length > 0) {
          goToFrame(minF);
          scheduleAudioAtFrame(minF);
        } else {
          togglePlay();
          return;
        }
      } else {
        goToFrame(state.currentFrame + 1);
      }
    }
    requestAnimationFrame(playStep);
  }

  mustEl<HTMLButtonElement>('btnPlay').onclick = togglePlay;
  mustEl<HTMLButtonElement>('btnRewind').onclick = () => {
    if (state.isPlaying) togglePlay();
    goToFrame(getPlaybackBounds().minF);
  };
  mustEl<HTMLButtonElement>('btnPrevFrame').onclick = () => goToFrame(state.currentFrame - 1);
  mustEl<HTMLButtonElement>('btnNextFrame').onclick = stepForwardOrExtend;

  mustEl<HTMLButtonElement>('btnLoop').onclick = (e) => {
    state.loop = !state.loop;
    const btn = e.currentTarget as HTMLButtonElement;
    btn.textContent = `Loop: ${state.loop ? 'On' : 'Off'}`;
    btn.classList.toggle('active', state.loop);
  };

  fpsSelect.onchange = (e) => {
    if (isBasicMode()) {
      fpsSelect.value = String(app.fps);
      return;
    }
    state.fps = Number((e.currentTarget as HTMLSelectElement).value);
    renderAudioTrack();
    if (state.isPlaying) scheduleAudioAtFrame(state.currentFrame);
  };

  const btnOnion = mustEl<HTMLButtonElement>('btnOnion');
  const btnOnionBefore = mustEl<HTMLButtonElement>('btnOnionBefore');
  const btnOnionAfter = mustEl<HTMLButtonElement>('btnOnionAfter');

  btnOnion.onclick = () => {
    state.onionSkin = !state.onionSkin;
    btnOnion.textContent = `Onion: ${state.onionSkin ? 'On' : 'Off'}`;
    btnOnion.classList.toggle('active', state.onionSkin);
    renderStage();
  };

  btnOnionBefore.onclick = () => {
    if (isBasicMode()) return;
    state.onionBefore = !state.onionBefore;
    btnOnionBefore.classList.toggle('active', state.onionBefore);
    renderStage();
  };

  btnOnionAfter.onclick = () => {
    if (isBasicMode()) return;
    state.onionAfter = !state.onionAfter;
    btnOnionAfter.classList.toggle('active', state.onionAfter);
    renderStage();
  };

  function updateOriginPointBtnUI(): void {
    btnOriginPoint.classList.toggle('hidden-nest-ui', isBasicMode() || state.tool !== 'moveCam');
    btnOriginPoint.classList.toggle('active', state.showOriginPoint);
    btnOriginPointText.textContent = state.showOriginPoint ? 'Origin: On' : 'Origin: Off';
  }

  btnOriginPoint.onclick = () => {
    if (isBasicMode() || state.tool !== 'moveCam') return;
    state.showOriginPoint = !state.showOriginPoint;
    if (!state.showOriginPoint) hoverOriginGizmoPart = null;
    updateOriginPointBtnUI();
    renderStage();
  };
  updateOriginPointBtnUI();

  btnVectorPixelPreview.onclick = () => {
    state.vectorPixelPreview = !state.vectorPixelPreview;
    btnVectorPixelPreview.textContent = `Pixelate: ${state.vectorPixelPreview ? 'On' : 'Off'}`;
    btnVectorPixelPreview.classList.toggle('active', state.vectorPixelPreview);
    updateStageBadge();
    renderStage();
  };

  function addCamTrack(): void {
    if (nestStack.length > 0 || state.showCamTrack) return;
    toggleCamTrack(true);
    selectTimelineTrack('cam');
  }

  function removeCamTrack(): void {
    state.cameraKeys.clear();
    camScale.value = '100';
    camX.value = '0';
    camY.value = '0';
    state.showCamTrack = false;
    camTrackLabel.classList.add('hidden-track');
    camTrackRow.classList.add('hidden-track');
    camTrackRight.classList.add('hidden-track');
    toggleCameraPanel(false);
    syncAddCamBtnUI();
    if (state.selectedTrack === 'cam') {
      selectFallbackVisibleLayerAfterDelete();
    }
    syncInspectorUI();
    updateTimelinePanelHeight();
    renderTimeline();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function toggleCamTrack(forceState?: boolean): void {
    state.showCamTrack = typeof forceState === 'boolean' ? forceState : !state.showCamTrack;
    camTrackLabel.classList.toggle('hidden-track', !state.showCamTrack);
    camTrackRow.classList.toggle('hidden-track', !state.showCamTrack);
    camTrackRight.classList.toggle('hidden-track', !state.showCamTrack);
    toggleCameraPanel(state.showCamTrack);
    syncAddCamBtnUI();
    if (state.showCamTrack) {
      if (typeof forceState !== 'boolean') {
        selectTimelineTrack('cam');
      }
    } else if (state.selectedTrack === 'cam') {
      selectTimelineTrack(state.activeLayer);
    }
    updateTimelinePanelHeight();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  mustEl<HTMLButtonElement>('btnVisCam').onclick = (e) => {
    e.stopPropagation();
    state.applyCamera = !state.applyCamera;
    (e.currentTarget as HTMLButtonElement).style.opacity = state.applyCamera ? '1' : '0.35';
    syncInspectorUI();
    renderStage();
  };

  // ==========================================
  // SCENES / STORYBOARD PAGE LOGIC
  // ==========================================
  function getTotalMovieFrames(): number {
    return app.scenes.reduce((sum, sc) => sum + sc.totalFrames, 0);
  }

  function resolveGlobalFrame(gFrame: number): { sceneIndex: number; scene: Scene; localFrame: number } {
    let acc = 0;
    for (let i = 0; i < app.scenes.length; i++) {
      const sc = app.scenes[i];
      if (gFrame < acc + sc.totalFrames) {
        return { sceneIndex: i, scene: sc, localFrame: gFrame - acc };
      }
      acc += sc.totalFrames;
    }
    const last = app.scenes[app.scenes.length - 1];
    return { sceneIndex: app.scenes.length - 1, scene: last, localFrame: last.totalFrames - 1 };
  }

  function renderScenesPreview(): void {
    const total = Math.max(1, getTotalMovieFrames());
    app.scenesGlobalFrame = Math.max(0, Math.min(total - 1, app.scenesGlobalFrame));

    const previewW = 640;
    const previewH = Math.round(640 * (WORLD_H / WORLD_W));
    if (scenesPreviewCanvas.width !== previewW || scenesPreviewCanvas.height !== previewH) {
      scenesPreviewCanvas.width = previewW;
      scenesPreviewCanvas.height = previewH;
    }

    const { scene, localFrame } = resolveGlobalFrame(app.scenesGlobalFrame);
    renderSceneToContext(scene, spCtx, previewW, previewH, localFrame, true, false);
    scenesFrameReadout.textContent = `${scene.name} • F ${app.scenesGlobalFrame + 1} / ${total}`;

    const playhead = scenesScrubber.querySelector<HTMLElement>('.scenes-scrub-playhead');
    if (playhead) {
      playhead.style.left = `${((app.scenesGlobalFrame + 0.5) / total) * 100}%`;
    }

    const cards = scenesGrid.children;
    for (let i = 0; i < app.scenes.length; i++) {
      if (cards[i]) {
        cards[i].classList.toggle('playing-now', app.scenesPlaying && app.scenes[i].id === scene.id);
      }
    }
  }

  function renderScenesScrubber(): void {
    const total = Math.max(1, getTotalMovieFrames());
    scenesScrubber.innerHTML = '';
    for (const sc of app.scenes) {
      const seg = document.createElement('div');
      seg.className = 'scenes-scrub-seg';
      seg.style.width = `${(sc.totalFrames / total) * 100}%`;
      seg.title = `${sc.name} (${sc.totalFrames}f)`;
      scenesScrubber.appendChild(seg);
    }
    const ph = document.createElement('div');
    ph.className = 'scenes-scrub-playhead';
    scenesScrubber.appendChild(ph);
  }

  let isScrubbingScenes = false;
  function scrubScenesFromEvent(e: PointerEvent): void {
    const rect = scenesScrubber.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.99999, (e.clientX - rect.left) / Math.max(1, rect.width)));
    app.scenesGlobalFrame = Math.floor(ratio * getTotalMovieFrames());
    renderScenesPreview();
  }

  scenesScrubber.addEventListener('pointerdown', (e) => {
    if (app.scenesPlaying) toggleScenesPlay();
    isScrubbingScenes = true;
    scenesScrubber.setPointerCapture(e.pointerId);
    scrubScenesFromEvent(e);
  });
  scenesScrubber.addEventListener('pointermove', (e) => {
    if (isScrubbingScenes) scrubScenesFromEvent(e);
  });
  scenesScrubber.addEventListener('pointerup', () => {
    isScrubbingScenes = false;
  });

  function scheduleMultiSceneAudio(
    startGlobalFrame: number,
    targetAc?: AudioContext,
    destinationNode?: AudioNode
  ): AudioBufferSourceNode[] {
    const ac = targetAc || getAudioContext();
    const dest = destinationNode || ac.destination;
    const startSec = startGlobalFrame / app.fps;
    const scheduled: AudioBufferSourceNode[] = [];
    let accFrames = 0;

    for (const sc of app.scenes) {
      const sceneStartSec = accFrames / app.fps;
      const sceneEndSec = (accFrames + sc.totalFrames) / app.fps;
      accFrames += sc.totalFrames;

      for (const aTrk of sc.audioTracks) {
        const clip = aTrk.clip;
        if (!clip || clip.muted || aTrk.muted) continue;

        const clipDur = clip.trimEndSec - clip.trimStartSec;
        const clipGlobalStart = sceneStartSec + clip.timelineStartSec;
        const clipGlobalEnd = Math.min(sceneEndSec, clipGlobalStart + clipDur);

        if (startSec >= clipGlobalEnd || clipGlobalEnd <= clipGlobalStart) continue;

        const src = ac.createBufferSource();
        src.buffer = clip.buffer;
        const gain = ac.createGain();
        gain.gain.value = getAudioTrackEffectiveVolume(aTrk);
        src.connect(gain);
        gain.connect(dest);

        if (startSec >= clipGlobalStart) {
          const intoClip = startSec - clipGlobalStart;
          const remaining = clipGlobalEnd - startSec;
          src.start(ac.currentTime, clip.trimStartSec + intoClip, remaining);
        } else {
          const delay = clipGlobalStart - startSec;
          src.start(ac.currentTime + delay, clip.trimStartSec, clipGlobalEnd - clipGlobalStart);
        }
        scheduled.push(src);
      }
    }
    return scheduled;
  }

  let scenesLastTick = 0;

  function toggleScenesPlay(): void {
    app.scenesPlaying = !app.scenesPlaying;
    btnScenesPlay.textContent = app.scenesPlaying ? '⏸ Pause' : '▶ Play All';

    if (app.scenesPlaying) {
      const total = getTotalMovieFrames();
      if (app.scenesGlobalFrame >= total) app.scenesGlobalFrame = 0;
      stopAllAudioPlayback();
      activeAudioSources = scheduleMultiSceneAudio(app.scenesGlobalFrame);
      scenesLastTick = performance.now();
      requestAnimationFrame(scenesPlayStep);
    } else {
      stopAllAudioPlayback();
      renderScenesPreview();
    }
  }

  function scenesPlayStep(now: number): void {
    if (!app.scenesPlaying) return;
    const interval = 1000 / app.fps;
    if (now - scenesLastTick >= interval) {
      scenesLastTick = now - ((now - scenesLastTick) % interval);
      const total = getTotalMovieFrames();
      if (app.scenesGlobalFrame + 1 >= total) {
        if (app.loop) {
          app.scenesGlobalFrame = 0;
          stopAllAudioPlayback();
          activeAudioSources = scheduleMultiSceneAudio(0);
        } else {
          toggleScenesPlay();
          return;
        }
      } else {
        app.scenesGlobalFrame += 1;
      }
      renderScenesPreview();
    }
    requestAnimationFrame(scenesPlayStep);
  }

  btnScenesPlay.onclick = toggleScenesPlay;
  mustEl<HTMLButtonElement>('btnScenesRewind').onclick = () => {
    if (app.scenesPlaying) toggleScenesPlay();
    app.scenesGlobalFrame = 0;
    renderScenesPreview();
  };
  btnScenesLoop.onclick = (e) => {
    app.loop = !app.loop;
    const btn = e.currentTarget as HTMLButtonElement;
    btn.textContent = `Loop: ${app.loop ? 'On' : 'Off'}`;
    btn.classList.toggle('active', app.loop);
    const loopBtn = mustEl<HTMLButtonElement>('btnLoop');
    loopBtn.textContent = `Loop: ${app.loop ? 'On' : 'Off'}`;
    loopBtn.classList.toggle('active', app.loop);
  };

  let draggingSceneId: string | null = null;

  function duplicateSceneObj(src: Scene): Scene {
    const cloneCelCelsMap = (srcMap: Map<number, Cel>): Map<number, Cel> => {
      const m = new Map<number, Cel>();
      for (const [f, cel] of srcMap.entries()) {
        const c = createCelCanvas(cel.canvas.width, cel.canvas.height);
        c.getContext('2d')?.drawImage(cel.canvas, 0, 0);
        m.set(f, {
          canvas: c,
          undoStack: [],
          hasInk: cel.hasInk,
          duration: cel.duration,
          offsetX: cel.offsetX,
          offsetY: cel.offsetY,
          originX: cel.originX,
          originY: cel.originY,
          rotation: cel.rotation,
          scale: cel.scale,
          posKeys: clonePosKeys(cel.posKeys),
          nestId: cel.nestId,
          nestOriginFrame: cel.nestOriginFrame,
        });
      }
      return m;
    };

    const cloneVecCelsMap = (srcMap: Map<number, VectorCel>): Map<number, VectorCel> => {
      const m = new Map<number, VectorCel>();
      for (const [f, vCel] of srcMap.entries()) {
        m.set(f, {
          items: cloneVectorItems(vCel.items),
          undoStack: [],
          hasInk: vCel.hasInk,
          duration: vCel.duration,
          offsetX: vCel.offsetX,
          offsetY: vCel.offsetY,
          originX: vCel.originX,
          originY: vCel.originY,
          rotation: vCel.rotation,
          scale: vCel.scale,
          posKeys: clonePosKeys(vCel.posKeys),
          nestId: vCel.nestId,
          nestOriginFrame: vCel.nestOriginFrame,
        });
      }
      return m;
    };

    const copy = makeScene(src.name + ' Copy');
    copy.totalFrames = src.totalFrames;
    copy.loopRange = src.loopRange ? { ...src.loopRange } : null;
    copy.celTracks = src.celTracks.map((trk) => ({
      id: trk.id,
      name: trk.name,
      visible: trk.visible,
      cels: cloneCelCelsMap(trk.cels),
    }));
    copy.activeCelTrackId = src.activeCelTrackId;
    copy.vectorTracks = src.vectorTracks.map((trk) => ({
      id: trk.id,
      name: trk.name,
      visible: trk.visible,
      cels: cloneVecCelsMap(trk.cels),
    }));
    copy.activeVectorTrackId = src.activeVectorTrackId;
    copy.layerOrder = [...src.layerOrder];
    copy.layerParents = { ...src.layerParents };
    copy.layerIK = { ...(src.layerIK || {}) };
    copy.nestedClips = new Map();
    for (const [cid, clip] of src.nestedClips.entries()) {
      copy.nestedClips.set(cid, {
        id: clip.id,
        name: clip.name,
        sourceLayer: clip.sourceLayer,
        totalFrames: clip.totalFrames,
        currentFrame: clip.currentFrame,
        loopRange: clip.loopRange ? { ...clip.loopRange } : null,
        celTracks: clip.celTracks.map((trk) => ({
          id: trk.id,
          name: trk.name,
          visible: trk.visible,
          cels: cloneCelCelsMap(trk.cels),
        })),
        activeCelTrackId: clip.activeCelTrackId,
        vectorTracks: clip.vectorTracks.map((trk) => ({
          id: trk.id,
          name: trk.name,
          visible: trk.visible,
          cels: cloneVecCelsMap(trk.cels),
        })),
        activeVectorTrackId: clip.activeVectorTrackId,
        layerOrder: [...clip.layerOrder],
        layerParents: { ...clip.layerParents },
        layerIK: { ...(clip.layerIK || {}) },
      });
    }
    copy.bgLayers = src.bgLayers.map((bg) => {
      const bgC = createCelCanvas(bg.canvas.width, bg.canvas.height);
      bgC.getContext('2d')?.drawImage(bg.canvas, 0, 0);
      return {
        id: bg.id,
        trackName: bg.trackName,
        canvas: bgC,
        undoStack: [],
        hasInk: bg.hasInk,
        visible: bg.visible,
        name: bg.name,
        offsetX: bg.offsetX,
        offsetY: bg.offsetY,
        originX: bg.originX,
        originY: bg.originY,
        rotation: bg.rotation,
        scale: bg.scale,
      };
    });
    copy.activeBgLayerId = src.activeBgLayerId;
    copy.mouthLayers = src.mouthLayers.map((m) => ({
      id: m.id,
      name: m.name,
      visible: m.visible,
      keys: new Map(Array.from(m.keys.entries()).map(([k, v]) => [k, { ...v }])),
      visemes: m.visemes.map((v) => {
        const vc = createCelCanvas(MOUTH_W, MOUTH_H);
        vc.getContext('2d')?.drawImage(v.canvas, 0, 0);
        return { name: v.name, canvas: vc, undoStack: [] };
      }),
    }));
    copy.activeMouthLayerId = src.activeMouthLayerId;
    copy.cameraKeys = new Map(Array.from(src.cameraKeys.entries()).map(([k, v]) => [k, { ...v }]));
    copy.audioTracks = src.audioTracks.map((aTrk) => ({
      id: aTrk.id,
      name: aTrk.name,
      volume: aTrk.volume,
      muted: aTrk.muted,
      clip: aTrk.clip ? { ...aTrk.clip } : null,
    }));
    copy.activeAudioTrackId = src.activeAudioTrackId;
    return copy;
  }

  function renderScenesGrid(): void {
    scenesGrid.innerHTML = '';
    const thumbW = 320;
    const thumbH = Math.round(320 * (WORLD_H / WORLD_W));

    app.scenes.forEach((sc, idx) => {
      const card = document.createElement('div');
      card.className = 'scene-card' + (sc.id === app.activeSceneId ? ' selected' : '');
      card.draggable = true;

      const thumbBox = document.createElement('div');
      thumbBox.className = 'scene-thumb-box';
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = thumbW;
      thumbCanvas.height = thumbH;
      const tctx = thumbCanvas.getContext('2d');
      if (tctx) renderSceneToContext(sc, tctx, thumbW, thumbH, 0, true, false);
      thumbBox.appendChild(thumbCanvas);

      const badge = document.createElement('div');
      badge.className = 'scene-num-badge';
      badge.textContent = `#${idx + 1}`;
      thumbBox.appendChild(badge);
      card.appendChild(thumbBox);

      const meta = document.createElement('div');
      meta.className = 'scene-meta';

      const titleRow = document.createElement('div');
      titleRow.className = 'scene-title-row';
      const nameInput = document.createElement('input');
      nameInput.className = 'scene-name-input';
      nameInput.value = sc.name;
      nameInput.onclick = (e) => e.stopPropagation();
      nameInput.onchange = () => {
        sc.name = nameInput.value.trim() || `Scene ${idx + 1}`;
        if (sc.id === app.activeSceneId) activeSceneLabel.textContent = sc.name;
        renderScenesPreview();
      };
      titleRow.appendChild(nameInput);
      meta.appendChild(titleRow);

      const actRow = document.createElement('div');
      actRow.className = 'scene-actions-row';

      const info = document.createElement('span');
      info.className = 'scene-info-txt';
      const secStr = (sc.totalFrames / app.fps).toFixed(1);
      info.textContent = `${sc.totalFrames}f (${secStr}s)` + (sc.audioTracks.some((t) => Boolean(t.clip)) ? ' • 🔊' : '');
      actRow.appendChild(info);

      const btns = document.createElement('div');
      btns.style.display = 'flex';
      btns.style.gap = '3px';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'mini-btn';
      btnEdit.textContent = 'Edit';
      btnEdit.onclick = (e) => {
        e.stopPropagation();
        selectSceneForEditor(sc.id, true);
      };

      const btnDup = document.createElement('button');
      btnDup.className = 'mini-btn';
      btnDup.textContent = 'Dup';
      btnDup.title = 'Duplicate Scene';
      btnDup.onclick = (e) => {
        e.stopPropagation();
        const copy = duplicateSceneObj(sc);
        app.scenes.splice(idx + 1, 0, copy);
        renderScenesView();
      };

      const btnDel = document.createElement('button');
      btnDel.className = 'mini-btn danger';
      btnDel.textContent = '✕';
      btnDel.title = 'Delete Scene';
      btnDel.onclick = (e) => {
        e.stopPropagation();
        if (app.scenes.length <= 1) return;
        app.scenes.splice(idx, 1);
        if (app.activeSceneId === sc.id) {
          app.activeSceneId = app.scenes[Math.max(0, idx - 1)].id;
          activeSceneLabel.textContent = activeScene().name;
        }
        renderScenesView();
      };

      btns.append(btnEdit, btnDup, btnDel);
      actRow.appendChild(btns);
      meta.appendChild(actRow);
      card.appendChild(meta);

      card.onclick = () => selectSceneForEditor(sc.id, false);
      card.ondblclick = () => selectSceneForEditor(sc.id, true);

      card.addEventListener('dragstart', (e) => {
        draggingSceneId = sc.id;
        card.classList.add('dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', sc.id);
        }
      });

      card.addEventListener('dragover', (e) => {
        if (!draggingSceneId || draggingSceneId === sc.id) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        if (!draggingSceneId || draggingSceneId === sc.id) return;
        e.preventDefault();
        e.stopPropagation();
        card.classList.remove('drag-over');

        const fromIdx = app.scenes.findIndex((s) => s.id === draggingSceneId);
        const toIdx = app.scenes.findIndex((s) => s.id === sc.id);
        if (fromIdx >= 0 && toIdx >= 0) {
          const [moved] = app.scenes.splice(fromIdx, 1);
          app.scenes.splice(toIdx, 0, moved);
          renderScenesView();
        }
      });

      card.addEventListener('dragend', () => {
        draggingSceneId = null;
        card.classList.remove('dragging');
        scenesGrid.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'));
      });

      scenesGrid.appendChild(card);
    });
  }

  function renderScenesView(): void {
    scenesBoard.style.setProperty('--scene-card-w', `${app.scenesBoardZoomPx}px`);
    renderScenesScrubber();
    renderScenesGrid();
    renderScenesPreview();
  }

  mustEl<HTMLButtonElement>('btnNewScene').onclick = () => {
    const nextNum = app.scenes.length + 1;
    const sc = makeScene(`Scene ${nextNum}`);
    app.scenes.push(sc);
    app.activeSceneId = sc.id;
    activeSceneLabel.textContent = sc.name;
    renderScenesView();
  };

  scenesZoomSlider.oninput = () => {
    app.scenesBoardZoomPx = Number(scenesZoomSlider.value);
    scenesBoard.style.setProperty('--scene-card-w', `${app.scenesBoardZoomPx}px`);
  };

  scenesBoard.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || !e.shiftKey) {
        e.preventDefault();
        const step = e.deltaY < 0 ? 18 : -18;
        app.scenesBoardZoomPx = Math.max(90, Math.min(380, app.scenesBoardZoomPx + step));
        scenesZoomSlider.value = String(app.scenesBoardZoomPx);
        scenesBoard.style.setProperty('--scene-card-w', `${app.scenesBoardZoomPx}px`);
      }
    },
    { passive: false }
  );

  // Keyboard Shortcuts
  window.addEventListener(
    'keydown',
    (e) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT')) return;
      if (e.code === 'Escape') {
        const hadOpenOverlay =
          celContextMenu.style.display === 'flex' ||
          mouthContextMenu.style.display === 'flex' ||
          audioContextMenu.style.display === 'flex' ||
          camContextMenu.style.display === 'flex' ||
          layerContextMenu.style.display === 'flex' ||
          exportMenu.classList.contains('open') ||
          sizeMenu.classList.contains('open') ||
          camPopover.classList.contains('open') ||
          mouthSheetPop.classList.contains('open');
        hideMenus();
        toggleCameraPanel(false);
        mouthSheetPop.classList.remove('open');
        if (!hadOpenOverlay && nestStack.length > 0) {
          exitNestLevel();
        }
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        if (app.mode === 'scenes') toggleScenesPlay();
        else togglePlay();
        return;
      }

      if (app.mode === 'scenes') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoActiveLayer();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (state.selectedTrack === 'audio' && state.audio) {
          deleteActiveAudio();
        } else if (!isBasicMode() && state.selectedTrack === 'mouth') {
          deleteMouthKeyAtFrame(state.currentFrame);
        } else if (!isBasicMode() && state.selectedTrack === 'cam') {
          if (state.cameraKeys.has(state.currentFrame)) {
            state.cameraKeys.delete(state.currentFrame);
            syncInspectorUI();
            renderTimeline();
            renderStage();
          }
        } else if (!isBasicMode() && state.selectedTrack === 'vector') {
          deleteVectorCelAtFrame(state.currentFrame);
        } else if (state.selectedTrack === 'cel') {
          deleteCelAtFrame(state.currentFrame);
        }
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'b') {
        selectTool('brush');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'e') {
        selectTool('eraser');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'f') {
        selectTool('fill');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key.toLowerCase() === 'm' || e.key.toLowerCase() === 'r')) {
        selectTool('moveCam');
      } else if (
        !isBasicMode() &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'n' &&
        (state.activeLayer === 'vector' || state.activeLayer === 'cel')
      ) {
        selectTool('nudge');
      } else if (
        !isBasicMode() &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'v' &&
        state.activeLayer === 'vector'
      ) {
        selectTool('vectorEdit');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        goToFrame(0);
        if (state.isPlaying) scheduleAudioAtFrame(0);
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && ((e.key >= '1' && e.key <= '9') || e.key === '0')) {
        const swIdx = e.key === '0' ? 9 : Number(e.key) - 1;
        if (swIdx < paletteColors.length) {
          e.preventDefault();
          activeSwatchIdx = swIdx;
          state.brushColor = paletteColors[swIdx];
          brushColor.value = state.brushColor;
          renderPalette();
          renderStage();
        }
      } else if (e.key === '[' || e.code === 'BracketLeft') {
        e.preventDefault();
        setBrushSize((state.tool === 'nudge' ? state.nudgeRadius - 6 : state.brushSize - 1));
      } else if (e.key === ']' || e.code === 'BracketRight') {
        e.preventDefault();
        setBrushSize((state.tool === 'nudge' ? state.nudgeRadius + 6 : state.brushSize + 1));
      } else if (e.key === 'ArrowRight' || e.key === '.') {
        stepForwardOrExtend();
      } else if (e.key === 'ArrowLeft' || e.key === ',') {
        goToFrame(state.currentFrame - 1);
      } else if (e.key.toLowerCase() === 'o') {
        btnOnion.click();
      }
    },
    { signal }
  );

  // ==========================================
  // Save / Load Project JSON
  // ==========================================
  interface SerializedCel {
    frame: number;
    duration?: number;
    hasInk?: boolean;
    offsetX?: number;
    offsetY?: number;
    originX?: number;
    originY?: number;
    rotation?: number;
    scale?: number;
    posKeys?: CelPosKey[];
    nestId?: string;
    nestOriginFrame?: number;
    width?: number;
    height?: number;
    dataUrl: string;
  }

  interface SerializedVectorCel {
    frame: number;
    duration?: number;
    hasInk?: boolean;
    offsetX?: number;
    offsetY?: number;
    originX?: number;
    originY?: number;
    rotation?: number;
    scale?: number;
    posKeys?: CelPosKey[];
    nestId?: string;
    nestOriginFrame?: number;
    items: VectorItem[];
  }

  interface SerializedVectorTrack {
    id: string;
    name: string;
    visible?: boolean;
    cels: SerializedVectorCel[];
  }

  interface SerializedCelTrack {
    id: string;
    name: string;
    visible?: boolean;
    cels: SerializedCel[];
  }

  interface SerializedBgLayer {
    id?: string;
    trackName?: string;
    hasInk?: boolean;
    visible?: boolean;
    name?: string;
    offsetX?: number;
    offsetY?: number;
    originX?: number;
    originY?: number;
    rotation?: number;
    scale?: number;
    width?: number;
    height?: number;
    dataUrl: string | null;
  }

  interface SerializedMouthLayer {
    id?: string;
    name?: string;
    visible?: boolean;
    keys?: Array<[number, MouthKey]>;
    visemes?: Array<{ name: string; dataUrl: string }>;
  }

  interface SerializedNestedClip {
    id: string;
    name: string;
    sourceLayer?: 'cel' | 'vector';
    totalFrames?: number;
    loopRange?: LoopRange | null;
    celTracks?: SerializedCelTrack[];
    activeCelTrackId?: string;
    cels?: SerializedCel[];
    vectorTracks?: SerializedVectorTrack[];
    activeVectorTrackId?: string;
    vectorCels?: SerializedVectorCel[];
    layerOrder?: string[];
    layerParents?: Record<string, string | null>;
    layerIK?: Record<string, boolean>;
    celName?: string;
  }

  interface SerializedScene {
    id?: string;
    name?: string;
    totalFrames?: number;
    loopRange?: LoopRange | null;
    celTracks?: SerializedCelTrack[];
    activeCelTrackId?: string;
    cels?: SerializedCel[];
    vectorTracks?: SerializedVectorTrack[];
    activeVectorTrackId?: string;
    vectorCels?: SerializedVectorCel[];
    bgLayers?: SerializedBgLayer[];
    activeBgLayerId?: string;
    mouthLayers?: SerializedMouthLayer[];
    activeMouthLayerId?: string;
    layerOrder?: string[];
    layerParents?: Record<string, string | null>;
    layerIK?: Record<string, boolean>;
    layerNames?: { cel: string; bg: string; mouth: string };
    nestedClips?: SerializedNestedClip[];
    cameraKeys?: Array<[number, CameraKey]>;
    bgLayer?: SerializedBgLayer;
    mouthLayer?: SerializedMouthLayer;
  }

  function serializeCelMap(celsMap: Map<number, Cel>): SerializedCel[] {
    const arr: SerializedCel[] = [];
    for (const [frame, cel] of celsMap.entries()) {
      arr.push({
        frame,
        duration: cel.duration,
        hasInk: cel.hasInk,
        offsetX: cel.offsetX,
        offsetY: cel.offsetY,
        originX: cel.originX,
        originY: cel.originY,
        rotation: cel.rotation,
        scale: cel.scale,
        posKeys: clonePosKeys(cel.posKeys),
        nestId: cel.nestId,
        nestOriginFrame: cel.nestOriginFrame,
        width: cel.canvas.width,
        height: cel.canvas.height,
        dataUrl: cel.canvas.toDataURL('image/png'),
      });
    }
    return arr;
  }

  function serializeCelTracks(tracks: CelTrack[]): SerializedCelTrack[] {
    return tracks.map((trk) => ({
      id: trk.id,
      name: trk.name,
      visible: trk.visible,
      cels: serializeCelMap(trk.cels),
    }));
  }

  function serializeVectorCelMap(vCelsMap: Map<number, VectorCel>): SerializedVectorCel[] {
    const arr: SerializedVectorCel[] = [];
    for (const [frame, vCel] of vCelsMap.entries()) {
      arr.push({
        frame,
        duration: vCel.duration,
        hasInk: vCel.hasInk,
        offsetX: vCel.offsetX,
        offsetY: vCel.offsetY,
        originX: vCel.originX,
        originY: vCel.originY,
        rotation: vCel.rotation,
        scale: vCel.scale,
        posKeys: clonePosKeys(vCel.posKeys),
        nestId: vCel.nestId,
        nestOriginFrame: vCel.nestOriginFrame,
        items: cloneVectorItems(vCel.items),
      });
    }
    return arr;
  }

  function serializeVectorTracks(tracks: VectorTrack[]): SerializedVectorTrack[] {
    return tracks.map((trk) => ({
      id: trk.id,
      name: trk.name,
      visible: trk.visible,
      cels: serializeVectorCelMap(trk.cels),
    }));
  }

  async function deserializeCelMapInto(targetMap: Map<number, Cel>, rawCels: SerializedCel[] | undefined): Promise<void> {
    for (const item of rawCels || []) {
      const canvas = createCelCanvas(item.width || WORLD_W, item.height || WORLD_H);
      const cel: Cel = {
        canvas,
        undoStack: [],
        hasInk: Boolean(item.hasInk),
        duration: item.duration || 1,
        offsetX: item.offsetX || 0,
        offsetY: item.offsetY || 0,
        originX: item.originX,
        originY: item.originY,
        rotation: item.rotation,
        scale: item.scale,
        posKeys: clonePosKeys(item.posKeys),
        nestId: item.nestId,
        nestOriginFrame: item.nestOriginFrame,
      };
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const cctx = canvas.getContext('2d');
          if (cctx) {
            cctx.imageSmoothingEnabled = false;
            cctx.drawImage(img, 0, 0);
          }
          resolve();
        };
        img.src = item.dataUrl;
      });
      targetMap.set(item.frame, cel);
    }
  }

  async function deserializeCelTracks(
    rawTracks: SerializedCelTrack[] | undefined,
    legacyCels: SerializedCel[] | undefined,
    legacyName?: string
  ): Promise<CelTrack[]> {
    if (Array.isArray(rawTracks) && rawTracks.length > 0) {
      const out: CelTrack[] = [];
      for (let idx = 0; idx < rawTracks.length; idx++) {
        const rt = rawTracks[idx];
        const cels = new Map<number, Cel>();
        await deserializeCelMapInto(cels, rt.cels);
        out.push({
          id: rt.id || 'ctrk_' + Math.random().toString(36).slice(2, 10),
          name: rt.name || `Bitmap ${idx + 1}`,
          visible: rt.visible !== false,
          cels,
        });
      }
      return out;
    }
    const trk = createCelTrack(legacyName || 'Bitmap 1', true);
    if (Array.isArray(legacyCels) && legacyCels.length > 0) {
      trk.cels.clear();
      await deserializeCelMapInto(trk.cels, legacyCels);
    }
    return [trk];
  }

  function deserializeVectorCelMapInto(
    targetMap: Map<number, VectorCel>,
    rawVCels: SerializedVectorCel[] | undefined
  ): void {
    for (const vItem of rawVCels || []) {
      targetMap.set(vItem.frame, {
        items: cloneVectorItems(vItem.items || []),
        undoStack: [],
        hasInk: Boolean(vItem.hasInk),
        duration: vItem.duration || 1,
        offsetX: vItem.offsetX || 0,
        offsetY: vItem.offsetY || 0,
        originX: vItem.originX,
        originY: vItem.originY,
        rotation: vItem.rotation,
        scale: vItem.scale,
        posKeys: clonePosKeys(vItem.posKeys),
        nestId: vItem.nestId,
        nestOriginFrame: vItem.nestOriginFrame,
      });
    }
  }

  function deserializeVectorTracks(
    rawTracks: SerializedVectorTrack[] | undefined,
    legacyVCels: SerializedVectorCel[] | undefined
  ): VectorTrack[] {
    if (Array.isArray(rawTracks) && rawTracks.length > 0) {
      return rawTracks.map((rt, idx) => {
        const cels = new Map<number, VectorCel>();
        deserializeVectorCelMapInto(cels, rt.cels);
        return {
          id: rt.id || 'vtrk_' + Math.random().toString(36).slice(2, 10),
          name: rt.name || `Vector ${idx + 1}`,
          visible: rt.visible !== false,
          cels,
        };
      });
    }
    const trk = createVectorTrack('Vector 1', true);
    if (Array.isArray(legacyVCels) && legacyVCels.length > 0) {
      trk.cels.clear();
      deserializeVectorCelMapInto(trk.cels, legacyVCels);
    }
    return [trk];
  }

  function serializeScene(sc: Scene): SerializedScene {
    const nestedClipsArr: SerializedNestedClip[] = [];
    for (const clip of sc.nestedClips.values()) {
      nestedClipsArr.push({
        id: clip.id,
        name: clip.name,
        sourceLayer: clip.sourceLayer,
        totalFrames: clip.totalFrames,
        loopRange: clip.loopRange,
        celTracks: serializeCelTracks(clip.celTracks),
        activeCelTrackId: clip.activeCelTrackId,
        vectorTracks: serializeVectorTracks(clip.vectorTracks),
        activeVectorTrackId: clip.activeVectorTrackId,
        layerOrder: [...clip.layerOrder],
        layerParents: { ...clip.layerParents },
        layerIK: { ...(clip.layerIK || {}) },
      });
    }
    return {
      id: sc.id,
      name: sc.name,
      totalFrames: sc.totalFrames,
      loopRange: sc.loopRange,
      celTracks: serializeCelTracks(sc.celTracks),
      activeCelTrackId: sc.activeCelTrackId,
      vectorTracks: serializeVectorTracks(sc.vectorTracks),
      activeVectorTrackId: sc.activeVectorTrackId,
      bgLayers: sc.bgLayers.map((bg) => ({
        id: bg.id,
        trackName: bg.trackName,
        hasInk: bg.hasInk,
        visible: bg.visible,
        name: bg.name,
        offsetX: bg.offsetX,
        offsetY: bg.offsetY,
        originX: bg.originX,
        originY: bg.originY,
        rotation: bg.rotation,
        scale: bg.scale,
        width: bg.canvas.width,
        height: bg.canvas.height,
        dataUrl: bg.hasInk ? bg.canvas.toDataURL('image/png') : null,
      })),
      activeBgLayerId: sc.activeBgLayerId,
      mouthLayers: sc.mouthLayers.map((m) => ({
        id: m.id,
        name: m.name,
        visible: m.visible,
        keys: Array.from(m.keys.entries()),
        visemes: m.visemes.map((v) => ({
          name: v.name,
          dataUrl: v.canvas.toDataURL('image/png'),
        })),
      })),
      activeMouthLayerId: sc.activeMouthLayerId,
      layerOrder: [...sc.layerOrder],
      layerParents: { ...sc.layerParents },
      layerIK: { ...(sc.layerIK || {}) },
      nestedClips: nestedClipsArr,
      cameraKeys: Array.from(sc.cameraKeys.entries()),
    };
  }

  async function deserializeBgLayerEntry(rawBg: SerializedBgLayer, fallbackName: string): Promise<BgLayer> {
    const bg = createBgLayer(rawBg.trackName || fallbackName, Boolean(rawBg.visible));
    if (rawBg.id) bg.id = rawBg.id;
    bg.hasInk = Boolean(rawBg.hasInk);
    bg.name = rawBg.name || '';
    bg.offsetX = rawBg.offsetX || 0;
    bg.offsetY = rawBg.offsetY || 0;
    bg.originX = rawBg.originX;
    bg.originY = rawBg.originY;
    bg.rotation = rawBg.rotation;
    bg.scale = rawBg.scale;
    bg.canvas = createCelCanvas(rawBg.width || WORLD_W, rawBg.height || WORLD_H);
    if (rawBg.dataUrl) {
      const dataUrl = rawBg.dataUrl;
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const bctx = bg.canvas.getContext('2d');
          if (bctx) {
            bctx.imageSmoothingEnabled = false;
            bctx.drawImage(img, 0, 0);
          }
          resolve();
        };
        img.src = dataUrl;
      });
    }
    return bg;
  }

  async function deserializeMouthLayerEntry(rawM: SerializedMouthLayer, fallbackName: string): Promise<MouthLayer> {
    const ml = createMouthLayer(rawM.name || fallbackName, Boolean(rawM.visible));
    if (rawM.id) ml.id = rawM.id;
    ml.keys = new Map(rawM.keys || []);
    if (Array.isArray(rawM.visemes)) {
      for (let i = 0; i < rawM.visemes.length; i++) {
        const vData = rawM.visemes[i];
        if (!vData) continue;
        if (i >= ml.visemes.length) {
          ml.visemes.push({
            name: vData.name || `Shape ${i + 1}`,
            canvas: createCelCanvas(MOUTH_W, MOUTH_H),
            undoStack: [],
          });
        } else if (vData.name) {
          ml.visemes[i].name = vData.name;
        }
        if (vData.dataUrl) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              const vctx = ml.visemes[i].canvas.getContext('2d');
              if (vctx) {
                vctx.imageSmoothingEnabled = false;
                vctx.clearRect(0, 0, MOUTH_W, MOUTH_H);
                vctx.drawImage(img, 0, 0);
              }
              resolve();
            };
            img.src = vData.dataUrl;
          });
        }
      }
    }
    return ml;
  }

  async function deserializeScene(raw: SerializedScene, fallbackName: string): Promise<Scene> {
    const sc = makeScene(raw.name || fallbackName);
    if (raw.id) sc.id = raw.id;
    sc.totalFrames = raw.totalFrames || 24;
    sc.loopRange = raw.loopRange || null;
    sc.nestedClips.clear();
    sc.cameraKeys = new Map(raw.cameraKeys || []);

    sc.celTracks = await deserializeCelTracks(raw.celTracks, raw.cels, raw.layerNames?.cel);
    sc.activeCelTrackId =
      raw.activeCelTrackId && sc.celTracks.some((t) => t.id === raw.activeCelTrackId)
        ? raw.activeCelTrackId
        : sc.celTracks[0].id;

    sc.vectorTracks = deserializeVectorTracks(raw.vectorTracks, raw.vectorCels);
    sc.activeVectorTrackId =
      raw.activeVectorTrackId && sc.vectorTracks.some((t) => t.id === raw.activeVectorTrackId)
        ? raw.activeVectorTrackId
        : sc.vectorTracks[0].id;

    if (Array.isArray(raw.bgLayers) && raw.bgLayers.length > 0) {
      sc.bgLayers = [];
      for (let i = 0; i < raw.bgLayers.length; i++) {
        sc.bgLayers.push(await deserializeBgLayerEntry(raw.bgLayers[i], `Background ${i + 1}`));
      }
    } else if (raw.bgLayer) {
      sc.bgLayers = [await deserializeBgLayerEntry(raw.bgLayer, raw.layerNames?.bg || 'Background 1')];
    }
    sc.activeBgLayerId =
      raw.activeBgLayerId && sc.bgLayers.some((b) => b.id === raw.activeBgLayerId)
        ? raw.activeBgLayerId
        : sc.bgLayers[0].id;

    if (Array.isArray(raw.mouthLayers) && raw.mouthLayers.length > 0) {
      sc.mouthLayers = [];
      for (let i = 0; i < raw.mouthLayers.length; i++) {
        sc.mouthLayers.push(await deserializeMouthLayerEntry(raw.mouthLayers[i], `Picker ${i + 1}`));
      }
    } else if (raw.mouthLayer) {
      sc.mouthLayers = [await deserializeMouthLayerEntry(raw.mouthLayer, raw.layerNames?.mouth || 'Picker 1')];
    }
    sc.activeMouthLayerId =
      raw.activeMouthLayerId && sc.mouthLayers.some((m) => m.id === raw.activeMouthLayerId)
        ? raw.activeMouthLayerId
        : sc.mouthLayers[0].id;

    if (Array.isArray(raw.layerOrder)) sc.layerOrder = [...raw.layerOrder];
    if (raw.layerParents && typeof raw.layerParents === 'object') sc.layerParents = { ...raw.layerParents };
    if (raw.layerIK && typeof raw.layerIK === 'object') sc.layerIK = { ...raw.layerIK };

    for (const rawClip of raw.nestedClips || []) {
      const clipCelTracks = await deserializeCelTracks(rawClip.celTracks, rawClip.cels, rawClip.celName);
      const clipVecTracks = deserializeVectorTracks(rawClip.vectorTracks, rawClip.vectorCels);
      const clip: NestedClip = {
        id: rawClip.id,
        name: rawClip.name || 'Nest',
        sourceLayer: rawClip.sourceLayer === 'vector' ? 'vector' : 'cel',
        totalFrames: Math.max(1, rawClip.totalFrames || 1),
        currentFrame: 0,
        loopRange: rawClip.loopRange || null,
        celTracks: clipCelTracks,
        activeCelTrackId:
          rawClip.activeCelTrackId && clipCelTracks.some((t) => t.id === rawClip.activeCelTrackId)
            ? rawClip.activeCelTrackId
            : clipCelTracks[0].id,
        vectorTracks: clipVecTracks,
        activeVectorTrackId:
          rawClip.activeVectorTrackId && clipVecTracks.some((t) => t.id === rawClip.activeVectorTrackId)
            ? rawClip.activeVectorTrackId
            : clipVecTracks[0].id,
        layerOrder: Array.isArray(rawClip.layerOrder)
          ? [...rawClip.layerOrder]
          : [...clipVecTracks.map((t) => `vector:${t.id}`), ...clipCelTracks.map((t) => `cel:${t.id}`)],
        layerParents:
          rawClip.layerParents && typeof rawClip.layerParents === 'object' ? { ...rawClip.layerParents } : {},
        layerIK: rawClip.layerIK && typeof rawClip.layerIK === 'object' ? { ...rawClip.layerIK } : {},
      };
      normalizeTargetHierarchy(clip);
      sc.nestedClips.set(clip.id, clip);
    }
    normalizeTargetHierarchy(sc);

    return sc;
  }

  mustEl<HTMLButtonElement>('btnSaveJson').onclick = () => {
    hideMenus();
    const payload = {
      version: 4,
      worldW: WORLD_W,
      worldH: WORLD_H,
      fps: app.fps,
      activeSceneId: app.activeSceneId,
      scenes: app.scenes.map(serializeScene),
    };
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    triggerDownload(blob, 'animation-project.json');
  };

  const fileInput = mustEl<HTMLInputElement>('fileInput');
  mustEl<HTMLButtonElement>('btnLoadJson').onclick = () => fileInput.click();
  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data.worldW && data.worldH) {
          WORLD_W = data.worldW;
          WORLD_H = data.worldH;
          btnCanvasSize.textContent = `📐 ${WORLD_W}×${WORLD_H} ▾`;
        }
        app.fps = data.fps === 24 ? 24 : 12;
        mustEl<HTMLSelectElement>('fpsSelect').value = String(app.fps);

        if (Array.isArray(data.scenes) && data.scenes.length > 0) {
          const loaded: Scene[] = [];
          for (let i = 0; i < data.scenes.length; i++) {
            loaded.push(await deserializeScene(data.scenes[i], `Scene ${i + 1}`));
          }
          app.scenes = loaded;
          app.activeSceneId = loaded.some((s) => s.id === data.activeSceneId) ? data.activeSceneId : loaded[0].id;
        } else {
          const single = await deserializeScene(data, 'Scene 1');
          app.scenes = [single];
          app.activeSceneId = single.id;
        }

        loadSceneIntoEditorUI(activeScene());
        if (app.mode === 'scenes') renderScenesView();
      } catch {
        onNotify('Could not parse project JSON file.');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  };

  // ==========================================
  // Export (PNGs, MP4, WebM)
  // ==========================================
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) {
      c = crcTable[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function buildZipBlob(files: Array<{ name: string; data: Uint8Array }>): Blob {
    const encoder = new TextEncoder();
    const localParts: BlobPart[] = [];
    const centralParts: BlobPart[] = [];
    let offset = 0;

    for (const file of files) {
      const nameBytes = encoder.encode(file.name);
      const data = file.data;
      const crc = crc32(data);

      const lh = new ArrayBuffer(30 + nameBytes.length);
      const ldv = new DataView(lh);
      ldv.setUint32(0, 0x04034b50, true);
      ldv.setUint16(4, 20, true);
      ldv.setUint16(6, 0, true);
      ldv.setUint16(8, 0, true);
      ldv.setUint16(10, 0, true);
      ldv.setUint16(12, 0, true);
      ldv.setUint32(14, crc, true);
      ldv.setUint32(18, data.length, true);
      ldv.setUint32(22, data.length, true);
      ldv.setUint16(26, nameBytes.length, true);
      ldv.setUint16(28, 0, true);
      new Uint8Array(lh, 30).set(nameBytes);

      localParts.push(new Uint8Array(lh), new Uint8Array(data));

      const ch = new ArrayBuffer(46 + nameBytes.length);
      const cdv = new DataView(ch);
      cdv.setUint32(0, 0x02014b50, true);
      cdv.setUint16(4, 20, true);
      cdv.setUint16(6, 20, true);
      cdv.setUint16(8, 0, true);
      cdv.setUint16(10, 0, true);
      cdv.setUint16(12, 0, true);
      cdv.setUint16(14, 0, true);
      cdv.setUint32(16, crc, true);
      cdv.setUint32(20, data.length, true);
      cdv.setUint32(24, data.length, true);
      cdv.setUint16(28, nameBytes.length, true);
      cdv.setUint16(30, 0, true);
      cdv.setUint16(32, 0, true);
      cdv.setUint16(34, 0, true);
      cdv.setUint16(36, 0, true);
      cdv.setUint32(38, 0, true);
      cdv.setUint32(42, offset, true);
      new Uint8Array(ch, 46).set(nameBytes);

      centralParts.push(new Uint8Array(ch));
      offset += 30 + nameBytes.length + data.length;
    }

    const cdSize = centralParts.reduce((s, p) => s + (p as Uint8Array).length, 0);
    const eocd = new ArrayBuffer(22);
    const edv = new DataView(eocd);
    edv.setUint32(0, 0x06054b50, true);
    edv.setUint16(4, 0, true);
    edv.setUint16(6, 0, true);
    edv.setUint16(8, files.length, true);
    edv.setUint16(10, files.length, true);
    edv.setUint32(12, cdSize, true);
    edv.setUint32(16, offset, true);
    edv.setUint16(20, 0, true);

    return new Blob([...localParts, ...centralParts, new Uint8Array(eocd)], { type: 'application/zip' });
  }

  function getExportFrameSequence(): Array<{ scene: Scene; frame: number }> {
    if (app.mode === 'scenes') {
      const seq: Array<{ scene: Scene; frame: number }> = [];
      for (const sc of app.scenes) {
        for (let f = 0; f < sc.totalFrames; f++) {
          seq.push({ scene: sc, frame: f });
        }
      }
      return seq;
    }
    const { minF, maxF } = getPlaybackBounds();
    const sc = activeScene();
    const seq: Array<{ scene: Scene; frame: number }> = [];
    for (let f = minF; f <= maxF; f++) {
      seq.push({ scene: sc, frame: f });
    }
    return seq;
  }

  mustEl<HTMLButtonElement>('btnExportPngSeq').onclick = async () => {
    hideMenus();
    if (state.isPlaying) togglePlay();
    if (app.scenesPlaying) toggleScenesPlay();
    btnExportMenu.textContent = 'Exporting PNGs...';
    btnExportMenu.disabled = true;

    try {
      const exportCanvas = createCelCanvas(WORLD_W, WORLD_H);
      const ectx = exportCanvas.getContext('2d')!;
      ectx.imageSmoothingEnabled = false;

      const seq = getExportFrameSequence();
      const files: Array<{ name: string; data: Uint8Array }> = [];

      for (let i = 0; i < seq.length; i++) {
        const { scene, frame } = seq[i];
        renderSceneToContext(scene, ectx, WORLD_W, WORLD_H, frame, true, false);
        const blob = await new Promise<Blob | null>((resolve) => exportCanvas.toBlob(resolve, 'image/png'));
        if (blob) {
          const bytes = new Uint8Array(await blob.arrayBuffer());
          const num = String(i + 1).padStart(4, '0');
          files.push({ name: `frame_${num}.png`, data: bytes });
        }
      }

      const zipBlob = buildZipBlob(files);
      triggerDownload(zipBlob, app.mode === 'scenes' ? 'all-scenes-pngs.zip' : 'png-sequence.zip');
    } finally {
      btnExportMenu.textContent = 'Export ▾';
      btnExportMenu.disabled = false;
    }
  };

  async function exportVideo(preferredFormat: 'mp4' | 'webm'): Promise<void> {
    hideMenus();
    if (state.isPlaying) togglePlay();
    if (app.scenesPlaying) toggleScenesPlay();
    btnExportMenu.textContent = 'Exporting...';
    btnExportMenu.disabled = true;

    try {
      const exportCanvas = createCelCanvas(WORLD_W, WORLD_H);
      const ectx = exportCanvas.getContext('2d')!;
      ectx.imageSmoothingEnabled = false;
      const canvasStream = exportCanvas.captureStream(app.fps);

      const seq = getExportFrameSequence();
      const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];
      let exportAudioSources: AudioBufferSourceNode[] = [];

      const hasAnyAudio =
        app.mode === 'scenes'
          ? app.scenes.some((sc) => sc.audioTracks.some((t) => t.clip && !t.clip.muted && !t.muted))
          : activeScene().audioTracks.some((t) => t.clip && !t.clip.muted && !t.muted);

      if (hasAnyAudio) {
        const ac = getAudioContext();
        const dest = ac.createMediaStreamDestination();
        if (app.mode === 'scenes') {
          exportAudioSources = scheduleMultiSceneAudio(0, ac, dest);
        } else {
          const { minF, maxF } = getPlaybackBounds();
          const startSec = minF / app.fps;
          const totalExportSec = (maxF - minF + 1) / app.fps;
          for (const aTrk of activeScene().audioTracks) {
            const clip = aTrk.clip;
            if (!clip || clip.muted || aTrk.muted) continue;
            const clipDur = clip.trimEndSec - clip.trimStartSec;
            const clipStart = clip.timelineStartSec;
            const clipEnd = clipStart + clipDur;

            if (startSec < clipEnd && startSec + totalExportSec > clipStart) {
              const src = ac.createBufferSource();
              src.buffer = clip.buffer;
              const gain = ac.createGain();
              gain.gain.value = getAudioTrackEffectiveVolume(aTrk);
              src.connect(gain);
              gain.connect(dest);
              if (startSec >= clipStart) {
                src.start(ac.currentTime, clip.trimStartSec + (startSec - clipStart), clipEnd - startSec);
              } else {
                src.start(ac.currentTime + (clipStart - startSec), clip.trimStartSec, clipDur);
              }
              exportAudioSources.push(src);
            }
          }
        }
        tracks.push(...dest.stream.getAudioTracks());
      }

      const mp4Types = hasAnyAudio
        ? [
            'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
            'video/mp4;codecs=avc1.64003E,mp4a.40.2',
            'video/mp4;codecs=avc1,mp4a.40.2',
            'video/mp4;codecs=avc1.42E01E,opus',
            'video/mp4',
          ]
        : ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1.64003E', 'video/mp4;codecs=avc1', 'video/mp4'];
      const webmTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];

      let mimeType = '';
      let ext = preferredFormat;

      if (preferredFormat === 'mp4') {
        mimeType = mp4Types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
        if (!mimeType) {
          mimeType = webmTypes.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
          ext = 'webm';
          onNotify('Native MP4 recording is not supported by this browser; exporting as WebM instead.');
        }
      } else {
        mimeType = webmTypes.find((t) => MediaRecorder.isTypeSupported(t)) || 'video/webm';
        ext = 'webm';
      }

      const combinedStream = new MediaStream(tracks);
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: BlobPart[] = [];

      await new Promise<void>(async (resolve) => {
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = () => {
          for (const src of exportAudioSources) {
            try {
              src.stop();
            } catch {
              // ignore
            }
          }
          const blob = new Blob(chunks, { type: mimeType });
          const baseName = app.mode === 'scenes' ? 'movie-all-scenes' : 'animation';
          triggerDownload(blob, `${baseName}.${ext}`);
          resolve();
        };

        recorder.start();
        const frameDelay = 1000 / app.fps;
        for (const item of seq) {
          renderSceneToContext(item.scene, ectx, WORLD_W, WORLD_H, item.frame, true, false);
          await new Promise((r) => setTimeout(r, frameDelay));
        }
        recorder.stop();
      });
    } finally {
      btnExportMenu.textContent = 'Export ▾';
      btnExportMenu.disabled = false;
    }
  }

  mustEl<HTMLButtonElement>('btnExportWebm').onclick = () => void exportVideo('webm');
  mustEl<HTMLButtonElement>('btnExportMp4').onclick = () => void exportVideo('mp4');

  // Initialize
  loadSceneIntoEditorUI(activeScene());
  resizeStageCanvas();
  goToFrame(0);

  return () => {
    abortController.abort();
    stageRO.disconnect();
    state.isPlaying = false;
    app.scenesPlaying = false;
    stopAllAudioPlayback();
    stopLiveRecPreview();
    if (micStream) {
      micStream.getTracks().forEach((t) => t.stop());
      micStream = null;
    }
    if (audioCtx) {
      void audioCtx.close();
      audioCtx = null;
    }
  };
}
