export interface PixelUndoEntry {
  type: 'pixels';
  imgData: ImageData;
  w: number;
  h: number;
  offsetX: number;
  offsetY: number;
}

export interface MoveUndoEntry {
  type: 'move';
  offsetX: number;
  offsetY: number;
}

export type UndoEntry = PixelUndoEntry | MoveUndoEntry;

export interface Cel {
  canvas: HTMLCanvasElement;
  undoStack: UndoEntry[];
  hasInk: boolean;
  duration: number;
  offsetX: number;
  offsetY: number;
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
    }
  | MoveUndoEntry;

export interface VectorCel {
  items: VectorItem[];
  undoStack: VectorUndoEntry[];
  hasInk: boolean;
  duration: number;
  offsetX: number;
  offsetY: number;
  nestId?: string;
  nestOriginFrame?: number;
}

export interface BgLayer {
  canvas: HTMLCanvasElement;
  undoStack: UndoEntry[];
  hasInk: boolean;
  visible: boolean;
  name: string;
  offsetX: number;
  offsetY: number;
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
}

export interface MouthLayer {
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
  cels: Map<number, Cel>;
  vectorCels: Map<number, VectorCel>;
}

export interface Scene {
  id: string;
  name: string;
  totalFrames: number;
  currentFrame: number;
  loopRange: LoopRange | null;
  cels: Map<number, Cel>;
  vectorCels: Map<number, VectorCel>;
  nestedClips: Map<string, NestedClip>;
  bgLayer: BgLayer;
  mouthLayer: MouthLayer;
  cameraKeys: Map<number, CameraKey>;
  audio: AudioClip | null;
}

interface BrushMask {
  cells: Array<{ dx: number; dy: number }>;
  edges: Array<{ x1: number; y1: number; x2: number; y2: number }>;
}

interface Point2D {
  x: number;
  y: number;
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

  function makeScene(name: string): Scene {
    const s: Scene = {
      id: 'sc_' + Math.random().toString(36).slice(2, 10),
      name,
      totalFrames: 24,
      currentFrame: 0,
      loopRange: null,
      cels: new Map(),
      vectorCels: new Map(),
      nestedClips: new Map(),
      bgLayer: {
        canvas: createCelCanvas(),
        undoStack: [],
        hasInk: false,
        visible: false,
        name: '',
        offsetX: 0,
        offsetY: 0,
      },
      mouthLayer: {
        visible: false,
        keys: new Map(),
        visemes: createDefaultVisemes(),
      },
      cameraKeys: new Map(),
      audio: null,
    };
    const c = createCelCanvas();
    s.cels.set(0, { canvas: c, undoStack: [], hasInk: false, duration: 1, offsetX: 0, offsetY: 0 });
    s.vectorCels.set(0, { items: [], undoStack: [], hasInk: false, duration: 1, offsetX: 0, offsetY: 0 });
    return s;
  }

  const app = {
    mode: 'editor' as 'editor' | 'scenes',
    fps: 12,
    loop: true,
    scenes: [makeScene('Scene 1')],
    activeSceneId: '',
    scenesPlaying: false,
    scenesGlobalFrame: 0,
    scenesBoardZoomPx: 220,
  };
  app.activeSceneId = app.scenes[0].id;

  function activeScene(): Scene {
    return app.scenes.find((s) => s.id === app.activeSceneId) || app.scenes[0];
  }

  interface NestBreadcrumbEntry {
    clipId: string;
    returnFrame: number;
    returnLayer: 'cel' | 'vector';
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

  const state = {
    isPlaying: false,
    onionSkin: false,
    onionBefore: true,
    onionAfter: false,
    showCelLayer: true,
    showVectorLayer: true,
    applyCamera: true,
    showVectorTrack: false,
    showBgTrack: false,
    showMouthTrack: false,
    showAudioTrack: false,
    showCamTrack: false,
    activeLayer: 'cel' as 'cel' | 'vector' | 'bg' | 'mouth',
    selectedTrack: 'cel' as 'cel' | 'vector' | 'audio' | 'mouth' | 'bg' | 'cam',

    tool: 'brush' as 'brush' | 'eraser' | 'fill' | 'moveCam' | 'nudge',
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
    get cels() {
      return activeTimelineTarget().cels;
    },
    get vectorCels() {
      return activeTimelineTarget().vectorCels;
    },
    get bgLayer() {
      return activeScene().bgLayer;
    },
    get mouthLayer() {
      return activeScene().mouthLayer;
    },
    get cameraKeys() {
      return activeScene().cameraKeys;
    },
    get audio() {
      return activeScene().audio;
    },
    set audio(v: AudioClip | null) {
      activeScene().audio = v;
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
  const btnModeEditor = mustEl<HTMLButtonElement>('btnModeEditor');
  const btnModeScenes = mustEl<HTMLButtonElement>('btnModeScenes');
  const activeSceneLabel = mustEl<HTMLSpanElement>('activeSceneLabel');
  const editorOnionGroup = mustEl<HTMLDivElement>('editorOnionGroup');

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
  const celTrackLabel = mustEl<HTMLDivElement>('celTrackLabel');
  const celTrackRow = mustEl<HTMLDivElement>('celTrackRow');
  const vectorTrackLabel = mustEl<HTMLDivElement>('vectorTrackLabel');
  const vectorTrackRow = mustEl<HTMLDivElement>('vectorTrackRow');
  const mouthTrackLabel = mustEl<HTMLDivElement>('mouthTrackLabel');
  const mouthTrackRow = mustEl<HTMLDivElement>('mouthTrackRow');
  const bgTrackLabel = mustEl<HTMLDivElement>('bgTrackLabel');
  const bgTrackRow = mustEl<HTMLDivElement>('bgTrackRow');
  const bgSpanBar = mustEl<HTMLDivElement>('bgSpanBar');
  const audioTrackLabel = mustEl<HTMLDivElement>('audioTrackLabel');
  const audioVolFill = mustEl<HTMLDivElement>('audioVolFill');
  const audioTrackRow = mustEl<HTMLDivElement>('audioTrackRow');
  const audioWaveCanvas = mustEl<HTMLCanvasElement>('audioWaveCanvas');
  const audioEmptyHint = mustEl<HTMLDivElement>('audioEmptyHint');
  const audioRecBadge = mustEl<HTMLDivElement>('audioRecBadge');
  const audioClipBox = mustEl<HTMLDivElement>('audioClipBox');
  const audioClipLabel = mustEl<HTMLDivElement>('audioClipLabel');
  const camTrackRow = mustEl<HTMLDivElement>('camTrackRow');
  const camTrackLabel = mustEl<HTMLDivElement>('camTrackLabel');
  const mouthTrackRight = mustEl<HTMLDivElement>('mouthTrackRight');
  const vectorTrackRight = mustEl<HTMLDivElement>('vectorTrackRight');
  const celTrackRight = mustEl<HTMLDivElement>('celTrackRight');
  const bgTrackRight = mustEl<HTMLDivElement>('bgTrackRight');
  const audioTrackRight = mustEl<HTMLDivElement>('audioTrackRight');
  const camTrackRight = mustEl<HTMLDivElement>('camTrackRight');
  const playheadLine = mustEl<HTMLDivElement>('playheadLine');
  const celContextMenu = mustEl<HTMLDivElement>('celContextMenu');
  const ctxNest = mustEl<HTMLButtonElement>('ctxNest');
  const ctxExitNest = mustEl<HTMLButtonElement>('ctxExitNest');
  const ctxUnnest = mustEl<HTMLButtonElement>('ctxUnnest');
  const mouthContextMenu = mustEl<HTMLDivElement>('mouthContextMenu');
  const audioContextMenu = mustEl<HTMLDivElement>('audioContextMenu');
  const camContextMenu = mustEl<HTMLDivElement>('camContextMenu');
  const paletteSwatches = mustEl<HTMLDivElement>('paletteSwatches');

  const mouthWidget = mustEl<HTMLDivElement>('mouthWidget');
  const mouthPreviewCanvas = mustEl<HTMLCanvasElement>('mouthPreviewCanvas');
  const mouthFrameBox = mustEl<HTMLDivElement>('mouthFrameBox');
  const mouthFrameLabel = mustEl<HTMLSpanElement>('mouthFrameLabel');
  const mouthSheetPop = mustEl<HTMLDivElement>('mouthSheetPop');
  const mouthSheetGrid = mustEl<HTMLDivElement>('mouthSheetGrid');
  const btnMouthDraw = mustEl<HTMLButtonElement>('btnMouthDraw');
  const btnMouthMove = mustEl<HTMLButtonElement>('btnMouthMove');
  const mouthScaleSlider = mustEl<HTMLInputElement>('mouthScaleSlider');
  const mouthScaleVal = mustEl<HTMLSpanElement>('mouthScaleVal');
  const btnToolNudge = mustEl<HTMLButtonElement>('btnToolNudge');
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
  // Page Mode Switching (Editor <-> Scenes)
  // ==========================================
  function switchToMode(mode: 'editor' | 'scenes'): void {
    if (state.isPlaying) togglePlay();
    if (app.scenesPlaying) toggleScenesPlay();
    if (mode === 'scenes' && nestStack.length > 0) {
      exitAllNests(false);
    }

    app.mode = mode;
    const isEditor = mode === 'editor';

    editorView.classList.toggle('hidden-view', !isEditor);
    scenesView.classList.toggle('hidden-view', isEditor);
    btnModeEditor.classList.toggle('active', isEditor);
    btnModeScenes.classList.toggle('active', !isEditor);
    editorOnionGroup.style.visibility = isEditor ? 'visible' : 'hidden';

    if (isEditor) {
      loadSceneIntoEditorUI(activeScene());
      requestAnimationFrame(() => {
        resizeStageCanvas();
        renderTimeline();
        renderStage();
      });
    } else {
      renderScenesView();
    }
  }

  btnModeEditor.onclick = () => switchToMode('editor');
  btnModeScenes.onclick = () => switchToMode('scenes');

  function selectSceneForEditor(sceneId: string, jumpToEditor = false): void {
    exitAllNests(false);
    app.activeSceneId = sceneId;
    loadSceneIntoEditorUI(activeScene());
    if (jumpToEditor) switchToMode('editor');
    else renderScenesGrid();
  }

  function loadSceneIntoEditorUI(sc: Scene): void {
    exitAllNests(false);
    activeSceneLabel.textContent = sc.name;
    const hasAudio = Boolean(sc.audio);
    if (sc.audio) {
      if (typeof sc.audio.volume !== 'number') sc.audio.volume = 1;
      state.audioVolume = sc.audio.volume;
    }
    updateAudioVolumeUI();
    if (hasAudio && !state.showAudioTrack) toggleAudioTrack(true);
    if (sc.bgLayer.hasInk && !state.showBgTrack) toggleBgTrack(true);
    if ((sc.mouthLayer.visible || sc.mouthLayer.keys.size > 0) && !state.showMouthTrack) toggleMouthTrack(true);
    const hasVectorContent =
      sc.vectorCels.size > 1 || Array.from(sc.vectorCels.values()).some((vc) => vc.hasInk || vc.items.length > 0 || Boolean(vc.nestId));
    if (hasVectorContent && !state.showVectorTrack) toggleVectorTrack(true);
    if (sc.cameraKeys.size > 0 && !state.showCamTrack) toggleCamTrack(true);
    updateBgUI();
    updateMouthWidget();
    updateActiveTrackHighlight();
    renderNestBreadcrumbUI();
    syncInspectorUI();
    renderTimeline();
    renderStage();
  }

  function setWorldResolution(newW: number, newH: number): void {
    if (WORLD_W === newW && WORLD_H === newH) return;
    const shiftX = Math.round((newW - WORLD_W) / 2);
    const shiftY = Math.round((newH - WORLD_H) / 2);

    WORLD_W = newW;
    WORLD_H = newH;

    for (const sc of app.scenes) {
      for (const cel of sc.cels.values()) {
        cel.offsetX += shiftX;
        cel.offsetY += shiftY;
      }
      for (const vCel of sc.vectorCels.values()) {
        vCel.offsetX += shiftX;
        vCel.offsetY += shiftY;
      }
      sc.bgLayer.offsetX += shiftX;
      sc.bgLayer.offsetY += shiftY;
      for (const mk of sc.mouthLayer.keys.values()) {
        mk.x += shiftX;
        mk.y += shiftY;
      }
    }

    btnCanvasSize.textContent = `📐 ${WORLD_W}×${WORLD_H} ▾`;
    updateStageBadge();
    if (app.mode === 'editor') renderStage();
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

  function getCelEntryInScene(sc: Scene | NestedClip, frame: number): { start: number; cel: Cel } | null {
    for (const [start, cel] of sc.cels.entries()) {
      if (frame >= start && frame < start + cel.duration) {
        return { start, cel };
      }
    }
    return null;
  }

  function getCelEntryAt(frame: number): { start: number; cel: Cel } | null {
    return getCelEntryInScene(activeTimelineTarget(), frame);
  }

  function getSortedCelStarts(): number[] {
    return Array.from(state.cels.keys()).sort((a, b) => a - b);
  }

  function getPrevCelBefore(frame: number): { start: number; cel: Cel } | null {
    const starts = getSortedCelStarts();
    let best: { start: number; cel: Cel } | null = null;
    for (const s of starts) {
      if (s < frame) {
        const cel = state.cels.get(s);
        if (cel) best = { start: s, cel };
      }
    }
    return best;
  }

  function getNextCelAfter(frame: number): { start: number; cel: Cel } | null {
    const starts = getSortedCelStarts();
    for (const s of starts) {
      if (s > frame) {
        const cel = state.cels.get(s);
        if (cel) return { start: s, cel };
      }
    }
    return null;
  }

  function ensureCelAt(frame: number, clonePrev = false): { start: number; cel: Cel } {
    const existing = getCelEntryAt(frame);
    if (existing) return existing;

    let canvas = createCelCanvas();
    let offsetX = 0;
    let offsetY = 0;
    let hasInk = false;
    let nestId: string | undefined;
    let nestOriginFrame: number | undefined;

    if (clonePrev) {
      const prev = getPrevCelBefore(frame);
      if (prev) {
        canvas = createCelCanvas(prev.cel.canvas.width, prev.cel.canvas.height);
        canvas.getContext('2d')?.drawImage(prev.cel.canvas, 0, 0);
        offsetX = prev.cel.offsetX;
        offsetY = prev.cel.offsetY;
        hasInk = prev.cel.hasInk;
        nestId = prev.cel.nestId;
        nestOriginFrame = prev.cel.nestOriginFrame;
      }
    }

    const cel: Cel = { canvas, undoStack: [], hasInk, duration: 1, offsetX, offsetY, nestId, nestOriginFrame };
    state.cels.set(frame, cel);
    return { start: frame, cel };
  }

  function cloneVectorItems(items: VectorItem[]): VectorItem[] {
    return items.map((item) => {
      if (item.kind === 'fill') {
        return {
          kind: 'fill',
          contours: item.contours.map((loop) => loop.map((p) => ({ x: p.x, y: p.y }))),
          color: item.color,
          isErase: item.isErase,
        };
      }
      if (item.kind === 'erase') {
        return {
          kind: 'erase',
          points: item.points.map((p) => ({ x: p.x, y: p.y })),
          size: item.size,
        };
      }
      return {
        kind: 'stroke',
        points: item.points.map((p) => ({ x: p.x, y: p.y })),
        color: item.color,
        size: item.size,
      };
    });
  }

  function getVectorCelEntryInScene(sc: Scene | NestedClip, frame: number): { start: number; cel: VectorCel } | null {
    for (const [start, cel] of sc.vectorCels.entries()) {
      if (frame >= start && frame < start + cel.duration) {
        return { start, cel };
      }
    }
    return null;
  }

  function getVectorCelEntryAt(frame: number): { start: number; cel: VectorCel } | null {
    return getVectorCelEntryInScene(activeTimelineTarget(), frame);
  }

  function getSortedVectorCelStarts(): number[] {
    return Array.from(state.vectorCels.keys()).sort((a, b) => a - b);
  }

  function getPrevVectorCelBefore(frame: number): { start: number; cel: VectorCel } | null {
    const starts = getSortedVectorCelStarts();
    let best: { start: number; cel: VectorCel } | null = null;
    for (const s of starts) {
      if (s < frame) {
        const cel = state.vectorCels.get(s);
        if (cel) best = { start: s, cel };
      }
    }
    return best;
  }

  function getNextVectorCelAfter(frame: number): { start: number; cel: VectorCel } | null {
    const starts = getSortedVectorCelStarts();
    for (const s of starts) {
      if (s > frame) {
        const cel = state.vectorCels.get(s);
        if (cel) return { start: s, cel };
      }
    }
    return null;
  }

  function ensureVectorCelAt(frame: number, clonePrev = false): { start: number; cel: VectorCel } {
    const existing = getVectorCelEntryAt(frame);
    if (existing) return existing;

    let items: VectorItem[] = [];
    let offsetX = 0;
    let offsetY = 0;
    let hasInk = false;
    let nestId: string | undefined;
    let nestOriginFrame: number | undefined;

    if (clonePrev) {
      const prev = getPrevVectorCelBefore(frame);
      if (prev) {
        items = cloneVectorItems(prev.cel.items);
        offsetX = prev.cel.offsetX;
        offsetY = prev.cel.offsetY;
        hasInk = prev.cel.hasInk;
        nestId = prev.cel.nestId;
        nestOriginFrame = prev.cel.nestOriginFrame;
      }
    }

    const cel: VectorCel = { items, undoStack: [], hasInk, duration: 1, offsetX, offsetY, nestId, nestOriginFrame };
    state.vectorCels.set(frame, cel);
    return { start: frame, cel };
  }

  function pushVectorItemsUndo(vCel: VectorCel): void {
    vCel.undoStack.push({
      type: 'items',
      items: cloneVectorItems(vCel.items),
      hasInk: vCel.hasInk,
      offsetX: vCel.offsetX,
      offsetY: vCel.offsetY,
    });
    if (vCel.undoStack.length > 25) vCel.undoStack.shift();
  }

  function pushVectorMoveUndo(vCel: VectorCel, offsetX: number, offsetY: number): void {
    vCel.undoStack.push({ type: 'move', offsetX, offsetY });
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

    const nextCanvas = createCelCanvas(newW, newH);
    const nctx = nextCanvas.getContext('2d');
    if (nctx) {
      nctx.imageSmoothingEnabled = false;
      nctx.drawImage(layerObj.canvas, ox - newOx, oy - newOy);
    }

    layerObj.canvas = nextCanvas;
    layerObj.offsetX = newOx;
    layerObj.offsetY = newOy;
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
    layerObj.undoStack.push({ type: 'move', offsetX, offsetY });
    if (layerObj.undoStack.length > 25) layerObj.undoStack.shift();
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
        const mx = (points[i].x + points[i + 1].x) / 2;
        const my = (points[i].y + points[i + 1].y) / 2;
        vctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
      }
      const last = points[points.length - 1];
      vctx.lineTo(last.x, last.y);
    }
    vctx.stroke();
  }

  function drawVectorItemsToContext(vctx: CanvasRenderingContext2D, items: VectorItem[]): void {
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
          vctx.moveTo(loop[0].x, loop[0].y);
          for (let i = 1; i < loop.length; i++) {
            vctx.lineTo(loop[i].x, loop[i].y);
          }
          vctx.closePath();
        }
        vctx.fill('evenodd');
        if (!item.isErase) {
          vctx.strokeStyle = item.color;
          vctx.lineWidth = 0.75;
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
        vctx.lineWidth = item.size;
        drawVectorStrokePath(vctx, item.points, item.size);
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
    isErase = false
  ): boolean {
    const localPt = { x: worldX - vCel.offsetX, y: worldY - vCel.offsetY };

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

  function floodFillVectorCel(vCel: VectorCel, worldX: number, worldY: number, hexColor: string, isErase = false): boolean {
    const w = WORLD_W;
    const h = WORLD_H;
    const sx = Math.round(worldX);
    const sy = Math.round(worldY);
    if (sx < 0 || sx >= w || sy < 0 || sy >= h) return false;

    if (vectorFillBufferCanvas.width !== w || vectorFillBufferCanvas.height !== h) {
      vectorFillBufferCanvas.width = w;
      vectorFillBufferCanvas.height = h;
    }
    vectorFillBufferCtx.clearRect(0, 0, w, h);
    vectorFillBufferCtx.save();
    vectorFillBufferCtx.translate(vCel.offsetX, vCel.offsetY);
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
    const contours = traceMaskContours(visited, w, h, -vCel.offsetX, -vCel.offsetY);
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
  function ensureMouthInitInScene(sc: Scene): void {
    if (sc.mouthLayer.keys.size === 0) {
      sc.mouthLayer.keys.set(0, {
        viseme: 0,
        x: Math.round(WORLD_W / 2),
        y: Math.round(WORLD_H * 0.56),
        scale: 100,
      });
    }
  }

  function getEvaluatedMouthInScene(sc: Scene, frame: number): (MouthKey & { keyFrame: number; isKey: boolean }) | null {
    if (!sc.mouthLayer.visible || sc.mouthLayer.keys.size === 0) return null;
    const exact = sc.mouthLayer.keys.get(frame);
    if (exact) {
      return { keyFrame: frame, ...exact, isKey: true };
    }
    let bestF: number | null = null;
    let firstF: number | null = null;
    for (const f of sc.mouthLayer.keys.keys()) {
      if (firstF === null || f < firstF) firstF = f;
      if (f <= frame && (bestF === null || f > bestF)) bestF = f;
    }
    const useF = bestF !== null ? bestF : firstF!;
    const mk = sc.mouthLayer.keys.get(useF)!;
    return { keyFrame: useF, ...mk, isKey: false };
  }

  function getActiveMouthState(): MouthKey & { keyFrame: number } {
    const evalM = getEvaluatedMouthInScene(activeScene(), state.currentFrame);
    if (evalM) return evalM;
    return {
      keyFrame: state.currentFrame,
      viseme: 0,
      x: Math.round(WORLD_W / 2),
      y: Math.round(WORLD_H * 0.56),
      scale: 100,
    };
  }

  function setMouthKeyAtCurrentFrame(patch: Partial<MouthKey>, targetFrame = state.currentFrame): void {
    const cur = getActiveMouthState();
    state.mouthLayer.keys.set(targetFrame, {
      viseme: patch.viseme !== undefined ? patch.viseme : cur.viseme,
      x: patch.x !== undefined ? patch.x : cur.x,
      y: patch.y !== undefined ? patch.y : cur.y,
      scale: patch.scale !== undefined ? patch.scale : cur.scale,
    });
  }

  function deleteMouthKeyAtFrame(frame: number): boolean {
    if (!state.mouthLayer.keys.has(frame)) return false;
    state.mouthLayer.keys.delete(frame);
    updateMouthWidget();
    renderTimeline();
    renderStage();
    return true;
  }

  function toggleMouthTrack(forceState?: boolean): void {
    state.showMouthTrack = typeof forceState === 'boolean' ? forceState : !state.showMouthTrack;
    const btn = mustEl<HTMLButtonElement>('btnToggleMouthTrack');
    btn.classList.toggle('active', state.showMouthTrack);
    mouthTrackLabel.classList.toggle('hidden-track', !state.showMouthTrack);
    mouthTrackRow.classList.toggle('hidden-track', !state.showMouthTrack);
    mouthTrackRight.classList.toggle('hidden-track', !state.showMouthTrack);

    if (state.showMouthTrack) {
      state.mouthLayer.visible = true;
      ensureMouthInitInScene(activeScene());
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
  }

  mustEl<HTMLButtonElement>('btnToggleMouthTrack').onclick = () => {
    if (nestStack.length === 0) toggleMouthTrack();
  };

  function updateMouthWidget(): void {
    const showWidget = state.showMouthTrack && state.mouthLayer.visible;
    mouthWidget.classList.toggle('open', showWidget);
    mustEl<HTMLButtonElement>('btnVisMouth').style.opacity = state.mouthLayer.visible ? '1' : '0.35';
    btnMouthDraw.classList.toggle('active', state.activeLayer === 'mouth' && state.tool !== 'moveCam');
    btnMouthMove.classList.toggle('active', state.activeLayer === 'mouth' && state.tool === 'moveCam');

    if (!showWidget) return;
    const cur = getActiveMouthState();
    const vis = state.mouthLayer.visemes[cur.viseme] || state.mouthLayer.visemes[0];
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
    const cur = getActiveMouthState();
    state.mouthLayer.visemes.forEach((vis, idx) => {
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
        setMouthKeyAtCurrentFrame({ viseme: idx });
        updateMouthWidget();
        renderTimeline();
        renderStage();
      };
      mouthSheetGrid.appendChild(slot);
    });
  }

  function cycleMouthViseme(dir: number): void {
    if (!state.mouthLayer.visible) state.mouthLayer.visible = true;
    const cur = getActiveMouthState();
    const len = state.mouthLayer.visemes.length;
    const nextIdx = (cur.viseme + dir + len) % len;
    setMouthKeyAtCurrentFrame({ viseme: nextIdx });
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
    const cur = getActiveMouthState();
    const vis = state.mouthLayer.visemes[cur.viseme];
    pushPixelUndo(vis, true);
    vis.canvas.getContext('2d')?.clearRect(0, 0, MOUTH_W, MOUTH_H);
    updateMouthWidget();
    renderStage();
  };

  mustEl<HTMLButtonElement>('btnMouthResetShape').onclick = () => {
    const cur = getActiveMouthState();
    const vis = state.mouthLayer.visemes[cur.viseme];
    pushPixelUndo(vis, true);
    drawStarterViseme(vis.canvas, cur.viseme);
    updateMouthWidget();
    renderStage();
  };

  mustEl<HTMLButtonElement>('btnVisMouth').onclick = (e) => {
    e.stopPropagation();
    state.mouthLayer.visible = !state.mouthLayer.visible;
    if (state.mouthLayer.visible) ensureMouthInitInScene(activeScene());
    updateMouthWidget();
    renderStage();
  };

  mouthTrackLabel.onclick = (e) => {
    if ((e.target as HTMLElement)?.closest('button, input, select')) return;
    setActiveLayer('mouth');
  };
  mouthTrackRow.addEventListener('pointerdown', (e) => {
    if (state.isPlaying) togglePlay();
    setActiveLayer('mouth');
    goToFrame(frameFromClientX(e.clientX));
  });

  let contextMouthFrame = 0;
  mouthTrackRow.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.isPlaying) togglePlay();
    setActiveLayer('mouth');
    contextMouthFrame = frameFromClientX(e.clientX);
    goToFrame(contextMouthFrame);

    mustEl<HTMLButtonElement>('ctxMouthDelete').disabled = !state.mouthLayer.keys.has(contextMouthFrame);
    mustEl<HTMLButtonElement>('ctxMouthClearAll').disabled = state.mouthLayer.keys.size === 0;

    mouthContextMenu.style.display = 'flex';
    const menuW = 175;
    const menuH = 105;
    const left = Math.min(window.innerWidth - menuW - 6, e.clientX);
    const top = Math.min(window.innerHeight - menuH - 6, e.clientY);
    mouthContextMenu.style.left = `${left}px`;
    mouthContextMenu.style.top = `${top}px`;
  });

  mustEl<HTMLButtonElement>('ctxMouthDelete').onclick = () => {
    deleteMouthKeyAtFrame(contextMouthFrame);
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxMouthKey').onclick = () => {
    if (!state.mouthLayer.visible) state.mouthLayer.visible = true;
    setMouthKeyAtCurrentFrame({}, contextMouthFrame);
    updateMouthWidget();
    renderTimeline();
    renderStage();
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxMouthClearAll').onclick = () => {
    state.mouthLayer.keys.clear();
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

  function getClipLoopFrame(clip: NestedClip, outerFrame: number, originFrame = 0): number {
    const len = Math.max(1, clip.totalFrames);
    const rel = outerFrame - originFrame;
    return ((rel % len) + len) % len;
  }

  function doesClipHaveInk(sc: Scene, clipId: string, depth = 0): boolean {
    if (depth > 12) return false;
    const clip = sc.nestedClips.get(clipId);
    if (!clip) return false;
    for (const c of clip.cels.values()) {
      if (c.nestId) {
        if (doesClipHaveInk(sc, c.nestId, depth + 1)) return true;
      } else if (c.hasInk) {
        return true;
      }
    }
    for (const vc of clip.vectorCels.values()) {
      if (vc.nestId) {
        if (doesClipHaveInk(sc, vc.nestId, depth + 1)) return true;
      } else if (vc.hasInk || vc.items.length > 0) {
        return true;
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
    tintColor?: string
  ): void {
    if (items.length === 0) return;
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

    vectorScratchCtx.translate(WORLD_W / 2 + cam.x, WORLD_H / 2 + cam.y);
    vectorScratchCtx.scale(cs, cs);
    vectorScratchCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

    vectorScratchCtx.beginPath();
    vectorScratchCtx.rect(0, 0, WORLD_W, WORLD_H);
    vectorScratchCtx.clip();

    vectorScratchCtx.translate(offsetX, offsetY);
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
    targetCtx: CanvasRenderingContext2D,
    vCel: VectorCel,
    targetW: number,
    targetH: number,
    cam: CameraKey,
    totalViewScale: number,
    vx: number,
    vy: number,
    alpha = 1,
    tintColor?: string
  ): void {
    renderVectorItemsWithOffset(
      targetCtx,
      vCel.items,
      vCel.offsetX,
      vCel.offsetY,
      targetW,
      targetH,
      cam,
      totalViewScale,
      vx,
      vy,
      alpha,
      tintColor
    );
  }

  function renderNestedClipAtFrame(
    sc: Scene,
    targetCtx: CanvasRenderingContext2D,
    clipId: string,
    outerFrame: number,
    originFrame: number,
    accOffsetX: number,
    accOffsetY: number,
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
    const clipFrame = getClipLoopFrame(clip, outerFrame, originFrame);

    const subCel = getCelEntryInScene(clip, clipFrame);
    if (subCel) {
      if (subCel.cel.nestId) {
        renderNestedClipAtFrame(
          sc,
          targetCtx,
          subCel.cel.nestId,
          clipFrame,
          subCel.cel.nestOriginFrame ?? 0,
          accOffsetX + subCel.cel.offsetX,
          accOffsetY + subCel.cel.offsetY,
          targetW,
          targetH,
          cam,
          totalViewScale,
          vx,
          vy,
          depth + 1
        );
      } else {
        targetCtx.imageSmoothingEnabled = false;
        targetCtx.drawImage(subCel.cel.canvas, accOffsetX + subCel.cel.offsetX, accOffsetY + subCel.cel.offsetY);
      }
    }

    const subVCel = getVectorCelEntryInScene(clip, clipFrame);
    if (subVCel) {
      if (subVCel.cel.nestId) {
        renderNestedClipAtFrame(
          sc,
          targetCtx,
          subVCel.cel.nestId,
          clipFrame,
          subVCel.cel.nestOriginFrame ?? 0,
          accOffsetX + subVCel.cel.offsetX,
          accOffsetY + subVCel.cel.offsetY,
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
          accOffsetX + subVCel.cel.offsetX,
          accOffsetY + subVCel.cel.offsetY,
          targetW,
          targetH,
          cam,
          totalViewScale,
          vx,
          vy,
          1
        );
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
      0,
      0,
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
    alpha: number
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
    targetCtx.drawImage(onionCanvas, offsetX, offsetY);
    targetCtx.restore();
  }

  function drawTintedCel(targetCtx: CanvasRenderingContext2D, cel: Cel, tintColor: string, alpha: number): void {
    drawTintedCanvas(targetCtx, cel.canvas, cel.offsetX, cel.offsetY, tintColor, alpha);
  }

  let hoverStagePt: Point2D | null = null;
  let isRightErasing = false;

  function renderStageOverlayGuides(
    targetCtx: CanvasRenderingContext2D,
    cam: CameraKey,
    totalViewScale: number
  ): void {
    const cs = cam.scale / 100;
    const inv = 1 / (totalViewScale * cs);
    targetCtx.strokeStyle = state.tool === 'moveCam' ? '#fbbf24' : 'rgba(255,255,255,0.28)';
    targetCtx.lineWidth = (state.tool === 'moveCam' ? 2 : 1) * inv;
    if (state.tool === 'moveCam') targetCtx.setLineDash([6 * inv, 4 * inv]);
    targetCtx.strokeRect(0, 0, WORLD_W, WORLD_H);
    targetCtx.setLineDash([]);

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
  }

  function renderNestToContext(
    rootSc: Scene,
    clip: NestedClip,
    targetCtx: CanvasRenderingContext2D,
    targetW: number,
    targetH: number,
    frame: number
  ): void {
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

    const activeEntry = getCelEntryInScene(clip, frame);
    if (!state.isPlaying && state.onionSkin && state.showCelLayer) {
      if (state.onionBefore) {
        const prevEntry = activeEntry ? getPrevCelBefore(activeEntry.start) : getPrevCelBefore(frame);
        if (prevEntry && isCelInkFilled(rootSc, prevEntry.cel)) {
          if (prevEntry.cel.nestId) {
            const c = rasterizeNestedClipToWorldCanvas(rootSc, prevEntry.cel.nestId, prevEntry.start, prevEntry.cel.nestOriginFrame ?? 0);
            drawTintedCanvas(targetCtx, c, prevEntry.cel.offsetX, prevEntry.cel.offsetY, '#ef4444', 0.25);
          } else {
            drawTintedCel(targetCtx, prevEntry.cel, '#ef4444', 0.25);
          }
        }
      }
      if (state.onionAfter) {
        const nextEntry = activeEntry ? getNextCelAfter(activeEntry.start) : getNextCelAfter(frame);
        if (nextEntry && isCelInkFilled(rootSc, nextEntry.cel)) {
          if (nextEntry.cel.nestId) {
            const c = rasterizeNestedClipToWorldCanvas(rootSc, nextEntry.cel.nestId, nextEntry.start, nextEntry.cel.nestOriginFrame ?? 0);
            drawTintedCanvas(targetCtx, c, nextEntry.cel.offsetX, nextEntry.cel.offsetY, '#3b82f6', 0.22);
          } else {
            drawTintedCel(targetCtx, nextEntry.cel, '#3b82f6', 0.22);
          }
        }
      }
    }

    if (state.showCelLayer && activeEntry) {
      if (activeEntry.cel.nestId) {
        renderNestedClipAtFrame(
          rootSc,
          targetCtx,
          activeEntry.cel.nestId,
          frame,
          activeEntry.cel.nestOriginFrame ?? 0,
          activeEntry.cel.offsetX,
          activeEntry.cel.offsetY,
          targetW,
          targetH,
          cam,
          totalViewScale,
          vx,
          vy,
          0
        );
      } else {
        targetCtx.imageSmoothingEnabled = false;
        targetCtx.drawImage(activeEntry.cel.canvas, activeEntry.cel.offsetX, activeEntry.cel.offsetY);
      }
    }

    const activeVectorEntry = getVectorCelEntryInScene(clip, frame);
    if (!state.isPlaying && state.onionSkin && state.showVectorLayer) {
      if (state.onionBefore) {
        const prevV = activeVectorEntry
          ? getPrevVectorCelBefore(activeVectorEntry.start)
          : getPrevVectorCelBefore(frame);
        if (prevV && isVectorCelInkFilled(rootSc, prevV.cel)) {
          if (prevV.cel.nestId) {
            const c = rasterizeNestedClipToWorldCanvas(rootSc, prevV.cel.nestId, prevV.start, prevV.cel.nestOriginFrame ?? 0);
            drawTintedCanvas(targetCtx, c, prevV.cel.offsetX, prevV.cel.offsetY, '#ef4444', 0.25);
          } else {
            renderVectorCelToContext(targetCtx, prevV.cel, targetW, targetH, cam, totalViewScale, vx, vy, 0.25, '#ef4444');
          }
        }
      }
      if (state.onionAfter) {
        const nextV = activeVectorEntry
          ? getNextVectorCelAfter(activeVectorEntry.start)
          : getNextVectorCelAfter(frame);
        if (nextV && isVectorCelInkFilled(rootSc, nextV.cel)) {
          if (nextV.cel.nestId) {
            const c = rasterizeNestedClipToWorldCanvas(rootSc, nextV.cel.nestId, nextV.start, nextV.cel.nestOriginFrame ?? 0);
            drawTintedCanvas(targetCtx, c, nextV.cel.offsetX, nextV.cel.offsetY, '#3b82f6', 0.22);
          } else {
            renderVectorCelToContext(targetCtx, nextV.cel, targetW, targetH, cam, totalViewScale, vx, vy, 0.22, '#3b82f6');
          }
        }
      }
    }

    if (state.showVectorLayer && activeVectorEntry) {
      if (activeVectorEntry.cel.nestId) {
        renderNestedClipAtFrame(
          rootSc,
          targetCtx,
          activeVectorEntry.cel.nestId,
          frame,
          activeVectorEntry.cel.nestOriginFrame ?? 0,
          activeVectorEntry.cel.offsetX,
          activeVectorEntry.cel.offsetY,
          targetW,
          targetH,
          cam,
          totalViewScale,
          vx,
          vy,
          0
        );
      } else if (activeVectorEntry.cel.items.length > 0) {
        renderVectorCelToContext(targetCtx, activeVectorEntry.cel, targetW, targetH, cam, totalViewScale, vx, vy, 1);
      }
    }

    targetCtx.restore();
    renderStageOverlayGuides(targetCtx, cam, totalViewScale);
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

    targetCtx.translate(targetW / 2 + vx, targetH / 2 + vy);
    targetCtx.scale(totalViewScale, totalViewScale);
    targetCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

    targetCtx.translate(WORLD_W / 2 + cam.x, WORLD_H / 2 + cam.y);
    targetCtx.scale(cs, cs);
    targetCtx.translate(-WORLD_W / 2, -WORLD_H / 2);

    targetCtx.save();
    targetCtx.beginPath();
    targetCtx.rect(0, 0, WORLD_W, WORLD_H);
    targetCtx.clip();

    targetCtx.fillStyle = '#ffffff';
    targetCtx.fillRect(0, 0, WORLD_W, WORLD_H);

    if (sc.bgLayer.visible && sc.bgLayer.hasInk) {
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(sc.bgLayer.canvas, sc.bgLayer.offsetX, sc.bgLayer.offsetY);
    }

    const activeEntry = getCelEntryInScene(sc, frame);

    if (!forExport && useViewport && !state.isPlaying && state.onionSkin && state.showCelLayer) {
      if (state.onionBefore) {
        const prevEntry = activeEntry ? getPrevCelBefore(activeEntry.start) : getPrevCelBefore(frame);
        if (prevEntry && isCelInkFilled(sc, prevEntry.cel)) {
          if (prevEntry.cel.nestId) {
            const c = rasterizeNestedClipToWorldCanvas(sc, prevEntry.cel.nestId, prevEntry.start, prevEntry.cel.nestOriginFrame ?? 0);
            drawTintedCanvas(targetCtx, c, prevEntry.cel.offsetX, prevEntry.cel.offsetY, '#ef4444', 0.25);
          } else {
            drawTintedCel(targetCtx, prevEntry.cel, '#ef4444', 0.25);
          }
        }
      }
      if (state.onionAfter) {
        const nextEntry = activeEntry ? getNextCelAfter(activeEntry.start) : getNextCelAfter(frame);
        if (nextEntry && isCelInkFilled(sc, nextEntry.cel)) {
          if (nextEntry.cel.nestId) {
            const c = rasterizeNestedClipToWorldCanvas(sc, nextEntry.cel.nestId, nextEntry.start, nextEntry.cel.nestOriginFrame ?? 0);
            drawTintedCanvas(targetCtx, c, nextEntry.cel.offsetX, nextEntry.cel.offsetY, '#3b82f6', 0.22);
          } else {
            drawTintedCel(targetCtx, nextEntry.cel, '#3b82f6', 0.22);
          }
        }
      }
    }

    if ((forExport || !useViewport || state.showCelLayer) && activeEntry) {
      if (activeEntry.cel.nestId) {
        renderNestedClipAtFrame(
          sc,
          targetCtx,
          activeEntry.cel.nestId,
          frame,
          activeEntry.cel.nestOriginFrame ?? 0,
          activeEntry.cel.offsetX,
          activeEntry.cel.offsetY,
          targetW,
          targetH,
          cam,
          totalViewScale,
          vx,
          vy,
          0
        );
      } else {
        targetCtx.imageSmoothingEnabled = false;
        targetCtx.drawImage(activeEntry.cel.canvas, activeEntry.cel.offsetX, activeEntry.cel.offsetY);
      }
    }

    const activeVectorEntry = getVectorCelEntryInScene(sc, frame);
    const shouldShowVector = forExport || !useViewport || state.showVectorLayer;

    if (!forExport && useViewport && !state.isPlaying && state.onionSkin && state.showVectorLayer) {
      if (state.onionBefore) {
        const prevV = activeVectorEntry
          ? getPrevVectorCelBefore(activeVectorEntry.start)
          : getPrevVectorCelBefore(frame);
        if (prevV && isVectorCelInkFilled(sc, prevV.cel)) {
          if (prevV.cel.nestId) {
            const c = rasterizeNestedClipToWorldCanvas(sc, prevV.cel.nestId, prevV.start, prevV.cel.nestOriginFrame ?? 0);
            drawTintedCanvas(targetCtx, c, prevV.cel.offsetX, prevV.cel.offsetY, '#ef4444', 0.25);
          } else {
            renderVectorCelToContext(targetCtx, prevV.cel, targetW, targetH, cam, totalViewScale, vx, vy, 0.25, '#ef4444');
          }
        }
      }
      if (state.onionAfter) {
        const nextV = activeVectorEntry
          ? getNextVectorCelAfter(activeVectorEntry.start)
          : getNextVectorCelAfter(frame);
        if (nextV && isVectorCelInkFilled(sc, nextV.cel)) {
          if (nextV.cel.nestId) {
            const c = rasterizeNestedClipToWorldCanvas(sc, nextV.cel.nestId, nextV.start, nextV.cel.nestOriginFrame ?? 0);
            drawTintedCanvas(targetCtx, c, nextV.cel.offsetX, nextV.cel.offsetY, '#3b82f6', 0.22);
          } else {
            renderVectorCelToContext(targetCtx, nextV.cel, targetW, targetH, cam, totalViewScale, vx, vy, 0.22, '#3b82f6');
          }
        }
      }
    }

    if (shouldShowVector && activeVectorEntry) {
      if (activeVectorEntry.cel.nestId) {
        renderNestedClipAtFrame(
          sc,
          targetCtx,
          activeVectorEntry.cel.nestId,
          frame,
          activeVectorEntry.cel.nestOriginFrame ?? 0,
          activeVectorEntry.cel.offsetX,
          activeVectorEntry.cel.offsetY,
          targetW,
          targetH,
          cam,
          totalViewScale,
          vx,
          vy,
          0
        );
      } else if (activeVectorEntry.cel.items.length > 0) {
        renderVectorCelToContext(targetCtx, activeVectorEntry.cel, targetW, targetH, cam, totalViewScale, vx, vy, 1);
      }
    }

    const mouthEval = getEvaluatedMouthInScene(sc, frame);
    if (mouthEval) {
      const vis = sc.mouthLayer.visemes[mouthEval.viseme] || sc.mouthLayer.visemes[0];
      const ms = (mouthEval.scale || 100) / 100;
      const dw = Math.round(MOUTH_W * ms);
      const dh = Math.round(MOUTH_H * ms);
      const dx = Math.round(mouthEval.x - dw / 2);
      const dy = Math.round(mouthEval.y - dh / 2);
      targetCtx.imageSmoothingEnabled = false;
      targetCtx.drawImage(vis.canvas, dx, dy, dw, dh);

      if (!forExport && useViewport && !state.isPlaying && state.activeLayer === 'mouth') {
        const inv = 1 / (totalViewScale * cs);
        targetCtx.strokeStyle = '#f472b6';
        targetCtx.lineWidth = 1.5 * inv;
        targetCtx.setLineDash([5 * inv, 3 * inv]);
        targetCtx.strokeRect(dx, dy, dw, dh);
        targetCtx.setLineDash([]);
      }
    }

    targetCtx.restore();

    if (!forExport && useViewport) {
      renderStageOverlayGuides(targetCtx, cam, totalViewScale);
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
    return {
      x: (worldPt.x - mouthEval.x) / ms + MOUTH_W / 2,
      y: (worldPt.y - mouthEval.y) / ms + MOUTH_H / 2,
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
    | { mode: 'mouthScale'; startStagePt: Point2D; startScale: number }
    | { mode: 'moveMouth'; startX: number; startY: number; startStagePt: Point2D; totalScale: number }
    | {
        mode: 'moveVector';
        cel: VectorCel;
        startOffsetX: number;
        startOffsetY: number;
        startStagePt: Point2D;
        totalScale: number;
        moved: boolean;
      }
    | {
        mode: 'moveFrame';
        cel: Cel | BgLayer;
        startOffsetX: number;
        startOffsetY: number;
        startStagePt: Point2D;
        totalScale: number;
        moved: boolean;
      }
    | null = null;

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

  stageContainer.addEventListener('pointerdown', (e) => {
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
  });

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

  stage.addEventListener('pointerdown', (e) => {
    if (e.button === 1 || state.isPlaying) return;
    stage.setPointerCapture(e.pointerId);
    const stagePt = getStageCoords(e);
    hoverStagePt = stagePt;
    const cam = getEvaluatedCamera(state.currentFrame);
    isPointerDown = true;

    if (state.tool === 'moveCam') {
      if (e.button === 2) {
        if (state.activeLayer === 'mouth' && !e.shiftKey) {
          if (!state.mouthLayer.visible) state.mouthLayer.visible = true;
          const curM = getActiveMouthState();
          moveCamState = { mode: 'mouthScale', startStagePt: stagePt, startScale: curM.scale || 100 };
        } else {
          moveCamState = { mode: 'camScale', startStagePt: stagePt, startScale: cam.scale };
        }
      } else if (e.shiftKey) {
        moveCamState = { mode: 'camPan', startStagePt: stagePt, startX: cam.x, startY: cam.y };
      } else if (state.activeLayer === 'mouth') {
        if (!state.mouthLayer.visible) state.mouthLayer.visible = true;
        const curM = getActiveMouthState();
        moveCamState = {
          mode: 'moveMouth',
          startX: curM.x,
          startY: curM.y,
          startStagePt: stagePt,
          totalScale: (cam.scale / 100) * getTotalViewScale(),
        };
      } else if (state.activeLayer === 'vector') {
        const existed = Boolean(getVectorCelEntryAt(state.currentFrame));
        const { cel } = ensureVectorCelAt(state.currentFrame, true);
        pushVectorMoveUndo(cel, cel.offsetX, cel.offsetY);
        moveCamState = {
          mode: 'moveVector',
          cel,
          startOffsetX: cel.offsetX,
          startOffsetY: cel.offsetY,
          startStagePt: stagePt,
          totalScale: (cam.scale / 100) * getTotalViewScale(),
          moved: false,
        };
        if (!existed) renderTimeline();
      } else {
        const { obj, created } = getTargetLayerForEdit(true, true);
        if (!obj) return;
        pushMoveUndo(obj, obj.offsetX, obj.offsetY);
        moveCamState = {
          mode: 'moveFrame',
          cel: obj,
          startOffsetX: obj.offsetX,
          startOffsetY: obj.offsetY,
          startStagePt: stagePt,
          totalScale: (cam.scale / 100) * getTotalViewScale(),
          moved: false,
        };
        if (created) renderTimeline();
      }
      return;
    }

    const rightErase = e.button === 2;
    if (rightErase) isRightErasing = true;
    const worldPt = stageToWorld(stagePt, cam);

    if (state.activeLayer === 'mouth') {
      if (!state.mouthLayer.visible) state.mouthLayer.visible = true;
      const mouthEval = getActiveMouthState();
      const vis = state.mouthLayer.visemes[mouthEval.viseme];
      const mp = worldToVisemeLocal(worldPt, mouthEval);

      if (state.tool === 'fill' && !rightErase) {
        floodFillLayer(vis, mp.x, mp.y, state.brushColor, false, true);
        updateMouthWidget();
        renderStage();
        return;
      }

      const eraseMode = rightErase || state.tool === 'eraser';
      activeDrawTarget = vis;
      activeDrawVector = null;
      activeDrawIsMouth = true;
      pushPixelUndo(vis, true);
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
      const curVecEntry = getVectorCelEntryAt(state.currentFrame);
      if (curVecEntry?.cel.nestId) {
        isPointerDown = false;
        isRightErasing = false;
        onNotify('Nested clip — right-click frame (or double-click) to edit inside nest, or use Move tool.');
        return;
      }
      if (!state.showVectorLayer) {
        state.showVectorLayer = true;
        mustEl<HTMLButtonElement>('btnVisVector').style.opacity = '1';
      }

      if (state.tool === 'nudge' && !rightErase) {
        const activeEntry = getVectorCelEntryAt(state.currentFrame);
        if (!activeEntry || activeEntry.cel.items.length === 0) return;
        const existed = Boolean(getVectorCelEntryAt(state.currentFrame));
        const { cel } = ensureVectorCelAt(state.currentFrame, true);
        pushVectorItemsUndo(cel);

        const localPt = { x: worldPt.x - cel.offsetX, y: worldPt.y - cel.offsetY };
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

        activeNudgeState = { cel, startLocalPt: localPt, radius: r, targets, moved: false };
        if (!existed) renderTimeline();
        renderStage();
        return;
      }

      if (state.tool === 'fill') {
        const existed = Boolean(getVectorCelEntryAt(state.currentFrame));
        const { cel } = ensureVectorCelAt(state.currentFrame, rightErase);
        const vecFilled = tryVectorStrokeFill(cel, worldPt.x, worldPt.y, state.brushColor, rightErase);
        if (!vecFilled) {
          floodFillVectorCel(cel, worldPt.x, worldPt.y, state.brushColor, rightErase);
        }
        if (!existed || vecFilled || cel.items.length > 0) renderTimeline();
        renderStage();
        return;
      }

      const eraseMode = rightErase || state.tool === 'eraser';
      const existed = Boolean(getVectorCelEntryAt(state.currentFrame));
      const { cel } = ensureVectorCelAt(state.currentFrame, eraseMode);
      pushVectorItemsUndo(cel);
      const localPt = { x: worldPt.x - cel.offsetX, y: worldPt.y - cel.offsetY };
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
    }
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
      activeBitmapNudgeState = {
        cel,
        imgData,
        pixels32,
        lastLocalPt: { x: worldPt.x - cel.offsetX, y: worldPt.y - cel.offsetY },
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
        floodFillLayer(obj, worldPt.x - obj.offsetX, worldPt.y - obj.offsetY, state.brushColor, false, false);
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
      drawPixelDisk(
        cctx,
        worldPt.x - obj.offsetX,
        worldPt.y - obj.offsetY,
        state.brushSize,
        state.brushColor,
        eraseMode
      );
    }
    obj.hasInk = true;
    lastWorldPt = worldPt;

    if (created) renderTimeline();
    updateBgUI();
    renderStage();
  });

  stage.addEventListener('pointermove', (e) => {
    if (isViewPanning) return;
    const stagePt = getStageCoords(e);
    hoverStagePt = stagePt;

    if (!isPointerDown) {
      if (
        state.tool === 'brush' ||
        state.tool === 'eraser' ||
        (state.tool === 'nudge' && (state.activeLayer === 'vector' || state.activeLayer === 'cel'))
      ) {
        renderStage();
      }
      return;
    }

    if (activeNudgeState) {
      const cam = getEvaluatedCamera(state.currentFrame);
      const worldPt = stageToWorld(stagePt, cam);
      const localPt = {
        x: worldPt.x - activeNudgeState.cel.offsetX,
        y: worldPt.y - activeNudgeState.cel.offsetY,
      };
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
      const { cel, imgData, pixels32, radius } = activeBitmapNudgeState;
      const curLocalPt = { x: worldPt.x - cel.offsetX, y: worldPt.y - cel.offsetY };
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
        setMouthKeyAtCurrentFrame({ scale: nextScale });
        updateMouthWidget();
        updateStageBadge();
        renderTimeline();
        renderStage();
      } else if (moveCamState.mode === 'moveMouth') {
        const dxWorld = Math.round(dx / moveCamState.totalScale);
        const dyWorld = Math.round(dy / moveCamState.totalScale);
        setMouthKeyAtCurrentFrame({
          x: moveCamState.startX + dxWorld,
          y: moveCamState.startY + dyWorld,
        });
        renderTimeline();
        renderStage();
      } else if (moveCamState.mode === 'moveVector') {
        const dxWorld = Math.round(dx / moveCamState.totalScale);
        const dyWorld = Math.round(dy / moveCamState.totalScale);
        if (dxWorld !== 0 || dyWorld !== 0) moveCamState.moved = true;

        moveCamState.cel.offsetX = moveCamState.startOffsetX + dxWorld;
        moveCamState.cel.offsetY = moveCamState.startOffsetY + dyWorld;
        renderStage();
      } else if (moveCamState.mode === 'moveFrame') {
        const dxWorld = Math.round(dx / moveCamState.totalScale);
        const dyWorld = Math.round(dy / moveCamState.totalScale);
        if (dxWorld !== 0 || dyWorld !== 0) moveCamState.moved = true;

        moveCamState.cel.offsetX = moveCamState.startOffsetX + dxWorld;
        moveCamState.cel.offsetY = moveCamState.startOffsetY + dyWorld;
        renderStage();
      }
      return;
    }

    if (activeDrawVector && (isRightErasing || state.tool === 'brush' || state.tool === 'eraser')) {
      const cam = getEvaluatedCamera(state.currentFrame);
      const worldPt = stageToWorld(stagePt, cam);
      const localPt = { x: worldPt.x - activeDrawVector.cel.offsetX, y: worldPt.y - activeDrawVector.cel.offsetY };
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
      const cctx = activeDrawTarget.canvas.getContext('2d');
      if (cctx) {
        cctx.imageSmoothingEnabled = false;
        if (activeDrawIsMouth) {
          const mouthEval = getActiveMouthState();
          const p1 = worldToVisemeLocal(lastWorldPt, mouthEval);
          const p2 = worldToVisemeLocal(worldPt, mouthEval);
          drawPixelLine(cctx, p1, p2, state.brushSize, state.brushColor, eraseMode);
          updateMouthWidget();
        } else if ('offsetX' in activeDrawTarget) {
          drawPixelLine(
            cctx,
            { x: lastWorldPt.x - activeDrawTarget.offsetX, y: lastWorldPt.y - activeDrawTarget.offsetY },
            { x: worldPt.x - activeDrawTarget.offsetX, y: worldPt.y - activeDrawTarget.offsetY },
            state.brushSize,
            state.brushColor,
            eraseMode
          );
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
    if (activeNudgeState && !activeNudgeState.moved) {
      activeNudgeState.cel.undoStack.pop();
    }
    if (activeBitmapNudgeState && !activeBitmapNudgeState.moved) {
      activeBitmapNudgeState.cel.undoStack.pop();
    }

    const finishedVector = activeDrawVector !== null || activeNudgeState !== null;
    lastWorldPt = null;
    activeDrawTarget = null;
    activeDrawVector = null;
    activeDrawIsMouth = false;
    activeNudgeState = null;
    activeBitmapNudgeState = null;
    moveCamState = null;
    if (finishedVector) renderTimeline();
    renderStage();
  });

  stage.addEventListener('pointerleave', () => {
    hoverStagePt = null;
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

  function loadImageFile(file: File, destination: 'bg' | 'cel', targetFrame = state.currentFrame): void {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      if (destination === 'bg') {
        state.bgLayer.visible = true;
        if (!state.showBgTrack) toggleBgTrack(true);
        drawImageFittedOnLayer(state.bgLayer, img, file.name);
        updateBgUI();
      } else {
        goToFrame(targetFrame);
        const { cel } = ensureCelAt(targetFrame, false);
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
    let extra = 0;
    if (state.showMouthTrack) extra += 38;
    if (state.showVectorTrack) extra += 36;
    if (state.showBgTrack) extra += 36;
    if (state.showAudioTrack) extra += 42;
    if (state.showCamTrack) extra += 36;
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

  function toggleVectorTrack(forceState?: boolean): void {
    state.showVectorTrack = typeof forceState === 'boolean' ? forceState : !state.showVectorTrack;
    const btn = mustEl<HTMLButtonElement>('btnToggleVectorTrack');
    btn.classList.toggle('active', state.showVectorTrack);
    vectorTrackLabel.classList.toggle('hidden-track', !state.showVectorTrack);
    vectorTrackRow.classList.toggle('hidden-track', !state.showVectorTrack);
    vectorTrackRight.classList.toggle('hidden-track', !state.showVectorTrack);
    if (state.showVectorTrack) {
      if (!state.showVectorLayer) {
        state.showVectorLayer = true;
        mustEl<HTMLButtonElement>('btnVisVector').style.opacity = '1';
      }
      if (typeof forceState !== 'boolean') {
        selectTimelineTrack('vector');
      }
    } else if (state.activeLayer === 'vector') {
      setActiveLayer('cel');
    }
    updateTimelinePanelHeight();
    renderStage();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  mustEl<HTMLButtonElement>('btnToggleVectorTrack').onclick = () => toggleVectorTrack();

  function toggleBgTrack(forceState?: boolean): void {
    state.showBgTrack = typeof forceState === 'boolean' ? forceState : !state.showBgTrack;
    const btn = mustEl<HTMLButtonElement>('btnToggleBgTrack');
    btn.classList.toggle('active', state.showBgTrack);
    bgTrackLabel.classList.toggle('hidden-track', !state.showBgTrack);
    bgTrackRow.classList.toggle('hidden-track', !state.showBgTrack);
    bgTrackRight.classList.toggle('hidden-track', !state.showBgTrack);
    if (state.showBgTrack) {
      state.bgLayer.visible = true;
      if (typeof forceState !== 'boolean') {
        selectTimelineTrack('bg');
      }
    } else if (state.activeLayer === 'bg') {
      setActiveLayer('cel');
    }
    updateBgUI();
    updateTimelinePanelHeight();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  function updateActiveTrackHighlight(): void {
    const active = state.selectedTrack;
    audioClipBox.classList.toggle('selected', active === 'audio');

    celTrackLabel.classList.toggle('active-draw-layer', active === 'cel');
    vectorTrackLabel.classList.toggle('active-draw-layer', active === 'vector');
    bgTrackLabel.classList.toggle('active-draw-layer', active === 'bg');
    mouthTrackLabel.classList.toggle('active-draw-layer', active === 'mouth');
    audioTrackLabel.classList.toggle('active-draw-layer', active === 'audio');
    camTrackLabel.classList.toggle('active-draw-layer', active === 'cam');

    celTrackRow.classList.toggle('active-track-row', active === 'cel');
    vectorTrackRow.classList.toggle('active-track-row', active === 'vector');
    bgTrackRow.classList.toggle('active-track-row', active === 'bg');
    mouthTrackRow.classList.toggle('active-track-row', active === 'mouth');
    audioTrackRow.classList.toggle('active-track-row', active === 'audio');
    camTrackRow.classList.toggle('active-track-row', active === 'cam');

    celTrackRight.classList.toggle('active-track-right', active === 'cel');
    vectorTrackRight.classList.toggle('active-track-right', active === 'vector');
    bgTrackRight.classList.toggle('active-track-right', active === 'bg');
    mouthTrackRight.classList.toggle('active-track-right', active === 'mouth');
    audioTrackRight.classList.toggle('active-track-right', active === 'audio');
    camTrackRight.classList.toggle('active-track-right', active === 'cam');

    btnToolNudge.classList.toggle('hidden-tool', state.activeLayer !== 'vector' && state.activeLayer !== 'cel');
  }

  function selectTimelineTrack(track: 'cel' | 'vector' | 'bg' | 'mouth' | 'audio' | 'cam'): void {
    const prevLayer = state.activeLayer;
    state.selectedTrack = track;
    if (track === 'cel' || track === 'vector' || track === 'bg' || track === 'mouth') {
      state.activeLayer = track;
    }
    if (track === 'mouth' && prevLayer !== 'mouth') {
      selectTool('moveCam');
    } else if (state.activeLayer !== 'vector' && state.activeLayer !== 'cel' && state.tool === 'nudge') {
      selectTool('brush');
    }
    updateActiveTrackHighlight();
    updateMouthWidget();
    updateStageBadge();
    renderStage();
  }

  function setActiveLayer(layer: 'cel' | 'vector' | 'bg' | 'mouth'): void {
    selectTimelineTrack(layer);
  }

  function updateBgUI(): void {
    mustEl<HTMLButtonElement>('btnVisBg').style.opacity = state.bgLayer.visible ? '1' : '0.35';
    if (state.bgLayer.hasInk) {
      bgSpanBar.textContent = state.bgLayer.name ? `BG: ${state.bgLayer.name}` : 'BG Artwork (Active)';
    } else {
      bgSpanBar.textContent = 'Background Layer (Drop image here or click to draw)';
    }
  }

  mustEl<HTMLButtonElement>('btnToggleBgTrack').onclick = () => {
    if (nestStack.length === 0) toggleBgTrack();
  };
  celTrackLabel.onclick = (e) => {
    if ((e.target as HTMLElement)?.closest('button, input, select')) return;
    setActiveLayer('cel');
  };
  vectorTrackLabel.onclick = (e) => {
    if ((e.target as HTMLElement)?.closest('button, input, select')) return;
    setActiveLayer('vector');
  };
  bgTrackLabel.onclick = (e) => {
    if ((e.target as HTMLElement)?.closest('button, input, select')) return;
    setActiveLayer('bg');
  };
  bgTrackRow.onclick = () => setActiveLayer('bg');
  celTrackRight.onclick = () => selectTimelineTrack('cel');
  vectorTrackRight.onclick = () => selectTimelineTrack('vector');
  bgTrackRight.onclick = () => selectTimelineTrack('bg');
  mouthTrackRight.onclick = () => selectTimelineTrack('mouth');
  audioTrackRight.onclick = () => selectTimelineTrack('audio');
  camTrackRight.onclick = () => selectTimelineTrack('cam');

  mustEl<HTMLButtonElement>('btnVisBg').onclick = (e) => {
    e.stopPropagation();
    state.bgLayer.visible = !state.bgLayer.visible;
    updateBgUI();
    renderStage();
  };

  mustEl<HTMLButtonElement>('btnClearBg').onclick = (e) => {
    e.stopPropagation();
    pushPixelUndo(state.bgLayer);
    state.bgLayer.canvas = createCelCanvas();
    state.bgLayer.offsetX = 0;
    state.bgLayer.offsetY = 0;
    state.bgLayer.hasInk = false;
    state.bgLayer.name = '';
    updateBgUI();
    renderStage();
  };

  const bgFileInput = mustEl<HTMLInputElement>('bgFileInput');
  mustEl<HTMLButtonElement>('btnAddBgImg').onclick = (e) => {
    e.stopPropagation();
    bgFileInput.click();
  };
  bgFileInput.onchange = () => {
    if (bgFileInput.files && bgFileInput.files[0]) loadImageFile(bgFileInput.files[0], 'bg');
    bgFileInput.value = '';
  };

  // ==========================================
  // Web Audio Track + Live Mic Waveform Preview + Delete
  // ==========================================
  let audioCtx: AudioContext | null = null;
  let activeAudioSources: AudioBufferSourceNode[] = [];
  let activeAudioGainNodes: GainNode[] = [];
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

  function getEffectiveAudioVolume(): number {
    if (state.audio) {
      return state.audio.muted ? 0 : Math.max(0, Math.min(1, state.audio.volume));
    }
    return Math.max(0, Math.min(1, state.audioVolume));
  }

  function updateAudioVolumeUI(): void {
    const vol = getEffectiveAudioVolume();
    const pct = Math.round(vol * 100);
    audioVolFill.style.width = `${pct}%`;
    audioVolFill.classList.toggle('empty', pct <= 0);
    audioVolFill.classList.toggle('full', pct >= 100);
    audioTrackLabel.title = `Scroll wheel here to adjust Audio volume (${pct}%)`;
    mustEl<HTMLButtonElement>('btnMuteAudio').textContent =
      state.audio?.muted || pct === 0 ? '🔇' : '🔊';
    for (const g of activeAudioGainNodes) {
      try {
        g.gain.value = vol;
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
    for (const g of activeAudioGainNodes) {
      try {
        g.disconnect();
      } catch {
        // ignore
      }
    }
    activeAudioSources = [];
    activeAudioGainNodes = [];
  }

  function scheduleAudioAtFrame(frame: number): void {
    stopAllAudioPlayback();
    if (nestStack.length > 0 || !state.audio || state.audio.muted) return;

    const ac = getAudioContext();
    const { buffer, timelineStartSec, trimStartSec, trimEndSec } = state.audio;
    const playheadSec = frame / state.fps;
    const clipDur = trimEndSec - trimStartSec;
    const clipStart = timelineStartSec;
    const clipEnd = timelineStartSec + clipDur;

    if (playheadSec >= clipEnd) return;

    const src = ac.createBufferSource();
    src.buffer = buffer;
    const gain = ac.createGain();
    gain.gain.value = getEffectiveAudioVolume();
    src.connect(gain);
    gain.connect(ac.destination);

    if (playheadSec >= clipStart) {
      const intoClip = playheadSec - clipStart;
      const remaining = clipEnd - playheadSec;
      src.start(ac.currentTime, trimStartSec + intoClip, remaining);
    } else {
      const delay = clipStart - playheadSec;
      src.start(ac.currentTime + delay, trimStartSec, clipDur);
    }
    activeAudioSources.push(src);
    activeAudioGainNodes.push(gain);
  }

  function playAudioScrubGrain(frame: number): void {
    if (nestStack.length > 0 || !state.audio || state.audio.muted) return;
    const vol = getEffectiveAudioVolume();
    if (vol <= 0.001) return;
    const now = performance.now();
    if (now - lastScrubTime < 55) return;
    lastScrubTime = now;

    const ac = getAudioContext();
    const { buffer, timelineStartSec, trimStartSec, trimEndSec } = state.audio;
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

  function toggleAudioTrack(forceState?: boolean): void {
    state.showAudioTrack = typeof forceState === 'boolean' ? forceState : !state.showAudioTrack;
    const btn = mustEl<HTMLButtonElement>('btnToggleAudioTrack');
    btn.classList.toggle('active', state.showAudioTrack);
    audioTrackLabel.classList.toggle('hidden-track', !state.showAudioTrack);
    audioTrackRow.classList.toggle('hidden-track', !state.showAudioTrack);
    audioTrackRight.classList.toggle('hidden-track', !state.showAudioTrack);
    if (state.showAudioTrack && typeof forceState !== 'boolean') {
      selectTimelineTrack('audio');
    } else if (!state.showAudioTrack && state.selectedTrack === 'audio') {
      selectTimelineTrack(state.activeLayer);
    }
    updateAudioVolumeUI();
    updateTimelinePanelHeight();
    requestAnimationFrame(() => {
      resizeStageCanvas();
      renderAudioTrack();
    });
  }

  mustEl<HTMLButtonElement>('btnToggleAudioTrack').onclick = () => {
    if (nestStack.length === 0) toggleAudioTrack();
  };
  audioTrackLabel.onclick = (e) => {
    if ((e.target as HTMLElement)?.closest('button, input, select')) return;
    selectTimelineTrack('audio');
  };
  audioTrackLabel.addEventListener(
    'wheel',
    (e) => {
      if (e.deltaY === 0) return;
      e.preventDefault();
      e.stopPropagation();
      const step =
        Math.abs(e.deltaY) < 20
          ? -Math.sign(e.deltaY) * Math.max(0.02, Math.abs(e.deltaY) * 0.0025)
          : e.deltaY < 0
            ? 0.05
            : -0.05;
      if (state.audio) {
        if (state.audio.muted && step > 0) {
          state.audio.muted = false;
          if (state.audio.volume <= 0) state.audio.volume = 0;
        }
        const nextVol = Math.max(0, Math.min(1, Math.round((state.audio.volume + step) * 100) / 100));
        state.audio.volume = nextVol;
        state.audioVolume = nextVol;
        updateAudioVolumeUI();
        if (state.isPlaying && !state.audio.muted && activeAudioSources.length === 0) {
          scheduleAudioAtFrame(state.currentFrame);
        }
        renderAudioTrack();
      } else {
        const nextVol = Math.max(0, Math.min(1, Math.round((state.audioVolume + step) * 100) / 100));
        state.audioVolume = nextVol;
        updateAudioVolumeUI();
      }
    },
    { passive: false }
  );
  audioTrackRow.addEventListener('pointerdown', () => selectTimelineTrack('audio'));

  async function setDecodedAudioBuffer(decoded: AudioBuffer, name: string, startFrame = 0): Promise<void> {
    const peaks = computePeaks(decoded);
    state.audio = {
      buffer: decoded,
      peaks,
      name,
      timelineStartSec: Math.max(0, startFrame) / state.fps,
      trimStartSec: 0,
      trimEndSec: decoded.duration,
      muted: false,
      volume: state.audioVolume,
    };

    updateAudioVolumeUI();
    if (!state.showAudioTrack) toggleAudioTrack(true);
    else renderAudioTrack();
  }

  async function loadAudioFile(file: File | undefined): Promise<void> {
    if (!file) return;
    const ac = getAudioContext();
    const buf = await file.arrayBuffer();
    const decoded = await ac.decodeAudioData(buf);
    await setDecodedAudioBuffer(decoded, file.name, 0);
  }

  function deleteActiveAudio(): void {
    stopAllAudioPlayback();
    state.audio = null;
    if (state.selectedTrack === 'audio') selectTimelineTrack(state.activeLayer);
    else updateActiveTrackHighlight();
    updateAudioVolumeUI();
    renderAudioTrack();
  }

  function startLiveRecPreview(stream: MediaStream): void {
    const ac = getAudioContext();
    micSourceNode = ac.createMediaStreamSource(stream);
    micAnalyser = ac.createAnalyser();
    micAnalyser.fftSize = 256;
    micSourceNode.connect(micAnalyser);

    const timeData = new Uint8Array(micAnalyser.fftSize);
    micLivePeaks = [];
    micStartTimestamp = performance.now();
    audioEmptyHint.style.display = 'none';
    audioClipBox.style.display = 'none';
    audioRecBadge.style.display = 'block';

    const drawLive = () => {
      if (!micRecorder || micRecorder.state !== 'recording' || !micAnalyser) return;
      micAnalyser.getByteTimeDomainData(timeData);
      let peak = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = Math.abs(timeData[i] - 128) / 128;
        if (v > peak) peak = v;
      }
      micLivePeaks.push(Math.min(1, peak * 2.2));
      if (micLivePeaks.length > 300) micLivePeaks.shift();

      const elapsed = ((performance.now() - micStartTimestamp) / 1000).toFixed(1);
      audioRecBadge.textContent = `● REC ${elapsed}s`;

      const w = audioTrackRow.clientWidth;
      const h = audioTrackRow.clientHeight;
      if (w > 0 && h > 0) {
        audioWaveCanvas.width = w;
        audioWaveCanvas.height = h;
        const actx = audioWaveCanvas.getContext('2d');
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
    audioRecBadge.style.display = 'none';
  }

  const btnRecAudio = mustEl<HTMLButtonElement>('btnRecAudio');
  btnRecAudio.onclick = async () => {
    if (micRecorder && micRecorder.state === 'recording') {
      micRecorder.stop();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      onNotify('Microphone recording is not supported in this browser.');
      return;
    }

    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micChunks = [];
      micStartFrame = state.currentFrame;

      const recorder = new MediaRecorder(micStream);
      micRecorder = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) micChunks.push(ev.data);
      };

      recorder.onstop = async () => {
        stopLiveRecPreview();
        btnRecAudio.textContent = '● Rec';
        btnRecAudio.classList.remove('recording');

        if (micStream) {
          micStream.getTracks().forEach((t) => t.stop());
          micStream = null;
        }

        if (micChunks.length > 0) {
          const blob = new Blob(micChunks, { type: recorder.mimeType || 'audio/webm' });
          const ac = getAudioContext();
          const buf = await blob.arrayBuffer();
          const decoded = await ac.decodeAudioData(buf);
          await setDecodedAudioBuffer(decoded, 'Mic Recording', micStartFrame);
        } else {
          renderAudioTrack();
        }
        micRecorder = null;
      };

      recorder.start();
      btnRecAudio.textContent = '■ Stop';
      btnRecAudio.classList.add('recording');
      startLiveRecPreview(micStream);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onNotify('Could not access microphone: ' + msg);
    }
  };

  function renderAudioTrack(): void {
    if (!state.showAudioTrack) return;
    if (micRecorder && micRecorder.state === 'recording') return;
    const w = audioTrackRow.clientWidth;
    const h = audioTrackRow.clientHeight;
    if (w <= 0 || h <= 0) return;

    audioWaveCanvas.width = w;
    audioWaveCanvas.height = h;
    const actx = audioWaveCanvas.getContext('2d');
    if (!actx) return;
    actx.clearRect(0, 0, w, h);

    if (!state.audio) {
      audioEmptyHint.style.display = 'flex';
      audioClipBox.style.display = 'none';
      return;
    }

    audioEmptyHint.style.display = 'none';
    audioClipBox.style.display = 'block';

    const { buffer, peaks, name, timelineStartSec, trimStartSec, trimEndSec, muted, volume } = state.audio;
    const effVol = muted ? 0 : Math.max(0, Math.min(1, typeof volume === 'number' ? volume : 1));
    const timelineDurSec = state.totalFrames / state.fps;
    const clipDur = trimEndSec - trimStartSec;

    const leftPct = (timelineStartSec / timelineDurSec) * 100;
    const widthPct = (clipDur / timelineDurSec) * 100;
    audioClipBox.style.left = `${leftPct}%`;
    audioClipBox.style.width = `${widthPct}%`;
    audioClipBox.style.opacity = muted || effVol === 0 ? '0.4' : '1';
    audioClipBox.classList.toggle('selected', state.selectedTrack === 'audio');

    const startFrameNum = Math.round(timelineStartSec * state.fps) + 1;
    audioClipLabel.textContent = `${name} (F${startFrameNum} • ${clipDur.toFixed(2)}s)`;

    const clipX0 = (timelineStartSec / timelineDurSec) * w;
    const clipX1 = ((timelineStartSec + clipDur) / timelineDurSec) * w;
    const drawStartX = Math.max(0, Math.floor(clipX0));
    const drawEndX = Math.min(w, Math.ceil(clipX1));

    actx.fillStyle = muted || effVol === 0 ? 'rgba(192, 132, 252, 0.35)' : '#c084fc';
    const midY = h / 2;
    const maxAmp = (h - 12) / 2;
    const volScale = muted ? 0.25 : 0.15 + 0.85 * effVol;

    for (let px = drawStartX; px < drawEndX; px++) {
      const tOnTimeline = (px / w) * timelineDurSec;
      const tInAudio = trimStartSec + (tOnTimeline - timelineStartSec);
      const norm = tInAudio / buffer.duration;
      const idx = Math.max(0, Math.min(peaks.length - 1, Math.floor(norm * peaks.length)));
      const amp = Math.max(1, peaks[idx] * maxAmp * volScale);
      actx.fillRect(px, Math.round(midY - amp), 1, Math.round(amp * 2));
    }
  }

  function autoLipSyncAudioToMouth(): void {
    if (!state.audio) {
      onNotify('Load or record an audio clip first to run Auto Lip-Sync.');
      return;
    }
    const { buffer, timelineStartSec, trimStartSec, trimEndSec } = state.audio;
    const clipDur = Math.max(0, trimEndSec - trimStartSec);
    if (clipDur <= 0.01) return;

    const sr = buffer.sampleRate;
    const numCh = buffer.numberOfChannels;
    const ch0 = buffer.getChannelData(0);
    const ch1 = numCh > 1 ? buffer.getChannelData(1) : null;

    const startFrame = Math.max(0, Math.floor(timelineStartSec * state.fps));
    const endFrame = Math.min(state.totalFrames - 1, Math.ceil((timelineStartSec + clipDur) * state.fps));
    if (endFrame < startFrame) return;

    // Analyze each frame's RMS loudness, zero-crossing rate, and low/high band ratio
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

    // Viseme indices: 0:Rest, 1:MBP, 2:AI, 3:E, 4:O, 5:U, 6:FV, 7:L
    const frameVisemes: number[] = [];
    let wasSilent = true;

    for (let i = 0; i < stats.length; i++) {
      const st = stats[i];
      const normVol = Math.min(1.2, st.rms / adaptivePeak);

      let vis = 0;
      if (st.rms < silenceThresh) {
        vis = 0; // Rest
        wasSilent = true;
      } else {
        if (wasSilent && i + 1 < stats.length && stats[i + 1].rms >= st.rms * 0.9 && normVol < 0.55) {
          vis = 1; // MBP bilabial onset
        } else if (st.zcr > 0.15 && st.lowRatio < 0.42 && normVol < 0.65) {
          vis = 6; // FV fricative
        } else if (normVol >= 0.72) {
          vis = st.lowRatio > 0.62 ? 2 : 3; // Wide AI or E
        } else if (normVol >= 0.44) {
          if (st.lowRatio > 0.72) vis = 4; // O
          else if (st.zcr > 0.085) vis = 7; // L
          else vis = 3; // E
        } else {
          vis = st.lowRatio > 0.68 ? 5 : 1; // U or MBP
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
    onNotify(`Auto lip-sync created ${count} mouth keyframes.`);
  }

  audioTrackRow.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!state.audio) return;
    selectTimelineTrack('audio');

    mustEl<HTMLButtonElement>('ctxAudioMute').textContent = state.audio.muted ? 'Unmute Audio' : 'Mute Audio';
    audioContextMenu.style.display = 'flex';
    const left = Math.min(window.innerWidth - 185, e.clientX);
    const top = Math.min(window.innerHeight - 135, e.clientY);
    audioContextMenu.style.left = `${left}px`;
    audioContextMenu.style.top = `${top}px`;
  });

  mustEl<HTMLButtonElement>('ctxAudioAutoLipSync').onclick = () => {
    hideMenus();
    autoLipSyncAudioToMouth();
  };
  mustEl<HTMLButtonElement>('ctxAudioDelete').onclick = () => {
    deleteActiveAudio();
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxAudioMute').onclick = () => {
    mustEl<HTMLButtonElement>('btnMuteAudio').click();
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxAudioFit').onclick = () => {
    if (state.audio) {
      const neededEndSec = Math.max(
        1,
        state.audio.timelineStartSec + (state.audio.trimEndSec - state.audio.trimStartSec)
      );
      state.totalFrames = Math.max(12, Math.ceil(neededEndSec * state.fps));
      renderTimeline();
    }
    hideMenus();
  };

  window.addEventListener(
    'dragover',
    (e) => {
      if (draggingSceneId) return;
      e.preventDefault();
      if (app.mode !== 'editor') return;
      const target = e.target as Node | null;
      if (target && (bgTrackRow.contains(target) || bgTrackLabel.contains(target))) {
        bgTrackRow.classList.add('drop-active');
        stageContainer.classList.remove('drop-active');
        audioTrackRow.classList.remove('drop-active');
      } else if (target && (audioTrackRow.contains(target) || audioTrackLabel.contains(target))) {
        audioTrackRow.classList.add('drop-active');
        stageContainer.classList.remove('drop-active');
        bgTrackRow.classList.remove('drop-active');
      } else {
        stageContainer.classList.add('drop-active');
        audioTrackRow.classList.remove('drop-active');
        bgTrackRow.classList.remove('drop-active');
      }
    },
    { signal }
  );

  window.addEventListener(
    'dragleave',
    (e) => {
      if (e.relatedTarget === null) {
        stageContainer.classList.remove('drop-active');
        audioTrackRow.classList.remove('drop-active');
        bgTrackRow.classList.remove('drop-active');
      }
    },
    { signal }
  );

  window.addEventListener(
    'drop',
    (e) => {
      if (draggingSceneId) return;
      e.preventDefault();
      stageContainer.classList.remove('drop-active');
      audioTrackRow.classList.remove('drop-active');
      bgTrackRow.classList.remove('drop-active');
      if (app.mode !== 'editor') return;

      const file = e.dataTransfer?.files?.[0];
      if (!file) return;

      if (file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(file.name)) {
        void loadAudioFile(file);
        return;
      }

      if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name)) {
        const target = e.target as Node | null;
        if (
          target &&
          (bgTrackRow.contains(target) ||
            bgTrackLabel.contains(target) ||
            (state.activeLayer === 'bg' && stageContainer.contains(target)))
        ) {
          loadImageFile(file, 'bg');
        } else if (target && celTrackRow.contains(target)) {
          const targetFrame = frameFromClientX(e.clientX);
          loadImageFile(file, 'cel', targetFrame);
        } else {
          loadImageFile(file, 'cel', state.currentFrame);
        }
      }
    },
    { signal }
  );

  mustEl<HTMLButtonElement>('btnMuteAudio').onclick = () => {
    if (!state.audio) return;
    state.audio.muted = !state.audio.muted;
    if (!state.audio.muted && state.audio.volume <= 0) {
      state.audio.volume = 1;
      state.audioVolume = 1;
    }
    updateAudioVolumeUI();
    if (state.audio.muted) stopAllAudioPlayback();
    else if (state.isPlaying) scheduleAudioAtFrame(state.currentFrame);
    renderAudioTrack();
  };

  let audioDragState: {
    mode: string;
    startX: number;
    origTimelineStart: number;
    origTrimStart: number;
    origTrimEnd: number;
  } | null = null;

  audioClipBox.addEventListener('pointerdown', (e) => {
    if (!state.audio) return;
    e.stopPropagation();
    selectTimelineTrack('audio');
    if (e.button === 2) return;
    if (state.isPlaying) togglePlay();

    const targetEl = e.target as HTMLElement;
    const trimRole = targetEl.dataset?.trim;
    audioClipBox.setPointerCapture(e.pointerId);
    audioDragState = {
      mode: trimRole || 'move',
      startX: e.clientX,
      origTimelineStart: state.audio.timelineStartSec,
      origTrimStart: state.audio.trimStartSec,
      origTrimEnd: state.audio.trimEndSec,
    };
  });

  audioClipBox.addEventListener('pointermove', (e) => {
    if (!audioDragState || !state.audio) return;
    const trackW = Math.max(1, audioTrackRow.clientWidth);
    const timelineDurSec = state.totalFrames / state.fps;
    const deltaSec = ((e.clientX - audioDragState.startX) / trackW) * timelineDurSec;
    const frameSec = 1 / state.fps;

    if (audioDragState.mode === 'move') {
      const rawFrame = Math.round((audioDragState.origTimelineStart + deltaSec) * state.fps);
      const snappedFrame = Math.max(0, Math.min(state.totalFrames - 1, rawFrame));
      state.audio.timelineStartSec = snappedFrame / state.fps;
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
        state.audio.timelineStartSec = finalStartSec;
        state.audio.trimStartSec = audioDragState.origTrimStart + actualDelta;
      }
    } else if (audioDragState.mode === 'right') {
      const origDur = audioDragState.origTrimEnd - audioDragState.origTrimStart;
      const rawEndOnTimeline = audioDragState.origTimelineStart + origDur + deltaSec;
      const startFrame = Math.round(audioDragState.origTimelineStart * state.fps);
      const snappedEndFrame = Math.max(startFrame + 1, Math.round(rawEndOnTimeline * state.fps));
      const snappedDur = snappedEndFrame / state.fps - audioDragState.origTimelineStart;
      const newTrimEnd = Math.min(state.audio.buffer.duration, audioDragState.origTrimStart + snappedDur);
      state.audio.trimEndSec = Math.max(audioDragState.origTrimStart + frameSec * 0.5, newTrimEnd);
    }
    renderAudioTrack();
  });

  audioClipBox.addEventListener('pointerup', () => {
    audioDragState = null;
  });
  audioClipBox.addEventListener('pointercancel', () => {
    audioDragState = null;
  });

  window.addEventListener(
    'resize',
    () => {
      if (app.mode === 'editor') renderAudioTrack();
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
    for (const [start, cel] of Array.from(state.cels.entries())) {
      if (start >= newTotal) state.cels.delete(start);
      else if (start + cel.duration > newTotal) cel.duration = newTotal - start;
    }
    for (const [start, vCel] of Array.from(state.vectorCels.entries())) {
      if (start >= newTotal) state.vectorCels.delete(start);
      else if (start + vCel.duration > newTotal) vCel.duration = newTotal - start;
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
    rulerRow.innerHTML = '';
    celTrackRow.innerHTML = '';
    vectorTrackRow.innerHTML = '';
    mouthTrackRow.innerHTML = '';
    camTrackRow.innerHTML = '';

    const sortedCamKeys = Array.from(state.cameraKeys.keys()).sort((a, b) => a - b);
    const firstCam = sortedCamKeys[0];
    const lastCam = sortedCamKeys[sortedCamKeys.length - 1];
    const effectiveColsPerScreen = state.totalFrames / state.timelineZoom;
    const labelStep = effectiveColsPerScreen > 48 ? 5 : effectiveColsPerScreen > 30 ? 2 : 1;

    for (let f = 0; f < state.totalFrames; f++) {
      const rCell = document.createElement('div');
      rCell.className = 'ruler-cell' + (f === state.currentFrame ? ' active' : '');
      if (f === 0 || (f + 1) % labelStep === 0 || f === state.currentFrame) {
        rCell.textContent = String(f + 1);
      }
      rulerRow.appendChild(rCell);

      const mCell = document.createElement('div');
      mCell.className = 'frame-cell' + (f === state.currentFrame ? ' current-col' : '');
      mouthTrackRow.appendChild(mCell);

      const vCell = document.createElement('div');
      vCell.className = 'frame-cell' + (f === state.currentFrame ? ' current-col' : '');
      vectorTrackRow.appendChild(vCell);

      const cCell = document.createElement('div');
      cCell.className = 'frame-cell' + (f === state.currentFrame ? ' current-col' : '');
      celTrackRow.appendChild(cCell);

      const camCell = document.createElement('div');
      camCell.className = 'frame-cell' + (f === state.currentFrame ? ' current-col' : '');
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

    for (const [f, mk] of state.mouthLayer.keys.entries()) {
      if (f >= state.totalFrames) continue;
      const pill = document.createElement('div');
      pill.className = 'mouth-key-pill';
      pill.style.left = `calc(${(f / state.totalFrames) * 100}% + 1px)`;
      pill.style.width = `calc(${(1 / state.totalFrames) * 100}% - 2px)`;
      pill.textContent = VISEME_NAMES[mk.viseme] || 'M';
      mouthTrackRow.appendChild(pill);
    }

    const rootSc = activeScene();
    for (const [start, vCel] of state.vectorCels.entries()) {
      if (start >= state.totalFrames) continue;
      const visibleDur = Math.min(vCel.duration, state.totalFrames - start);
      const isNested = Boolean(vCel.nestId);
      const nestClip = isNested && vCel.nestId ? rootSc.nestedClips.get(vCel.nestId) : null;
      const spanBar = document.createElement('div');
      spanBar.className = 'vector-span-bar' + (isNested ? ' is-nested' : '');
      spanBar.style.left = `calc(${(start / state.totalFrames) * 100}% + 2px)`;
      spanBar.style.width = `calc(${(visibleDur / state.totalFrames) * 100}% - 4px)`;
      spanBar.title =
        isNested && nestClip
          ? `${nestClip.name} (${nestClip.totalFrames}f loop • Hold: ${vCel.duration}f) — Double-click or Right-click to open nest`
          : `Vector Frame ${start + 1} (Hold: ${vCel.duration}f) — Drag to stretch, Right-click for options`;

      const dot = document.createElement('div');
      dot.className = 'vector-span-dot' + (isVectorCelInkFilled(rootSc, vCel) ? '' : ' blank');
      spanBar.appendChild(dot);

      if (isNested && nestClip) {
        const nestPill = document.createElement('span');
        nestPill.className = 'nest-span-pill';
        nestPill.textContent = `⟲ ${nestClip.totalFrames}f`;
        spanBar.appendChild(nestPill);
      }

      const grip = document.createElement('div');
      grip.className = 'vector-span-grip';
      spanBar.appendChild(grip);

      vectorTrackRow.appendChild(spanBar);
    }

    for (const [start, cel] of state.cels.entries()) {
      if (start >= state.totalFrames) continue;
      const visibleDur = Math.min(cel.duration, state.totalFrames - start);
      const isNested = Boolean(cel.nestId);
      const nestClip = isNested && cel.nestId ? rootSc.nestedClips.get(cel.nestId) : null;
      const spanBar = document.createElement('div');
      spanBar.className = 'cel-span-bar' + (isNested ? ' is-nested' : '');
      spanBar.style.left = `calc(${(start / state.totalFrames) * 100}% + 2px)`;
      spanBar.style.width = `calc(${(visibleDur / state.totalFrames) * 100}% - 4px)`;
      spanBar.title =
        isNested && nestClip
          ? `${nestClip.name} (${nestClip.totalFrames}f loop • Hold: ${cel.duration}f) — Double-click or Right-click to open nest`
          : `Frame ${start + 1} (Hold: ${cel.duration}f) — Drag to stretch, Right-click for options`;

      const dot = document.createElement('div');
      dot.className = 'cel-span-dot' + (isCelInkFilled(rootSc, cel) ? '' : ' blank');
      spanBar.appendChild(dot);

      if (isNested && nestClip) {
        const nestPill = document.createElement('span');
        nestPill.className = 'nest-span-pill';
        nestPill.textContent = `⟲ ${nestClip.totalFrames}f`;
        spanBar.appendChild(nestPill);
      }

      const grip = document.createElement('div');
      grip.className = 'cel-span-grip';
      spanBar.appendChild(grip);

      celTrackRow.appendChild(spanBar);
    }

    updateLoopRangeUI();
    updatePlayheadUI();
    renderAudioTrack();
  }

  function updatePlayheadUI(): void {
    const rCells = rulerRow.children;
    const mCells = mouthTrackRow.children;
    const vCells = vectorTrackRow.children;
    const cCells = celTrackRow.children;
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
      const mCell = mCells[f] as HTMLElement | undefined;
      if (mCell && mCell.classList.contains('frame-cell')) {
        mCell.classList.toggle('current-col', isCurr);
      }
      const vCell = vCells[f] as HTMLElement | undefined;
      if (vCell && vCell.classList.contains('frame-cell')) {
        vCell.classList.toggle('current-col', isCurr);
      }
      const cCell = cCells[f] as HTMLElement | undefined;
      if (cCell && cCell.classList.contains('frame-cell')) {
        cCell.classList.toggle('current-col', isCurr);
      }
      const kCell = kCells[f] as HTMLElement | undefined;
      if (kCell) kCell.classList.toggle('current-col', isCurr);
    }

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
    if (state.tool === 'moveCam') toolLabel = 'MOVE / CAM';
    else if (state.tool === 'nudge') toolLabel = `NUDGE (${state.nudgeRadius}px)`;
    else if (state.tool === 'brush' || state.tool === 'eraser') toolLabel = `${toolLabel} (${state.brushSize}px)`;

    const viewPct = Math.round(state.viewZoom * 100);
    let layerTag = '';
    if (state.activeLayer === 'vector') layerTag = ' | [VECTOR]';
    else if (state.activeLayer === 'bg') layerTag = ' | [BG]';
    else if (state.activeLayer === 'mouth') {
      const m = getActiveMouthState();
      layerTag = ` | [MOUTH ${Math.round(m.scale || 100)}%]`;
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

  let stretchState: {
    targetStart: number;
    origTotalFrames: number;
    origCels: Array<{ start: number; cel: Cel; duration: number }>;
    lastTargetFrame: number;
  } | null = null;

  celTrackRow.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    setActiveLayer('cel');
    if (state.isPlaying) togglePlay();
    const clickFrame = frameFromClientX(e.clientX);
    goToFrame(clickFrame);

    const entry = getCelEntryAt(clickFrame);
    if (!entry) return;

    celTrackRow.setPointerCapture(e.pointerId);
    const origCels: Array<{ start: number; cel: Cel; duration: number }> = [];
    for (const s of getSortedCelStarts()) {
      const c = state.cels.get(s);
      if (c) origCels.push({ start: s, cel: c, duration: c.duration });
    }

    stretchState = {
      targetStart: entry.start,
      origTotalFrames: state.totalFrames,
      origCels,
      lastTargetFrame: clickFrame,
    };
  });

  celTrackRow.addEventListener('pointermove', (e) => {
    if (!stretchState) return;
    const rect = timelineGrid.getBoundingClientRect();
    let dragFrame = Math.floor(((e.clientX - rect.left) / rect.width) * state.totalFrames);
    dragFrame = Math.max(stretchState.targetStart, dragFrame);
    if (dragFrame === stretchState.lastTargetFrame) return;
    stretchState.lastTargetFrame = dragFrame;

    const { targetStart, origCels, origTotalFrames } = stretchState;
    const newDur = Math.max(1, dragFrame - targetStart + 1);

    const nextOrig = origCels.find((item) => item.start > targetStart);
    let pushShift = 0;
    if (nextOrig) {
      const neededNextStart = targetStart + newDur;
      if (neededNextStart > nextOrig.start) {
        pushShift = neededNextStart - nextOrig.start;
      }
    }

    state.cels.clear();
    let maxEnd = origTotalFrames;
    for (const item of origCels) {
      if (item.start < targetStart) {
        item.cel.duration = item.duration;
        state.cels.set(item.start, item.cel);
      } else if (item.start === targetStart) {
        item.cel.duration = newDur;
        state.cels.set(item.start, item.cel);
        maxEnd = Math.max(maxEnd, item.start + newDur);
      } else {
        const newStart = item.start + pushShift;
        item.cel.duration = item.duration;
        state.cels.set(newStart, item.cel);
        maxEnd = Math.max(maxEnd, newStart + item.duration);
      }
    }

    state.totalFrames = Math.max(origTotalFrames, maxEnd);
    state.currentFrame = Math.min(state.totalFrames - 1, dragFrame);
    renderTimeline();
    renderStage();
  });

  celTrackRow.addEventListener('pointerup', () => {
    stretchState = null;
  });
  celTrackRow.addEventListener('pointercancel', () => {
    stretchState = null;
  });

  let contextTargetFrame = 0;
  let contextTargetLayer: 'cel' | 'vector' = 'cel';

  let vectorStretchState: {
    targetStart: number;
    origTotalFrames: number;
    origCels: Array<{ start: number; cel: VectorCel; duration: number }>;
    lastTargetFrame: number;
  } | null = null;

  vectorTrackRow.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    setActiveLayer('vector');
    if (state.isPlaying) togglePlay();
    const clickFrame = frameFromClientX(e.clientX);
    goToFrame(clickFrame);

    const entry = getVectorCelEntryAt(clickFrame);
    if (!entry) return;

    vectorTrackRow.setPointerCapture(e.pointerId);
    const origCels: Array<{ start: number; cel: VectorCel; duration: number }> = [];
    for (const s of getSortedVectorCelStarts()) {
      const c = state.vectorCels.get(s);
      if (c) origCels.push({ start: s, cel: c, duration: c.duration });
    }

    vectorStretchState = {
      targetStart: entry.start,
      origTotalFrames: state.totalFrames,
      origCels,
      lastTargetFrame: clickFrame,
    };
  });

  vectorTrackRow.addEventListener('pointermove', (e) => {
    if (!vectorStretchState) return;
    const rect = timelineGrid.getBoundingClientRect();
    let dragFrame = Math.floor(((e.clientX - rect.left) / rect.width) * state.totalFrames);
    dragFrame = Math.max(vectorStretchState.targetStart, dragFrame);
    if (dragFrame === vectorStretchState.lastTargetFrame) return;
    vectorStretchState.lastTargetFrame = dragFrame;

    const { targetStart, origCels, origTotalFrames } = vectorStretchState;
    const newDur = Math.max(1, dragFrame - targetStart + 1);

    const nextOrig = origCels.find((item) => item.start > targetStart);
    let pushShift = 0;
    if (nextOrig) {
      const neededNextStart = targetStart + newDur;
      if (neededNextStart > nextOrig.start) {
        pushShift = neededNextStart - nextOrig.start;
      }
    }

    state.vectorCels.clear();
    let maxEnd = origTotalFrames;
    for (const item of origCels) {
      if (item.start < targetStart) {
        item.cel.duration = item.duration;
        state.vectorCels.set(item.start, item.cel);
      } else if (item.start === targetStart) {
        item.cel.duration = newDur;
        state.vectorCels.set(item.start, item.cel);
        maxEnd = Math.max(maxEnd, item.start + newDur);
      } else {
        const newStart = item.start + pushShift;
        item.cel.duration = item.duration;
        state.vectorCels.set(newStart, item.cel);
        maxEnd = Math.max(maxEnd, newStart + item.duration);
      }
    }

    state.totalFrames = Math.max(origTotalFrames, maxEnd);
    state.currentFrame = Math.min(state.totalFrames - 1, dragFrame);
    renderTimeline();
    renderStage();
  });

  vectorTrackRow.addEventListener('pointerup', () => {
    vectorStretchState = null;
  });
  vectorTrackRow.addEventListener('pointercancel', () => {
    vectorStretchState = null;
  });

  vectorTrackRow.addEventListener('dblclick', (e) => {
    if (e.button !== 0) return;
    const f = frameFromClientX(e.clientX);
    const entry = getVectorCelEntryAt(f);
    if (entry?.cel.nestId) {
      openNestedAnimationAt('vector', f);
    }
  });

  celTrackRow.addEventListener('dblclick', (e) => {
    if (e.button !== 0) return;
    const f = frameFromClientX(e.clientX);
    const entry = getCelEntryAt(f);
    if (entry?.cel.nestId) {
      openNestedAnimationAt('cel', f);
    }
  });

  function renderNestBreadcrumbUI(): void {
    const inNest = nestStack.length > 0;
    nestBreadcrumbBar.classList.toggle('open', inNest);
    btnRemoveFrame.classList.toggle('hidden-nest-ui', !inNest);

    btnModeScenes.disabled = inNest;
    mustEl<HTMLButtonElement>('btnToggleMouthTrack').disabled = inNest;
    mustEl<HTMLButtonElement>('btnToggleBgTrack').disabled = inNest;
    mustEl<HTMLButtonElement>('btnToggleAudioTrack').disabled = inNest;
    mustEl<HTMLButtonElement>('btnToggleCamTrack').disabled = inNest;

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

  function openNestedAnimationAt(layer: 'cel' | 'vector', frame: number): void {
    if (state.isPlaying) togglePlay();
    hideMenus();
    toggleCameraPanel(false);
    mouthSheetPop.classList.remove('open');

    const sc = activeScene();
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
        clip = {
          id: clipId,
          name: `Nest ${sc.nestedClips.size + 1}`,
          sourceLayer: 'vector',
          totalFrames: 1,
          currentFrame: 0,
          loopRange: null,
          cels: new Map(),
          vectorCels: new Map(),
        };
        sc.nestedClips.set(clipId, clip);

        if (existing) {
          const innerItems = cloneVectorItems(existing.cel.items);
          const innerHasInk = existing.cel.hasInk || innerItems.length > 0;
          clip.vectorCels.set(0, {
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
          clip.vectorCels.set(0, {
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
        clip = {
          id: clipId,
          name: `Nest ${sc.nestedClips.size + 1}`,
          sourceLayer: 'cel',
          totalFrames: 1,
          currentFrame: 0,
          loopRange: null,
          cels: new Map(),
          vectorCels: new Map(),
        };
        sc.nestedClips.set(clipId, clip);

        if (existing) {
          const innerCanvas = createCelCanvas(existing.cel.canvas.width, existing.cel.canvas.height);
          innerCanvas.getContext('2d')?.drawImage(existing.cel.canvas, 0, 0);
          clip.cels.set(0, {
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
          clip.cels.set(0, {
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
      savedTracks,
    });

    toggleMouthTrack(false);
    toggleBgTrack(false);
    toggleAudioTrack(false);
    toggleCamTrack(false);
    toggleVectorTrack(layer === 'vector' || clip.vectorCels.size > 0);
    selectTimelineTrack(layer);

    clip.currentFrame = Math.max(0, Math.min(clip.totalFrames - 1, clip.currentFrame));
    renderNestBreadcrumbUI();
    syncInspectorUI();
    renderTimeline();
    goToFrame(clip.currentFrame);
    onNotify(`Opened ${clip.name} (${clip.totalFrames}f loop) — add frames to animate, then click Exit Nest.`);
  }

  function exitNestLevel(toDepth = nestStack.length - 1): void {
    if (nestStack.length === 0 || toDepth >= nestStack.length) return;
    if (state.isPlaying) togglePlay();
    hideMenus();

    const targetDepth = Math.max(0, toDepth);
    const removed = nestStack.splice(targetDepth);
    const popped = removed[0];

    if (nestStack.length === 0 && popped?.savedTracks) {
      restoreSavedTracks(popped.savedTracks);
    } else if (nestStack.length > 0) {
      const parentClip = activeNestedClip();
      toggleVectorTrack(Boolean(parentClip && (parentClip.vectorCels.size > 0 || popped?.returnLayer === 'vector')));
    }

    if (popped) {
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
    if (rootEntry?.savedTracks) {
      restoreSavedTracks(rootEntry.savedTracks);
    }
    renderNestBreadcrumbUI();
    if (syncUI) {
      selectTimelineTrack(rootEntry.returnLayer);
      syncInspectorUI();
      renderTimeline();
      goToFrame(rootEntry.returnFrame);
    }
  }

  function unnestFrameAt(layer: 'cel' | 'vector', frame: number): void {
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
      const subCel = getCelEntryInScene(clip, clipFrame);
      const subVCel = getVectorCelEntryInScene(clip, clipFrame);
      if ((subCel && (subCel.cel.hasInk || subCel.cel.nestId)) || subVCel?.cel.nestId) {
        onNotify('Cannot unnest nested bitmap or sub-nest directly into a vector frame.');
        return;
      }
      pushVectorItemsUndo(entry.cel);
      if (subVCel) {
        const sx = subVCel.cel.offsetX;
        const sy = subVCel.cel.offsetY;
        const cloned = cloneVectorItems(subVCel.cel.items);
        for (const item of cloned) {
          if (item.kind === 'fill') {
            for (const loop of item.contours) {
              for (const p of loop) {
                p.x += sx;
                p.y += sy;
              }
            }
          } else {
            for (const p of item.points) {
              p.x += sx;
              p.y += sy;
            }
          }
        }
        entry.cel.items = cloned;
        entry.cel.hasInk = subVCel.cel.hasInk || cloned.length > 0;
      } else {
        entry.cel.items = [];
        entry.cel.hasInk = false;
      }
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

  vectorTrackRow.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.isPlaying) togglePlay();
    setActiveLayer('vector');
    contextTargetLayer = 'vector';
    contextTargetFrame = frameFromClientX(e.clientX);
    goToFrame(contextTargetFrame);

    const entry = getVectorCelEntryAt(contextTargetFrame);
    const hasEntry = Boolean(entry);
    const hasNest = Boolean(entry?.cel.nestId);
    mustEl<HTMLButtonElement>('ctxDelete').disabled = !hasEntry;
    mustEl<HTMLButtonElement>('ctxClear').disabled = !hasEntry;
    ctxExitNest.classList.toggle('hidden-nest-ui', nestStack.length === 0);
    ctxNest.textContent = hasNest ? 'Open Nested Animation' : hasEntry ? 'Open Nested Animation' : 'New Nested Animation';
    ctxUnnest.classList.toggle('hidden-nest-ui', !hasNest);

    celContextMenu.style.display = 'flex';
    const menuW = 190;
    const menuH = 220;
    const left = Math.min(window.innerWidth - menuW - 6, e.clientX);
    const top = Math.min(window.innerHeight - menuH - 6, e.clientY);
    celContextMenu.style.left = `${left}px`;
    celContextMenu.style.top = `${top}px`;
  });

  celTrackRow.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (state.isPlaying) togglePlay();
    setActiveLayer('cel');
    contextTargetLayer = 'cel';
    contextTargetFrame = frameFromClientX(e.clientX);
    goToFrame(contextTargetFrame);

    const entry = getCelEntryAt(contextTargetFrame);
    const hasEntry = Boolean(entry);
    const hasNest = Boolean(entry?.cel.nestId);
    mustEl<HTMLButtonElement>('ctxDelete').disabled = !hasEntry;
    mustEl<HTMLButtonElement>('ctxClear').disabled = !hasEntry;
    ctxExitNest.classList.toggle('hidden-nest-ui', nestStack.length === 0);
    ctxNest.textContent = hasNest ? 'Open Nested Animation' : hasEntry ? 'Open Nested Animation' : 'New Nested Animation';
    ctxUnnest.classList.toggle('hidden-nest-ui', !hasNest);

    celContextMenu.style.display = 'flex';
    const menuW = 190;
    const menuH = 220;
    const left = Math.min(window.innerWidth - menuW - 6, e.clientX);
    const top = Math.min(window.innerHeight - menuH - 6, e.clientY);
    celContextMenu.style.left = `${left}px`;
    celContextMenu.style.top = `${top}px`;
  });

  function hideMenus(): void {
    celContextMenu.style.display = 'none';
    mouthContextMenu.style.display = 'none';
    audioContextMenu.style.display = 'none';
    camContextMenu.style.display = 'none';
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

  ctxExitNest.onclick = () => {
    hideMenus();
    exitNestLevel();
  };
  ctxNest.onclick = () => {
    hideMenus();
    openNestedAnimationAt(contextTargetLayer, contextTargetFrame);
  };
  ctxUnnest.onclick = () => {
    hideMenus();
    unnestFrameAt(contextTargetLayer, contextTargetFrame);
  };

  mustEl<HTMLButtonElement>('ctxDelete').onclick = () => {
    if (contextTargetLayer === 'vector') deleteVectorCelAtFrame(contextTargetFrame);
    else deleteCelAtFrame(contextTargetFrame);
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxBlank').onclick = () => {
    if (contextTargetLayer === 'vector') splitOrCreateBlankVectorAt(contextTargetFrame, false);
    else splitOrCreateBlankAt(contextTargetFrame, false);
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxDup').onclick = () => {
    if (contextTargetLayer === 'vector') splitOrCreateBlankVectorAt(contextTargetFrame, true);
    else splitOrCreateBlankAt(contextTargetFrame, true);
    hideMenus();
  };
  mustEl<HTMLButtonElement>('ctxClear').onclick = () => {
    if (contextTargetLayer === 'vector') {
      const entry = getVectorCelEntryAt(contextTargetFrame);
      if (entry) {
        pushVectorItemsUndo(entry.cel);
        entry.cel.items = [];
        entry.cel.hasInk = false;
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

  function selectTool(toolName: 'brush' | 'eraser' | 'fill' | 'moveCam' | 'nudge'): void {
    const resolvedTool =
      toolName === 'nudge' && state.activeLayer !== 'vector' && state.activeLayer !== 'cel' ? 'brush' : toolName;
    state.tool = resolvedTool;
    document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tool === resolvedTool);
    });
    stage.style.cursor = resolvedTool === 'moveCam' ? 'move' : 'crosshair';
    syncSizeSliderUI();
    updateMouthWidget();
    updateStageBadge();
    renderStage();
  }

  document.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((btn) => {
    btn.onclick = () => {
      const t = btn.dataset.tool as 'brush' | 'eraser' | 'fill' | 'moveCam' | 'nudge' | undefined;
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
      sw.title =
        idx === activeSwatchIdx
          ? 'Click again to edit color (Right-click to remove)'
          : 'Click to select color';
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
      if (entry.type === 'move') {
        vCel.offsetX = entry.offsetX;
        vCel.offsetY = entry.offsetY;
      } else {
        vCel.items = cloneVectorItems(entry.items);
        vCel.hasInk = entry.hasInk;
        vCel.offsetX = entry.offsetX;
        vCel.offsetY = entry.offsetY;
      }
      renderTimeline();
      renderStage();
      return;
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
    if (entry.type === 'move' && 'offsetX' in layerObj) {
      layerObj.offsetX = entry.offsetX;
      layerObj.offsetY = entry.offsetY;
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
        delete existing.cel.nestId;
        delete existing.cel.nestOriginFrame;
        if (clonePrev) {
          const prev = getPrevVectorCelBefore(frame);
          if (prev) {
            existing.cel.items = cloneVectorItems(prev.cel.items);
            existing.cel.offsetX = prev.cel.offsetX;
            existing.cel.offsetY = prev.cel.offsetY;
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
        existing.cel.duration = leftDur;

        let items: VectorItem[] = [];
        let offsetX = 0;
        let offsetY = 0;
        let hasInk = false;
        let nestId: string | undefined;
        let nestOriginFrame: number | undefined;
        if (clonePrev) {
          items = cloneVectorItems(existing.cel.items);
          offsetX = existing.cel.offsetX;
          offsetY = existing.cel.offsetY;
          hasInk = existing.cel.hasInk;
          nestId = existing.cel.nestId;
          nestOriginFrame = existing.cel.nestOriginFrame;
        }
        state.vectorCels.set(frame, { items, undoStack: [], hasInk, duration: rightDur, offsetX, offsetY, nestId, nestOriginFrame });
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
        delete existing.cel.nestId;
        delete existing.cel.nestOriginFrame;
        if (clonePrev) {
          const prev = getPrevCelBefore(frame);
          if (prev) {
            existing.cel.canvas = createCelCanvas(prev.cel.canvas.width, prev.cel.canvas.height);
            existing.cel.canvas.getContext('2d')?.drawImage(prev.cel.canvas, 0, 0);
            existing.cel.offsetX = prev.cel.offsetX;
            existing.cel.offsetY = prev.cel.offsetY;
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
        existing.cel.duration = leftDur;

        let canvas = createCelCanvas();
        let offsetX = 0;
        let offsetY = 0;
        let hasInk = false;
        let nestId: string | undefined;
        let nestOriginFrame: number | undefined;
        if (clonePrev) {
          canvas = createCelCanvas(existing.cel.canvas.width, existing.cel.canvas.height);
          canvas.getContext('2d')?.drawImage(existing.cel.canvas, 0, 0);
          offsetX = existing.cel.offsetX;
          offsetY = existing.cel.offsetY;
          hasInk = existing.cel.hasInk;
          nestId = existing.cel.nestId;
          nestOriginFrame = existing.cel.nestOriginFrame;
        }
        state.cels.set(frame, { canvas, undoStack: [], hasInk, duration: rightDur, offsetX, offsetY, nestId, nestOriginFrame });
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

  mustEl<HTMLSelectElement>('fpsSelect').onchange = (e) => {
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
    state.onionBefore = !state.onionBefore;
    btnOnionBefore.classList.toggle('active', state.onionBefore);
    renderStage();
  };

  btnOnionAfter.onclick = () => {
    state.onionAfter = !state.onionAfter;
    btnOnionAfter.classList.toggle('active', state.onionAfter);
    renderStage();
  };

  function toggleCamTrack(forceState?: boolean): void {
    state.showCamTrack = typeof forceState === 'boolean' ? forceState : !state.showCamTrack;
    const btn = mustEl<HTMLButtonElement>('btnToggleCamTrack');
    btn.classList.toggle('active', state.showCamTrack);
    camTrackLabel.classList.toggle('hidden-track', !state.showCamTrack);
    camTrackRow.classList.toggle('hidden-track', !state.showCamTrack);
    camTrackRight.classList.toggle('hidden-track', !state.showCamTrack);
    toggleCameraPanel(state.showCamTrack);
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

  mustEl<HTMLButtonElement>('btnToggleCamTrack').onclick = () => {
    if (nestStack.length === 0) toggleCamTrack();
  };

  mustEl<HTMLButtonElement>('btnVisVector').onclick = (e) => {
    e.stopPropagation();
    state.showVectorLayer = !state.showVectorLayer;
    (e.currentTarget as HTMLButtonElement).style.opacity = state.showVectorLayer ? '1' : '0.35';
    renderStage();
  };
  mustEl<HTMLButtonElement>('btnVisCel').onclick = (e) => {
    e.stopPropagation();
    state.showCelLayer = !state.showCelLayer;
    (e.currentTarget as HTMLButtonElement).style.opacity = state.showCelLayer ? '1' : '0.35';
    renderStage();
  };
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

      if (!sc.audio || sc.audio.muted) continue;

      const clipDur = sc.audio.trimEndSec - sc.audio.trimStartSec;
      const clipGlobalStart = sceneStartSec + sc.audio.timelineStartSec;
      const clipGlobalEnd = Math.min(sceneEndSec, clipGlobalStart + clipDur);

      if (startSec >= clipGlobalEnd || clipGlobalEnd <= clipGlobalStart) continue;

      const src = ac.createBufferSource();
      src.buffer = sc.audio.buffer;
      const gain = ac.createGain();
      gain.gain.value = typeof sc.audio.volume === 'number' ? sc.audio.volume : 1;
      src.connect(gain);
      gain.connect(dest);

      if (startSec >= clipGlobalStart) {
        const intoClip = startSec - clipGlobalStart;
        const remaining = clipGlobalEnd - startSec;
        src.start(ac.currentTime, sc.audio.trimStartSec + intoClip, remaining);
      } else {
        const delay = clipGlobalStart - startSec;
        src.start(ac.currentTime + delay, sc.audio.trimStartSec, clipGlobalEnd - clipGlobalStart);
      }
      scheduled.push(src);
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
    const copy = makeScene(src.name + ' Copy');
    copy.totalFrames = src.totalFrames;
    copy.loopRange = src.loopRange ? { ...src.loopRange } : null;
    copy.cels.clear();
    for (const [f, cel] of src.cels.entries()) {
      const c = createCelCanvas(cel.canvas.width, cel.canvas.height);
      c.getContext('2d')?.drawImage(cel.canvas, 0, 0);
      copy.cels.set(f, {
        canvas: c,
        undoStack: [],
        hasInk: cel.hasInk,
        duration: cel.duration,
        offsetX: cel.offsetX,
        offsetY: cel.offsetY,
        nestId: cel.nestId,
        nestOriginFrame: cel.nestOriginFrame,
      });
    }
    copy.vectorCels.clear();
    for (const [f, vCel] of src.vectorCels.entries()) {
      copy.vectorCels.set(f, {
        items: cloneVectorItems(vCel.items),
        undoStack: [],
        hasInk: vCel.hasInk,
        duration: vCel.duration,
        offsetX: vCel.offsetX,
        offsetY: vCel.offsetY,
        nestId: vCel.nestId,
        nestOriginFrame: vCel.nestOriginFrame,
      });
    }
    copy.nestedClips = new Map();
    for (const [cid, clip] of src.nestedClips.entries()) {
      const cCels = new Map<number, Cel>();
      for (const [f, cel] of clip.cels.entries()) {
        const c = createCelCanvas(cel.canvas.width, cel.canvas.height);
        c.getContext('2d')?.drawImage(cel.canvas, 0, 0);
        cCels.set(f, {
          canvas: c,
          undoStack: [],
          hasInk: cel.hasInk,
          duration: cel.duration,
          offsetX: cel.offsetX,
          offsetY: cel.offsetY,
          nestId: cel.nestId,
          nestOriginFrame: cel.nestOriginFrame,
        });
      }
      const vCels = new Map<number, VectorCel>();
      for (const [f, vCel] of clip.vectorCels.entries()) {
        vCels.set(f, {
          items: cloneVectorItems(vCel.items),
          undoStack: [],
          hasInk: vCel.hasInk,
          duration: vCel.duration,
          offsetX: vCel.offsetX,
          offsetY: vCel.offsetY,
          nestId: vCel.nestId,
          nestOriginFrame: vCel.nestOriginFrame,
        });
      }
      copy.nestedClips.set(cid, {
        id: clip.id,
        name: clip.name,
        sourceLayer: clip.sourceLayer,
        totalFrames: clip.totalFrames,
        currentFrame: clip.currentFrame,
        loopRange: clip.loopRange ? { ...clip.loopRange } : null,
        cels: cCels,
        vectorCels: vCels,
      });
    }
    const bgC = createCelCanvas(src.bgLayer.canvas.width, src.bgLayer.canvas.height);
    bgC.getContext('2d')?.drawImage(src.bgLayer.canvas, 0, 0);
    copy.bgLayer = {
      canvas: bgC,
      undoStack: [],
      hasInk: src.bgLayer.hasInk,
      visible: src.bgLayer.visible,
      name: src.bgLayer.name,
      offsetX: src.bgLayer.offsetX,
      offsetY: src.bgLayer.offsetY,
    };
    copy.mouthLayer = {
      visible: src.mouthLayer.visible,
      keys: new Map(Array.from(src.mouthLayer.keys.entries()).map(([k, v]) => [k, { ...v }])),
      visemes: src.mouthLayer.visemes.map((v) => {
        const vc = createCelCanvas(MOUTH_W, MOUTH_H);
        vc.getContext('2d')?.drawImage(v.canvas, 0, 0);
        return { name: v.name, canvas: vc, undoStack: [] };
      }),
    };
    copy.cameraKeys = new Map(Array.from(src.cameraKeys.entries()).map(([k, v]) => [k, { ...v }]));
    copy.audio = src.audio ? { ...src.audio } : null;
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
      info.textContent = `${sc.totalFrames}f (${secStr}s)` + (sc.audio ? ' • 🔊' : '');
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

      if (app.mode !== 'editor') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoActiveLayer();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (state.selectedTrack === 'audio' && state.audio) {
          deleteActiveAudio();
        } else if (state.selectedTrack === 'mouth') {
          deleteMouthKeyAtFrame(state.currentFrame);
        } else if (state.selectedTrack === 'cam') {
          if (state.cameraKeys.has(state.currentFrame)) {
            state.cameraKeys.delete(state.currentFrame);
            syncInspectorUI();
            renderTimeline();
            renderStage();
          }
        } else if (state.selectedTrack === 'vector') {
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
      } else if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.toLowerCase() === 'n' &&
        (state.activeLayer === 'vector' || state.activeLayer === 'cel')
      ) {
        selectTool('nudge');
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
    nestId?: string;
    nestOriginFrame?: number;
    items: VectorItem[];
  }

  interface SerializedNestedClip {
    id: string;
    name: string;
    sourceLayer?: 'cel' | 'vector';
    totalFrames?: number;
    loopRange?: LoopRange | null;
    cels?: SerializedCel[];
    vectorCels?: SerializedVectorCel[];
  }

  interface SerializedScene {
    id?: string;
    name?: string;
    totalFrames?: number;
    loopRange?: LoopRange | null;
    cels?: SerializedCel[];
    vectorCels?: SerializedVectorCel[];
    nestedClips?: SerializedNestedClip[];
    cameraKeys?: Array<[number, CameraKey]>;
    bgLayer?: {
      hasInk?: boolean;
      visible?: boolean;
      name?: string;
      offsetX?: number;
      offsetY?: number;
      width?: number;
      height?: number;
      dataUrl: string | null;
    };
    mouthLayer?: {
      visible?: boolean;
      keys?: Array<[number, MouthKey]>;
      visemes?: Array<{ name: string; dataUrl: string }>;
    };
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
        nestId: cel.nestId,
        nestOriginFrame: cel.nestOriginFrame,
        width: cel.canvas.width,
        height: cel.canvas.height,
        dataUrl: cel.canvas.toDataURL('image/png'),
      });
    }
    return arr;
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
        nestId: vCel.nestId,
        nestOriginFrame: vCel.nestOriginFrame,
        items: cloneVectorItems(vCel.items),
      });
    }
    return arr;
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
        nestId: vItem.nestId,
        nestOriginFrame: vItem.nestOriginFrame,
      });
    }
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
        cels: serializeCelMap(clip.cels),
        vectorCels: serializeVectorCelMap(clip.vectorCels),
      });
    }
    return {
      id: sc.id,
      name: sc.name,
      totalFrames: sc.totalFrames,
      loopRange: sc.loopRange,
      cels: serializeCelMap(sc.cels),
      vectorCels: serializeVectorCelMap(sc.vectorCels),
      nestedClips: nestedClipsArr,
      cameraKeys: Array.from(sc.cameraKeys.entries()),
      bgLayer: {
        hasInk: sc.bgLayer.hasInk,
        visible: sc.bgLayer.visible,
        name: sc.bgLayer.name,
        offsetX: sc.bgLayer.offsetX,
        offsetY: sc.bgLayer.offsetY,
        width: sc.bgLayer.canvas.width,
        height: sc.bgLayer.canvas.height,
        dataUrl: sc.bgLayer.hasInk ? sc.bgLayer.canvas.toDataURL('image/png') : null,
      },
      mouthLayer: {
        visible: sc.mouthLayer.visible,
        keys: Array.from(sc.mouthLayer.keys.entries()),
        visemes: sc.mouthLayer.visemes.map((v) => ({
          name: v.name,
          dataUrl: v.canvas.toDataURL('image/png'),
        })),
      },
    };
  }

  async function deserializeScene(raw: SerializedScene, fallbackName: string): Promise<Scene> {
    const sc = makeScene(raw.name || fallbackName);
    if (raw.id) sc.id = raw.id;
    sc.totalFrames = raw.totalFrames || 24;
    sc.loopRange = raw.loopRange || null;
    sc.cels.clear();
    sc.nestedClips.clear();
    sc.cameraKeys = new Map(raw.cameraKeys || []);

    if (Array.isArray(raw.vectorCels) && raw.vectorCels.length > 0) {
      sc.vectorCels.clear();
      deserializeVectorCelMapInto(sc.vectorCels, raw.vectorCels);
    }

    await deserializeCelMapInto(sc.cels, raw.cels);

    for (const rawClip of raw.nestedClips || []) {
      const clip: NestedClip = {
        id: rawClip.id,
        name: rawClip.name || 'Nest',
        sourceLayer: rawClip.sourceLayer === 'vector' ? 'vector' : 'cel',
        totalFrames: Math.max(1, rawClip.totalFrames || 1),
        currentFrame: 0,
        loopRange: rawClip.loopRange || null,
        cels: new Map(),
        vectorCels: new Map(),
      };
      await deserializeCelMapInto(clip.cels, rawClip.cels);
      deserializeVectorCelMapInto(clip.vectorCels, rawClip.vectorCels);
      sc.nestedClips.set(clip.id, clip);
    }

    if (raw.bgLayer && raw.bgLayer.dataUrl) {
      sc.bgLayer.hasInk = Boolean(raw.bgLayer.hasInk);
      sc.bgLayer.visible = Boolean(raw.bgLayer.visible);
      sc.bgLayer.name = raw.bgLayer.name || '';
      sc.bgLayer.offsetX = raw.bgLayer.offsetX || 0;
      sc.bgLayer.offsetY = raw.bgLayer.offsetY || 0;
      sc.bgLayer.canvas = createCelCanvas(raw.bgLayer.width || WORLD_W, raw.bgLayer.height || WORLD_H);
      const dataUrl = raw.bgLayer.dataUrl;
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          const bctx = sc.bgLayer.canvas.getContext('2d');
          if (bctx) {
            bctx.imageSmoothingEnabled = false;
            bctx.drawImage(img, 0, 0);
          }
          resolve();
        };
        img.src = dataUrl;
      });
    }

    if (raw.mouthLayer) {
      sc.mouthLayer.visible = Boolean(raw.mouthLayer.visible);
      sc.mouthLayer.keys = new Map(raw.mouthLayer.keys || []);
      if (Array.isArray(raw.mouthLayer.visemes)) {
        for (let i = 0; i < sc.mouthLayer.visemes.length && i < raw.mouthLayer.visemes.length; i++) {
          const vData = raw.mouthLayer.visemes[i];
          if (vData && vData.dataUrl) {
            await new Promise<void>((resolve) => {
              const img = new Image();
              img.onload = () => {
                const vctx = sc.mouthLayer.visemes[i].canvas.getContext('2d');
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
    }
    return sc;
  }

  mustEl<HTMLButtonElement>('btnSaveJson').onclick = () => {
    hideMenus();
    const payload = {
      version: 3,
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
          ? app.scenes.some((sc) => sc.audio && !sc.audio.muted)
          : Boolean(state.audio && !state.audio.muted);

      if (hasAnyAudio) {
        const ac = getAudioContext();
        const dest = ac.createMediaStreamDestination();
        if (app.mode === 'scenes') {
          exportAudioSources = scheduleMultiSceneAudio(0, ac, dest);
        } else if (state.audio) {
          const { minF, maxF } = getPlaybackBounds();
          const startSec = minF / app.fps;
          const totalExportSec = (maxF - minF + 1) / app.fps;
          const clipDur = state.audio.trimEndSec - state.audio.trimStartSec;
          const clipStart = state.audio.timelineStartSec;
          const clipEnd = clipStart + clipDur;

          if (startSec < clipEnd && startSec + totalExportSec > clipStart) {
            const src = ac.createBufferSource();
            src.buffer = state.audio.buffer;
            const gain = ac.createGain();
            gain.gain.value = getEffectiveAudioVolume();
            src.connect(gain);
            gain.connect(dest);
            if (startSec >= clipStart) {
              src.start(ac.currentTime, state.audio.trimStartSec + (startSec - clipStart), clipEnd - startSec);
            } else {
              src.start(ac.currentTime + (clipStart - startSec), state.audio.trimStartSec, clipDur);
            }
            exportAudioSources.push(src);
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
  resizeStageCanvas();
  updateAudioVolumeUI();
  updateActiveTrackHighlight();
  renderTimeline();
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
