'use client';

import { useEffect } from 'react';
import Script from 'next/script';

// Real-media drawing engine: charcoal/graphite/ink/marker/pastel/oil/eraser,
// reference trace-paper import, and signage/print export presets.
// Logic lives in /public/draw-engine.js (plain JS, loaded below) so it stays
// a normal, editable file instead of a string buried in this component.

export default function DrawPage() {
  useEffect(() => {
    document.title = 'Veridian Q — Draw';
  }, []);

  return (
    <>
      <style>{`
  :root{
    --bg:#0a0a0a; --panel:#111111; --panel2:#17120a; --line:#2a2520;
    --gold:#f2b94e; --gold-dim:#b08a3e; --text:#faf8f3; --text-dim:#c7c1b4;
  }
  *{box-sizing:border-box;}
  html,body{height:100%;margin:0;background:var(--bg);color:var(--text);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;overflow:hidden;}
  #app{display:flex;flex-direction:column;height:100dvh;min-height:100dvh;}
  header{padding:14px 20px;border-bottom:1px solid var(--line);display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
  header .logo{font-family:Georgia,"Times New Roman",serif;font-size:24px;letter-spacing:4px;}
  header .logo b{color:var(--gold);font-weight:400;}
  header .tag{font-size:13px;letter-spacing:2px;color:var(--text-dim);text-transform:uppercase;}
  header .auth-btn{margin-left:auto;background:transparent;border:1px solid rgba(255,255,255,.6);
    color:var(--gold,#f2b94e);font-size:10px;letter-spacing:1px;text-transform:uppercase;
    padding:8px 16px;border-radius:7px;cursor:pointer;font-family:inherit;
    animation:authPump 3.6s ease-in-out infinite;}
  header .auth-btn:hover{background:rgba(242,185,78,.08);}
  @keyframes authPump{
    0%,100%{transform:scale(1);}
    50%{transform:scale(1.045);}
  }
  .main{flex:1;display:flex;min-height:0;overflow:hidden;}
  aside{width:230px;flex:0 0 230px;background:var(--panel);overflow-y:auto;padding:14px;border-right:1px solid var(--line);}
  aside.right{border-right:none;border-left:1px solid var(--line);transition:width .15s,flex-basis .15s;}
  aside.right.collapsed{width:60px;flex:0 0 60px;padding:14px 8px;overflow:hidden;}
  aside.right.collapsed #rightBody{display:none;}
  #rightToggle{margin-bottom:10px;}
  h3.sec{font-size:15px;letter-spacing:1.5px;color:var(--gold);text-transform:uppercase;margin:16px 0 8px;}
  h3.sec:first-child{margin-top:0;}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:6px;}
  .grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
  .pigment-row-label{font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-dim);margin:6px 0 3px;}
  .pigment-row{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 4px;}
  .pigment-swatch{width:30px;height:30px;border-radius:6px;border:1px solid var(--line);cursor:pointer;padding:0;}
  .pigment-swatch.active{border-color:var(--gold);box-shadow:0 0 0 2px rgba(242,185,78,.35) inset;}
  .gray-slider{-webkit-appearance:none;appearance:none;width:100%;height:24px;border-radius:4px;margin:2px 0 6px;
    background:linear-gradient(to right, #fff, #000);}
  .gray-slider::-webkit-slider-runnable-track{height:24px;background:transparent;border-radius:4px;}
  .gray-slider::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:30px;border-radius:3px;
    background:var(--gold);border:1px solid #140f06;margin-top:-3px;cursor:pointer;box-shadow:0 0 6px rgba(242,185,78,.7);}
  .gray-slider::-moz-range-track{height:24px;background:transparent;border-radius:4px;}
  .gray-slider::-moz-range-thumb{width:10px;height:30px;border-radius:3px;background:var(--gold);border:1px solid #140f06;cursor:pointer;}
  button.tile{background:#1c1712;border:1px solid var(--line);color:var(--text);padding:10px 7px;
    font-size:14.5px;letter-spacing:.3px;cursor:pointer;border-radius:3px;text-transform:uppercase;}
  button.tile:hover{border-color:var(--gold-dim);}
  button.tile.active{border-color:var(--gold);color:var(--gold);background:#231c10;}
  label.small{display:block;font-size:14.5px;color:var(--text-dim);letter-spacing:.5px;margin:10px 0 4px;text-transform:uppercase;}
  input[type=range]{width:100%;-webkit-appearance:none;appearance:none;height:4px;background:#2a2520;border-radius:2px;outline:none;}
  input[type=range]::-webkit-slider-runnable-track{height:4px;background:#2a2520;border-radius:2px;}
  input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;border-radius:50%;
    background:#4a9eff;box-shadow:0 0 9px 3px rgba(74,158,255,.65);cursor:pointer;margin-top:-6px;}
  input[type=range]::-moz-range-track{height:4px;background:#2a2520;border-radius:2px;}
  input[type=range]::-moz-range-thumb{width:16px;height:16px;border-radius:50%;background:#4a9eff;
    box-shadow:0 0 9px 3px rgba(74,158,255,.65);border:none;cursor:pointer;}
  input[type=color]{width:100%;height:30px;border:1px solid var(--line);background:none;border-radius:3px;}
  select,input[type=number],input[type=text]{width:100%;background:#1c1712;border:1px solid var(--line);
    color:var(--text);padding:7px;border-radius:3px;font-size:13.5px;}
  .swatches{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}
  .swatch{width:24px;height:24px;border-radius:50%;border:2px solid var(--line);cursor:pointer;}
  .swatch.active{border-color:var(--gold);}
  .row{display:flex;gap:8px;align-items:center;}
  .row>*{flex:1;}
  .btn{background:#1c1712;border:1px solid var(--gold-dim);color:var(--gold);padding:10px;border-radius:3px;
    cursor:pointer;font-size:12.5px;letter-spacing:1px;text-transform:uppercase;width:100%;margin-top:6px;}
  .btn:hover{background:#271d10;}
  .btn.primary{background:var(--gold);color:#140f06;border-color:var(--gold);font-weight:600;}
  .btn.primary:hover{filter:brightness(1.08);}
  .canvas-area{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0;background:#060606;position:relative;}
  .canvas-wrap{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:auto;padding:20px;}
  #stage{position:relative;box-shadow:0 10px 40px rgba(0,0,0,.5);}
  #stage canvas,#stage img{position:absolute;left:0;top:0;width:100%;height:100%;}
  #refImg{object-fit:cover;pointer-events:none;display:none;background:#333;}
  #paperCv{touch-action:none;}
  #cv{touch-action:none;background:transparent;mix-blend-mode:multiply;image-rendering:pixelated;}
  .zoom-bar{display:flex;align-items:center;gap:12px;padding:10px 20px;border-top:1px solid var(--line);background:var(--panel);}
  .zoom-bar input[type=range]{flex:1;}
  .zoom-bar .zlabel{font-size:12.5px;color:var(--text-dim);min-width:120px;text-align:right;letter-spacing:.5px;}
  .hint{font-size:15.5px;color:var(--text-dim);line-height:1.5;margin-top:4px;}
  .mini-monitor{display:flex;flex-direction:column;align-items:center;margin-top:10px;}
  .mini-monitor-screen{background:#0a0a0a;border:3px solid #3a342c;border-radius:6px;
    padding:6px;box-shadow:inset 0 0 6px rgba(0,0,0,.6);}
  .mini-monitor-screen canvas{display:block;width:240px;height:180px;border-radius:2px;
    background:#111;}
  .mini-monitor::after{content:'';width:34px;height:7px;background:#3a342c;border-radius:0 0 3px 3px;}
  .layer-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--line);
    border-radius:4px;margin-bottom:6px;cursor:pointer;background:#1c1712;}
  .layer-row.active{border-color:var(--gold);background:#231c10;}
  .layer-row .lname{flex:1;font-size:13px;color:var(--text);user-select:none;}
  .layer-row button{width:auto;padding:2px 8px;font-size:12px;margin:0;}
  .layer-row .eyeBtn.off{opacity:.35;}
  .ref-toolbar{display:flex;justify-content:center;align-items:center;gap:10px;padding:10px 16px;
    border-bottom:1px solid var(--line);background:var(--panel);flex-wrap:wrap;}
  .ref-toolbar .btn{margin-top:0;}
  .ref-panel{display:none;align-items:center;gap:10px;flex-wrap:wrap;}
  .ref-panel.open{display:flex;}
  /* Thin rounded white pill + gold shimmer, scoped to this toolbar only --
     does not touch .btn or label.small anywhere else in the app. */
  .ref-toolbar .btn,
  .ref-toolbar label.small{
    width:auto;margin:0;display:inline-flex;align-items:center;gap:4px;
    border:1px solid rgba(255,255,255,.55);border-radius:999px;padding:6px 14px;
    font-size:11px;letter-spacing:1px;
    background-image:linear-gradient(90deg, var(--gold) 0%, #fff6d8 45%, var(--gold) 100%);
    background-size:220% auto;background-repeat:no-repeat;
    -webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
    animation:refToolbarShine 5s linear infinite;
  }
  .ref-toolbar .btn:hover{background-color:transparent;}
  @keyframes refToolbarShine{
    0%{background-position:220% center;}
    100%{background-position:-220% center;}
  }
  #exportOverlay{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;align-items:center;justify-content:center;
    flex-direction:column;z-index:50;padding:20px;}
  #exportOverlay img{max-width:90vw;max-height:70vh;border:1px solid var(--line);background:#fff;}
  #exportOverlay .panel{margin-top:14px;text-align:center;max-width:520px;}
  #exportOverlay .btn{display:inline-block;width:auto;padding:10px 20px;margin:4px;}
  aside.left{padding:10px 8px;}
  .edit-rail{display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid var(--line);}
  .icon-btn{width:30px;height:30px;flex:0 0 30px;display:flex;align-items:center;justify-content:center;
    background:#1c1712;border:1px solid var(--line);color:var(--text);border-radius:4px;cursor:pointer;font-size:15px;padding:0;}
  .icon-btn:hover{border-color:var(--gold-dim);}
  .icon-btn.active{border-color:var(--gold);color:var(--gold);background:#231c10;}
  .edit-rail .tile{width:30px;height:30px;flex:0 0 30px;padding:0;font-size:15px;display:flex;align-items:center;justify-content:center;}
  .rail-div{width:1px;align-self:stretch;background:var(--line);margin:0 2px;}
  .texture-box{display:none;padding-bottom:10px;margin-bottom:10px;border-bottom:1px solid var(--line);}
  .surface-preview{width:100%;height:52px;border-radius:6px;margin-bottom:6px;
    background-size:cover;background-position:center;background-color:#536878;
    border:1px solid var(--line);}
  .texture-box.open{display:block;}
  .prompt-chips{display:flex;flex-direction:column;gap:6px;margin:8px 0;padding:10px;background:#15110b;border:1px solid var(--line);border-radius:4px;}
  .chip-label{font-size:13.5px;letter-spacing:1px;color:var(--gold);text-transform:uppercase;}
  .chip-row{display:flex;flex-wrap:wrap;gap:5px;}
  .prompt-chip{background:#1c1712;border:1px solid var(--line);color:var(--text);padding:6px 11px;
    border-radius:14px;font-size:14px;cursor:pointer;white-space:nowrap;}
  .prompt-chip.style-chip{padding-left:38px;background-repeat:no-repeat;background-position:5px center;
    background-size:26px 26px;}
  .prompt-chip:hover{border-color:var(--gold-dim);color:var(--gold);}
  .prompt-chip.active{border-color:var(--gold);color:var(--gold);background:#271d10;}
  .chip-clear{align-self:flex-start;background:none;border:none;color:var(--text-dim);font-size:13.5px;
    text-decoration:underline;cursor:pointer;padding:0;margin-top:2px;}
  .menu-panel{display:none;}
  .menu-panel.open{display:block;}
  details.menu-cat{border-bottom:1px solid var(--line);padding:4px 0;}
  details.menu-cat>summary{font-size:16.5px;letter-spacing:1.5px;color:var(--gold);text-transform:uppercase;
    cursor:pointer;list-style:none;padding:9px 2px;line-height:1.3;}
  details.menu-cat>summary::-webkit-details-marker{display:none;}
  details.menu-cat>summary::before{content:'▸  ';}
  details.menu-cat[open]>summary::before{content:'▾  ';}
  details.menu-sub{margin:0 0 0 10px;}
  details.menu-sub>summary{font-size:15.5px;letter-spacing:.5px;color:var(--text-dim);text-transform:uppercase;
    cursor:pointer;list-style:none;padding:7px 2px;line-height:1.3;}
  details.menu-sub>summary.med-icon{padding-left:38px;background-repeat:no-repeat;background-position:2px center;
    background-size:26px 26px;}
  details.menu-sub>summary::-webkit-details-marker{display:none;}
  details.menu-sub>summary::before{content:'›  ';}
  details.menu-sub[open]>summary::before{content:'⌄  ';}
  details.menu-sub .grid2{margin:5px 0 8px;}
  #cropBox{position:absolute;left:0;top:0;width:0;height:0;border:2px dashed var(--gold);
    background:rgba(242,185,78,.12);display:none;pointer-events:none;}
  #rulerOverlay{position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;}
  #valueSlider{-webkit-appearance:none;appearance:none;width:100%;height:24px;border-radius:4px;
    background-image:linear-gradient(rgba(10,8,5,.52),rgba(10,8,5,.52)), url('/value-scale.png');
    background-size:cover;background-position:center;margin:4px 0 2px;}
  #valueSlider::-webkit-slider-runnable-track{height:24px;background:transparent;border-radius:4px;}
  #valueSlider::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:30px;border-radius:3px;
    background:var(--gold);border:1px solid #140f06;margin-top:-3px;cursor:pointer;box-shadow:0 0 6px rgba(242,185,78,.7);}
  #valueSlider::-moz-range-track{height:24px;background:transparent;border-radius:4px;}
  #valueSlider::-moz-range-thumb{width:10px;height:30px;border-radius:3px;background:var(--gold);border:1px solid #140f06;cursor:pointer;}
  .ruler-tile.active{border-color:var(--gold);color:var(--gold);background:#231c10;}
  label.adj-label{display:block;font-size:13.5px;color:var(--text-dim);letter-spacing:.3px;margin:8px 0 2px;text-transform:uppercase;}
  input.adj-slider{margin:0 0 2px;}
  code.tag{background:#1c1712;padding:2px 5px;border-radius:3px;color:var(--gold);}
  body.text-magnified .prompt-chip{font-size:17px;padding:8px 13px;}
  body.text-magnified .chip-label{font-size:16px;}
  body.text-magnified .hint{font-size:18.5px;}
  body.text-magnified label.small,body.text-magnified label.adj-label{font-size:17px;}
  body.text-magnified details.menu-cat>summary{font-size:19.5px;}
  body.text-magnified details.menu-sub>summary{font-size:18.5px;}
  body.text-magnified button.tile{font-size:17px;padding:11px 8px;}
`}</style>
      <div dangerouslySetInnerHTML={{ __html: `<div id="app">
  <svg width="0" height="0" style="position:absolute;overflow:hidden;">
    <filter id="sharpenFx"><feConvolveMatrix id="sharpenMatrix" order="3" preserveAlpha="true" kernelMatrix="0 0 0 0 1 0 0 0 0"/></filter>
  </svg>
  <header>
    <div class="logo">VERIDIAN <b>Q</b></div>
    <button type="button" class="auth-btn" id="authBtn" title="Coming soon">Sign Up / Log In</button>
  </header>
  <div class="main">
    <aside class="left">
      <div class="edit-rail">
        <button class="icon-btn" id="menuToggle" title="Menu" aria-expanded="false">☰</button>
        <button class="icon-btn tool-icon" id="toolMove" title="Move / Pan Canvas">✋</button>
        <button class="icon-btn tool-icon" id="toolCrop" title="Crop (drag a region, then Download/Copy it)">⬚</button>
        <button class="icon-btn tile" data-medium="eraser" data-variant="soft" title="Eraser">⌫</button>
        <span class="rail-div"></span>
        <button class="icon-btn" id="textureToggle" title="Surface">▦</button>
      </div>

      <div class="texture-box" id="textureBox"><div class="surface-preview" id="surfacePreview"></div><select id="surfaceSel"></select></div>

      <div class="menu-panel" id="menuPanel">
        <details class="menu-cat" open>
          <summary>Project</summary>
          <div class="grid3" id="projectModeGrid">
            <button class="tile" data-mode="paint">Paint</button>
            <button class="tile" data-mode="drawing">Drawing</button>
            <button class="tile" data-mode="mixed">Mixed Media</button>
          </div>
        </details>
        <details class="menu-cat">
          <summary>Brushes</summary>
          <details class="menu-sub" data-cat="drawing">
            <summary class="med-icon" style="background-image:url('/brush-swatches/charcoal.png')">Charcoal</summary>
            <div class="grid2">
              <button class="tile" data-medium="charcoal" data-variant="vine">Vine</button>
              <button class="tile" data-medium="charcoal" data-variant="compressed">Compressed</button>
              <button class="tile" data-medium="charcoal" data-variant="hard">Hard</button>
              <button class="tile" data-medium="charcoal" data-variant="medium">Medium</button>
              <button class="tile" data-medium="charcoal" data-variant="soft">Soft</button>
            </div>
          </details>
          <details class="menu-sub" data-cat="drawing">
            <summary class="med-icon" style="background-image:url('/brush-swatches/pencil.png')">Pencil</summary>
            <div class="grid2">
              <button class="tile" data-medium="graphite" data-variant="hb">HB</button>
              <button class="tile" data-medium="graphite" data-variant="2b">2B</button>
              <button class="tile" data-medium="graphite" data-variant="4b">4B</button>
              <button class="tile" data-medium="graphite" data-variant="6b">6B</button>
              <button class="tile" data-medium="graphite" data-variant="7b">7B</button>
              <button class="tile" data-medium="graphite" data-variant="8b">8B</button>
            </div>
          </details>
          <details class="menu-sub" data-cat="drawing">
            <summary class="med-icon" style="background-image:url('/brush-swatches/ink.png')">Ink</summary>
            <div class="grid2">
              <button class="tile" data-medium="ink" data-variant="liner">Fine Liner</button>
              <button class="tile" data-medium="ink" data-variant="brush">Brush Pen</button>
            </div>
          </details>
          <details class="menu-sub" data-cat="drawing">
            <summary class="med-icon" style="background-image:url('/brush-swatches/markers.png')">Markers</summary>
            <div class="grid2">
              <button class="tile" data-medium="marker" data-variant="alcohol">Alcohol</button>
              <button class="tile" data-medium="marker" data-variant="chisel">Chisel Tip</button>
            </div>
          </details>
          <details class="menu-sub" data-cat="paint">
            <summary class="med-icon" style="background-image:url('/brush-swatches/pastel.png')">Pastel</summary>
            <div class="grid2">
              <button class="tile" data-medium="pastel" data-variant="soft">Soft Pastel</button>
              <button class="tile" data-medium="pastel" data-variant="pencil">Pastel Pencil</button>
            </div>
          </details>
          <details class="menu-sub" data-cat="paint">
            <summary class="med-icon" style="background-image:url('/brush-swatches/painting.png')">Painting</summary>
            <div class="grid2">
              <button class="tile" data-medium="oil" data-variant="allaprima">Alla Prima</button>
              <button class="tile" data-medium="oil" data-variant="impasto">Impasto</button>
              <button class="tile" data-medium="oil" data-variant="round">Round</button>
              <button class="tile" data-medium="oil" data-variant="flat">Flat</button>
              <button class="tile" data-medium="oil" data-variant="filbert">Filbert</button>
              <button class="tile" data-medium="oil" data-variant="fan">Fan</button>
              <button class="tile" data-medium="oil" data-variant="angle">Angle Shader</button>
              <button class="tile" data-medium="oil" data-variant="liner">Liner</button>
              <button class="tile" data-medium="oil" data-variant="knife1" title="Small diamond point">Knife 1</button>
              <button class="tile" data-medium="oil" data-variant="knife2" title="Wide blunt chisel">Knife 2</button>
              <button class="tile" data-medium="oil" data-variant="knife3" title="Large diamond point">Knife 3</button>
              <button class="tile" data-medium="oil" data-variant="knife4" title="Narrow trowel">Knife 4</button>
              <button class="tile" data-medium="oil" data-variant="knife5" title="Large wide trowel">Knife 5</button>
            </div>
          </details>
          <details class="menu-sub">
            <summary>Surface</summary>
            <div class="grid2">
              <button class="tile" data-medium="surface" data-variant="smooth">Smooth Blend</button>
              <button class="tile" data-medium="surface" data-variant="hard">Hard Blend</button>
            </div>
            <div class="hint" style="padding:0 2px 8px;">Both drag the paint that's already there -- neither adds new color. Smooth softens and feathers it as it drags; Hard carries it across with much less softening, for a firmer, more solid smear.</div>
          </details>
          <details class="menu-sub" data-cat="paint">
            <summary>Pigments</summary>
            <div class="hint" style="padding:0 2px 6px;">Mixed the way real paint mixes, not a flat color blend -- pick a pigment below.</div>
            <div class="pigment-row-label">Warm</div>
            <div class="pigment-row" id="pigmentWarmRow"></div>
            <div class="pigment-row-label">Cool</div>
            <div class="pigment-row" id="pigmentCoolRow"></div>
            <div class="pigment-row-label">Grayscale</div>
            <input type="range" id="grayscaleSlider" class="gray-slider" min="0" max="100" value="50">
          </details>
        </details>

        <details class="menu-cat">
          <summary>Tools</summary>
          <div class="grid2">
            <button class="tile" data-medium="eraser" data-variant="soft">Eraser</button>
            <button class="tile" id="toolMagnify" type="button" title="Enlarge small UI text for readability">🔍 Magnify Text</button>
          </div>
        </details>

        <details class="menu-cat">
          <summary>Layers</summary>
          <div id="layersList"></div>
          <button class="btn" id="addLayerBtn" style="margin-top:6px;">+ Add Layer</button>
          <div class="hint" style="padding:6px 2px 2px;">Everything you paint goes on the active (highlighted) layer. Export always flattens every visible layer into one ordinary image file.</div>
        </details>

        <details class="menu-cat">
          <summary>Rulers</summary>
          <div class="grid2" style="padding-bottom:6px;">
            <button class="tile ruler-tile" data-ruler="fibonacci">Fibonacci</button>
            <button class="tile ruler-tile" data-ruler="grid1">Grid 1</button>
            <button class="tile ruler-tile" data-ruler="grid2">Grid 2</button>
          </div>
          <div id="fibAngleRow" style="display:none;align-items:center;gap:8px;padding:2px 2px 10px;">
            <label class="small" style="margin:0;">Angle</label>
            <select id="fibAngleSel" style="width:auto;flex:1;">
              <option value="0">0° (default)</option>
              <option value="45">45°</option>
              <option value="90">90°</option>
              <option value="180">180°</option>
              <option value="360">360°</option>
            </select>
          </div>
          <div id="canvasSizeRow" style="display:none;align-items:center;gap:8px;padding:2px 2px 10px;">
            <label class="small" style="margin:0;">Canvas Size</label>
            <select id="canvasSizeSel" style="width:auto;flex:1;">
              <option value="8x10" selected>8 × 10 in</option>
              <option value="11x14">11 × 14 in (max)</option>
            </select>
          </div>
          <div id="gridUnitRow" style="display:none;align-items:center;gap:8px;padding:2px 2px 10px;">
            <label class="small" style="margin:0;">Unit</label>
            <select id="gridUnitSel" style="width:auto;flex:1;">
              <option value="in">1 inch</option>
              <option value="cm">1 cm</option>
              <option value="mm">1 mm</option>
            </select>
          </div>
          <div id="perspectiveRow" style="display:none;align-items:center;gap:8px;padding:2px 2px 10px;">
            <label class="small" style="margin:0;">Perspective</label>
            <select id="perspectiveSel" style="width:auto;flex:1;">
              <option value="1">1-Point</option>
              <option value="2">2-Point</option>
              <option value="3">3-Point</option>
            </select>
          </div>
          <div class="hint" style="padding:0 2px 8px;">Click a ruler again to turn it off. Grid 1/2 measure against the Canvas Size above, not the Export panel.</div>
        </details>

        <details class="menu-cat" id="adjustDetails">
          <summary>Adjust</summary>
          <label class="small" style="margin-top:4px;">Global Value — <span id="valueVal">100</span>%</label>
          <input type="range" id="valueSlider" min="50" max="150" value="100">
          <div class="hint" style="padding:2px 2px 8px;">Shifts the whole piece lighter or darker — check this first, before you check anything else.</div>
          <label class="small adj-label">Contrast — <span id="adjContrastVal">0</span></label>
          <input type="range" class="adj-slider" id="adjContrast" min="-100" max="100" value="0">
          <label class="small adj-label">Tint — <span id="adjTintVal">0</span></label>
          <input type="range" class="adj-slider" id="adjTint" min="-100" max="100" value="0">
          <label class="small adj-label">Shadow — <span id="adjShadowVal">0</span></label>
          <input type="range" class="adj-slider" id="adjShadow" min="-100" max="100" value="0">
          <label class="small adj-label">Highlight — <span id="adjHighlightVal">0</span></label>
          <input type="range" class="adj-slider" id="adjHighlight" min="-100" max="100" value="0">
          <label class="small adj-label">Saturation — <span id="adjSaturationVal">0</span></label>
          <input type="range" class="adj-slider" id="adjSaturation" min="-100" max="100" value="0">
          <label class="small adj-label">Warm — <span id="adjWarmVal">0</span></label>
          <input type="range" class="adj-slider" id="adjWarm" min="0" max="100" value="0">
          <label class="small adj-label">Cool — <span id="adjCoolVal">0</span></label>
          <input type="range" class="adj-slider" id="adjCool" min="0" max="100" value="0">
          <label class="small adj-label">Sharp — <span id="adjSharpVal">0</span></label>
          <input type="range" class="adj-slider" id="adjSharp" min="0" max="100" value="0">
          <button class="btn" id="adjResetBtn" style="margin-top:8px;">Reset Adjustments</button>
        </details>

      </div>
    </aside>

    <div class="canvas-area">
      <div class="ref-toolbar">
        <button class="btn" id="refDropdownBtn" style="width:auto;">Reference ▾</button>
        <div id="refPanel" class="ref-panel">
          <input type="file" id="refFileInput" accept="image/*" style="display:none;">
          <button class="btn" id="importRefBtn" style="width:auto;">Import</button>
          <button class="btn" id="clearRefBtn" style="width:auto;">Clear</button>
          <label class="small" style="margin:0;">Opacity — <span id="refOpVal">50</span>%</label>
          <input type="range" id="refOpacity" min="0" max="100" value="50" style="width:110px;">
          <label class="small" style="display:flex;align-items:center;gap:4px;margin:0;">
            <input type="checkbox" id="traceChk" style="width:auto;"> Trace
          </label>
          <label class="small" style="display:flex;align-items:center;gap:4px;margin:0;" title="Bake the reference photo into the exported file, under your strokes">
            <input type="checkbox" id="refExportChk" style="width:auto;"> Include in export
          </label>
        </div>
      </div>
      <div class="canvas-wrap" id="canvasWrap">
        <div id="stage">
          <canvas id="paperCv" width="1000" height="1300"></canvas>
          <img id="refImg" alt="reference">
          <canvas id="cv" width="1000" height="1300"></canvas>
          <div id="rulerOverlay"></div>
          <div id="cropBox"></div>
        </div>
      </div>
      <div class="zoom-bar">
        <span style="font-size:12.5px;color:var(--text-dim);">ZOOM</span>
        <input type="range" id="zoomSlider" min="10" max="100" step="10" value="100">
        <span class="zlabel" id="zoomLabel">Fit Screen · 100%</span>
      </div>
    </div>

    <aside class="right collapsed" id="rightAside">
      <button class="btn" id="rightToggle">Settings ▾</button>
      <div id="rightBody">
      <h3 class="sec">Color</h3>
      <input type="color" id="colorPicker" value="#1a1a1a">
      <div class="swatches" id="swatches"></div>

      <h3 class="sec">Brush</h3>
      <label class="small">Size — <span id="sizeVal">14</span>px</label>
      <input type="range" id="sizeSlider" min="2" max="80" value="14">
      <label class="small">Pressure Sensitivity</label>
      <select id="pressureMode">
        <option value="auto">Auto (pen pressure, else speed)</option>
        <option value="full">Always Full Pressure</option>
      </select>

      <div class="row" style="margin-top:14px;">
        <button class="btn" id="undoBtn">Undo</button>
        <button class="btn" id="clearBtn">Clear</button>
      </div>

      <h3 class="sec">Auto Paint</h3>
      <label class="small">Style</label>
      <select id="styleSel">
        <option value="charcoal">Charcoal Sketch</option>
        <option value="graphite">Graphite Drawing</option>
        <option value="ink">Ink Illustration</option>
        <option value="marker">Marker Illustration</option>
        <option value="pastel">Soft Pastel Painting</option>
        <option value="watercolor">Watercolor</option>
        <option value="acrylic">Acrylic</option>
        <option value="oil-allaprima">Oil — Alla Prima</option>
        <option value="oil-impasto">Oil — Impasto</option>
        <option value="monochromatic">Monochromatic</option>
      </select>

      <details class="menu-cat" id="artPromptingDetails">
        <summary>Art Prompting</summary>
        <div class="prompt-chips" id="artPromptingBox">
          <div>
            <div class="chip-label">Lighting</div>
            <div class="chip-row" data-chip-group="lighting">
              <button class="prompt-chip" type="button">dramatic lighting</button>
              <button class="prompt-chip" type="button">soft diffused light</button>
              <button class="prompt-chip" type="button">golden hour light</button>
              <button class="prompt-chip" type="button">high contrast chiaroscuro</button>
            </div>
          </div>
          <div>
            <div class="chip-label">Palette &amp; Mood</div>
            <div class="chip-row" data-chip-group="palette">
              <button class="prompt-chip" type="button">warm palette</button>
              <button class="prompt-chip" type="button">cool palette</button>
              <button class="prompt-chip" type="button">muted earth tones</button>
              <button class="prompt-chip" type="button">vivid saturated color</button>
            </div>
          </div>
          <div>
            <div class="chip-label">Composition</div>
            <div class="chip-row" data-chip-group="composition">
              <button class="prompt-chip" type="button">tight close-up</button>
              <button class="prompt-chip" type="button">dramatic negative space</button>
              <button class="prompt-chip" type="button">rule-of-thirds framing</button>
              <button class="prompt-chip" type="button">centered symmetry</button>
            </div>
          </div>
          <div>
            <div class="chip-label">Texture &amp; Finish</div>
            <div class="chip-row" data-chip-group="texture">
              <button class="prompt-chip" type="button">visible brushwork</button>
              <button class="prompt-chip" type="button">soft blended edges</button>
              <button class="prompt-chip" type="button">heavy impasto texture</button>
              <button class="prompt-chip" type="button">fine linework detail</button>
            </div>
          </div>
          <div>
            <div class="chip-label">Artist Style</div>
            <div class="chip-row" data-chip-group="artist">
              <button class="prompt-chip style-chip" type="button" style="background-image:url('/artist-styles/monet.png')" data-prompt="in the style of French Impressionist painter Claude Monet -- broken color, visible short brushstrokes, soft atmospheric natural light, plein air color harmony">Monet (Impressionist light)</button>
              <button class="prompt-chip style-chip" type="button" style="background-image:url('/artist-styles/picasso.png')" data-prompt="in the style of Cubist painter Pablo Picasso -- flattened overlapping planes, bold black outlines, angular faceted forms, fragmented multi-angle perspective">Picasso (Cubist)</button>
              <button class="prompt-chip style-chip" type="button" style="background-image:url('/artist-styles/davinci.png')" data-prompt="in the style of Renaissance painter Leonardo da Vinci -- smoky sfumato shading, soft blended tonal transitions, subtle anatomical modeling">Da Vinci (sfumato)</button>
              <button class="prompt-chip style-chip" type="button" style="background-image:url('/artist-styles/rubens.png')" data-prompt="in the style of Baroque painter Peter Paul Rubens -- dynamic diagonal composition, lush fleshy volume, rich warm oil glazes, dramatic movement">Rubens (Baroque)</button>
              <button class="prompt-chip style-chip" type="button" style="background-image:url('/artist-styles/rembrandt.png')" data-prompt="in the style of Dutch Golden Age painter Rembrandt van Rijn -- dramatic chiaroscuro, warm glowing pool of light, thick textured impasto highlights">Rembrandt (chiaroscuro)</button>
              <button class="prompt-chip style-chip" type="button" style="background-image:url('/artist-styles/charles-white.png')" data-prompt="in the style of African-American artist Charles White -- bold charcoal and graphite figure drawing, sculptural cross-hatching, monumental social-realist portraiture">Charles White (charcoal realism)</button>
            </div>
          </div>
          <button class="chip-clear" id="clearPromptBtn" type="button">Clear prompt</button>
        </div>
      </details>

      <label class="small">Prompt (optional)</label>
      <textarea id="autoPaintPrompt" rows="3" placeholder="Describe what to paint, or tap chips above to build it. With a reference photo loaded, this is optional -- leave it blank to just restyle the photo." style="width:100%;background:#1c1712;border:1px solid var(--line);color:var(--text);padding:7px;border-radius:3px;font-size:13.5px;resize:vertical;"></textarea>
      <button class="btn primary" id="autoPaintBtn" style="margin-top:8px;">Auto Paint</button>
      <div class="hint" id="autoPaintHint"></div>

      <select id="presetSel" title="Export Size" style="margin-top:14px;"></select>
      <div class="row" style="margin-top:8px;">
        <div><input type="number" id="wIn" value="8" step="0.5" max="14" title="Width (in) -- 14in max"></div>
        <div><input type="number" id="hIn" value="10" step="0.5" max="14" title="Height (in) -- 14in max"></div>
      </div>
      <input type="number" id="dpiIn" value="150" step="25" title="Output DPI" style="margin-top:8px;">
      <select id="formatSel" style="margin-top:8px;" title="File Format">
        <option value="png">PNG</option>
        <option value="jpeg">JPEG</option>
      </select>
      <label style="display:flex;align-items:center;gap:6px;margin-top:10px;" title="Add 0.125&quot; Bleed + Crop Marks">
        <input type="checkbox" id="bleedChk" style="width:auto;"> <span class="small">Bleed</span>
      </label>
      <button class="btn primary" id="exportBtn" style="margin-top:10px;">Export</button>
      <div class="mini-monitor" id="miniMonitor" title="Live preview">
        <div class="mini-monitor-screen"><canvas id="miniMonitorCv" width="240" height="180"></canvas></div>
      </div>
      </div>
    </aside>
  </div>
</div>

<div id="exportOverlay">
  <img id="exportImg" alt="export preview">
  <div class="panel">
    <div class="hint" id="exportMeta"></div>
    <div>
      <button class="btn primary" id="downloadImgBtn" style="width:auto;">Download</button>
      <button class="btn" id="copyImgBtn" style="width:auto;">Copy Image</button>
      <button class="btn" id="closeExportBtn" style="width:auto;">Close</button>
    </div>
  </div>
</div>` }} />
      <Script src="/vendor/mixbox.js?v=1" strategy="beforeInteractive" />
      <Script src="/draw-engine.js?v=15" strategy="afterInteractive" />
    </>
  );
}
