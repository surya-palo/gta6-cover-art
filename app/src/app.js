// Vice Cover Studio — editor wiring. Owns the app state, the control panel, the
// pointer interactions on the preview (drag to pan, scroll to zoom, click to pick
// a panel), the PNG export, and the ?shot= query setup used for screenshots.

import { LAYOUTS, GRADES, drawCover, renderCoverAt, panelsFor, panelIndexAt } from './render.js';

const SAMPLES = {
  pier: './samples/pier.jpg',
  boulevard: './samples/boulevard.jpg',
};

const EXPORT_SIZES = {
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
  '1920x1080': [1920, 1080],
};

const state = {
  layout: 'hero',
  grade: 'sunset',
  caption: 'VICE HEIST',
  tagline: 'Leonida, after dark',
  captionSize: 1,
  captionPos: 'bottom',
  captionColor: 'white',
  exportSize: '1920x1080',
  photos: [
    { img: null, zoom: 1, panX: 0, panY: 0 },
    { img: null, zoom: 1, panX: 0, panY: 0 },
    { img: null, zoom: 1, panX: 0, panY: 0 },
    { img: null, zoom: 1, panX: 0, panY: 0 },
  ],
  activeSlot: 0,
};

const stage = document.getElementById('stage');
const stageCtx = stage.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const shotMode = params.get('shot'); // 'cover' | 'editor' | null

function say(text) {
  statusEl.textContent = text;
}

function exportDims() {
  return EXPORT_SIZES[state.exportSize] || EXPORT_SIZES['1920x1080'];
}

// Size the preview canvas to the export aspect (long side ~960px, or the full
// viewport in cover-shot mode) and repaint.
function repaint() {
  const [ew, eh] = exportDims();
  if (shotMode === 'cover') {
    stage.width = window.innerWidth;
    stage.height = window.innerHeight;
  } else {
    const scale = Math.min(960 / ew, 720 / eh, 1);
    stage.width = Math.round(ew * scale);
    stage.height = Math.round(eh * scale);
  }
  drawCover(stageCtx, stage.width, stage.height, state);
  document.body.dataset.ready = '1';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('could not load ' + src));
    img.src = src;
  });
}

async function putPhotoInSlot(slot, src) {
  try {
    const img = await loadImage(src);
    state.photos[slot] = { img, zoom: 1, panX: 0, panY: 0.2 };
    state.activeSlot = slot;
    refreshSlots();
    syncZoomSlider();
    repaint();
  } catch (err) {
    say('That photo could not be loaded.');
  }
}

function refreshSlots() {
  const wrap = document.getElementById('slots');
  wrap.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-btn' + (i === state.activeSlot ? ' active' : '');
    btn.setAttribute('aria-label', 'Photo slot ' + (i + 1));
    if (photo.img) {
      const thumb = document.createElement('img');
      thumb.src = photo.img.src;
      thumb.alt = '';
      btn.appendChild(thumb);
    } else {
      btn.textContent = 'Empty';
    }
    const tag = document.createElement('span');
    tag.className = 'slot-tag';
    tag.textContent = 'Photo ' + (i + 1);
    btn.appendChild(tag);
    btn.addEventListener('click', () => {
      state.activeSlot = i;
      refreshSlots();
      syncZoomSlider();
    });
    wrap.appendChild(btn);
  });
}

function syncZoomSlider() {
  document.getElementById('zoom').value = Math.round((state.photos[state.activeSlot].zoom || 1) * 100);
}

function buildLayoutButtons() {
  const wrap = document.getElementById('layouts');
  const minis = {
    solo: '<i style="inset:3px"></i>',
    hero: '<i style="left:3px;right:3px;top:3px;height:16px"></i><i style="left:3px;bottom:3px;width:8px;height:9px"></i><i style="left:14px;bottom:3px;width:8px;height:9px"></i><i style="right:3px;bottom:3px;width:8px;height:9px"></i>',
    grid: '<i style="left:3px;top:3px;width:14px;height:13px"></i><i style="right:3px;top:3px;width:14px;height:13px"></i><i style="left:3px;bottom:3px;width:14px;height:13px"></i><i style="right:3px;bottom:3px;width:14px;height:13px"></i>',
    diagonal: '<i style="left:3px;top:3px;width:12px;height:28px;transform:skewX(-14deg)"></i><i style="left:17px;top:3px;width:12px;height:28px;transform:skewX(-14deg)"></i><i style="right:3px;top:3px;width:12px;height:28px;transform:skewX(-14deg)"></i>',
  };
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-btn' + (key === state.layout ? ' active' : '');
    btn.innerHTML = '<span class="mini">' + (minis[key] || '') + '</span>' + def.label;
    btn.addEventListener('click', () => {
      state.layout = key;
      wrap.querySelectorAll('.layout-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      repaint();
    });
    wrap.appendChild(btn);
  });
}

function buildGradeButtons() {
  const wrap = document.getElementById('grades');
  Object.entries(GRADES).forEach(([key, def]) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'grade-btn' + (key === state.grade ? ' active' : '');
    btn.innerHTML = '<span class="swatch swatch-' + key + '"></span>' + def.label;
    btn.addEventListener('click', () => {
      state.grade = key;
      wrap.querySelectorAll('.grade-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      repaint();
    });
    wrap.appendChild(btn);
  });
}

function canvasPoint(event) {
  const rect = stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * stage.width,
    y: ((event.clientY - rect.top) / rect.height) * stage.height,
  };
}

// Drag pans the photo in the panel under the pointer; wheel zooms it.
let drag = null;
stage.addEventListener('pointerdown', (event) => {
  const p = canvasPoint(event);
  const idx = panelIndexAt(state.layout, stage.width, stage.height, p.x, p.y);
  if (idx < 0) return;
  const slot = panelsFor(state.layout, stage.width, stage.height)[idx].slot;
  state.activeSlot = slot;
  refreshSlots();
  syncZoomSlider();
  drag = { x: p.x, y: p.y, slot };
  stage.setPointerCapture(event.pointerId);
});
stage.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const p = canvasPoint(event);
  const photo = state.photos[drag.slot];
  if (!photo.img) return;
  photo.panX += (p.x - drag.x) / stage.width;
  photo.panY += (p.y - drag.y) / stage.height;
  drag.x = p.x;
  drag.y = p.y;
  repaint();
});
stage.addEventListener('pointerup', () => { drag = null; });
stage.addEventListener('pointercancel', () => { drag = null; });
stage.addEventListener('wheel', (event) => {
  event.preventDefault();
  const photo = state.photos[state.activeSlot];
  if (!photo.img) return;
  const next = (photo.zoom || 1) * (event.deltaY < 0 ? 1.08 : 1 / 1.08);
  photo.zoom = Math.max(1, Math.min(3, next));
  syncZoomSlider();
  repaint();
}, { passive: false });

document.getElementById('photoFiles').addEventListener('change', (event) => {
  const files = [...event.target.files].slice(0, 4);
  files.forEach((file, i) => {
    const reader = new FileReader();
    reader.onload = () => putPhotoInSlot((state.activeSlot + i) % 4, reader.result);
    reader.readAsDataURL(file);
  });
  event.target.value = '';
});
document.getElementById('samplePier').addEventListener('click', () => putPhotoInSlot(state.activeSlot, SAMPLES.pier));
document.getElementById('sampleBoulevard').addEventListener('click', () => putPhotoInSlot(state.activeSlot, SAMPLES.boulevard));
document.getElementById('zoom').addEventListener('input', (event) => {
  state.photos[state.activeSlot].zoom = event.target.value / 100;
  repaint();
});
document.getElementById('caption').addEventListener('input', (event) => { state.caption = event.target.value; repaint(); });
document.getElementById('tagline').addEventListener('input', (event) => { state.tagline = event.target.value; repaint(); });
document.getElementById('captionSize').addEventListener('input', (event) => { state.captionSize = event.target.value / 100; repaint(); });
document.getElementById('captionPos').addEventListener('change', (event) => { state.captionPos = event.target.value; repaint(); });
document.getElementById('captionColor').addEventListener('change', (event) => { state.captionColor = event.target.value; repaint(); });
document.getElementById('exportSize').addEventListener('change', (event) => { state.exportSize = event.target.value; repaint(); });

document.getElementById('exportPng').addEventListener('click', () => {
  const [w, h] = exportDims();
  const canvas = renderCoverAt(w, h, state);
  canvas.toBlob((blob) => {
    if (!blob) {
      say('Export failed — please try again.');
      return;
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `vice-cover-${w}x${h}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    say(`Exported ${w} × ${h} PNG — check your downloads.`);
  }, 'image/png');
});

// Query setup (used for screenshots and shared links): ?shot=cover|editor
// &photo=pier|boulevard &photo2=… &layout=… &grade=… &size=… &caption=…
// &tagline=… &pos=… &color=… &captionsize=…
async function applyQuery() {
  if (shotMode === 'cover') document.body.classList.add('shot-cover');
  if (params.get('layout') && LAYOUTS[params.get('layout')]) state.layout = params.get('layout');
  if (params.get('grade') && GRADES[params.get('grade')]) state.grade = params.get('grade');
  if (params.get('size') && EXPORT_SIZES[params.get('size')]) state.exportSize = params.get('size');
  if (params.get('caption') !== null) state.caption = params.get('caption');
  if (params.get('tagline') !== null) state.tagline = params.get('tagline');
  if (params.get('pos')) state.captionPos = params.get('pos');
  if (params.get('color')) state.captionColor = params.get('color');
  if (params.get('captionsize')) state.captionSize = Number(params.get('captionsize')) || 1;
  document.getElementById('caption').value = state.caption;
  document.getElementById('tagline').value = state.tagline;
  document.getElementById('captionSize').value = Math.round(state.captionSize * 100);
  document.getElementById('captionPos').value = state.captionPos;
  document.getElementById('captionColor').value = state.captionColor;
  document.getElementById('exportSize').value = state.exportSize;

  const picks = [params.get('photo'), params.get('photo2'), params.get('photo3'), params.get('photo4')]
    .map((name) => (name && SAMPLES[name] ? SAMPLES[name] : null));
  if (!picks[0]) picks[0] = SAMPLES.pier;
  if (!picks[1]) picks[1] = SAMPLES.boulevard;
  for (let i = 0; i < picks.length; i++) {
    if (!picks[i]) continue;
    try {
      const img = await loadImage(picks[i]);
      state.photos[i] = { img, zoom: 1, panX: 0, panY: 0.2 };
    } catch (err) { /* leave the slot empty */ }
  }
  refreshSlots();
  buildLayoutButtons();
  buildGradeButtons();
  repaint();
}

applyQuery();
