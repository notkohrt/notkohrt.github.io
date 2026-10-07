// Keep parallel and reciprocal mechanical relationships visually distinct.
// Lanes use the same orientation for both directions of an unordered pair.
function groupEdges(edges) {
  const pairs = new Map();
  for (const edge of edges) {
    const key = JSON.stringify([edge.source, edge.target].sort());
    if (!pairs.has(key)) pairs.set(key, []);
    pairs.get(key).push(edge);
  }
  return pairs;
}

export function uniqueLayoutLinks(edges) {
  return [...groupEdges(edges).keys()].sort().map(key => {
    const [source, target] = JSON.parse(key);
    return { source, target };
  });
}

export function assignEdgeLanes(edges) {
  const lanes = new Map();
  const pairs = groupEdges(edges);
  for (const group of pairs.values()) {
    const sorted = [...group].sort((a, b) => a.id.localeCompare(b.id));
    sorted.forEach((edge, index) => {
      const canonicalOffset = (index - (sorted.length - 1) / 2) * 22;
      lanes.set(edge.id, edge.source < edge.target ? canonicalOffset : -canonicalOffset);
    });
  }
  return lanes;
}

export function edgeGeometry(source, target, lane = 0) {
  if (![source?.x, source?.y, target?.x, target?.y, lane].every(Number.isFinite)) return null;
  const dx = target.x - source.x, dy = target.y - source.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return null;
  const offset = Math.sign(lane) * Math.min(Math.abs(lane), distance * 0.35);
  const control = {
    x: (source.x + target.x) / 2 - dy / distance * offset,
    y: (source.y + target.y) / 2 + dx / distance * offset
  };
  const startLength = Math.hypot(control.x - source.x, control.y - source.y);
  const endLength = Math.hypot(target.x - control.x, target.y - control.y);
  const startClip = Math.min((source.radius || 4) + 1, distance * 0.25);
  const endClip = Math.min((target.radius || 4) + 2, distance * 0.3);
  const start = {
    x: source.x + (control.x - source.x) / startLength * startClip,
    y: source.y + (control.y - source.y) / startLength * startClip
  };
  const end = {
    x: target.x - (target.x - control.x) / endLength * endClip,
    y: target.y - (target.y - control.y) / endLength * endClip
  };
  const tangentLength = Math.hypot(end.x - control.x, end.y - control.y);
  return {
    start, control, end,
    tangent: { x: (end.x - control.x) / tangentLength, y: (end.y - control.y) / tangentLength },
    midpoint: { x: start.x / 4 + control.x / 2 + end.x / 4, y: start.y / 4 + control.y / 2 + end.y / 4 }
  };
}
