// Draws the poster: photo panels in the chosen layout, a Vice City sunset or
// neon grade, halftone and vignette, and the bold caption lettering. The same
// function paints the live preview and the exported PNG, so what you see is
// what the file holds.

import { layoutPanels, panelCount } from './state.js';

// Each grade: the wash laid over the photos, the photo filter, the glow of
// its setting sun, the accent behind the subtitle pill and the title shadow.
const GRADES = {
  sunset: {
    wash: ['rgba(255, 122, 26, 0.20)', 'rgba(255, 46, 136, 0.38)'],
    washBlend: 'overlay',
    photoFilter: 'saturate(1.25) contrast(1.08)',
    sun: { color: 'rgba(255, 190, 90, 0.85)', alpha: 0.55 },
    accent: '#ff2e88',
    titleShadow: 'rgba(255, 46, 136, 0.9)',
  },
  neon: {
    wash: ['rgba(25, 227, 214, 0.22)', 'rgba(176, 77, 255, 0.42)'],
    washBlend: 'overlay',
    photoFilter: 'saturate(1.45) contrast(1.12)',
    sun: { color: 'rgba(25, 227, 214, 0.7)', alpha: 0.4 },
    accent: '#19e3d6',
    titleShadow: 'rgba(25, 227, 214, 0.9)',
  },
  gold: {
    wash: ['rgba(255, 194, 51, 0.26)', 'rgba(255, 90, 26, 0.34)'],
    washBlend: 'soft-light',
    photoFilter: 'saturate(1.3) contrast(1.05) sepia(0.18)',
    sun: { color: 'rgba(255, 214, 120, 0.9)', alpha: 0.7 },
    accent: '#ffc233',
    titleShadow: 'rgba(255, 122, 26, 0.9)',
  },
  noir: {
    wash: ['rgba(255, 255, 255, 0.05)', 'rgba(0, 0, 0, 0.45)'],
    washBlend: 'overlay',
    photoFilter: 'saturate(0.12) contrast(1.35) brightness(1.05)',
    sun: null,
    accent: '#f4eef7',
    titleShadow: 'rgba(0, 0, 0, 0.95)',
  },
};

let halftonePattern = null;
function halftone(ctx) {
  if (!halftonePattern) {
    const dot = document.createElement('canvas');
    dot.width = 9;
    dot.height = 9;
    const d = dot.getContext('2d');
    d.fillStyle = 'rgba(0, 0, 0, 0.55)';
    d.beginPath();
    d.arc(4.5, 4.5, 1.7, 0, Math.PI * 2);
    d.fill();
    halftonePattern = ctx.createPattern(dot, 'repeat');
  }
  return halftonePattern;
}

/** Cover-fit draw of one photo inside a panel rect, with the panel's crop. */
function drawPanelPhoto(ctx, photo, rect, crop) {
  if (!photo) return;
  const { x, y, w, h } = rect;
  const base = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
  const scale = base * crop.zoom;
  const pw = photo.naturalWidth * scale;
  const ph = photo.naturalHeight * scale;
  const cx = x + w / 2 + crop.dx * w;
  const cy = y + h / 2 + crop.dy * h;
  ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
}

function fitTitleSize(ctx, text, maxWidth, startSize) {
  let size = startSize;
  ctx.font = `900 ${size}px "Arial Black", "Archivo Black", system-ui, sans-serif`;
  while (size > 20 && ctx.measureText(text).width > maxWidth) {
    size -= 4;
    ctx.font = `900 ${size}px "Arial Black", "Archivo Black", system-ui, sans-serif`;
  }
  return size;
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Paints the whole poster onto `ctx` at W x H from `state`.
 * `forExport` skips the editor's selection outline.
 */
export function drawPoster(ctx, w, h, state, forExport = false) {
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const rects = layoutPanels(state.layout, w, h);
  const n = panelCount(state.layout);
  const s = Math.min(w, h) / 1080; // scale: 1 at 1080 on the short side

  ctx.save();
  ctx.fillStyle = '#12081c';
  ctx.fillRect(0, 0, w, h);

  // Photos, one per panel.
  for (let i = 0; i < n; i++) {
    const rect = rects[i];
    const photo = state.photos[state.panels[i].slot];
    ctx.save();
    ctx.beginPath();
    ctx.rect(rect.x, rect.y, rect.w, rect.h);
    ctx.clip();
    if (photo) {
      ctx.filter = grade.photoFilter;
      drawPanelPhoto(ctx, photo, rect, state.panels[i]);
      ctx.filter = 'none';
    } else {
      const g = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
      g.addColorStop(0, '#3a1c52');
      g.addColorStop(1, '#1c0f2a');
      ctx.fillStyle = g;
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    }
    ctx.restore();
  }

  // The setting sun: a soft disc glowing through the hero panel.
  if (grade.sun) {
    const hero = rects[0];
    const r = Math.min(hero.w, hero.h) * 0.22;
    const sx = hero.x + hero.w * 0.68;
    const sy = hero.y + hero.h * 0.26;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = grade.sun.alpha;
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 2.4);
    glow.addColorStop(0, grade.sun.color);
    glow.addColorStop(1, 'rgba(255, 120, 60, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sx - r * 2.4, sy - r * 2.4, r * 4.8, r * 4.8);
    ctx.restore();
  }

  // The grade wash: sunset or neon light falling from the top to the foot.
  ctx.save();
  ctx.globalCompositeOperation = grade.washBlend;
  const wash = ctx.createLinearGradient(0, 0, 0, h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(0.55, 'rgba(0, 0, 0, 0)');
  wash.addColorStop(1, grade.wash[1]);
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Halftone dots and a vignette, the printed-poster feel.
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = halftone(ctx);
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  const vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.42, w / 2, h / 2, Math.max(w, h) * 0.78);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(1, 'rgba(10, 2, 18, 0.5)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);

  // Thin bright seams between the panels.
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = Math.max(2, 2 * s);
  for (const r of rects) ctx.strokeRect(r.x, r.y, r.w, r.h);
  ctx.restore();

  // Caption band: a dark gradient foot the lettering sits on.
  const bandH = h * 0.24;
  const band = ctx.createLinearGradient(0, h - bandH, 0, h);
  band.addColorStop(0, 'rgba(12, 4, 20, 0)');
  band.addColorStop(0.45, 'rgba(12, 4, 20, 0.72)');
  band.addColorStop(1, 'rgba(12, 4, 20, 0.92)');
  ctx.fillStyle = band;
  ctx.fillRect(0, h - bandH, w, bandH);

  const pad = w * 0.045;
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();

  // Subtitle pill above the title.
  if (subtitle) {
    const pillH = 44 * s;
    ctx.font = `800 ${Math.round(26 * s)}px system-ui, sans-serif`;
    try { ctx.letterSpacing = `${Math.round(6 * s)}px`; } catch { /* older canvas */ }
    const tw = ctx.measureText(subtitle).width;
    const pillW = tw + 34 * s;
    const pillY = h - bandH + 26 * s;
    ctx.fillStyle = grade.accent;
    roundRectPath(ctx, pad, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.fillStyle = state.grade === 'noir' ? '#12081c' : '#160818';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(subtitle, pad + 17 * s, pillY + pillH / 2 + 1);
    try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
  }

  // The big title: heavy capitals, dark outline, neon drop shadow. The fit
  // leaves room for the outline stroke on both sides.
  if (title) {
    const size = fitTitleSize(ctx, title, (w - pad * 2) * 0.94, Math.round(112 * s));
    ctx.font = `900 ${size}px "Arial Black", "Archivo Black", system-ui, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#160818';
    ctx.lineWidth = Math.max(6, size * 0.09);
    ctx.shadowColor = grade.titleShadow;
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = size * 0.045;
    const ty = h - pad * 0.9;
    ctx.strokeText(title, pad, ty);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, pad, ty);
  }

  // Editor-only: outline the selected panel so the crop target is clear.
  if (!forExport) {
    const r = rects[state.selected];
    if (r) {
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = Math.max(3, 3 * s);
      ctx.setLineDash([18 * s, 10 * s]);
      ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(18, 8, 28, 0.85)';
      const label = `PANEL ${state.selected + 1}`;
      ctx.font = `800 ${Math.round(22 * s)}px system-ui, sans-serif`;
      const lw = ctx.measureText(label).width + 22 * s;
      roundRectPath(ctx, r.x + 10 * s, r.y + 10 * s, lw, 36 * s, 18 * s);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, r.x + 21 * s, r.y + 28 * s);
      ctx.restore();
    }
  }

  ctx.restore();
}
