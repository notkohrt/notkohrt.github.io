// A standalone preview embeds the same pinned files the HTTP site fetches.
let embeddedData;

export async function loadJson(path) {
  const embedded = document.getElementById('sts2-snapshot');
  if (embedded) {
    embeddedData ??= JSON.parse(embedded.textContent);
    if (!Object.hasOwn(embeddedData, path)) throw new Error('Missing embedded data: ' + path);
    return embeddedData[path];
  }
  const url = new URL('../' + path, import.meta.url);
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load ' + url.pathname);
  return res.json();
}
