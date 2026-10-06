(() => {
  const SOURCES = {
    card: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/cards.json',
    relic: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/relics.json',
    power: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/powers.json',
    potion: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/potions.json',
    enchantment: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/enchantments.json',
    keyword: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/keywords.json'
  };

  const TYPE_COLORS = {
    card: '#8b83d6',
    relic: '#c19a63',
    power: '#a276bd',
    potion: '#65a7a1',
    enchantment: '#c9829f',
    keyword: '#7f9a72'
  };

  const TYPE_LABELS = {
    card: 'Cards',
    relic: 'Relics',
    power: 'Powers',
    potion: 'Potions',
    enchantment: 'Enchantments',
    keyword: 'Keywords'
  };

  const TYPE_FOLDERS = {
    card: 'Cards',
    relic: 'Relics',
    power: 'Powers',
    potion: 'Potions',
    enchantment: 'Enchantments',
    keyword: 'Keywords'
  };

  const state = {
    nodes: [],
    edges: [],
    cy: null,
    focusedId: null,
    viewMode: 'global',
    depth: 1,
    visibleTypes: new Set(Object.keys(TYPE_LABELS)),
    outAdj: new Map(),
    inAdj: new Map(),
    paletteIndex: 0,
    paletteMatches: [],
    layoutTimer: null
  };

  const $ = id => document.getElementById(id);
  const norm = s => String(s == null ? '' : s).toLowerCase().trim();
  const slug = s => String(s == null ? '' : s).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
  const nodeId = (type, id) => type + ':' + id;
  const htmlEsc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  async function loadJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load ' + url);
    return res.json();
  }

  async function loadOptionalJson(url, fallback) {
    try {
      return await loadJson(url);
    } catch (_) {
      return fallback;
    }
  }

  function normalizeData(raw) {
    const nodes = [];

    for (const card of raw.card) {
      nodes.push({
        id: nodeId('card', card.id),
        sourceId: card.id,
        type: 'card',
        name: card.name,
        description: card.description || '',
        color: card.color || 'unknown',
        rarity: card.rarity || '',
        cardType: card.type || '',
        cost: card.cost,
        keywords: card.keywords || [],
        tags: card.tags || []
      });
    }

    for (const relic of raw.relic) {
      nodes.push({
        id: nodeId('relic', relic.id),
        sourceId: relic.id,
        type: 'relic',
        name: relic.name,
        description: relic.description || '',
        color: relic.color || 'shared',
        rarity: relic.tier || ''
      });
    }

    for (const power of raw.power) {
      nodes.push({
        id: nodeId('power', power.id),
        sourceId: power.id,
        type: 'power',
        name: power.name,
        description: power.description || '',
        rarity: power.type || '',
        stackable: power.stackable
      });
    }

    for (const potion of raw.potion) {
      nodes.push({
        id: nodeId('potion', potion.id),
        sourceId: potion.id,
        type: 'potion',
        name: potion.name,
        description: potion.description || '',
        rarity: potion.rarity || '',
        color: potion.color || ''
      });
    }

    for (const ench of raw.enchantment) {
      nodes.push({
        id: nodeId('enchantment', ench.id),
        sourceId: ench.id,
        type: 'enchantment',
        name: ench.name,
        description: ench.description || '',
        rarity: ench.rarity || ''
      });
    }

    for (const kw of raw.keyword) {
      nodes.push({
        id: nodeId('keyword', kw.id),
        sourceId: kw.id,
        type: 'keyword',
        name: (kw.names && kw.names[0]) || kw.id,
        description: kw.description || ''
      });
    }

    return nodes;
  }

  function containsEntityName(text, name) {
    const hay = norm(text);
    const needle = norm(name);
    if (!hay || !needle || needle.length < 4) return false;

    let from = 0;
    while (from < hay.length) {
      const at = hay.indexOf(needle, from);
      if (at === -1) return false;

      const before = at === 0 ? '' : hay[at - 1];
      const afterPos = at + needle.length;
      const after = afterPos >= hay.length ? '' : hay[afterPos];
      const word = /[a-z0-9]/;

      if ((!before || !word.test(before)) && (!after || !word.test(after))) return true;
      from = at + needle.length;
    }

    return false;
  }

  function inferRelation(text, targetName) {
    const t = norm(text);
    const n = norm(targetName);
    const index = t.indexOf(n);
    const around = index >= 0 ? t.slice(Math.max(0, index - 58), index + n.length + 58) : t;

    if (/add|create|put .* hand|shuffle|transform/.test(around)) return 'creates / moves';
    if (/gain|apply|channel|inflict/.test(around)) return 'grants / applies';
    if (/deal|damage|increase|additional/.test(around)) return 'modifies';
    if (/whenever|when |if |start of|end of/.test(around)) return 'references / triggers';
    return 'references';
  }

  function buildEdges(nodes, manualLinks) {
    const edges = [];
    const edgeIds = new Set();
    const byId = new Map(nodes.map(n => [n.id, n]));
    const cards = nodes.filter(n => n.type === 'card');
    const powers = nodes.filter(n => n.type === 'power');
    const candidates = nodes.filter(n => n.type !== 'keyword' && n.name && n.name.length >= 4);

    const pushEdge = (source, target, relation, provenance, note) => {
      if (!byId.has(source) || !byId.has(target) || source === target) return;
      const id = source + '|' + target + '|' + relation;
      if (edgeIds.has(id)) return;
      edgeIds.add(id);
      edges.push({
        id,
        source,
        target,
        relation,
        provenance: provenance || 'description',
        note: note || ''
      });
    };

    for (const card of cards) {
      for (const kw of card.keywords || []) {
        const target = nodeId('keyword', slug(kw));
        if (byId.has(target)) pushEdge(card.id, target, 'has keyword', 'explicit');
      }
    }

    for (const source of nodes) {
      const text = source.description || '';
      if (!text) continue;

      for (const target of candidates) {
        if (target.id === source.id) continue;
        if (containsEntityName(text, target.name)) {
          pushEdge(source.id, target.id, inferRelation(text, target.name), 'description');
        }
      }
    }

    for (const card of cards) {
      for (const power of powers) {
        const base = power.name.replace(/\s+Power$/i, '');
        if (norm(card.name) === norm(base)) {
          pushEdge(card.id, power.id, 'grants', 'name-match');
        }
      }
    }

    for (const link of manualLinks || []) {
      pushEdge(link.source, link.target, link.relation || 'related', 'curated', link.note || '');
    }

    return edges;
  }

  function buildAdjacency() {
    state.outAdj = new Map();
    state.inAdj = new Map();

    for (const node of state.nodes) {
      state.outAdj.set(node.id, []);
      state.inAdj.set(node.id, []);
    }

    for (const edge of state.edges) {
      if (state.outAdj.has(edge.source)) state.outAdj.get(edge.source).push(edge);
      if (state.inAdj.has(edge.target)) state.inAdj.get(edge.target).push(edge);
    }

    for (const node of state.nodes) {
      const degree = (state.outAdj.get(node.id) || []).length + (state.inAdj.get(node.id) || []).length;
      node.degree = degree;
      node.weight = Math.max(1, Math.min(28, degree + 1));
    }
  }

  function graphElements() {
    return [
      ...state.nodes.map(n => ({
        data: Object.assign({}, n, {
          label: n.name,
          color: TYPE_COLORS[n.type]
        })
      })),
      ...state.edges.map(e => ({ data: e }))
    ];
  }

  function initGraph() {
    state.cy = cytoscape({
      container: $('cy'),
      elements: graphElements(),
      minZoom: 0.12,
      maxZoom: 2.8,
      wheelSensitivity: 0.18,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#c9c9c9',
            'font-size': 9,
            'min-zoomed-font-size': 8,
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'text-outline-width': 2,
            'text-outline-color': '#1e1e1e',
            'width': 'mapData(weight, 1, 28, 8, 26)',
            'height': 'mapData(weight, 1, 28, 8, 26)',
            'border-width': 1,
            'border-color': '#171717',
            'opacity': 0.82
          }
        },
        {
          selector: 'node[type = "relic"]',
          style: { 'shape': 'diamond' }
        },
        {
          selector: 'node[type = "keyword"]',
          style: { 'shape': 'round-rectangle', 'height': 9 }
        },
        {
          selector: 'edge',
          style: {
            'width': 0.7,
            'line-color': '#525252',
            'target-arrow-color': '#525252',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.55,
            'opacity': 0.28
          }
        },
        {
          selector: 'edge[provenance = "description"]',
          style: { 'line-style': 'dotted', 'opacity': 0.2 }
        },
        {
          selector: 'edge[provenance = "curated"]',
          style: {
            'line-color': '#8a79f2',
            'target-arrow-color': '#8a79f2',
            'width': 1.3,
            'opacity': 0.7
          }
        },
        {
          selector: '.dimmed',
          style: { 'opacity': 0.07, 'text-opacity': 0 }
        },
        {
          selector: '.neighbor',
          style: { 'opacity': 0.95, 'text-opacity': 1 }
        },
        {
          selector: 'edge.neighbor',
          style: {
            'opacity': 0.75,
            'width': 1.15,
            'line-color': '#777184',
            'target-arrow-color': '#777184'
          }
        },
        {
          selector: '.focused',
          style: {
            'opacity': 1,
            'text-opacity': 1,
            'border-width': 2.5,
            'border-color': '#b5a9ff',
            'width': 27,
            'height': 27,
            'font-size': 11,
            'z-index': 99
          }
        },
        {
          selector: '.hovered',
          style: {
            'opacity': 1,
            'text-opacity': 1,
            'border-width': 2,
            'border-color': '#8f83df',
            'z-index': 90
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: false,
        randomize: true,
        componentSpacing: 52,
        nodeRepulsion: 7200,
        idealEdgeLength: 70,
        edgeElasticity: 0.13,
        gravity: 0.12,
        numIter: 520
      }
    });

    state.cy.on('tap', 'node', evt => focusNode(evt.target.id()));
    state.cy.on('tap', evt => {
      if (evt.target === state.cy && state.viewMode === 'global') clearFocus();
    });

    state.cy.on('mouseover', 'node', evt => evt.target.addClass('hovered'));
    state.cy.on('mouseout', 'node', evt => evt.target.removeClass('hovered'));
  }

  function renderTypeFilters() {
    $('type-filters').innerHTML = Object.entries(TYPE_LABELS).map(([type, label]) =>
      '<label class="check-item"><input type="checkbox" data-type="' + type + '" checked><span>' + label + '</span></label>'
    ).join('');

    $('type-filters').querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) state.visibleTypes.add(input.dataset.type);
        else state.visibleTypes.delete(input.dataset.type);
        applyFilters();
      });
    });
  }

  function renderLegend() {
    $('legend-items').innerHTML = Object.entries(TYPE_LABELS).map(([type, label]) =>
      '<div class="legend-row"><span class="legend-left"><span class="legend-dot" style="background:' +
      TYPE_COLORS[type] + '"></span>' + label + '</span></div>'
    ).join('');
  }

  function optionize(el, values, formatter) {
    formatter = formatter || (v => v);
    const first = el.options[0].outerHTML;
    el.innerHTML = first + values
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map(v => '<option value="' + htmlEsc(v) + '">' + htmlEsc(formatter(v)) + '</option>')
      .join('');
  }

  function setupControls() {
    renderTypeFilters();
    renderLegend();

    optionize($('color-filter'), [...new Set(state.nodes.map(n => n.color).filter(Boolean))]);
    optionize($('rarity-filter'), [...new Set(state.nodes.map(n => n.rarity).filter(Boolean))]);
    optionize($('card-type-filter'), [...new Set(state.nodes.filter(n => n.type === 'card').map(n => n.cardType).filter(Boolean))]);

    const costs = [...new Set(
      state.nodes
        .filter(n => n.type === 'card')
        .map(n => n.cost)
        .filter(v => v !== undefined && v !== null)
    )].sort((a, b) => Number(a) - Number(b));

    optionize($('cost-filter'), costs, v => v === -1 ? 'X' : v);

    ['search-input', 'color-filter', 'rarity-filter', 'card-type-filter', 'cost-filter', 'isolated-filter', 'incoming-filter', 'outgoing-filter'].forEach(id => {
      $(id).addEventListener(id === 'search-input' ? 'input' : 'change', applyFilters);
    });

    $('global-mode').addEventListener('click', () => setViewMode('global'));
    $('local-mode').addEventListener('click', () => setViewMode('local'));

    document.querySelectorAll('.depth-button').forEach(button => {
      button.addEventListener('click', () => {
        state.depth = Number(button.dataset.depth);
        document.querySelectorAll('.depth-button').forEach(b => b.classList.toggle('active', b === button));
        if (state.viewMode === 'local') applyFilters();
      });
    });

    $('reset-filters').addEventListener('click', resetFilters);
    $('clear-focus').addEventListener('click', clearFocus);
    $('fit-graph').addEventListener('click', () => state.cy.fit(state.cy.elements(':visible'), 55));

    $('zoom-in').addEventListener('click', () => state.cy.zoom({
      level: Math.min(state.cy.zoom() * 1.18, 2.8),
      renderedPosition: { x: $('graph-stage').clientWidth / 2, y: $('graph-stage').clientHeight / 2 }
    }));

    $('zoom-out').addEventListener('click', () => state.cy.zoom({
      level: Math.max(state.cy.zoom() / 1.18, 0.12),
      renderedPosition: { x: $('graph-stage').clientWidth / 2, y: $('graph-stage').clientHeight / 2 }
    }));

    $('filters-toggle').addEventListener('click', () => $('filters-panel').classList.add('open'));
    $('filters-close').addEventListener('click', () => $('filters-panel').classList.remove('open'));
    $('inspector-toggle').addEventListener('click', () => $('inspector-panel').classList.add('open'));
    $('inspector-close').addEventListener('click', () => $('inspector-panel').classList.remove('open'));

    $('command-button').addEventListener('click', openPalette);
    $('palette-backdrop').addEventListener('mousedown', e => {
      if (e.target === $('palette-backdrop')) closePalette();
    });
    $('palette-input').addEventListener('input', updatePalette);
    $('palette-input').addEventListener('keydown', handlePaletteKeys);

    document.addEventListener('keydown', e => {
      const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';
      if (ctrlK) {
        e.preventDefault();
        openPalette();
        return;
      }

      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        $('search-input').focus();
      }

      if (e.key === 'Escape') {
        if (!$('palette-backdrop').classList.contains('hidden')) closePalette();
        else clearFocus();
      }
    });
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    $('global-mode').classList.toggle('active', mode === 'global');
    $('local-mode').classList.toggle('active', mode === 'local');
    $('depth-controls').classList.toggle('disabled', mode !== 'local');
    $('selection-hint').classList.toggle('hidden', !(mode === 'local' && !state.focusedId));
    applyFilters();
  }

  function matchesFilters(n) {
    if (!state.visibleTypes.has(n.type)) return false;

    const q = norm($('search-input').value);
    if (q && !(norm(n.name).includes(q) || norm(n.description).includes(q))) return false;

    const color = $('color-filter').value;
    if (color !== 'all' && n.color !== color) return false;

    const rarity = $('rarity-filter').value;
    if (rarity !== 'all' && n.rarity !== rarity) return false;

    const cardType = $('card-type-filter').value;
    if (cardType !== 'all' && (n.type !== 'card' || n.cardType !== cardType)) return false;

    const cost = $('cost-filter').value;
    if (cost !== 'all' && (n.type !== 'card' || String(n.cost) !== cost)) return false;

    return true;
  }

  function collectLocal(startId, baseAllowed) {
    if (!startId || !baseAllowed.has(startId)) return new Set();

    const incoming = $('incoming-filter').checked;
    const outgoing = $('outgoing-filter').checked;
    const found = new Set([startId]);
    let frontier = new Set([startId]);

    for (let step = 0; step < state.depth; step++) {
      const next = new Set();

      for (const id of frontier) {
        if (outgoing) {
          for (const edge of state.outAdj.get(id) || []) {
            if (baseAllowed.has(edge.target) && !found.has(edge.target)) {
              found.add(edge.target);
              next.add(edge.target);
            }
          }
        }

        if (incoming) {
          for (const edge of state.inAdj.get(id) || []) {
            if (baseAllowed.has(edge.source) && !found.has(edge.source)) {
              found.add(edge.source);
              next.add(edge.source);
            }
          }
        }
      }

      frontier = next;
      if (!frontier.size) break;
    }

    return found;
  }

  function applyFilters() {
    if (!state.cy) return;

    const baseAllowed = new Set(state.nodes.filter(matchesFilters).map(n => n.id));
    let visible = new Set(baseAllowed);

    if (state.viewMode === 'local' && state.focusedId && baseAllowed.has(state.focusedId)) {
      visible = collectLocal(state.focusedId, baseAllowed);
    }

    const visibleEdges = state.edges.filter(e => visible.has(e.source) && visible.has(e.target));

    if ($('isolated-filter').checked && !$('search-input').value && state.viewMode === 'global') {
      const connected = new Set();
      for (const edge of visibleEdges) {
        connected.add(edge.source);
        connected.add(edge.target);
      }
      visible = new Set([...visible].filter(id => connected.has(id) || id === state.focusedId));
    }

    state.cy.batch(() => {
      state.cy.nodes().forEach(node => {
        node.style('display', visible.has(node.id()) ? 'element' : 'none');
      });

      state.cy.edges().forEach(edge => {
        const show = visible.has(edge.source().id()) && visible.has(edge.target().id());
        edge.style('display', show ? 'element' : 'none');
      });
    });

    if (state.viewMode === 'global') applyGlobalFocusClasses();
    else applyLocalFocusClasses();

    const nodeCount = state.cy.nodes(':visible').length;
    const edgeCount = state.cy.edges(':visible').length;
    const modeLabel = state.viewMode === 'local' ? 'local · depth ' + state.depth : 'global';
    $('graph-summary').textContent = modeLabel + ' · ' + nodeCount + ' nodes · ' + edgeCount + ' links';
    $('selection-hint').classList.toggle('hidden', !(state.viewMode === 'local' && !state.focusedId));

    scheduleRelayout();
  }

  function applyGlobalFocusClasses() {
    state.cy.elements().removeClass('dimmed neighbor focused');

    if (!state.focusedId) return;

    const node = state.cy.getElementById(state.focusedId);
    if (!node || node.empty() || node.style('display') === 'none') return;

    state.cy.elements(':visible').addClass('dimmed');
    const hood = node.closedNeighborhood(':visible');
    hood.removeClass('dimmed').addClass('neighbor');
    node.addClass('focused');
  }

  function applyLocalFocusClasses() {
    state.cy.elements().removeClass('dimmed neighbor focused');
    if (!state.focusedId) return;

    state.cy.nodes(':visible').addClass('neighbor');
    state.cy.edges(':visible').addClass('neighbor');

    const node = state.cy.getElementById(state.focusedId);
    if (node && !node.empty()) node.addClass('focused');
  }

  function scheduleRelayout() {
    clearTimeout(state.layoutTimer);
    state.layoutTimer = setTimeout(relayout, 90);
  }

  function relayout() {
    const visible = state.cy.elements(':visible');
    const count = state.cy.nodes(':visible').length;
    if (!count) return;

    const local = state.viewMode === 'local' && state.focusedId;
    const layout = {
      name: 'cose',
      animate: false,
      fit: true,
      padding: local ? 85 : 55,
      randomize: false,
      componentSpacing: local ? 70 : 46,
      nodeRepulsion: local ? 8500 : 6100,
      idealEdgeLength: local ? 105 : 72,
      edgeElasticity: 0.12,
      gravity: local ? 0.32 : 0.11,
      numIter: count > 350 ? 180 : 320
    };

    try {
      visible.layout(layout).run();
    } catch (err) {
      console.warn(err);
    }
  }

  function focusNode(id) {
    const node = state.cy.getElementById(id);
    if (!node || node.empty()) return;

    state.focusedId = id;
    $('clear-focus').disabled = false;
    renderInspector(id);

    if (state.viewMode === 'local') {
      applyFilters();
    } else {
      applyGlobalFocusClasses();
      const hood = node.closedNeighborhood(':visible');
      state.cy.animate({ fit: { eles: hood, padding: 90 }, duration: 180 });
    }

    if (window.innerWidth <= 900) $('inspector-panel').classList.add('open');
  }

  function clearFocus() {
    state.focusedId = null;
    if (!state.cy) return;

    $('clear-focus').disabled = true;
    state.cy.elements().removeClass('dimmed neighbor focused');

    $('entity-card').classList.add('hidden');
    $('inspector-empty').classList.remove('hidden');
    $('note-path').textContent = 'No note selected';
    $('note-panel-title').textContent = 'Reading view';

    applyFilters();
  }

  function relationRow(edge, node, direction) {
    const provenance = edge.provenance === 'curated' ? 'curated' :
      edge.provenance === 'explicit' ? 'explicit' :
      edge.provenance === 'name-match' ? 'matched' : 'text';

    return '<div class="relation" data-target="' + htmlEsc(node.id) + '">' +
      '<span class="relation-dot" style="background:' + TYPE_COLORS[node.type] + '"></span>' +
      '<div><div class="relation-name">' + htmlEsc(node.name) + '</div>' +
      '<div class="relation-type">' + htmlEsc(direction + ' · ' + edge.relation) +
      ' · <span class="relation-provenance">' + provenance + '</span></div></div></div>';
  }

  function renderInspector(id) {
    const n = state.nodes.find(x => x.id === id);
    if (!n) return;

    $('inspector-empty').classList.add('hidden');
    $('entity-card').classList.remove('hidden');

    $('note-path').textContent = TYPE_FOLDERS[n.type] + ' / ' + n.name + '.md';
    $('note-panel-title').textContent = 'Reading view';
    $('entity-kicker').textContent = TYPE_LABELS[n.type].replace(/s$/, '');
    $('entity-name').textContent = n.name;

    const chips = [
      n.color,
      n.rarity,
      n.cardType,
      n.cost !== undefined && n.type === 'card' ? (n.cost === -1 ? 'X cost' : n.cost + ' cost') : '',
      n.degree ? n.degree + ' links' : ''
    ].filter(Boolean);

    $('entity-meta').innerHTML = chips.map(c => '<span class="chip">' + htmlEsc(c) + '</span>').join('');
    $('entity-description').textContent = n.description || 'No description available.';

    const outgoing = (state.outAdj.get(id) || []).map(edge => ({
      edge,
      node: state.nodes.find(x => x.id === edge.target)
    })).filter(x => x.node);

    const incoming = (state.inAdj.get(id) || []).map(edge => ({
      edge,
      node: state.nodes.find(x => x.id === edge.source)
    })).filter(x => x.node);

    $('outgoing-count').textContent = outgoing.length;
    $('backlinks-count').textContent = incoming.length;

    $('outgoing-list').innerHTML = outgoing.length
      ? outgoing.slice(0, 150).map(item => relationRow(item.edge, item.node, 'to')).join('')
      : '<div class="empty-links">No outgoing links.</div>';

    $('backlinks-list').innerHTML = incoming.length
      ? incoming.slice(0, 150).map(item => relationRow(item.edge, item.node, 'from')).join('')
      : '<div class="empty-links">No backlinks.</div>';

    document.querySelectorAll('.relation[data-target]').forEach(el => {
      el.addEventListener('click', () => focusNode(el.dataset.target));
    });
  }

  function resetFilters() {
    $('search-input').value = '';
    $('color-filter').value = 'all';
    $('rarity-filter').value = 'all';
    $('card-type-filter').value = 'all';
    $('cost-filter').value = 'all';
    $('isolated-filter').checked = true;
    $('incoming-filter').checked = true;
    $('outgoing-filter').checked = true;

    state.visibleTypes = new Set(Object.keys(TYPE_LABELS));
    $('type-filters').querySelectorAll('input').forEach(i => i.checked = true);

    applyFilters();
  }

  function openPalette() {
    $('palette-backdrop').classList.remove('hidden');
    $('palette-input').value = '';
    state.paletteIndex = 0;
    updatePalette();
    setTimeout(() => $('palette-input').focus(), 0);
  }

  function closePalette() {
    $('palette-backdrop').classList.add('hidden');
  }

  function updatePalette() {
    const q = norm($('palette-input').value);

    state.paletteMatches = state.nodes
      .filter(n => !q || norm(n.name).includes(q) || norm(n.description).includes(q))
      .sort((a, b) => {
        const aExact = q && norm(a.name) === q ? 1 : 0;
        const bExact = q && norm(b.name) === q ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;

        const aStart = q && norm(a.name).startsWith(q) ? 1 : 0;
        const bStart = q && norm(b.name).startsWith(q) ? 1 : 0;
        if (aStart !== bStart) return bStart - aStart;

        return (b.degree || 0) - (a.degree || 0) || a.name.localeCompare(b.name);
      })
      .slice(0, 14);

    state.paletteIndex = Math.min(state.paletteIndex, Math.max(0, state.paletteMatches.length - 1));

    $('palette-results').innerHTML = state.paletteMatches.length
      ? state.paletteMatches.map((n, index) =>
          '<div class="palette-result' + (index === state.paletteIndex ? ' active' : '') + '" data-id="' + htmlEsc(n.id) + '">' +
          '<span class="palette-result-dot" style="background:' + TYPE_COLORS[n.type] + '"></span>' +
          '<span class="palette-result-name">' + htmlEsc(n.name) + '</span>' +
          '<span class="palette-result-meta">' + htmlEsc(TYPE_LABELS[n.type].replace(/s$/, '')) + '</span></div>'
        ).join('')
      : '<div class="empty-links">No matching notes.</div>';

    $('palette-results').querySelectorAll('.palette-result').forEach(el => {
      el.addEventListener('click', () => openPaletteResult(el.dataset.id));
    });
  }

  function handlePaletteKeys(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      state.paletteIndex = Math.min(state.paletteIndex + 1, state.paletteMatches.length - 1);
      updatePalette();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      state.paletteIndex = Math.max(state.paletteIndex - 1, 0);
      updatePalette();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = state.paletteMatches[state.paletteIndex];
      if (selected) openPaletteResult(selected.id);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  }

  function openPaletteResult(id) {
    closePalette();

    const nodeData = state.nodes.find(n => n.id === id);
    if (!nodeData) return;

    if (!matchesFilters(nodeData)) {
      $('search-input').value = '';
      $('color-filter').value = 'all';
      $('rarity-filter').value = 'all';
      $('card-type-filter').value = 'all';
      $('cost-filter').value = 'all';
      state.visibleTypes.add(nodeData.type);
      const typeBox = $('type-filters').querySelector('input[data-type="' + nodeData.type + '"]');
      if (typeBox) typeBox.checked = true;
    }

    focusNode(id);
  }

  async function boot() {
    try {
      const entries = await Promise.all(
        Object.entries(SOURCES).map(async pair => [pair[0], await loadJson(pair[1])])
      );

      const raw = Object.fromEntries(entries);
      const manualLinks = await loadOptionalJson('./data/manual-links.json', []);

      state.nodes = normalizeData(raw);
      state.edges = buildEdges(state.nodes, manualLinks);
      buildAdjacency();

      initGraph();
      setupControls();
      setViewMode('global');

      $('loading-state').classList.add('hidden');
      $('dataset-status').classList.add('ready');
      $('dataset-status').innerHTML = '<span class="status-dot"></span><span>Vault ready</span>';
      $('data-count').textContent = state.nodes.length + ' notes · ' + state.edges.length + ' links';
    } catch (err) {
      console.error(err);
      $('loading-state').innerHTML = '<strong>Could not load STS2 data</strong><span>' + htmlEsc(err.message) + '</span>';
      $('dataset-status').innerHTML = '<span class="status-dot"></span><span>Data unavailable</span>';
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();