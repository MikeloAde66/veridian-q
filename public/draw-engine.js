
const baseW = 1000, baseH = 1300;
const stage = document.getElementById('stage');
const cv = document.getElementById('cv');
const ctx = cv.getContext('2d');
const paperCv = document.getElementById('paperCv');
const pctx = paperCv.getContext('2d');
const refImg = document.getElementById('refImg');
const wrap = document.getElementById('canvasWrap');

// ---------- state ----------
let strokes = [];      // finished strokes -- each carries a .layer id
let current = null;    // in-progress stroke
let layers = [{id:1, name:'Layer 1', visible:true, opacity:1}]; // bottom -> top stacking order
let activeLayerId = 1;
let nextLayerId = 2;
let medium = 'graphite', variant='hb';
let color = '#1a1a1a';
let brushSize = 14;
let paperType = 'smooth';
let pressureMode = 'auto';
let lastPt = null, lastTime = 0;

// ---------- paper texture ----------
function paperBase(type){
  if(type==='toned') return '#8d8579';
  if(type==='canvas') return '#e9e1cd';
  if(type==='coldpress') return '#f3efe4';
  return '#536878'; /* Payne's Grey — default surface, easier on the eyes than white */
}
function drawPaper(ctx){
  ctx.save();
  ctx.setTransform(1,0,0,1,0,0);
  ctx.fillStyle = paperBase(paperType);
  ctx.fillRect(0,0,cv.width,cv.height);
  // deterministic grain so screen + export match
  let seed = 42;
  function rnd(){ seed = (seed*9301+49297)%233280; return seed/233280; }
  const density = paperType==='canvas' ? 2600 : paperType==='coldpress' ? 1800 : paperType==='toned' ? 1500 : 900;
  for(let i=0;i<density;i++){
    const x = rnd()*cv.width, y = rnd()*cv.height;
    const r = (paperType==='canvas' ? 1.6 : 0.8) + rnd()*1.2;
    const dark = rnd() > 0.5;
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }
  if(paperType==='canvas'){
    ctx.strokeStyle='rgba(0,0,0,0.04)'; ctx.lineWidth=1;
    for(let x=0;x<cv.width;x+=5){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+cv.height,cv.height); ctx.stroke(); }
  }
  ctx.restore();
}

// ---------- jitter generator (baked per point so export matches screen) ----------
function makeJitter(n){
  const arr=[];
  for(let i=0;i<n;i++){
    arr.push({dx:(Math.random()-0.5),dy:(Math.random()-0.5),r:0.3+Math.random()*0.8,a:0.3+Math.random()*0.7,rot:Math.random()*Math.PI*2});
  }
  return arr;
}

// ---------- medium stamp functions. all coords/sizes pre-scaled by caller ----------
const CHARCOAL_GRADE = {vine:{n:4,a:0.22}, compressed:{n:6,a:0.40}, hard:{n:4,a:0.16}, medium:{n:5,a:0.26}, soft:{n:6,a:0.40}};
function stampCharcoal(ctx,x,y,size,p,col,j,variant){
  ctx.globalCompositeOperation='multiply';
  const grade = CHARCOAL_GRADE[variant] || CHARCOAL_GRADE.vine;
  const n = grade.n;
  const baseA = grade.a * (0.4+p*0.8);
  for(let i=0;i<n;i++){
    const jj=j[i%j.length];
    const r = size*0.45*jj.r;
    ctx.beginPath();
    ctx.fillStyle = col;
    ctx.globalAlpha = baseA*jj.a;
    ctx.ellipse(x+jj.dx*size*0.5, y+jj.dy*size*0.5, r, r*0.8, jj.rot, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha=1;
}
const GRAPHITE_GRADE = {hb:0.16, '2b':0.21, '4b':0.27, '6b':0.34, '7b':0.42, '8b':0.5, soft:0.34};
function stampGraphite(ctx,x,y,size,p,col,j,variant){
  ctx.globalCompositeOperation='multiply';
  const base = GRAPHITE_GRADE[variant] !== undefined ? GRAPHITE_GRADE[variant] : GRAPHITE_GRADE.hb;
  const grad = ctx.createRadialGradient(x,y,0,x,y,size*0.5);
  const a = base*(0.3+p*0.9);
  grad.addColorStop(0, hexToRgba(col,a));
  grad.addColorStop(1, hexToRgba(col,0));
  ctx.fillStyle=grad;
  ctx.beginPath(); ctx.arc(x,y,size*0.5,0,Math.PI*2); ctx.fill();
  // accent grain -- softer/darker grades get grainier, heavier flecking
  const grainCount = base>0.3 ? 3 : 2;
  for(let i=0;i<grainCount;i++){
    const jj=j[i%j.length];
    ctx.globalAlpha = a*0.6*jj.a;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(x+jj.dx*size*0.3,y+jj.dy*size*0.3,size*0.08*jj.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function stampInk(ctx,x,y,size,p,col,j,variant){
  ctx.globalCompositeOperation='source-over';
  const w = variant==='brush' ? size*0.6 : size*0.28;
  const r = Math.max(1, w*(0.5+p*0.7));
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.95;
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  // wet edge bleed
  ctx.globalCompositeOperation='multiply';
  ctx.globalAlpha = 0.12;
  ctx.beginPath(); ctx.arc(x,y,r*1.6,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}
function stampMarker(ctx,x,y,size,p,col,j,variant){
  ctx.globalCompositeOperation='multiply';
  const w = variant==='chisel' ? size*0.7 : size*0.5;
  ctx.fillStyle = col;
  ctx.globalAlpha = 0.5;
  if(variant==='chisel'){
    ctx.save(); ctx.translate(x,y); ctx.rotate(0.5);
    ctx.fillRect(-w*0.5,-size*0.12,w,size*0.24);
    ctx.restore();
  } else {
    ctx.beginPath(); ctx.arc(x,y,w*0.5,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function stampPastel(ctx,x,y,size,p,col,j,variant){
  ctx.globalCompositeOperation='source-over';
  const n = variant==='soft' ? 5 : 3;
  for(let i=0;i<n;i++){
    const jj=j[i%j.length];
    const grad = ctx.createRadialGradient(x+jj.dx*size*0.4,y+jj.dy*size*0.4,0,x,y,size*0.5);
    const a=(variant==='soft'?0.18:0.3)*jj.a*(0.4+p*0.8);
    grad.addColorStop(0, hexToRgba(col,a));
    grad.addColorStop(1, hexToRgba(col,0));
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.arc(x,y,size*0.5,0,Math.PI*2); ctx.fill();
  }
}
const OIL_SHAPE = {
  allaprima: {shape:'round', w:0.5,  ratio:1,    a:0.9,  thick:false},
  impasto:   {shape:'round', w:0.5,  ratio:1,    a:0.9,  thick:true},
  round:     {shape:'round', w:0.3,  ratio:1,    a:0.85, thick:false},
  flat:      {shape:'flat',  w:0.55, ratio:0.4,  a:0.85, thick:false},
  filbert:   {shape:'flat',  w:0.5,  ratio:0.55, a:0.55, thick:false},
  fan:       {shape:'fan',   w:0.5,  ratio:1,    a:0.45, thick:false},
  angle:     {shape:'flat',  w:0.5,  ratio:0.32, a:0.85, thick:false, skew:0.5},
  liner:     {shape:'round', w:0.12, ratio:1,    a:0.95, thick:false},
  knife:     {shape:'knife', w:0.55, ratio:0.3,  a:1,    thick:true},
};
function stampOil(ctx,x,y,size,p,col,j,variant){
  ctx.globalCompositeOperation='source-over';
  const g = OIL_SHAPE[variant] || OIL_SHAPE.allaprima;
  ctx.fillStyle = col;
  const rx = size*g.w*(0.6+p*0.6);
  const ry = rx*g.ratio;
  if (g.shape==='fan'){
    ctx.globalAlpha = g.a*(0.5+p*0.5);
    for(let i=0;i<j.length;i++){
      const jj = j[i];
      ctx.beginPath();
      ctx.ellipse(x+jj.dx*rx*0.7, y+jj.dy*rx*0.3, rx*0.22, ry*0.22*jj.r, jj.rot*0.3, 0, Math.PI*2);
      ctx.fill();
    }
  } else {
    ctx.globalAlpha = g.a;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, g.skew ? g.skew : (j[0].rot*0.15), 0, Math.PI*2);
    ctx.fill();
  }
  if(g.thick){
    // highlight ridge to fake paint thickness (heavier for the palette knife)
    ctx.globalAlpha = g.shape==='knife' ? 0.35 : 0.25;
    ctx.fillStyle='#ffffff';
    ctx.beginPath(); ctx.ellipse(x-rx*0.22,y-ry*0.26, rx*0.3, ry*0.5, 0,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha=1;
}
function stampEraser(ctx,x,y,size,p,col,j,variant){
  ctx.globalCompositeOperation='destination-out';
  ctx.globalAlpha = Math.min(1, 0.9*(0.3+p*0.7));
  ctx.beginPath(); ctx.arc(x,y,size*0.55,0,Math.PI*2); ctx.fill();
  ctx.globalAlpha=1;
}
function hexToRgba(hex,a){
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
// Surface / Smooth Blend -- a real smudge: it samples the paint already on the
// canvas at the previous point and drags a softened copy of it to the new
// point. No pigment is added; drawImage (not putImageData) is used on both
// ends so the clip + partial alpha actually blend it into what's there.
function stampSurface(ctx, x, y, size, prevX, prevY, strength){
  const r = Math.max(2, size/2);
  const d = Math.round(r*2);
  const sx = Math.round(prevX-r), sy = Math.round(prevY-r);
  if (sx+d<=0 || sy+d<=0 || sx>=ctx.canvas.width || sy>=ctx.canvas.height) return;
  const tmp = document.createElement('canvas');
  tmp.width = d; tmp.height = d;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(ctx.canvas, sx, sy, d, d, 0, 0, d, d);
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.clip();
  ctx.globalAlpha = strength;
  ctx.drawImage(tmp, x-r, y-r, d, d);
  ctx.restore();
}
function stampAt(ctx, stroke, pt, idx){
  if (stroke.medium === 'surface'){
    const prev = (idx>0) ? stroke.points[idx-1] : pt;
    const strength = (stroke.variant==='smooth') ? 0.35 : 0.35;
    stampSurface(ctx, pt.x, pt.y, stroke.size, prev.x, prev.y, strength*Math.max(0.3,pt.p));
    return;
  }
  const fns={charcoal:stampCharcoal,graphite:stampGraphite,ink:stampInk,marker:stampMarker,pastel:stampPastel,oil:stampOil,eraser:stampEraser};
  fns[stroke.medium](ctx, pt.x, pt.y, stroke.size, pt.p, stroke.color, pt.j, stroke.variant);
}

// ---------- drawing a whole stroke / whole scene ----------
function drawStrokePoints(ctx, stroke, fromIdx){
  for(let i=fromIdx;i<stroke.points.length;i++) stampAt(ctx, stroke, stroke.points[i], i);
}
const layerScratch = document.createElement('canvas');
layerScratch.width = baseW; layerScratch.height = baseH;
const lsctx = layerScratch.getContext('2d');
function drawLayeredStrokes(ctx){
  // Layers stack bottom -> top; within a layer, strokes replay in the order
  // they were painted. Hidden layers (or ones faded to 0) are skipped
  // entirely, but kept in strokes[] so turning them back on/up restores
  // them exactly. Each visible layer is composited through its own fade
  // slider via a scratch canvas, so the per-stamp alpha each medium sets
  // internally can't fight with the layer's own opacity.
  for(const L of layers){
    if(!L.visible || L.opacity<=0) continue;
    lsctx.clearRect(0,0,layerScratch.width,layerScratch.height);
    for(const s of strokes){ if(s.layer===L.id) drawStrokePoints(lsctx, s, 0); }
    ctx.globalAlpha = L.opacity;
    ctx.drawImage(layerScratch, 0, 0);
    ctx.globalAlpha = 1;
  }
}
function fullRedraw(ctx){
  drawPaper(ctx);
  drawLayeredStrokes(ctx);
}
function redrawLiveStrokes(){
  ctx.clearRect(0,0,cv.width,cv.height);
  drawLayeredStrokes(ctx);
}

// ---------- pointer handling ----------
function toCanvasXY(e){
  const rect = cv.getBoundingClientRect();
  return {
    x: (e.clientX-rect.left) * (cv.width/rect.width),
    y: (e.clientY-rect.top) * (cv.height/rect.height)
  };
}
function pressureFor(e, speed){
  if(pressureMode==='full') return 1;
  if(e.pointerType==='pen' && e.pressure>0) return e.pressure;
  const norm = Math.min(1, speed/18);
  return Math.max(0.15, 1-norm);
}
// ---------- Move & Crop tools ----------
let activeTool = 'draw'; // 'draw' | 'move' | 'crop'
let panning = false, panStart = null, panScroll = null;
let cropping = false, cropStartPt = null;
const toolMove = document.getElementById('toolMove');
const toolCrop = document.getElementById('toolCrop');
const cropBox = document.getElementById('cropBox');
function setTool(t){
  activeTool = (activeTool === t) ? 'draw' : t;
  toolMove.classList.toggle('active', activeTool==='move');
  toolCrop.classList.toggle('active', activeTool==='crop');
  wrap.style.cursor = activeTool==='move' ? 'grab' : (activeTool==='crop' ? 'crosshair' : 'default');
  cropBox.style.display = 'none';
}
toolMove.addEventListener('click', ()=> setTool('move'));
toolCrop.addEventListener('click', ()=> setTool('crop'));

cv.addEventListener('pointerdown', e=>{
  if(activeTool==='move'){
    panning = true; panStart = {x:e.clientX,y:e.clientY};
    panScroll = {l:wrap.scrollLeft,t:wrap.scrollTop};
    wrap.style.cursor = 'grabbing';
    return;
  }
  if(activeTool==='crop'){
    cv.setPointerCapture(e.pointerId);
    cropping = true;
    const rect = stage.getBoundingClientRect();
    cropStartPt = {x:e.clientX-rect.left, y:e.clientY-rect.top};
    cropBox.style.left = cropStartPt.x+'px'; cropBox.style.top = cropStartPt.y+'px';
    cropBox.style.width = '0px'; cropBox.style.height = '0px';
    cropBox.style.display = 'block';
    return;
  }
  cv.setPointerCapture(e.pointerId);
  const {x,y} = toCanvasXY(e);
  const p = pressureFor(e,0);
  current = {medium, variant, color, size:brushSize, layer:activeLayerId, points:[{x,y,p,j:makeJitter(6)}]};
  stampAt(ctx, current, current.points[0], 0);
  lastPt = {x,y,t:performance.now()};
});
cv.addEventListener('pointermove', e=>{
  if(panning){
    wrap.scrollLeft = panScroll.l - (e.clientX-panStart.x);
    wrap.scrollTop = panScroll.t - (e.clientY-panStart.y);
    return;
  }
  if(cropping){
    const rect = stage.getBoundingClientRect();
    const curX = e.clientX-rect.left, curY = e.clientY-rect.top;
    const x = Math.min(cropStartPt.x, curX), y = Math.min(cropStartPt.y, curY);
    const w = Math.abs(curX-cropStartPt.x), h = Math.abs(curY-cropStartPt.y);
    cropBox.style.left=x+'px'; cropBox.style.top=y+'px'; cropBox.style.width=w+'px'; cropBox.style.height=h+'px';
    return;
  }
  if(!current) return;
  const {x,y} = toCanvasXY(e);
  const now = performance.now();
  const dist = Math.hypot(x-lastPt.x, y-lastPt.y);
  const dt = Math.max(1, now-lastPt.t);
  const speed = dist/dt*16;
  const spacing = Math.max(2, current.size*0.22);
  const steps = Math.max(1, Math.floor(dist/spacing));
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    const px=lastPt.x+(x-lastPt.x)*t, py=lastPt.y+(y-lastPt.y)*t;
    const p = pressureFor(e,speed);
    const pt = {x:px,y:py,p,j:makeJitter(6)};
    current.points.push(pt);
    stampAt(ctx, current, pt, current.points.length-1);
  }
  lastPt = {x,y,t:now};
});
function showCropExport(sx,sy,sw,sh){
  const off = document.createElement('canvas'); off.width=Math.round(sw); off.height=Math.round(sh);
  const octx = off.getContext('2d');
  octx.translate(-sx,-sy);
  octx.filter = adjustFilterString();
  fullRedraw(octx);
  const dataUrl = off.toDataURL('image/png');
  document.getElementById('exportImg').src = dataUrl;
  document.getElementById('exportMeta').textContent = `Crop — ${Math.round(sw)}×${Math.round(sh)}px`;
  document.getElementById('exportOverlay').style.display='flex';
  window._lastExportCanvas = off;
}
function endStroke(){
  if(panning){ panning=false; wrap.style.cursor='grab'; return; }
  if(cropping){
    cropping = false;
    const rect = stage.getBoundingClientRect();
    const scaleX = cv.width/rect.width, scaleY = cv.height/rect.height;
    const boxRect = cropBox.getBoundingClientRect();
    const sx = (boxRect.left-rect.left)*scaleX, sy=(boxRect.top-rect.top)*scaleY;
    const sw = boxRect.width*scaleX, sh = boxRect.height*scaleY;
    cropBox.style.display='none';
    if(sw>8 && sh>8){ showCropExport(sx,sy,sw,sh); }
    return;
  }
  if(current){ strokes.push(current); current=null; redrawLiveStrokes(); }
}
cv.addEventListener('pointerup', endStroke);
cv.addEventListener('pointerleave', endStroke);

// ---------- UI wiring ----------
document.querySelectorAll('.tile[data-medium]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.tile[data-medium]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    medium = btn.dataset.medium; variant = btn.dataset.variant;
    if(activeTool!=='draw') setTool(activeTool);
  });
});
document.querySelector('.tile[data-medium="graphite"][data-variant="hb"]').classList.add('active');

const textureBox = document.getElementById('textureBox');
const textureToggle = document.getElementById('textureToggle');
const TEXTURES = [
  {type:'smooth', label:'Smooth Bristol'},
  {type:'coldpress', label:'Cold Press Paper'},
  {type:'canvas', label:'Rough Canvas'},
  {type:'toned', label:'Toned Gray'},
];
TEXTURES.forEach(t=>{
  const b = document.createElement('button');
  b.className = 'tex-swatch' + (t.type===paperType ? ' active':'');
  b.title = t.label;
  b.style.background = paperBase(t.type);
  b.addEventListener('click', ()=>{
    paperType = t.type; drawPaper(pctx);
    document.querySelectorAll('.tex-swatch').forEach(s=>s.classList.remove('active'));
    b.classList.add('active');
  });
  textureBox.appendChild(b);
});
textureToggle.addEventListener('click', ()=>{
  const open = textureBox.classList.toggle('open');
  textureToggle.classList.toggle('active', open);
});
const menuToggle = document.getElementById('menuToggle');
const menuPanel = document.getElementById('menuPanel');
menuToggle.addEventListener('click', ()=>{
  const open = menuPanel.classList.toggle('open');
  menuToggle.classList.toggle('active', open);
  menuToggle.setAttribute('aria-expanded', String(open));
});

const colorPicker = document.getElementById('colorPicker');
colorPicker.addEventListener('input', ()=> color = colorPicker.value);
const PALETTE = ['#1a1a1a','#6b4226','#8a3324','#2e4a3a','#1c3a5e','#caa23d','#ffffff','#9c9c9c'];
const swEl = document.getElementById('swatches');
PALETTE.forEach(c=>{
  const d=document.createElement('div'); d.className='swatch'; d.style.background=c;
  d.addEventListener('click', ()=>{ color=c; colorPicker.value=c;
    document.querySelectorAll('.swatch').forEach(s=>s.classList.remove('active')); d.classList.add('active'); });
  swEl.appendChild(d);
});

document.querySelectorAll('.val-circle, .val-tile').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const c = btn.dataset.color;
    color = c; colorPicker.value = c;
    document.querySelectorAll('.swatch,.val-circle').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll(`.val-circle[data-color="${c}"]`).forEach(s=>s.classList.add('active'));
  });
});
document.querySelector('.val-circle[data-color="#ffffff"]').classList.add('active');

const sizeSlider = document.getElementById('sizeSlider');
const sizeVal = document.getElementById('sizeVal');
sizeSlider.addEventListener('input', ()=>{ brushSize=Number(sizeSlider.value); sizeVal.textContent=brushSize; });

document.getElementById('pressureMode').addEventListener('change', e=> pressureMode = e.target.value);

document.getElementById('rightToggle').addEventListener('click', ()=>{
  document.getElementById('rightAside').classList.toggle('collapsed');
  applyZoom();
});
document.getElementById('undoBtn').addEventListener('click', ()=>{ strokes.pop(); redrawLiveStrokes(); });
document.getElementById('clearBtn').addEventListener('click', ()=>{ strokes = strokes.filter(s=>s.layer!==activeLayerId); redrawLiveStrokes(); });

// ---------- Layers: what you paint on. Export always flattens all of them. ----------
const layersList = document.getElementById('layersList');
const addLayerBtn = document.getElementById('addLayerBtn');
function renderLayersPanel(){
  layersList.innerHTML = '';
  // Show topmost layer first in the list, like a standard layers panel --
  // layers[] itself stays bottom-to-top for correct paint-stacking order.
  for(let i=layers.length-1;i>=0;i--){
    const L = layers[i];
    const row = document.createElement('div');
    row.className = 'layer-row' + (L.id===activeLayerId ? ' active' : '');
    const name = document.createElement('span');
    name.className = 'lname';
    name.textContent = L.name;
    row.appendChild(name);
    const muteBtn = document.createElement('button');
    muteBtn.className = 'btn eyeBtn' + (L.visible ? '' : ' off');
    muteBtn.textContent = L.visible ? 'Mute' : 'Muted';
    muteBtn.title = L.visible ? 'Mute (mask out) this layer' : 'Unmute this layer';
    muteBtn.addEventListener('click', ev=>{
      ev.stopPropagation();
      L.visible = !L.visible;
      renderLayersPanel();
      redrawLiveStrokes();
    });
    row.appendChild(muteBtn);
    if(layers.length > 1){
      const delBtn = document.createElement('button');
      delBtn.className = 'btn';
      delBtn.textContent = '✕';
      delBtn.title = 'Delete layer';
      delBtn.addEventListener('click', ev=>{
        ev.stopPropagation();
        strokes = strokes.filter(s=>s.layer!==L.id);
        layers = layers.filter(x=>x.id!==L.id);
        if(activeLayerId===L.id) activeLayerId = layers[layers.length-1].id;
        renderLayersPanel();
        redrawLiveStrokes();
      });
      row.appendChild(delBtn);
    }
    row.addEventListener('click', ()=>{ activeLayerId = L.id; renderLayersPanel(); });
    layersList.appendChild(row);

    // Fade slider: a live preview of this layer's strength, independent of Mute.
    const fadeWrap = document.createElement('div');
    fadeWrap.style.cssText = 'display:flex;align-items:center;gap:8px;padding:0 4px 8px;margin-top:-4px;';
    const fadeLabel = document.createElement('span');
    fadeLabel.className = 'small';
    fadeLabel.style.cssText = 'margin:0;min-width:34px;';
    fadeLabel.textContent = Math.round(L.opacity*100)+'%';
    const fadeSlider = document.createElement('input');
    fadeSlider.type = 'range'; fadeSlider.min = '0'; fadeSlider.max = '100';
    fadeSlider.value = String(Math.round(L.opacity*100));
    fadeSlider.style.cssText = 'flex:1;margin:0;';
    fadeSlider.title = 'Fade this layer in/out as a preview';
    fadeSlider.addEventListener('click', ev=> ev.stopPropagation());
    fadeSlider.addEventListener('input', ()=>{
      L.opacity = Number(fadeSlider.value)/100;
      fadeLabel.textContent = fadeSlider.value+'%';
      redrawLiveStrokes();
    });
    fadeWrap.appendChild(fadeLabel);
    fadeWrap.appendChild(fadeSlider);
    layersList.appendChild(fadeWrap);

    // Jumps straight to the Adjust panel for quick tonal work on this piece.
    const adjustBtn = document.createElement('button');
    adjustBtn.className = 'btn';
    adjustBtn.style.cssText = 'width:100%;margin:0 0 10px;';
    adjustBtn.textContent = 'Adjust →';
    adjustBtn.title = 'Open the Adjust panel';
    adjustBtn.addEventListener('click', ev=>{
      ev.stopPropagation();
      const d = document.getElementById('adjustDetails');
      d.open = true;
      d.scrollIntoView({behavior:'smooth', block:'nearest'});
    });
    layersList.appendChild(adjustBtn);
  }
}
addLayerBtn.addEventListener('click', ()=>{
  const id = nextLayerId++;
  layers.push({id, name: `Layer ${layers.length+1}`, visible:true, opacity:1});
  activeLayerId = id;
  renderLayersPanel();
});
renderLayersPanel();

// ---------- zoom: 100% == fit to screen, steps of 10% below that ----------
const zoomSlider = document.getElementById('zoomSlider');
const zoomLabel = document.getElementById('zoomLabel');
function fitScale(){
  const pad=40;
  const availW = Math.max(wrap.clientWidth-pad, 200), availH = Math.max(wrap.clientHeight-pad, 200);
  return Math.min(availW/baseW, availH/baseH, 1);
}
function applyZoom(){
  const pct = Number(zoomSlider.value);
  const scale = fitScale()*(pct/100);
  stage.style.width = (baseW*scale)+'px';
  stage.style.height = (baseH*scale)+'px';
  zoomLabel.textContent = pct===100 ? 'Fit Screen · 100%' : pct+'% of Fit Screen';
}
zoomSlider.addEventListener('input', applyZoom);
window.addEventListener('resize', applyZoom);

// ---------- export presets ----------
// Sizes kept to what a browser tab can safely render -- the old industrial
// sign/banner/mural presets (up to 48x96in @300dpi) built canvases of 100M+
// pixels, which was enough on its own to push some machines into system-wide
// out-of-memory territory. Max preset here (2400x3000px) stays well under
// that, while still being plenty sharp for normal printing.
const PRESETS = [
  {name:'Web / Screen — 10×13in @100dpi', w:10,h:13,dpi:100},
  {name:'Standard Print — 8×10in @150dpi', w:8,h:10,dpi:150},
  {name:'Large Print — 11×14in @150dpi', w:11,h:14,dpi:150},
  {name:'Poster — 16×20in @150dpi', w:16,h:20,dpi:150},
  {name:'Custom', w:null,h:null,dpi:null}
];
const presetSel = document.getElementById('presetSel');
PRESETS.forEach((p,i)=>{ const o=document.createElement('option'); o.value=i; o.textContent=p.name; presetSel.appendChild(o); });
const wIn=document.getElementById('wIn'), hIn=document.getElementById('hIn'), dpiIn=document.getElementById('dpiIn');
presetSel.addEventListener('change', ()=>{
  const p = PRESETS[presetSel.value];
  if(p.w!=null){ wIn.value=p.w; hIn.value=p.h; dpiIn.value=p.dpi; }
});

document.getElementById('exportBtn').addEventListener('click', ()=>{
  const bleed = document.getElementById('bleedChk').checked ? 0.125 : 0;
  const dpi = Number(dpiIn.value), wInches=Number(wIn.value)+bleed*2, hInches=Number(hIn.value)+bleed*2;
  const pxW = Math.round(wInches*dpi), pxH = Math.round(hInches*dpi);
  const off = document.createElement('canvas'); off.width=pxW; off.height=pxH;
  const octx = off.getContext('2d');
  octx.save();
  octx.scale(pxW/baseW, pxH/baseH);
  octx.filter = adjustFilterString();
  fullRedraw(octx);
  octx.restore();
  if(bleed>0){
    const trimPx = bleed*dpi;
    octx.strokeStyle='#000'; octx.lineWidth=1;
    const len=14;
    [[trimPx,trimPx,1,1],[pxW-trimPx,trimPx,-1,1],[trimPx,pxH-trimPx,1,-1],[pxW-trimPx,pxH-trimPx,-1,-1]].forEach(([x,y,dx,dy])=>{
      octx.beginPath(); octx.moveTo(x,y); octx.lineTo(x+dx*len,y); octx.stroke();
      octx.beginPath(); octx.moveTo(x,y); octx.lineTo(x,y+dy*len); octx.stroke();
    });
  }
  const dataUrl = off.toDataURL('image/png');
  document.getElementById('exportImg').src = dataUrl;
  document.getElementById('exportMeta').textContent =
    `${pxW}×${pxH}px · ${dpi} DPI · ${Number(wIn.value)}×${Number(hIn.value)}in` + (bleed>0?' (+0.125" bleed, crop marks)':'');
  document.getElementById('exportOverlay').style.display='flex';
  window._lastExportCanvas = off;
});
document.getElementById('closeExportBtn').addEventListener('click', ()=>{
  document.getElementById('exportOverlay').style.display='none';
});
document.getElementById('downloadImgBtn').addEventListener('click', ()=>{
  const off = window._lastExportCanvas;
  if(!off) return;
  off.toBlob(blob=>{
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veridianq-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1000);
  }, 'image/png');
});
document.getElementById('copyImgBtn').addEventListener('click', async ()=>{
  try{
    const off = window._lastExportCanvas;
    off.toBlob(async blob=>{
      try{
        await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
      }catch(err){ /* clipboard write may be refused in this sandbox; image stays visible for manual save */ }
    });
  }catch(e){}
});

// ---------- reference image (trace-paper) ----------
document.getElementById('refDropdownBtn').addEventListener('click', ()=>{
  document.getElementById('refPanel').classList.toggle('open');
});
document.getElementById('importRefBtn').addEventListener('click', ()=> document.getElementById('refFileInput').click());
document.getElementById('refFileInput').addEventListener('change', e=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = ev=>{ refImg.src = ev.target.result; refImg.style.display='block'; };
  reader.readAsDataURL(file);
});
document.getElementById('clearRefBtn').addEventListener('click', ()=>{
  refImg.style.display='none'; refImg.src='';
  document.getElementById('traceChk').checked=false; paperCv.style.opacity=1;
});
const refOpacity = document.getElementById('refOpacity'), refOpVal = document.getElementById('refOpVal');
refOpacity.addEventListener('input', ()=>{ refImg.style.opacity = refOpacity.value/100; refOpVal.textContent = refOpacity.value; });
document.getElementById('traceChk').addEventListener('change', e=>{ paperCv.style.opacity = e.target.checked ? 0.32 : 1; });

// ---------- Auto Paint ----------
const STYLE_PROMPTS = {
  charcoal: 'rendered as a charcoal sketch, soft smudged tonal shading, visible paper tooth',
  graphite: 'rendered as a graphite pencil drawing, fine hatching, precise linework',
  ink: 'rendered as an ink illustration, confident linework, high contrast',
  marker: 'rendered as a marker illustration, flat bold color blocking, clean edges',
  pastel: 'rendered as a soft pastel painting, chalky texture, blended color transitions',
  'oil-allaprima': 'rendered as an alla prima oil painting, wet-on-wet brushwork, visible brush strokes',
  'oil-impasto': 'rendered as an impasto oil painting, thick textured paint, heavy palette knife strokes',
};

const styleSel = document.getElementById('styleSel');
const autoPaintPrompt = document.getElementById('autoPaintPrompt');
const autoPaintBtn = document.getElementById('autoPaintBtn');
const autoPaintHint = document.getElementById('autoPaintHint');
const DEFAULT_AUTOPAINT_HINT = autoPaintHint.textContent;

// Keep the style dropdown roughly in sync with whichever brush tile is active,
// as a starting point -- the artist can still override it before painting.
document.querySelectorAll('.tile').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const m = btn.dataset.medium, v = btn.dataset.variant;
    const key = (m === 'oil') ? `oil-${v}` : m;
    if (STYLE_PROMPTS[key]) styleSel.value = key;
  });
});

function hasReferencePhoto(){
  return !!(refImg.src && refImg.style.display !== 'none');
}

autoPaintBtn.addEventListener('click', async ()=>{
  const prompt = autoPaintPrompt.value.trim();
  const styleModifier = STYLE_PROMPTS[styleSel.value] || '';
  const withPhoto = hasReferencePhoto();

  if (!prompt && !withPhoto){
    autoPaintHint.textContent = 'Load a reference photo, or type a prompt above -- Auto Paint needs one of the two.';
    autoPaintHint.style.color = '#d87a3d';
    return;
  }

  autoPaintBtn.disabled = true;
  autoPaintBtn.textContent = 'Painting\u2026';
  autoPaintHint.style.color = '';
  autoPaintHint.textContent = withPhoto ? 'Uploading your reference photo\u2026' : 'Generating from your prompt\u2026';

  try {
    // Same connection the proven "Activate Q" button on the other Veridian Q
    // site uses: the model can't fetch a browser data: URL, so a loaded
    // reference photo is uploaded first to get a real https URL.
    let imageUrl;
    if (withPhoto) {
      const photoBlob = await (await fetch(refImg.src)).blob();
      const form = new FormData();
      form.append('file', photoBlob, 'reference.png');
      const upRes = await fetch('/api/upload', { method: 'POST', body: form });
      const upData = await upRes.json();
      if (!upRes.ok || !upData.url) throw new Error(upData.error || 'Reference photo upload failed.');
      imageUrl = upData.url;
      autoPaintHint.textContent = 'Repainting your reference photo\u2026';
    }

    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        prompt,
        styleModifier,
        imageUrl,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.error || `Request failed (${data.status || res.status})`);
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>{
      // Cover-fit the result onto the paper canvas (texture preserved underneath
      // via drawPaper), then the artist keeps drawing on top with brush tools.
      const cw = paperCv.width, ch = paperCv.height;
      const scale = Math.max(cw/img.width, ch/img.height);
      const dw = img.width*scale, dh = img.height*scale;
      const dx = (cw-dw)/2, dy = (ch-dh)/2;
      drawPaper(pctx);
      pctx.drawImage(img, dx, dy, dw, dh);
      autoPaintHint.textContent = DEFAULT_AUTOPAINT_HINT;
      autoPaintBtn.disabled = false;
      autoPaintBtn.textContent = 'Auto Paint';
    };
    img.onerror = ()=>{
      autoPaintHint.textContent = 'Image generated but failed to load into the canvas.';
      autoPaintHint.style.color = '#d87a3d';
      autoPaintBtn.disabled = false;
      autoPaintBtn.textContent = 'Auto Paint';
    };
    img.src = data.imageUrl;
  } catch (err) {
    autoPaintHint.textContent = `Auto Paint failed: ${err.message}`;
    autoPaintHint.style.color = '#d87a3d';
    autoPaintBtn.disabled = false;
    autoPaintBtn.textContent = 'Auto Paint';
  }
});

// ---------- Rulers: Fibonacci spiral + proportion grids ----------
function fibonacciOverlaySVG(W,H,angle){
  // The real Fibonacci/golden-ratio cascade (squares shrinking in toward a
  // spiral) only comes out right when the starting rectangle is actually in
  // Fibonacci proportions (~1.618:1) -- a standard art-canvas size like
  // 16x20 or 9x12 is nowhere near that ratio, and peeling squares off a
  // non-golden rectangle collapses after one step instead of cascading.
  // So: build the classic cascade in its own natural unit space (a true
  // 55x34 Fibonacci rectangle), then stretch that whole diagram -- squares,
  // spiral and all -- to exactly fill the selected Canvas Size's frame.
  const { wInches, hInches } = currentCanvasSizeInches();
  const aspect = wInches/hInches;
  let gw, gh;
  if (W/aspect <= H) { gw = W; gh = W/aspect; } else { gh = H; gw = H*aspect; }
  const ox=(W-gw)/2, oy=(H-gh)/2;

  // The peel loop below only cascades correctly starting from a landscape
  // (wider-than-tall) 55x34 Fibonacci rectangle -- so that's always what we
  // feed it. If the target canvas is portrait, we rotate the mapping instead
  // of the math: the unit rect's long side (55) lands on the canvas's long
  // side, its short side (34) on the canvas's short side.
  const unitW = 55, unitH = 34;
  const portrait = gh >= gw;
  const scaleLong = (portrait ? gh : gw) / unitW;
  const scaleShort = (portrait ? gw : gh) / unitH;
  const toReal = portrait
    ? (ux,uy) => [ox + uy*scaleShort, oy + ux*scaleLong]
    : (ux,uy) => [ox + ux*scaleLong, oy + uy*scaleShort];

  let rx=0, ry=0, rw=unitW, rh=unitH, dir=0;
  const squares=[];
  for(let i=0;i<9;i++){
    if(rw<1||rh<1) break;
    const s = Math.min(rw,rh);
    let sq={s};
    if(dir===0){ sq.x=rx; sq.y=ry; rx+=s; rw-=s; }
    else if(dir===1){ sq.x=rx; sq.y=ry+rh-s; rh-=s; }
    else if(dir===2){ sq.x=rx+rw-s; sq.y=ry; rw-=s; }
    else { sq.x=rx; sq.y=ry; ry+=s; rh-=s; }
    sq.dir=dir;
    squares.push(sq);
    dir=(dir+1)%4;
  }
  const corners = sq => ({
    TL:{x:sq.x,y:sq.y}, TR:{x:sq.x+sq.s,y:sq.y},
    BL:{x:sq.x,y:sq.y+sq.s}, BR:{x:sq.x+sq.s,y:sq.y+sq.s}
  });
  const START=['TL','BL','BR','TR'], END=['BR','TR','TL','BL'], CENTER=['TR','TL','BL','BR'];
  let d='';
  squares.forEach((sq,i)=>{
    const c = corners(sq);
    const cc = c[CENTER[sq.dir]], p0 = c[START[sq.dir]], p1 = c[END[sq.dir]];
    const a0 = Math.atan2(p0.y-cc.y, p0.x-cc.x);
    let a1 = Math.atan2(p1.y-cc.y, p1.x-cc.x);
    let da = a1-a0;
    while(da<=-Math.PI) da+=2*Math.PI;
    while(da>Math.PI) da-=2*Math.PI;
    const steps=14, pts=[];
    for(let k=0;k<=steps;k++){
      const a = a0 + da*(k/steps);
      const [rxp,ryp] = toReal(cc.x+sq.s*Math.cos(a), cc.y+sq.s*Math.sin(a));
      pts.push(`${rxp.toFixed(1)},${ryp.toFixed(1)}`);
    }
    d += (i===0?'M':'L') + pts.join(' L ');
  });
  const squaresSVG = squares.map(sq=>{
    const [rxp,ryp] = toReal(sq.x, sq.y);
    const rw2 = (sq.s*(portrait?scaleShort:scaleLong)).toFixed(1);
    const rh2 = (sq.s*(portrait?scaleLong:scaleShort)).toFixed(1);
    return `<rect x="${rxp.toFixed(1)}" y="${ryp.toFixed(1)}" width="${rw2}" height="${rh2}" fill="none" stroke="currentColor" stroke-opacity=".85" stroke-width="1.5"/>`;
  }).join('');
  const rot = angle ? ` transform="rotate(${angle} ${(W/2).toFixed(1)} ${(H/2).toFixed(1)})"` : '';
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;position:absolute;left:0;top:0;color:var(--gold);"><g${rot}>${squaresSVG}<path d="${d}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-opacity=".9"/></g></svg>`;
}
// Grid 1 -- a real measurement grid: lines spaced by actual inches/cm/mm of the
// physical piece (from the Export panel's Width/Height), each line numbered.
// Because this overlay lives in the same baseW x baseH viewBox as the canvas,
// and the canvas's on-screen size is what the zoom slider scales, the grid
// (lines and numbers both) scales right along with it -- shrink to 60% and
// the numbers shrink too, exactly like a real ruler held up to the screen.
function niceUnitStep(pxPerUnit){
  const candidates=[1,2,5,10,20,25,50,100,200,250,500,1000];
  for(const c of candidates){ if(pxPerUnit*c>=26) return c; }
  return candidates[candidates.length-1];
}
function currentCanvasSizeInches(){
  const parts = (canvasSizeSel.value || '8x10').split('x').map(Number);
  return { wInches: parts[0]||8, hInches: parts[1]||10 };
}
function measurementGridSVG(W,H,unit){
  const { wInches, hInches } = currentCanvasSizeInches();
  const unitInInches = unit==='in' ? 1 : (unit==='cm' ? 1/2.54 : 1/25.4);
  const pxPerUnitX = (W/wInches) * unitInInches;
  const pxPerUnitY = (H/hInches) * unitInInches;
  const stepX = niceUnitStep(pxPerUnitX);
  const stepY = niceUnitStep(pxPerUnitY);
  const totalX = wInches/unitInInches, totalY = hInches/unitInInches;
  const color = '#000000'; // black, like a real ruler laid on the piece
  const fs = Math.max(9, Math.min(W,H)*0.014);
  let lines='', labels='';
  for(let u=stepX; u<totalX; u+=stepX){
    const x=u*pxPerUnitX;
    lines += `<line x1="${x.toFixed(1)}" y1="0" x2="${x.toFixed(1)}" y2="${H}" stroke="${color}" stroke-width="1.3" stroke-opacity="1"/>`;
    labels += `<text x="${(x+4).toFixed(1)}" y="${(fs+4).toFixed(1)}" fill="${color}" font-size="${fs.toFixed(1)}" font-family="Georgia,serif" font-weight="700" opacity="1">${u}</text>`;
  }
  for(let u=stepY; u<totalY; u+=stepY){
    const y=u*pxPerUnitY;
    lines += `<line x1="0" y1="${y.toFixed(1)}" x2="${W}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1.3" stroke-opacity="1"/>`;
    labels += `<text x="4" y="${(y-4).toFixed(1)}" fill="${color}" font-size="${fs.toFixed(1)}" font-family="Georgia,serif" font-weight="700" opacity="1">${u}</text>`;
  }
  const unitLabel = unit==='in' ? 'in' : unit;
  labels += `<text x="${(W-6).toFixed(1)}" y="${(H-8).toFixed(1)}" fill="${color}" font-size="${fs.toFixed(1)}" font-family="Georgia,serif" font-weight="700" opacity="1" text-anchor="end">1 ${unitLabel} grid — ${wInches}×${hInches}in canvas</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;position:absolute;left:0;top:0;">${lines}${labels}</svg>`;
}

// Grid 2 -- a perspective grid: 1/2/3-point, for training the eye on
// convergence the same way the measurement grid trains it on proportion.
function perspectiveGridSVG(W,H,points){
  const color = '#000000'; // black lines, numbered, so it reads like a real tool
  const horizonY = H*0.42;
  const N = 10;
  const edgePts = [];
  for(let i=0;i<=N;i++){ edgePts.push([W*i/N,0]); edgePts.push([W*i/N,H]); }
  for(let i=1;i<N;i++){ edgePts.push([0,H*i/N]); edgePts.push([W,H*i/N]); }
  let lines = `<line x1="0" y1="${horizonY.toFixed(1)}" x2="${W}" y2="${horizonY.toFixed(1)}" stroke="${color}" stroke-width="1.8" stroke-opacity="1" stroke-dasharray="7 6"/>`;
  const vpDot = (x,y)=> `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" fill="${color}"/>`;
  const rayTo = (vx,vy,x,y)=> `<line x1="${vx.toFixed(1)}" y1="${vy.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${color}" stroke-width="1.1" stroke-opacity=".8"/>`;
  if (points===1){
    const vp=[W/2,horizonY];
    edgePts.forEach(([x,y])=> lines += rayTo(vp[0],vp[1],x,y));
    lines += vpDot(vp[0],vp[1]);
  } else if (points===2){
    const vp1=[-W*0.65,horizonY], vp2=[W*1.65,horizonY];
    edgePts.forEach(([x,y])=>{ lines += rayTo(vp1[0],vp1[1],x,y); lines += rayTo(vp2[0],vp2[1],x,y); });
  } else {
    const vp1=[-W*0.65,horizonY], vp2=[W*1.65,horizonY], vp3=[W/2,H*1.75];
    edgePts.forEach(([x,y])=>{ lines += rayTo(vp1[0],vp1[1],x,y); lines += rayTo(vp2[0],vp2[1],x,y); });
    for(let i=0;i<=N;i++){ const x=W*i/N; lines += rayTo(x,0,vp3[0],vp3[1]); lines += rayTo(x,H,vp3[0],vp3[1]); }
  }
  // Numbered ruler ticks along the horizon, in inches of the chosen Canvas
  // Size, so the convergence lines above can be read against real measurements.
  const { wInches } = currentCanvasSizeInches();
  const pxPerInch = W/wInches;
  const step = niceUnitStep(pxPerInch);
  const fs = Math.max(9, Math.min(W,H)*0.013);
  let ticks = '';
  for(let u=step; u<wInches; u+=step){
    const x = u*pxPerInch;
    ticks += `<line x1="${x.toFixed(1)}" y1="${(horizonY-7).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(horizonY+7).toFixed(1)}" stroke="${color}" stroke-width="1.6" stroke-opacity="1"/>`;
    ticks += `<text x="${(x+3).toFixed(1)}" y="${(horizonY-10).toFixed(1)}" fill="${color}" font-size="${fs.toFixed(1)}" font-family="Georgia,serif" font-weight="700" opacity="1">${u}</text>`;
  }
  const pointLabel = points===1?'1-Point':points===2?'2-Point':'3-Point';
  ticks += `<text x="${(W-6).toFixed(1)}" y="${(H-8).toFixed(1)}" fill="${color}" font-size="${fs.toFixed(1)}" font-family="Georgia,serif" font-weight="700" opacity="1" text-anchor="end">${pointLabel} perspective — horizon ticks in inches</text>`;
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:100%;position:absolute;left:0;top:0;overflow:hidden;">${lines}${ticks}</svg>`;
}

const rulerOverlay = document.getElementById('rulerOverlay');
const gridUnitRow = document.getElementById('gridUnitRow');
const gridUnitSel = document.getElementById('gridUnitSel');
const perspectiveRow = document.getElementById('perspectiveRow');
const perspectiveSel = document.getElementById('perspectiveSel');
const canvasSizeRow = document.getElementById('canvasSizeRow');
const canvasSizeSel = document.getElementById('canvasSizeSel');
const fibAngleRow = document.getElementById('fibAngleRow');
const fibAngleSel = document.getElementById('fibAngleSel');
let activeRuler = null;
function renderRuler(){
  fibAngleRow.style.display = (activeRuler==='fibonacci') ? 'flex' : 'none';
  gridUnitRow.style.display = (activeRuler==='grid1') ? 'flex' : 'none';
  perspectiveRow.style.display = (activeRuler==='grid2') ? 'flex' : 'none';
  canvasSizeRow.style.display = (activeRuler==='grid1' || activeRuler==='grid2') ? 'flex' : 'none';
  if(activeRuler==='fibonacci') rulerOverlay.innerHTML = fibonacciOverlaySVG(baseW, baseH, Number(fibAngleSel.value));
  else if(activeRuler==='grid1') rulerOverlay.innerHTML = measurementGridSVG(baseW, baseH, gridUnitSel.value);
  else if(activeRuler==='grid2') rulerOverlay.innerHTML = perspectiveGridSVG(baseW, baseH, Number(perspectiveSel.value));
  else rulerOverlay.innerHTML = '';
}
document.querySelectorAll('.ruler-tile').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const r = btn.dataset.ruler;
    activeRuler = (activeRuler===r) ? null : r;
    document.querySelectorAll('.ruler-tile').forEach(b=>b.classList.remove('active'));
    if(activeRuler) btn.classList.add('active');
    renderRuler();
  });
});
gridUnitSel.addEventListener('change', renderRuler);
perspectiveSel.addEventListener('change', renderRuler);
canvasSizeSel.addEventListener('change', renderRuler);
fibAngleSel.addEventListener('change', renderRuler);

// ---------- Adjust: global value + the 8 adjustment sliders ----------
let valueAdjust = 100; // percent, 100 = neutral
let adj = {contrast:0, tint:0, shadow:0, highlight:0, saturation:0, warm:0, cool:0, sharp:0};
const valueSlider = document.getElementById('valueSlider');
const valueVal = document.getElementById('valueVal');
const sharpenMatrix = document.getElementById('sharpenMatrix');

function adjustFilterString(){
  const brightnessPct = valueAdjust * (1 + adj.shadow*0.002) * (1 + adj.highlight*0.001);
  const contrastPct = 100 * (1 - adj.shadow*0.0015) * (1 + adj.highlight*0.002) * (1 + adj.contrast*0.005);
  const saturatePct = 100 * (1 + adj.saturation*0.008);
  const sepiaPct = Math.max(0, adj.warm*0.6);
  const hueDeg = adj.tint*0.9 - adj.cool*0.9;
  let f = `brightness(${brightnessPct.toFixed(1)}%) contrast(${Math.max(0,contrastPct).toFixed(1)}%) saturate(${Math.max(0,saturatePct).toFixed(1)}%)`;
  if (sepiaPct>0.1) f += ` sepia(${sepiaPct.toFixed(1)}%)`;
  if (Math.abs(hueDeg)>0.1) f += ` hue-rotate(${hueDeg.toFixed(1)}deg)`;
  if (adj.sharp>0){
    const k = adj.sharp/100*0.6;
    sharpenMatrix.setAttribute('kernelMatrix', `0 ${-k} 0 ${-k} ${(1+4*k).toFixed(3)} ${-k} 0 ${-k} 0`);
    f += ' url(#sharpenFx)';
  }
  return f;
}
function applyAdjustments(){
  stage.style.filter = adjustFilterString();
}
valueSlider.addEventListener('input', ()=>{
  valueAdjust = Number(valueSlider.value);
  valueVal.textContent = valueAdjust;
  applyAdjustments();
});
document.querySelectorAll('.adj-slider').forEach(sl=>{
  const key = sl.id.replace('adj','').replace(/^./, c=>c.toLowerCase());
  const out = document.getElementById(sl.id+'Val');
  sl.addEventListener('input', ()=>{
    adj[key] = Number(sl.value);
    out.textContent = sl.value;
    applyAdjustments();
  });
});
document.getElementById('signOutBtn').addEventListener('click', ()=>{
  fetch('/api/signout', {method:'POST'}).finally(()=>{ window.location.href = '/login'; });
});
document.getElementById('adjResetBtn').addEventListener('click', ()=>{
  valueAdjust = 100; valueSlider.value = 100; valueVal.textContent = 100;
  Object.keys(adj).forEach(k=>{
    adj[k] = 0;
    const el = document.getElementById('adj'+k.charAt(0).toUpperCase()+k.slice(1));
    if(el){ el.value = 0; document.getElementById(el.id+'Val').textContent = 0; }
  });
  stage.style.filter = '';
});

// ---------- boot ----------
function bootPaint(){
  drawPaper(pctx);
  refImg.style.opacity = 0.5;
  applyZoom();
}
// Run after the browser has actually committed layout (double rAF),
// and again on window 'load' as a safety net -- avoids reading
// clientWidth/clientHeight as 0 before the flex chain has sized itself.
requestAnimationFrame(()=>requestAnimationFrame(bootPaint));
window.addEventListener('load', bootPaint);

// ---------- Mini monitor: small live preview in the Export panel ----------
(function(){
  const mon = document.getElementById('miniMonitorCv');
  if (!mon) return;
  const mctx = mon.getContext('2d');
  function renderMiniMonitor(){
    try{
      mctx.clearRect(0,0,mon.width,mon.height);
      const pw = paperCv.width, ph = paperCv.height;
      if (!pw || !ph) return;
      const scale = Math.min(mon.width/pw, mon.height/ph);
      const dw = pw*scale, dh = ph*scale, dx=(mon.width-dw)/2, dy=(mon.height-dh)/2;
      mctx.filter = (typeof adjustFilterString === 'function') ? adjustFilterString() : 'none';
      mctx.drawImage(paperCv, dx, dy, dw, dh);
      if (refImg && refImg.style.display !== 'none' && refImg.src){
        mctx.globalAlpha = parseFloat(refImg.style.opacity) || 1;
        mctx.drawImage(refImg, dx, dy, dw, dh);
        mctx.globalAlpha = 1;
      }
      mctx.drawImage(cv, dx, dy, dw, dh);
      mctx.filter = 'none';
    }catch(e){ /* preview is a convenience, never block the app on it */ }
  }
  setInterval(renderMiniMonitor, 300);
  requestAnimationFrame(()=>requestAnimationFrame(renderMiniMonitor));
})();
