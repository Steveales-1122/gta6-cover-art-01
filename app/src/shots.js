// Fixed scenes for screenshots: ?shot=cover shows the cover alone, ?shot=editor
// the editor with a sample photo loaded, ?shot=export loads a scene and leaves
// the export ready for the screenshot driver. `photo`, `photo2` and `photo3`
// pick the samples (samples/<name>.jpg); `caption` sets the title, `layout`,
// `grade` and `size` the rest. window.__shotReady is set once painted, and
// window.__shotSize holds the scene's export size.
export async function runShot(shot, query, api) {
  const title = query.get('caption') ?? 'Sunset Heist';
  const size = query.get('size') ?? '1080x1080';
  api.setSize(size);
  api.setLayout(query.get('layout') ?? 'hero');
  api.setGrade(query.get('grade') ?? 'sunset');
  api.setTitle(title);
  if (query.get('subtitle')) api.setSubtitle(query.get('subtitle'));

  const names = [query.get('photo') ?? 'pier', query.get('photo2'), query.get('photo3')]
    .filter(Boolean);
  await api.loadSamples(names);
  api.spread();
  if (shot === 'cover' || shot === 'export') document.body.classList.add('shot-cover');
  api.redraw();
  const [w, h] = size.split('x').map(Number);
  window.__shotSize = { w, h };
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
