// The archive stores cost upgrades as replacements and other numeric upgrades
// as deltas. Keep these interpretations shared by the inspector and exports.
export function costText(value) {
  if (value === -1) return 'X';
  return Number.isInteger(value) && value >= 0 ? String(value) : 'Unknown';
}

export function cardCosts(card, upgraded = false) {
  const upgrade = upgraded ? card.upgrade || {} : {};
  const energy = Object.hasOwn(upgrade, 'cost') ? upgrade.cost : card.cost;
  const stars = Object.hasOwn(upgrade, 'star_cost') ? upgrade.star_cost : card.starCost;
  const keywords = new Set(card.keywords || []);
  if (upgraded) {
    for (const word of upgrade.add_keywords || []) keywords.add(word);
    for (const word of upgrade.remove_keywords || []) keywords.delete(word);
  }
  return { energy, stars, keywords: [...keywords], unplayable: keywords.has('Unplayable') };
}

export function upgradeFacts(card) {
  return Object.entries(card.upgrade || {}).filter(([key]) => key !== 'description').map(([key, value]) => {
    let label = key.replace(/_/g, ' '), text;
    if (key === 'cost' || key === 'star_cost') {
      label = key === 'cost' ? 'Energy cost' : 'Star cost';
      text = costText(key === 'cost' ? card.cost : card.starCost) + ' → ' + costText(value);
    } else if (typeof value === 'number') text = value > 0 ? '+' + value : String(value);
    else text = Array.isArray(value) ? value.join(', ') : String(value);
    return { label, text };
  });
}
