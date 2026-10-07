import { loadSnapshot } from './load-snapshot.mjs';
import { validateModel } from '../lib/validate-model.mjs';
import { relationFamily } from '../lib/graph-model.mjs';

const snapshot = await loadSnapshot();
const { errors, unresolvedCardPowers, nodes, edges } = validateModel(snapshot);
const countBy = (items, key) => items.reduce((counts, item) => {
  const value = key(item);
  counts[value] = (counts[value] || 0) + 1;
  return counts;
}, {});

if (errors.length) {
  console.error('Graph validation failed:\n' + errors.join('\n'));
  process.exitCode = 1;
}
console.log(JSON.stringify({
  snapshot: snapshot.meta,
  entities: countBy(nodes, node => node.type),
  cards_by_color: countBy(nodes.filter(node => node.type === 'card'), node => node.color),
  graph_endpoint_ids: nodes.length,
  relationships: edges.length,
  relationships_by_source_type: countBy(edges, edge => edge.source.split(':')[0]),
  relationships_by_family: countBy(edges, edge => relationFamily(edge.relation)),
  manual_links: snapshot.manualLinks.length,
  unresolved_card_power_mappings: unresolvedCardPowers,
  status: errors.length ? 'failed' : 'ok'
}, null, 2));
