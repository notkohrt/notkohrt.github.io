import { SOURCES, SOURCE_META_URL, ONTOLOGY_EDGES, SEMANTIC_OVERRIDES, normalizeData, buildEdges, createNodePaths, isMechanicalRelation } from './graph-model.mjs';

export function validateModel({ raw, meta, manualLinks }) {
  const errors = [];
  const unresolvedCardPowers = [];
  for (const [key, file] of Object.entries(SOURCES)) {
    if (!/^data\/sts2\/[a-z_]+\.json$/.test(file)) errors.push('Unpinned data source: ' + file);
    if (!['mechanics', 'cardPowers'].includes(key) && (!Array.isArray(raw[key]) || !raw[key].length)) {
      errors.push('Missing or empty entity array: ' + key);
    } else if (Array.isArray(raw[key])) {
      for (const entity of raw[key]) {
        if (!entity || typeof entity.id !== 'string' || !entity.id ||
            (key === 'keyword' ? !Array.isArray(entity.names) || !entity.names[0] : typeof entity.name !== 'string' || !entity.name)) {
          errors.push('Invalid entity ID/name in: ' + key);
        }
      }
    }
  }
  for (const group of ['core_concepts', 'orbs', 'character_mechanics']) {
    if (!Array.isArray(raw.mechanics?.[group])) errors.push('Missing mechanic group: ' + group);
  }
  if (!raw.cardPowers || typeof raw.cardPowers !== 'object' || Array.isArray(raw.cardPowers)) errors.push('Invalid card/power mapping');
  if (!Array.isArray(manualLinks)) errors.push('Manual links must be an array');
  if (SOURCE_META_URL !== 'data/sts2/meta.json') errors.push('Unpinned snapshot metadata source');
  if (!/^[0-9a-f]{40}$/.test(meta?.source_commit || '')) errors.push('Snapshot source_commit must be a full commit SHA');
  if (meta?.source_repository !== 'nkhoit/spire-archive' || meta?.source_path !== 'data/sts2') errors.push('Unexpected snapshot source');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta?.snapshot_date || '') || !meta?.game_data_version) errors.push('Missing snapshot date/version');
  if (errors.length) return { errors, unresolvedCardPowers, nodes: [], edges: [] };

  const nodes = normalizeData(raw);
  const ids = new Set();
  for (const node of nodes) {
    if (!node.sourceId || !node.name) errors.push('Missing entity ID/name: ' + node.id);
    if (ids.has(node.id)) errors.push('Duplicate node: ' + node.id);
    ids.add(node.id);
  }
  const paths = createNodePaths(nodes);
  if (new Set(paths.values()).size !== nodes.length) errors.push('Colliding vault note paths');

  const checkEndpoints = (source, target, label) => {
    if (!ids.has(source)) errors.push(label + ' missing source: ' + source);
    if (!ids.has(target)) errors.push(label + ' missing target: ' + target);
    if (source === target) errors.push(label + ' self edge: ' + source);
  };
  for (const [source, target] of [...ONTOLOGY_EDGES, ...SEMANTIC_OVERRIDES]) checkEndpoints(source, target, 'Semantic rule');
  for (const [card, powers] of Object.entries(raw.cardPowers)) {
    if (!Array.isArray(powers)) { errors.push('Invalid power list: ' + card); continue; }
    for (const power of powers) {
      if (!power?.id || typeof power.id !== 'string') { errors.push('Invalid mapped power: ' + card); continue; }
      const source = 'card:' + card, target = 'power:' + power.id;
      // Some IDs in the pinned upstream map are absent from its entity lists.
      // Report these hints separately; they must never become dangling edges.
      if (!ids.has(source) || !ids.has(target)) unresolvedCardPowers.push({ source, target });
    }
  }
  for (const link of manualLinks) {
    if (!link || typeof link !== 'object') { errors.push('Invalid manual link'); continue; }
    checkEndpoints(link.source, link.target, 'Manual link');
    if (!isMechanicalRelation(link.relation)) errors.push('Manual link needs a mechanical relation: ' + link.source);
  }
  if (errors.length) return { errors, unresolvedCardPowers, nodes, edges: [] };

  const edges = buildEdges(nodes, manualLinks, raw.cardPowers);
  const edgeIds = new Set();
  for (const edge of edges) {
    checkEndpoints(edge.source, edge.target, 'Emitted edge');
    if (edgeIds.has(edge.id)) errors.push('Duplicate edge: ' + edge.id);
    edgeIds.add(edge.id);
    if (!isMechanicalRelation(edge.relation)) errors.push('Low-signal edge: ' + edge.id);
    if (edge.target === 'effect:DAMAGE' && edge.relation === 'deals damage') errors.push('Plain damage hub: ' + edge.id);
    if (edge.target === 'effect:PLAY_CARD' && edge.relation === 'plays cards') errors.push('Plain play hub: ' + edge.id);
  }
  return { errors, unresolvedCardPowers, nodes, edges };
}
