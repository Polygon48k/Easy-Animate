import { useEffect, useRef, useState } from 'react';
import { initAnimator } from './animatorEngine';

export default function App() {
  const [notice, setNotice] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const cleanup = initAnimator((msg: string) => {
      setNotice(msg);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setNotice(null);
      }, 4500);
    });

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      cleanup();
    };
  }, []);

  return (
    <div className="app-root">
      {notice && <div className="toast-notice">{notice}</div>}

      <header>
        <div className="toolbar-group">
          <div className="studio-seg">
            <button id="btnModeBasic" className="active">Basic</button>
            <button id="btnModePro">Pro</button>
            <button id="btnModeScenes">Scenes</button>
          </div>
          <span id="activeSceneLabel" className="scene-name-tag">Scene 1</span>
        </div>

        <div className="toolbar-group" id="editorOnionGroup">
          <div className="studio-seg" title="Onion Skinning (O)">
            <button id="btnOnion">Onion: Off</button>
            <button id="btnOnionBefore" className="mini-btn active" title="Show 1 Frame Before">Prev</button>
            <button id="btnOnionAfter" className="mini-btn" title="Show 1 Frame After">Next</button>
          </div>
          <button
            id="btnOriginPoint"
            className="hidden-nest-ui"
            title="Show/Hide Orange Origin Point (Pivot &amp; Rotate)"
          >
            <span className="origin-btn-dot" aria-hidden="true" />
            <span id="btnOriginPointText">Origin: Off</span>
          </button>
          <button
            id="btnVectorPixelPreview"
            className="hidden-nest-ui"
            title="Pixelate Vector layer to canvas resolution using nearest-neighbor preview"
          >
            Pixelate: Off
          </button>
          <div id="vectorPointModeGroup" className="studio-seg hidden-nest-ui" title="Switch selected vector point between sharp Corners and smooth Curves">
            <button id="btnVectorCorner" type="button" title="Sharp corner vertex">Corners</button>
            <button id="btnVectorCurve" type="button" className="active" title="Smooth curved vertex">Curves</button>
          </div>
        </div>

        <div className="toolbar-group">
          <button id="btnLoadJson" title="Open project JSON">Load</button>
          <input type="file" id="fileInput" accept=".json" className="hidden" />

          <div className="dropdown-wrap" id="sizeWrap">
            <button id="btnCanvasSize" title="Change Canvas Resolution">1280×720 ▾</button>
            <div className="dropdown-menu" id="sizeMenu">
              <button data-res="720x480">720 × 480 (SD)</button>
              <button data-res="1280x720">1280 × 720 (HD)</button>
              <button data-res="1920x1080">1920 × 1080 (Full HD)</button>
            </div>
          </div>

          <div className="dropdown-wrap" id="exportWrap">
            <button id="btnExportMenu" className="export-btn" title="Export Video, PNG Sequence, or Project">Export ▾</button>
            <div className="dropdown-menu" id="exportMenu">
              <button id="btnExportMp4">Export MP4 (.mp4)</button>
              <button id="btnExportWebm">Export WebM (.webm)</button>
              <button id="btnExportPngSeq">Export PNG Sequence (.zip)</button>
              <button id="btnSaveJson">Export Project (.json)</button>
            </div>
          </div>
        </div>
      </header>

      {/* PAGE 1: SCENE EDITOR VIEW */}
      <div className="editor-view" id="editorView">
        <div className="workspace">
          {/* Affinity-style Slim Left Tool Dock */}
          <aside className="left-dock">
            <div>
              <div className="section-title">Tools</div>
              <div className="tool-stack">
                <button className="tool-btn active" data-tool="brush" title="Brush (B) — Right-click erases, [ / ] resizes">
                  <svg viewBox="0 0 24 24">
                    <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
                    <path d="M9 8c-2 3-4 3.5-7 4l8 10c2-1 6-5 6-7" />
                  </svg>
                  <span>Brush</span>
                </button>

                <button className="tool-btn" data-tool="eraser" title="Eraser (E) — [ / ] resizes">
                  <svg viewBox="0 0 24 24">
                    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                    <path d="M22 21H7" />
                    <path d="m5 11 9 9" />
                  </svg>
                  <span>Eraser</span>
                </button>

                <button className="tool-btn" data-tool="fill" title="Fill Bucket (F) — Right-click erases">
                  <svg viewBox="0 0 24 24">
                    <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
                    <path d="m5 2 5 5" />
                    <path d="M2 13h15" />
                    <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
                  </svg>
                  <span>Fill</span>
                </button>

                <button className="tool-btn" data-tool="moveCam" title="Move / Scale / Rotate Layer (M / R) — Drag to move, Right-drag to scale content, Shift+drag to pan camera (enable Origin to pivot/rotate)">
                  <svg viewBox="0 0 24 24">
                    <path d="M5 9l-3 3 3 3" />
                    <path d="M9 5l3-3 3 3" />
                    <path d="M15 19l-3 3-3-3" />
                    <path d="M19 9l3 3-3 3" />
                    <path d="M2 12h20" />
                    <path d="M12 2v20" />
                  </svg>
                  <span>Move</span>
                </button>

                <button
                  id="btnToolNudge"
                  className="tool-btn hidden-tool"
                  data-tool="nudge"
                  title="Proportional Nudge (N) — Move/stretch inside circle on Bitmap (100% hard edge) or sculpt Vector curves ([ / ] resizes)"
                >
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" strokeDasharray="3 2.2" />
                    <circle cx="12" cy="12" r="2.2" />
                    <path d="M14 10l4-4" />
                    <path d="M15 6h3v3" />
                  </svg>
                  <span>Nudge</span>
                </button>

                <button
                  id="btnToolVectorEdit"
                  className="tool-btn hidden-tool"
                  data-tool="vectorEdit"
                  title="Edit Vector Points (V) — Select and move individual vector points, switch between Corners and Curves"
                >
                  <svg viewBox="0 0 24 24">
                    <path d="M4 18C7 9 17 9 20 18" />
                    <rect x="2.5" y="16.5" width="3" height="3" rx="0.5" />
                    <circle cx="12" cy="10" r="2.3" />
                    <rect x="18.5" y="16.5" width="3" height="3" rx="0.5" />
                    <path d="M12 4v3.5" />
                  </svg>
                  <span>Edit</span>
                </button>
              </div>
            </div>

            <div className="brush-box">
              <div className="section-title mb-0">Color</div>
              <input
                type="color"
                id="brushColor"
                className="palette-picker-proxy"
                defaultValue="#000000"
                tabIndex={-1}
                aria-hidden="true"
              />
              <div className="swatches" id="paletteSwatches" />
            </div>

            <div className="size-box" id="brushSizeBox">
              <div className="section-title mb-0" id="brushSizeHeading">Size</div>
              <span id="brushSizeVal" className="size-readout">4px</span>
              <input type="range" id="brushSize" min="1" max="32" defaultValue="4" title="Brush/Eraser/Nudge Size ([ and ])" />
            </div>

            <div className="size-box" id="closeFillBox">
              <div className="section-title mb-0">Close</div>
              <button id="btnGapCycle" className="gap-btn" title="Automatically close gaps up to this size (up to 64px) when using Fill">Off</button>
            </div>
          </aside>

          {/* Full-Area Center Stage */}
          <main className="stage-container" id="stageContainer">
            <div className="stage-top-left">
              <div className="stage-badge" id="stageBadge">BRUSH (4px) | F1 | 1280×720 | View 100%</div>
              <button id="btnResetView" className="mini-btn hidden-nest-ui" title="Reset Canvas Zoom & Pan">Reset View</button>
              <div className="nest-breadcrumb-bar" id="nestBreadcrumbBar">
                <div className="nest-crumbs" id="nestBreadcrumbs" />
                <button id="btnExitNest" className="nest-exit-btn" title="Exit Nested Animation back to parent timeline (Esc)">← Exit Nest</button>
              </div>
            </div>

            {/* Framed Shape Switcher Widget (Appears when Picker Layer is On) */}
            <div className="mouth-widget" id="mouthWidget">
              <div className="mouth-sheet-pop" id="mouthSheetPop">
                <div className="flex items-center justify-between gap-1">
                  <strong className="text-[11px] font-semibold">Picker Shapes</strong>
                  <div className="flex gap-1">
                    <button id="btnMouthAddShape" className="mini-btn primary" title="Add extra shape">+</button>
                    <button id="btnMouthClearShape" className="mini-btn danger" title="Clear current shape to redraw">Clear</button>
                    <button id="btnMouthResetShape" className="mini-btn" title="Restore starter shape">Reset</button>
                    <button id="btnMouthClosePop" className="mini-btn">✕</button>
                  </div>
                </div>
                <div className="mouth-sheet-grid" id="mouthSheetGrid" />
                <div className="hint">Click a shape to select it, click <strong>+</strong> to add extra shapes, then use <strong>Draw</strong> (or draw directly on stage) to customize.</div>
              </div>

              <div className="mouth-cycler">
                <button id="btnMouthPrev" className="mouth-arrow-btn" title="Previous Picker Shape">◀</button>
                <div className="mouth-frame-box" id="mouthFrameBox" title="Click to view/pick all shapes">
                  <canvas id="mouthPreviewCanvas" width={160} height={120} />
                  <span className="mouth-frame-label" id="mouthFrameLabel">Rest</span>
                </div>
                <button id="btnMouthNext" className="mouth-arrow-btn" title="Next Picker Shape">▶</button>
              </div>
              <div className="mouth-widget-actions">
                <button id="btnMouthDraw" className="mini-btn flex-1 justify-center" title="Draw replacement directly on stage">Draw</button>
                <button id="btnMouthMove" className="mini-btn flex-1 justify-center" title="Left-drag to move picker, Right-drag to scale picker layer">Move</button>
                <button id="btnMouthAll" className="mini-btn" title="All Picker Shapes">Shapes</button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-semibold text-[#f9a8d4] truncate" id="mouthLayerNameBadge">Picker 1</span>
              </div>
              <div className="mouth-scale-row" title="Scale only the picker layer">
                <label htmlFor="mouthScaleSlider">Scale</label>
                <input type="range" id="mouthScaleSlider" min="20" max="500" defaultValue="100" />
                <span id="mouthScaleVal">100%</span>
              </div>
            </div>

            {/* Camera Keyframe Controls Pop-out (Right of Stage when Camera Track is On) */}
            <div className="cam-popover" id="camPopover">
              <div className="flex items-center justify-between">
                <span className="section-title m-0 text-left text-[10px]">Camera Keyframes</span>
                <button id="btnCloseCamPanel" className="mini-btn" title="Hide Camera Controls">✕</button>
              </div>

              <div>
                <div className="flex gap-[5px] mb-1.5">
                  <button id="btnSetCamKey" className="primary flex-1">◆ Keyframe</button>
                  <button id="btnDelCamKey" className="danger" title="Remove Camera Keyframe">Remove</button>
                </div>
                <div className="control-row">
                  <label>Easing</label>
                  <select id="camEase" defaultValue="easeInOut" className="flex-1">
                    <option value="easeInOut">Ease In-Out</option>
                    <option value="linear">Linear</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="control-row">
                  <label>Scale</label>
                  <input type="range" id="camScale" min="20" max="500" defaultValue="100" />
                  <span className="val-badge" id="camScaleVal">100%</span>
                </div>
                <div className="control-row">
                  <label>Pan X</label>
                  <input type="range" id="camX" min="-1200" max="1200" defaultValue="0" />
                  <span className="val-badge" id="camXVal">0</span>
                </div>
                <div className="control-row">
                  <label>Pan Y</label>
                  <input type="range" id="camY" min="-800" max="800" defaultValue="0" />
                  <span className="val-badge" id="camYVal">0</span>
                </div>
                <button id="btnResetCam" className="w-full justify-center mt-0.5">Reset Camera (100%)</button>
              </div>

              <div className="hint">
                <strong>View Zoom:</strong> Scroll / Pinch<br />
                <strong>View Pan:</strong> Middle-mouse drag<br />
                <strong>Layer Scale:</strong> Right-drag (Move)<br />
                <strong>Cam Pan:</strong> Shift+drag (Move)
              </div>
            </div>

            <canvas id="stage" />
          </main>
        </div>

        {/* Bottom Timeline */}
        <section className="timeline-panel" id="timelinePanel">
          <div className="timeline-header" id="timelineHeader" title="Drag up/down to resize timeline (double-click to reset)">
            {/* Left: Add Layers (Pro) / Audio Toggle (Basic) */}
            <div className="toolbar-group" id="editorLayerTrackGroup">
              <button id="btnAddCelTrack" title="Add Bitmap Layer">+ Bitmap</button>
              <button id="btnAddVectorTrack" title="Add Vector Layer">+ Vector</button>
              <button id="btnAddMouthTrack" title="Add Picker Layer">+ Picker</button>
              <button id="btnAddBgTrack" title="Add Background Layer">+ Background</button>
              <button id="btnAddAudioTrack" title="Add Audio Layer">+ Audio</button>
              <button id="btnAddCamTrack" title="Add Camera Layer (max 1)">+ Camera</button>
              <button id="btnToggleAudioTrack" title="Show/Hide Sound Layer">Audio</button>
            </div>

            {/* Center: Playback Controls */}
            <div className="timeline-header-center">
              <button id="btnRewind" className="transport-btn" title="First Frame" aria-label="First Frame">
                <svg className="transport-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6v12" />
                  <path d="M18 6l-7 6 7 6V6Z" />
                </svg>
              </button>
              <button id="btnPrevFrame" className="transport-btn" title="Previous Frame (&lt;)" aria-label="Previous Frame">
                <svg className="transport-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M15 6l-6 6 6 6" />
                </svg>
              </button>
              <button id="btnPlay" className="primary" title="Play / Pause (Space)">▶ Play</button>
              <button id="btnNextFrame" className="transport-btn" title="Next Frame (&gt; — extends at end)" aria-label="Next Frame">
                <svg className="transport-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </button>
              <button id="btnLoop" className="active" title="Toggle Loop">Loop: On</button>
              <select id="fpsSelect" defaultValue="12" title="Frames Per Second">
                <option value="12">12 FPS</option>
                <option value="24">24 FPS</option>
              </select>
              <span id="frameIndicator" className="frame-readout">
                F 1 / 24
              </span>
            </div>

            {/* Right: Loop, Timeline Zoom & Add Frame */}
            <div className="toolbar-group">
              <span id="loopRangeBadge" className="loop-readout">Loop: All</span>
              <button id="btnResetTimelineZoom" className="mini-btn hidden-nest-ui" title="Reset Timeline Zoom">Zoom: 1x ✕</button>
              <button id="btnRemoveFrame" className="hidden-nest-ui" title="Remove last frame from nested loop">- Frame</button>
              <button id="btnAddFrame" title="Extend timeline by 1 frame">+ Frame</button>
            </div>
          </div>

          <div className="timeline-body">
            <div className="track-labels">
              <div className="track-label-loop">
                <span>Loop Range</span>
                <button id="btnClearLoopRange" className="mini-btn" title="Reset Loop Range">Clear</button>
              </div>
              <div className="track-label-spacer">Scrub Frames</div>
              <div id="layerLabelsContainer" className="vector-track-group" />
              <input type="file" id="bgFileInput" accept="image/*" className="hidden" />
              <div id="audioLabelsContainer" className="vector-track-group" />
              <div className="track-label hidden-track" id="camTrackLabel">
                <span className="track-tag"><i className="bg-[#fbbf24]" /> Camera</span>
                <button id="btnVisCam" className="mini-btn" title="Toggle Camera Preview">👁</button>
              </div>
            </div>

            <div className="timeline-scroll" id="timelineScroll">
              <div className="timeline-grid" id="timelineGrid">
                <div className="loop-row" id="loopRow" title="Drag to select loop range (double-click to clear)">
                  <div className="loop-selection-bar" id="loopSelectionBar" />
                </div>
                <div className="ruler-row" id="rulerRow" />
                <div id="layerRowsContainer" className="vector-track-group" />
                <div id="audioRowsContainer" className="vector-track-group" />
                <div className="track-row hidden-track" id="camTrackRow" />
                <div className="loop-highlight-overlay" id="loopHighlightOverlay" />
                <div className="playhead-line" id="playheadLine"><div className="playhead-cap" /></div>
              </div>
            </div>

            <div className="track-right-rail" id="trackRightRail" title="Active Layer Selection">
              <div className="track-right-loop" />
              <div className="track-right-spacer" />
              <div id="layerRightsContainer" className="vector-track-group" />
              <div id="audioRightsContainer" className="vector-track-group" />
              <div className="track-right-cell hidden-track" id="camTrackRight" />
            </div>
          </div>
        </section>
      </div>

      {/* PAGE 2: SCENES / STORYBOARD VIEW */}
      <div className="scenes-view hidden-view" id="scenesView">
        <div className="scenes-player-area">
          <div className="scenes-preview-wrap">
            <canvas id="scenesPreviewCanvas" />
          </div>
          <div className="scenes-player-bar">
            <button id="btnScenesRewind" title="Rewind All">|&lt;</button>
            <button id="btnScenesPlay" className="primary" title="Play All Scenes (Space)">▶ Play All</button>
            <button id="btnScenesLoop" className="active">Loop: On</button>
            <div className="scenes-scrubber" id="scenesScrubber" title="Scrub across all scenes" />
            <span id="scenesFrameReadout" className="scenes-frame-readout">
              Scene 1 • F 1 / 24
            </span>
          </div>
        </div>

        <div className="scenes-board-header">
          <div className="toolbar-group">
            <strong className="text-[12px] font-semibold">Scenes Storyboard</strong>
            <button id="btnNewScene" className="primary">+ New Scene</button>
            <span className="scenes-hint-text">Drag scenes to reorder • Double-click a scene to edit</span>
          </div>
          <div className="toolbar-group">
            <span className="scenes-hint-text">Zoom</span>
            <input type="range" id="scenesZoomSlider" min="90" max="380" defaultValue="220" className="w-[110px]" />
          </div>
        </div>

        <div className="scenes-board" id="scenesBoard">
          <div className="scenes-grid" id="scenesGrid" />
        </div>
      </div>

      {/* Right-Click Frame Context Menu */}
      <div className="context-menu" id="celContextMenu">
        <button id="ctxExitNest" className="hidden-nest-ui ctx-nest-exit">← Exit Nested Animation</button>
        <button id="ctxNest" className="ctx-nest-open">Open Nested Animation</button>
        <button id="ctxUnnest" className="hidden-nest-ui">Unnest (Flatten Frame)</button>
        <button id="ctxClearTween" className="hidden-nest-ui">Clear Motion Tween</button>
        <div className="ctx-divider" id="ctxNestTweenDivider" />
        <button id="ctxDelete" className="ctx-danger">Delete Frame</button>
        <button id="ctxBlank">+ Blank Keyframe</button>
        <button id="ctxDup">Duplicate Previous</button>
        <button id="ctxClear">Clear Drawing</button>
      </div>

      {/* Right-Click Picker Keyframe Context Menu */}
      <div className="context-menu" id="mouthContextMenu">
        <button id="ctxMouthDelete" className="ctx-danger">Delete Picker Key</button>
        <button id="ctxMouthKey">+ Keyframe Here</button>
        <button id="ctxMouthClearAll" className="ctx-danger">Clear All Picker Keys</button>
      </div>

      {/* Right-Click Audio Context Menu */}
      <div className="context-menu" id="audioContextMenu">
        <button id="ctxAudioAutoLipSync">Auto Lip-Sync Picker</button>
        <button id="ctxAudioFit">Fit Timeline to Audio</button>
        <button id="ctxAudioMute">Mute / Unmute</button>
        <button id="ctxAudioDelete" className="ctx-danger">Delete Audio Clip</button>
        <button id="ctxAudioDeleteTrack" className="ctx-danger hidden-nest-ui">Delete Audio Layer</button>
      </div>

      {/* Right-Click Camera Keyframe Context Menu */}
      <div className="context-menu" id="camContextMenu">
        <button id="ctxCamSet">Update Camera Keyframe</button>
        <button id="ctxCamDelete" className="ctx-danger">Delete Camera Keyframe</button>
      </div>

      {/* Right-Click Layer Label Context Menu */}
      <div className="context-menu" id="layerContextMenu">
        <button id="ctxLayerAddChildVec">+↳ Add Child Vector Layer</button>
        <button id="ctxLayerAddChildCel">+↳ Add Child Bitmap Layer</button>
        <button id="ctxLayerJoinAbove">Join as Child of Above</button>
        <button id="ctxLayerDetach">Detach from Parent</button>
        <button id="ctxLayerToggleIK">Enable Inverse Kinematics</button>
        <div className="ctx-divider" />
        <button id="ctxLayerRename">Rename Layer</button>
        <button id="ctxLayerClear" className="hidden-nest-ui">Clear Background Artwork</button>
        <button id="ctxLayerDelete" className="ctx-danger">Delete Layer</button>
      </div>
    </div>
  );
}
