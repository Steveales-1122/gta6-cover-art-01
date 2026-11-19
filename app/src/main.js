// Wires the page: photo slots, layout and grade chips, caption fields, the
// panel crop editor (click a panel, drag its photo, scroll to zoom) and the
// PNG exports. A `?shot=` query sets up a fixed scene for a screenshot
// instead (./shots.js). window.__exportPNGDataURL draws the cover at any
// size and resolves to its PNG data URL, for the screenshot driver.
import { drawPoster } from './cover.js';
import { runShot } from './shots.js';
import {
  SIZES, createCoverState, fillAllPanels, hitPanel, layoutPanels, panelCount,
  resetPanelCrop, spreadPhotos,
} from './state.js';

const state = createCoverState();
const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const SAMPLE_BY_SLOT = ['boulevard', 'pier', 'boulevard'];

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function previewSize() {
  const { w, h } = SIZES[state.size];
  const long = 720;
  return w >= h ? { w: long, h: Math.round(long * h / w) } : { w: Math.round(long * w / h), h: long };
}

function redraw() {
  const { w, h } = previewSize();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  drawPoster(canvas.getContext('2d'), w, h, state, false);
}

function setStatus(text) {
  status.textContent = text;
}

// --- chip groups (size / layout / grade) ---------------------------------
function wireChips(id, attr, apply) {
  const group = document.getElementById(id);
  group.addEventListener('click', (e) => {
    const button = e.target.closest(`[data-${attr}]`);
    if (!button) return;
    group.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    button.classList.add('active');
    apply(button.dataset[attr]);
    redraw();
  });
}

wireChips('sizes', 'size', (v) => { state.size = v; });
wireChips('layouts', 'layout', (v) => {
  state.layout = v;
  state.selected = 0;
  buildPanelTabs();
  syncPanelEditor();
});
wireChips('grades', 'grade', (v) => { state.grade = v; });

// --- caption ---------------------------------------------------------------
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });

// --- photo slots -----------------------------------------------------------
const slotsBox = document.getElementById('slots');
['A', 'B', 'C'].forEach((letter, slot) => {
  const row = document.createElement('div');
  row.className = 'slot';
  row.innerHTML = `<b>${letter}</b><span class="name">No photo yet</span>`;
  const name = row.querySelector('.name');

  const pick = document.createElement('label');
  pick.textContent = 'Choose file';
  const file = document.createElement('input');
  file.type = 'file';
  file.accept = 'image/*';
  file.addEventListener('change', async () => {
    const chosen = file.files[0];
    if (!chosen) return;
    state.photos[slot] = await loadImage(URL.createObjectURL(chosen));
    state.photoNames[slot] = chosen.name;
    name.textContent = chosen.name;
    name.classList.add('loaded');
    redraw();
  });
  pick.append(file);
  row.append(pick);

  const sample = document.createElement('button');
  sample.type = 'button';
  sample.textContent = 'Sample';
  sample.addEventListener('click', async () => {
    state.photos[slot] = await loadImage(`samples/${SAMPLE_BY_SLOT[slot]}.jpg`);
    state.photoNames[slot] = `sample ${SAMPLE_BY_SLOT[slot]}.jpg`;
    name.textContent = state.photoNames[slot];
    name.classList.add('loaded');
    redraw();
  });
  row.append(sample);
  slotsBox.append(row);
});

document.getElementById('fillAllA').addEventListener('click', () => {
  fillAllPanels(state, 0);
  syncPanelEditor();
  redraw();
});
document.getElementById('spreadPhotos').addEventListener('click', () => {
  spreadPhotos(state);
  syncPanelEditor();
  redraw();
});

// --- panel crop editor -----------------------------------------------------
const panelTabs = document.getElementById('panelTabs');
const panelSlot = document.getElementById('panelSlot');
const zoomInput = document.getElementById('zoom');
const zoomValue = document.getElementById('zoomValue');

function buildPanelTabs() {
  panelTabs.replaceChildren();
  for (let i = 0; i < panelCount(state.layout); i++) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `chip${i === state.selected ? ' active' : ''}`;
    tab.textContent = `Panel ${i + 1}`;
    tab.addEventListener('click', () => {
      state.selected = i;
      buildPanelTabs();
      syncPanelEditor();
      redraw();
    });
    panelTabs.append(tab);
  }
}

function syncPanelEditor() {
  const crop = state.panels[state.selected];
  panelSlot.value = String(crop.slot);
  zoomInput.value = String(Math.round(crop.zoom * 100));
  zoomValue.textContent = `${Math.round(crop.zoom * 100)}%`;
}

panelSlot.addEventListener('change', () => {
  state.panels[state.selected].slot = Number(panelSlot.value);
  redraw();
});
zoomInput.addEventListener('input', () => {
  state.panels[state.selected].zoom = Number(zoomInput.value) / 100;
  zoomValue.textContent = `${zoomInput.value}%`;
  redraw();
});
document.getElementById('resetCrop').addEventListener('click', () => {
  resetPanelCrop(state, state.selected);
  syncPanelEditor();
  redraw();
});
document.getElementById('centerCrop').addEventListener('click', () => {
  const crop = state.panels[state.selected];
  crop.dx = 0;
  crop.dy = 0;
  redraw();
});

// --- drag to reposition, scroll to zoom ------------------------------------
function posterPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (canvas.width / rect.width),
    y: (e.clientY - rect.top) * (canvas.height / rect.height),
  };
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const p = posterPoint(e);
  const hit = hitPanel(state, canvas.width, canvas.height, p.x, p.y);
  if (hit < 0) return;
  if (hit !== state.selected) {
    state.selected = hit;
    buildPanelTabs();
    syncPanelEditor();
  }
  drag = { x: p.x, y: p.y };
  canvas.classList.add('dragging');
  canvas.setPointerCapture(e.pointerId);
  redraw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const p = posterPoint(e);
  const crop = state.panels[state.selected];
  const rects = layoutPanels(state.layout, canvas.width, canvas.height);
  const rect = rects[state.selected];
  crop.dx += (p.x - drag.x) / rect.w;
  crop.dy += (p.y - drag.y) / rect.h;
  crop.dx = Math.max(-1, Math.min(1, crop.dx));
  crop.dy = Math.max(-1, Math.min(1, crop.dy));
  drag = { x: p.x, y: p.y };
  redraw();
});
canvas.addEventListener('pointerup', () => {
  drag = null;
  canvas.classList.remove('dragging');
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const crop = state.panels[state.selected];
  crop.zoom = Math.max(0.5, Math.min(3, crop.zoom * Math.exp(-e.deltaY * 0.0012)));
  syncPanelEditor();
  redraw();
}, { passive: false });

// --- export ----------------------------------------------------------------
function drawExport(w, h) {
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  drawPoster(off.getContext('2d'), w, h, state, true);
  return off;
}

/** Draws the cover at W x H and resolves to its PNG data URL. */
window.__exportPNGDataURL = (w, h) => Promise.resolve(drawExport(w, h).toDataURL('image/png'));

function exportPNG(sizeKey) {
  const { w, h } = SIZES[sizeKey];
  drawExport(w, h).toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `vice-city-sunset-${w}x${h}.png`;
    a.click();
    setStatus(`Saved vice-city-sunset-${w}x${h}.png`);
  }, 'image/png');
}

document.getElementById('exportSquare').addEventListener('click', () => exportPNG('1080x1080'));
document.getElementById('exportPortrait').addEventListener('click', () => exportPNG('1080x1350'));
document.getElementById('exportWide').addEventListener('click', () => exportPNG('1920x1080'));

// --- shots -----------------------------------------------------------------
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, {
    setSize: (v) => {
      state.size = v;
      document.querySelectorAll('#sizes .chip').forEach((c) => c.classList.toggle('active', c.dataset.size === v));
    },
    setLayout: (v) => {
      state.layout = v;
      state.selected = 0;
      buildPanelTabs();
      document.querySelectorAll('#layouts .chip').forEach((c) => c.classList.toggle('active', c.dataset.layout === v));
    },
    setGrade: (v) => {
      state.grade = v;
      document.querySelectorAll('#grades .chip').forEach((c) => c.classList.toggle('active', c.dataset.grade === v));
    },
    setTitle: (v) => { state.title = v; titleInput.value = v; },
    setSubtitle: (v) => { state.subtitle = v; subtitleInput.value = v; },
    loadSamples: async (names) => {
      for (let i = 0; i < names.length; i++) {
        state.photos[i] = await loadImage(`samples/${names[i]}.jpg`);
        state.photoNames[i] = `sample ${names[i]}.jpg`;
      }
      document.querySelectorAll('.slot .name').forEach((el, i) => {
        if (state.photoNames[i]) {
          el.textContent = state.photoNames[i];
          el.classList.add('loaded');
        }
      });
    },
    spread: () => spreadPhotos(state),
    redraw,
  });
} else {
  buildPanelTabs();
  syncPanelEditor();
  redraw();
}
