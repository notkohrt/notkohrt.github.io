import { analyzeDeck, analyzePool, createDeckIndex, normalizeDeck, readDeckDocument, deckMarkdown, percent, MAX_DECK_SIZE, ANALYSIS_ASSUMPTIONS, SILENT_EXAMPLE } from './deck-analysis.mjs';
import { costText } from './card-facts.mjs';

const STORAGE_KEY = 'sts2-stars.deck.v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const colorName = value => String(value || 'shared').replace(/^./, char => char.toUpperCase());
const variantKey = entry => entry.id + '|' + entry.upgraded;

export function mountDeckLab({ nodes, edges, meta, onInspect, onTrace, onPause }) {
  const $ = id => document.getElementById(id);
  const dialog = $('deck-lab');
  const index = createDeckIndex(nodes, edges, meta);
  let deck = normalizeDeck(index), requestedDraws = 5, firstId = '', secondId = '', returnFocus = null, report;
  let poolFilter = null;
  let poolContext = '';
  const pools = new Map();
  const label = id => index.byId.get(id).name + ' (' + colorName(index.byId.get(id).color) + ')';
  const message = text => { $('deck-message').textContent = text; };

  const readDraft = draft => readDeckDocument(index, draft);

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const restored = readDraft(JSON.parse(saved));
      deck = restored.normalized; requestedDraws = restored.draws;
      [firstId = '', secondId = ''] = restored.combo;
      if (JSON.parse(saved).snapshot !== deck.snapshot) message('Saved deck loaded against this pinned snapshot. Review costs and mechanics after a data update.');
    }
  } catch (_) { message('Saved deck could not be restored. You can import a downloaded deck JSON.'); }

  const serializable = () => ({ ...deck, draws: requestedDraws, combo: [firstId, secondId] });
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable())); }
    catch (_) { $('deck-storage-help').textContent = 'This browser cannot save the deck locally. Download deck JSON to keep it.'; }
  }

  function refresh() {
    const size = deck.entries.reduce((sum, entry) => sum + entry.count, 0);
    const ids = new Set(deck.entries.map(entry => entry.id));
    if (!ids.has(firstId)) firstId = '';
    if (!ids.has(secondId)) secondId = '';
    report = analyzeDeck(index, deck, { draws: Math.min(requestedDraws, size), ...(firstId && secondId ? { firstId, secondId } : {}) });
    $('deck-size').textContent = '(' + size + ')';
    $('deck-draws').value = requestedDraws;
    $('deck-example').disabled = size > 0 || deck.relics.length > 0;
    $('deck-clear').disabled = size === 0 && deck.relics.length === 0;
    $('deck-save-note').disabled = size === 0 && deck.relics.length === 0;
    $('deck-cards').innerHTML = report.cardRows.length ? report.cardRows.map(entry => {
      const key = variantKey(entry), name = label(entry.id) + (entry.upgraded ? ' upgraded' : '');
      return '<li data-entry="' + escape(key) + '"><button type="button" class="deck-inspect" data-inspect="' + escape(entry.id) + '">' + escape(entry.name) + (entry.upgraded ? ' +' : '') + '<small>' + escape(colorName(entry.color)) + ' · ' + (entry.costs.unplayable ? 'Unplayable' : escape(costText(entry.costs.energy)) + ' Energy') + (entry.costs.stars !== undefined ? ' · ' + escape(costText(entry.costs.stars)) + ' Stars' : '') + '</small></button>' +
        '<div class="deck-entry-controls"><label>Copies<input class="deck-qty" type="number" min="0" max="99" value="' + entry.count + '" inputmode="numeric" aria-label="Copies of ' + escape(name) + '"></label>' +
        '<label class="deck-upgrade-label"><input type="checkbox" class="deck-upgrade" ' + (entry.upgraded ? 'checked ' : '') + 'aria-label="Upgraded ' + escape(label(entry.id)) + '">Upgraded</label>' +
        '<button type="button" class="icon-button" data-remove="' + escape(key) + '" aria-label="Remove ' + escape(name) + '">×</button></div></li>';
    }).join('') : '<li class="deck-help">Add cards above, or load the example.</li>';
    $('deck-relics').innerHTML = deck.relics.length ? deck.relics.map(id => '<li><button class="deck-inspect" type="button" data-inspect="' + escape(id) + '">' + escape(index.byId.get(id).name) + '</button><button class="icon-button" type="button" data-remove-relic="' + escape(id) + '" aria-label="Remove ' + escape(index.byId.get(id).name) + '">×</button></li>').join('') : '<li class="deck-help">None entered. Relics do not count as draw-pile cards.</li>';
    $('deck-overview').innerHTML = '<div class="deck-stats"><div><strong>' + size + '</strong><span>card copies</span></div><div><strong>' + report.odds.length + '</strong><span>distinct cards</span></div><div><strong>' + (report.costs.averageEnergy === null ? '—' : report.costs.averageEnergy.toFixed(2)) + '</strong><span>average fixed Energy<br>(' + report.costs.fixedEnergyCards + ' cards)</span></div><div><strong>' + report.costs.starCards + '</strong><span>cards with recorded<br>positive Star costs</span></div></div>';
    $('deck-curve').innerHTML = report.curve.map(([cost, copies]) => '<div class="deck-curve-row"><span>' + escape(cost) + '</span><meter min="0" max="' + size + '" value="' + copies + '" aria-label="' + escape(cost) + ' Energy: ' + copies + ' copies">' + copies + '</meter><strong>' + copies + '</strong></div>').join('') || '<p class="deck-help">Add cards to see their cost distribution.</p>';
    for (const [id, value, excluded] of [['deck-pair-first', firstId, secondId], ['deck-pair-second', secondId, firstId]]) {
      $(id).innerHTML = '<option value="">Choose a card</option>' + report.odds.filter(item => item.id !== excluded).map(item => '<option value="' + escape(item.id) + '">' + escape(label(item.id)) + ' ×' + item.copies + '</option>').join('');
      $(id).value = value;
    }
    $('deck-pair-result').textContent = report.combo ? percent(report.combo.probability) + ' chance of at least one of each in a ' + report.draws + '-card sample. Drawing the pair does not guarantee you can play it.' : 'Choose two different cards to measure drawing at least one of each.';
    $('deck-odds').innerHTML = report.odds.length ? '<table><caption>At least one copy in ' + report.draws + ' cards sampled from ' + size + '</caption><thead><tr><th scope="col">Card</th><th scope="col">Copies</th><th scope="col">Chance</th></tr></thead><tbody>' + report.odds.map(item => '<tr><th scope="row">' + escape(label(item.id)) + '</th><td>' + item.copies + '</td><td>' + percent(item.probability) + '</td></tr>').join('') + '</tbody></table>' : '<p class="deck-help">Enter your complete deck, including cards that are not combo pieces, to calculate meaningful odds.</p>';
    const roleSummary = items => {
      const cards = items.filter(item => item.type === 'card').reduce((sum, item) => sum + item.copies, 0);
      const relics = items.filter(item => item.type === 'relic').length;
      return [cards ? cards + ' card' + (cards === 1 ? '' : 's') : '', relics ? relics + ' relic' + (relics === 1 ? '' : 's') : ''].filter(Boolean).join(' + ') || 'none detected';
    };
    $('deck-mechanics').innerHTML = report.mechanics.map(profile => '<details class="deck-mechanic"><summary><strong>' + profile.label + '</strong><span>Enablers: ' + roleSummary(profile.enablers) + ' · Uses / payoffs: ' + roleSummary(profile.payoffs) + '</span></summary><div class="deck-role-columns">' + ['enablers', 'payoffs'].map(role => '<section><h5>' + (role === 'enablers' ? 'Enablers' : 'Uses / payoffs') + '</h5>' + (profile[role].map(item => '<details class="deck-evidence"><summary>' + escape(item.name) + ' ×' + item.copies + (item.type === 'relic' ? ' (relic)' : '') + '</summary>' + item.evidence.map(evidence => '<button type="button" class="deck-evidence-link" data-edge="' + escape(evidence.edgeId) + '" data-root="' + escape(item.id) + '">' + escape(evidence.relation) + ' → ' + escape(index.byId.get(evidence.target).name) + (evidence.path.length > 1 ? '<small>via granted ' + escape(index.byId.get(evidence.source).name) + ' power</small>' : '') + '</button>').join('') + '</details>').join('') || '<p class="deck-help">None detected among entered items.</p>') + '</section>').join('') + '</div></details>').join('') || '<p class="deck-help">Add cards or relics to explore supported mechanic roles.</p>';
    renderSearch();
  }

  function renderSearch() {
    $('deck-search-scope').textContent = poolFilter ? poolContext : '';
    const query = $('deck-search').value.trim().toLowerCase();
    const terms = query.split(/\s+/).filter(Boolean), color = $('deck-color').value;
    if (!terms.length && !poolFilter) { $('deck-search-results').innerHTML = '<p class="deck-help">Search all pinned cards and relics. Include tokens only if they are actually in your draw pile.</p>'; return; }
    const candidates = [...index.cards, ...index.relics].filter(node => (!poolFilter || poolFilter.has(node.id)) && (color === 'all' || node.color === color || node.color === 'shared') && terms.every(term => [node.name, node.color, node.rarity, node.cardType].join(' ').toLowerCase().includes(term)));
    candidates.sort((a, b) => Number(b.name.toLowerCase() === query) - Number(a.name.toLowerCase() === query) || a.name.localeCompare(b.name, 'en') || a.id.localeCompare(b.id, 'en'));
    $('deck-search-results').innerHTML = candidates.slice(0, 12).map(node => '<button type="button" class="deck-search-result" data-add="' + escape(node.id) + '" aria-label="Add ' + escape(label(node.id)) + '"><span>' + escape(node.name) + '</span><small>' + escape(colorName(node.color)) + ' · ' + (node.type === 'relic' ? 'Relic' : escape(node.cardType) + ' · ' + escape(node.rarity)) + '</small><span aria-hidden="true">+</span></button>').join('') + (candidates.length > 12 ? '<p class="deck-help">Showing 12 of ' + candidates.length + ' matches. Refine your search.</p>' : '') || '<p class="deck-help">No matching cards or relics.</p>';
  }

  function renderPool() {
    const color = $('deck-pool-color').value;
    if (!pools.has(color)) pools.set(color, analyzePool(index, color));
    const pool = pools.get(color);
    $('deck-pool-summary').textContent = pool.total + ' cards: ' + Object.entries(pool.rarities).map(([rarity, count]) => count + ' ' + rarity).join(' · ') + '. ' + pool.zeroEnergy + ' cost 0 Energy; ' + pool.zeroEnergyWithRecordedStars + ' of those have a recorded positive Star cost.';
    $('deck-pool-results').innerHTML = '<table><caption>Detected roles in the ' + escape(colorName(color)) + ' card pool</caption><thead><tr><th scope="col">Mechanic</th><th scope="col">Enablers</th><th scope="col">Uses / payoffs</th></tr></thead><tbody>' + pool.mechanics.map(profile => '<tr><th scope="row">' + profile.label + '</th>' + ['enablers', 'payoffs'].map(role => '<td><button type="button" class="ghost-button" data-pool-profile="' + profile.id + '" data-pool-role="' + role + '" ' + (!profile[role].length ? 'disabled ' : '') + 'aria-label="Find ' + profile.label + ' ' + role + ' in ' + escape(colorName(color)) + '">' + profile[role].length + '</button></td>').join('') + '</tr>').join('') + '</tbody></table>';
  }

  function commit(next, text = '') {
    try { deck = normalizeDeck(index, next); message(text); refresh(); persist(); return true; }
    catch (error) { message(error.message); return false; }
  }

  function add(id) {
    const node = index.byId.get(id);
    if (!node || !['card', 'relic'].includes(node.type)) return;
    const next = structuredClone(deck);
    if (node.type === 'relic') next.relics.push(id);
    else next.entries.push({ id, count: 1, upgraded: false });
    commit(next, node.name + ' added.');
  }

  function open(launcher = document.activeElement) {
    if (dialog.open) return;
    returnFocus = launcher;
    dialog.showModal(); refresh(); onPause(true);
    $('deck-search').focus({ preventScroll: true });
  }

  function download(filename, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('deck-meta').textContent = 'Pinned game data ' + (meta.game_data_version || 'unknown') + ' · source ' + String(meta.source_commit || '').slice(0, 7);
  $('deck-assumptions').innerHTML = ANALYSIS_ASSUMPTIONS.map(text => '<li>' + escape(text) + '</li>').join('');
  $('deck-color').innerHTML += [...new Set(index.cards.map(card => card.color))].sort().map(color => '<option value="' + escape(color) + '">' + escape(colorName(color)) + '</option>').join('');
  for (const id of ['deck-toggle', 'deck-note-open']) {
    $(id).disabled = false;
    $(id).addEventListener('click', event => open(event.currentTarget));
  }
  $('deck-close').addEventListener('click', () => dialog.close());
  $('deck-jump').addEventListener('click', () => {
    const target = $('deck-analysis-title');
    const offset = target.getBoundingClientRect().top - dialog.getBoundingClientRect().top - dialog.querySelector('.deck-lab-header').getBoundingClientRect().height - 12;
    dialog.scrollTo({ top: dialog.scrollTop + offset });
    target.focus({ preventScroll: true });
  });
  dialog.addEventListener('close', () => { onPause(false); if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true }); });
  $('deck-search').addEventListener('input', renderSearch);
  $('deck-color').addEventListener('change', renderSearch);
  $('deck-pool-color').addEventListener('change', () => { poolFilter = null; $('deck-pool-reset').classList.add('hidden'); renderPool(); renderSearch(); });
  $('deck-pool-results').addEventListener('click', event => {
    const button = event.target.closest('[data-pool-profile]'); if (!button) return;
    const profile = pools.get($('deck-pool-color').value).mechanics.find(item => item.id === button.dataset.poolProfile);
    poolFilter = new Set(profile[button.dataset.poolRole].map(item => item.id));
    poolContext = 'Filtered to ' + colorName($('deck-pool-color').value) + ' ' + profile.label + ' ' + button.dataset.poolRole + '.';
    $('deck-search').value = ''; $('deck-color').value = 'all';
    $('deck-pool-reset').classList.remove('hidden'); renderSearch();
    message('Showing ' + colorName($('deck-pool-color').value) + ' ' + profile.label + ' ' + button.dataset.poolRole + ' in the card picker.');
    $('deck-search').focus();
  });
  $('deck-pool-reset').addEventListener('click', () => { poolFilter = null; $('deck-pool-reset').classList.add('hidden'); renderSearch(); message('Mechanic search cleared.'); $('deck-search').focus(); });
  $('deck-search-results').addEventListener('click', event => {
    const button = event.target.closest('[data-add]');
    if (button) { const id = button.dataset.add; add(id); $('deck-search-results').querySelector('[data-add="' + CSS.escape(id) + '"]')?.focus({ preventScroll: true }); }
  });
  dialog.addEventListener('click', event => {
    const inspect = event.target.closest('[data-inspect]'), evidence = event.target.closest('[data-edge]');
    if (inspect) { returnFocus = null; dialog.close(); onInspect(inspect.dataset.inspect); }
    if (evidence) { returnFocus = null; dialog.close(); onTrace(evidence.dataset.edge, evidence.dataset.root); }
    const remove = event.target.closest('[data-remove]'), relic = event.target.closest('[data-remove-relic]');
    if (remove) { commit({ ...deck, entries: deck.entries.filter(entry => variantKey(entry) !== remove.dataset.remove) }, 'Card removed.'); $('deck-search').focus({ preventScroll: true }); }
    if (relic) { commit({ ...deck, relics: deck.relics.filter(id => id !== relic.dataset.removeRelic) }, 'Relic removed.'); $('deck-search').focus({ preventScroll: true }); }
  });
  $('deck-cards').addEventListener('change', event => {
    if (!event.target.matches('.deck-qty,.deck-upgrade')) return;
    const key = event.target.closest('[data-entry]').dataset.entry;
    const next = structuredClone(deck), entry = next.entries.find(item => variantKey(item) === key);
    const quantity = event.target.matches('.deck-qty');
    if (quantity) entry.count = event.target.value === '' ? NaN : Number(event.target.value);
    else entry.upgraded = event.target.checked;
    const newKey = variantKey(entry);
    if (!commit(next)) refresh();
    $('deck-cards').querySelector('[data-entry="' + CSS.escape(newKey) + '"] ' + (quantity ? '.deck-qty' : '.deck-upgrade'))?.focus({ preventScroll: true });
  });
  $('deck-draws').addEventListener('change', event => {
    const value = event.target.value === '' ? NaN : Number(event.target.value);
    if (!Number.isInteger(value) || value < 0 || value > MAX_DECK_SIZE) { message('Choose a whole sample size from 0 to ' + MAX_DECK_SIZE + '.'); event.target.value = requestedDraws; return; }
    requestedDraws = value; message(''); refresh(); persist();
  });
  for (const id of ['deck-pair-first', 'deck-pair-second']) $(id).addEventListener('change', () => {
    firstId = $('deck-pair-first').value; secondId = $('deck-pair-second').value;
    refresh(); persist();
  });
  $('deck-example').addEventListener('click', () => commit(SILENT_EXAMPLE, 'Example loaded: a hypothetical 20-card Silent deck.'));
  $('deck-clear').addEventListener('click', () => commit({ entries: [], relics: [] }, 'Deck cleared.'));
  $('deck-save-json').addEventListener('click', () => download('sts2-stars-deck.json', JSON.stringify(serializable(), null, 2) + '\n', 'application/json'));
  $('deck-save-note').addEventListener('click', () => download('STS2 Stars Deck Analysis.md', deckMarkdown(index, report), 'text/markdown;charset=utf-8'));
  $('deck-import').addEventListener('click', () => $('deck-import-file').click());
  $('deck-import-file').addEventListener('change', async event => {
    const file = event.target.files[0]; if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Deck JSON must be smaller than 1 MB.');
      const original = JSON.parse(await file.text()), incoming = readDraft(original);
      deck = incoming.normalized; requestedDraws = incoming.draws;
      [firstId = '', secondId = ''] = incoming.combo;
      refresh(); persist(); message(original.snapshot && original.snapshot !== deck.snapshot ? 'Deck imported against this snapshot. Review costs and mechanics after a data update.' : 'Deck imported.');
    } catch (error) { message('Import failed: ' + error.message); }
    event.target.value = '';
  });
  refresh(); renderPool();
  return { open, add, get isOpen() { return dialog.open; } };
}
