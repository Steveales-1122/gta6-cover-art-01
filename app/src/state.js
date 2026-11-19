// The cover's state: size, layout, grade, caption, three photo slots and one
// crop (photo slot, zoom, offset) per panel. Offsets are fractions of the
// panel's own width/height, so a crop survives a change of export size.

export const SIZES = {
  '1080x1080': { w: 1080, h: 1080, label: 'Square' },
  '1080x1350': { w: 1080, h: 1350, label: 'Portrait' },
  '1920x1080': { w: 1920, h: 1080, label: 'Wide' },
};

export const LAYOUTS = ['hero', 'triptych', 'quad', 'strip'];
export const GRADES = ['sunset', 'neon', 'gold', 'noir'];

/** A fresh cover state with the default caption and no photos yet. */
export function createCoverState() {
  return {
    size: '1080x1080',
    layout: 'hero',
    grade: 'sunset',
    title: 'SUNSET HEIST',
    subtitle: 'VICE CITY',
    photos: [null, null, null],
    photoNames: ['', '', ''],
    panels: [
      { slot: 0, zoom: 1, dx: 0, dy: 0 },
      { slot: 0, zoom: 1, dx: 0, dy: 0 },
      { slot: 0, zoom: 1, dx: 0, dy: 0 },
      { slot: 0, zoom: 1, dx: 0, dy: 0 },
    ],
    selected: 0,
  };
}

/** How many panels a layout shows. */
export function panelCount(layout) {
  return layout === 'quad' ? 4 : 3;
}

/**
 * Panel rectangles for a layout inside a W x H poster. Gutters are a
 * fraction of the short side, so the collage keeps its proportions at any
 * export size. Returns [{x, y, w, h}] in poster pixels.
 */
export function layoutPanels(layout, w, h) {
  const g = Math.round(Math.min(w, h) * 0.018);
  const full = { x: 0, y: 0, w, h };
  if (layout === 'triptych') {
    const pw = (w - 2 * g) / 3;
    return [0, 1, 2].map((i) => ({ x: i * (pw + g), y: 0, w: pw, h }));
  }
  if (layout === 'quad') {
    const pw = (w - g) / 2;
    const ph = (h - g) / 2;
    return [
      { x: 0, y: 0, w: pw, h: ph },
      { x: pw + g, y: 0, w: pw, h: ph },
      { x: 0, y: ph + g, w: pw, h: ph },
      { x: pw + g, y: ph + g, w: pw, h: ph },
    ];
  }
  if (layout === 'strip') {
    const topH = Math.round(h * 0.58);
    const botH = h - topH - g;
    const pw = (w - g) / 2;
    return [
      { x: 0, y: 0, w, h: topH },
      { x: 0, y: topH + g, w: pw, h: botH },
      { x: pw + g, y: topH + g, w: pw, h: botH },
    ];
  }
  // hero: one tall hero panel on the left, two stacked panels on the right.
  const heroW = Math.round(w * 0.62);
  const sideW = w - heroW - g;
  const sideH = (h - g) / 2;
  return [
    { x: 0, y: 0, w: heroW, h },
    { x: heroW + g, y: 0, w: sideW, h: sideH },
    { x: heroW + g, y: sideH + g, w: sideW, h: sideH },
  ];
}

/** The panel rectangle at index i, or null when the layout has no such panel. */
export function panelRect(state, w, h, i) {
  const rects = layoutPanels(state.layout, w, h);
  return rects[i] ?? null;
}

/** Point (in poster pixels) inside panel i, or -1. */
export function hitPanel(state, w, h, px, py) {
  const rects = layoutPanels(state.layout, w, h);
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return i;
  }
  return -1;
}

/** Give every visible panel the same photo slot. */
export function fillAllPanels(state, slot) {
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) state.panels[i].slot = slot;
}

/** Spread the loaded photo slots across the visible panels, in order. */
export function spreadPhotos(state) {
  const loaded = state.photos.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  if (!loaded.length) return;
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) state.panels[i].slot = loaded[i % loaded.length];
}

/** Reset one panel's crop to a centred, cover-fit photo. */
export function resetPanelCrop(state, i) {
  state.panels[i] = { ...state.panels[i], zoom: 1, dx: 0, dy: 0 };
}
