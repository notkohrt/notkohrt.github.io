import { RELATION_FAMILIES, relationFamily } from './graph-model.mjs';

const searchText = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

// Index visible mechanical edges, rather than searching endpoint descriptions:
// a text mention must never appear to be a new relationship.
export function indexRelations(edges, byId, direction) {
  return edges.flatMap(edge => {
    const node = byId.get(direction === 'incoming' ? edge.source : edge.target);
    if (!node) return [];
    const family = relationFamily(edge.relation);
    return [{
      edge, node, family,
      searchText: searchText([
        node.name, node.type, node.type + 's', node.color,
        edge.relation, RELATION_FAMILIES[family].label,
        edge.provenance === 'name-match' ? 'matched' : edge.provenance
      ].filter(Boolean).join(' '))
    }];
  });
}

export function selectRelations(index, { query = '', family = 'all', sort = 'name' } = {}) {
  const terms = searchText(query).trim().split(/\s+/u).filter(Boolean);
  const familyCounts = new Map();
  for (const item of index) familyCounts.set(item.family, (familyCounts.get(item.family) || 0) + 1);
  const byName = (a, b) => a.node.name.localeCompare(b.node.name) ||
    a.edge.relation.localeCompare(b.edge.relation) || a.edge.id.localeCompare(b.edge.id);
  const items = index.filter(item => (family === 'all' || item.family === family) &&
    terms.every(term => item.searchText.includes(term)));
  items.sort(sort === 'relation' ? (a, b) => a.edge.relation.localeCompare(b.edge.relation) || byName(a, b) : byName);
  return { items, familyCounts, total: index.length };
}
