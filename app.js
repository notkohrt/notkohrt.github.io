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
    card: '#7e8fb8',
    relic: '#c79b57',
    power: '#a07cb8',
    potion: '#65a7a1',
    enchantment: '#d08aa7',
    keyword: '#8b9a78'
  };

  const TYPE_LABELS = {
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
    visibleTypes: new Set(Object.keys(TYPE_LABELS))
  };

  const $ = id => document.getElementById(id);
  const norm = s => String(s == null ? '' : s).toLowerCase().trim();
  const slug = s => String(s == null ? '' : s).replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').toUpperCase();
  const nodeId = (type, id) => type + ':' + id;

  async function loadJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load ' + url);
    return res.json();
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
      const leftOk = !before || !word.test(before);
      const rightOk = !after || !word.test(after);

      if (leftOk && rightOk) return true;
      from = at + needle.length;
    }

    return false;
  }

  function inferRelation(text, targetName) {
    const t = norm(text);
    const n = norm(targetName);
    const index = t.indexOf(n);
    const around = index >= 0 ? t.slice(Math.max(0, index - 55), index + n.length + 55) : t;

    if (/add|create|put .* hand|shuffle/.test(around)) return 'creates / moves';
    if (/gain|apply|channel/.test(around)) return 'grants / applies';
    if (/deal|damage/.test(around)) return 'modifies';
    if (/whenever|when |if /.test(around)) return 'references / triggers';
    return 'references';
  }

  function buildEdges(nodes) {
    const edges = [];
    const edgeIds = new Set();
    const byId = new Map(nodes.map(n => [n.id, n]));
    const cards = nodes.filter(n => n.type === 'card');
    const powers = nodes.filter(n => n.type === 'power');
    const candidates = nodes.filter(n => n.type !== 'keyword' && n.name && n.name.length >= 4);

    const pushEdge = (source, target, relation) => {
      if (!byId.has(source) || !byId.has(target) || source === target) return;
      const id = source + '|' + target + '|' + relation;
      if (edgeIds.has(id)) return;
      edgeIds.add(id);
      edges.push({ id, source, target, relation });
    };

    for (const card of cards) {
      for (const kw of card.keywords || []) {
        const target = nodeId('keyword', slug(kw));
        if (byId.has(target)) pushEdge(card.id, target, 'has keyword');
      }
    }

    for (const source of nodes) {
      const text = source.description || '';
      if (!text) continue;

      for (const target of candidates) {
        if (target.id === source.id) continue;
        if (containsEntityName(text, target.name)) {
          pushEdge(source.id, target.id, inferRelation(text, target.name));
        }
      }
    }

    for (const card of cards) {
      for (const power of powers) {
        const base = power.name.replace(/\s+Power$/i, '');
        if (norm(card.name) === norm(base)) pushEdge(card.id, power.id, 'grants');
      }
    }

    return edges;
  }

  function graphElements() {
    return [
      ...state.nodes.map(n => ({ data: Object.assign({}, n, { label: n.name, color: TYPE_COLORS[n.type] }) })),
      ...state.edges.map(e => ({ data: e }))
    ];
  }

  function initGraph() {
    state.cy = cytoscape({
      container: $('cy'),
      elements: graphElements(),
      minZoom: 0.15,
      maxZoom: 2.5,
      wheelSensitivity: 0.2,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#d8dce5',
            'font-size': 10,
            'text-valign': 'bottom',
            'text-margin-y': 7,
            'text-outline-width': 2,
            'text-outline-color': '#0b0c0f',
            'width': 12,
            'height': 12,
            'border-width': 1,
            'border-color': '#161a22',
            'opacity': 0.92
          }
        },
        {
          selector: 'node[type = "relic"]',
          style: { 'shape': 'diamond', 'width': 15, 'height': 15 }
        },
        {
          selector: 'node[type = "keyword"]',
          style: { 'shape': 'round-rectangle', 'width': 16, 'height': 10 }
        },
        {
          selector: 'edge',
          style: {
            'width': 0.7,
            'line-color': '#3b4350',
            'target-arrow-color': '#3b4350',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'arrow-scale': 0.65,
            'opacity': 0.45
          }
        },
        { selector: '.dimmed', style: { 'opacity': 0.06 } },
        {
          selector: '.focused',
          style: {
            'opacity': 1,
            'border-width': 3,
            'border-color': '#f0d18c',
            'width': 22,
            'height': 22,
            'font-size': 12,
            'z-index': 99
          }
        },
        { selector: '.neighbor', style: { 'opacity': 1 } },
        {
          selector: 'edge.neighbor',
          style: {
            'opacity': 0.9,
            'width': 1.6,
            'line-color': '#7b8495',
            'target-arrow-color': '#7b8495'
          }
        }
      ],
      layout: {
        name: 'cose',
        animate: false,
        randomize: true,
        componentSpacing: 70,
        nodeRepulsion: 6500,
        idealEdgeLength: 75,
        edgeElasticity: 0.12,
        gravity: 0.18,
        numIter: 600
      }
    });

    state.cy.on('tap', 'node', evt => focusNode(evt.target.id()));
    state.cy.on('tap', evt => {
      if (evt.target === state.cy) clearFocus();
    });
  }

  function renderTypeFilters() {
    $('type-filters').innerHTML = Object.entries(TYPE_LABELS).map(([type, label]) =>
      '<label class="check-item"><input type="checkbox" data-type="' + type + '" checked><span>' + label + '</span></label>'
    ).join('');

    $('type-filters').querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) state.visibleTypes.add(input.dataset.type);
        else state.visibleTypes.delete(input.dataset.type);

        clearFocus(false);
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
      .map(v => '<option value="' + String(v).replace(/"/g, '&quot;') + '">' + formatter(v) + '</option>')
      .join('');
  }

  function setupFilters() {
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

    ['search-input', 'color-filter', 'rarity-filter', 'card-type-filter', 'cost-filter', 'isolated-filter'].forEach(id => {
      $(id).addEventListener(id === 'search-input' ? 'input' : 'change', () => {
        clearFocus(false);
        applyFilters();
      });
    });

    $('reset-filters').addEventListener('click', resetFilters);
    $('clear-focus').addEventListener('click', () => clearFocus());
    $('fit-graph').addEventListener('click', () => state.cy.fit(state.cy.elements(':visible'), 45));

    $('zoom-in').addEventListener('click', () => state.cy.zoom({
      level: Math.min(state.cy.zoom() * 1.2, 2.5),
      renderedPosition: { x: $('graph-stage').clientWidth / 2, y: $('graph-stage').clientHeight / 2 }
    }));

    $('zoom-out').addEventListener('click', () => state.cy.zoom({
      level: Math.max(state.cy.zoom() / 1.2, 0.15),
      renderedPosition: { x: $('graph-stage').clientWidth / 2, y: $('graph-stage').clientHeight / 2 }
    }));

    $('filters-toggle').addEventListener('click', () => $('filters-panel').classList.add('open'));
    $('filters-close').addEventListener('click', () => $('filters-panel').classList.remove('open'));
    $('inspector-toggle').addEventListener('click', () => $('inspector-panel').classList.add('open'));
    $('inspector-close').addEventListener('click', () => $('inspector-panel').classList.remove('open'));

    document.addEventListener('keydown', e => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        $('search-input').focus();
      }
      if (e.key === 'Escape') clearFocus();
    });
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

  function applyFilters() {
    const allowed = new Set(state.nodes.filter(matchesFilters).map(n => n.id));

    state.cy.batch(() => {
      state.cy.nodes().forEach(n => {
        n.style('display', allowed.has(n.id()) ? 'element' : 'none');
      });

      state.cy.edges().forEach(e => {
        const visible = allowed.has(e.source().id()) && allowed.has(e.target().id());
        e.style('display', visible ? 'element' : 'none');
      });

      if ($('isolated-filter').checked) {
        state.cy.nodes(':visible').forEach(n => {
          if (n.connectedEdges(':visible').length === 0) n.style('display', 'none');
        });
      }
    });

    const visibleNodes = state.cy.nodes(':visible').length;
    const visibleEdges = state.cy.edges(':visible').length;
    $('graph-summary').textContent = visibleNodes + ' nodes · ' + visibleEdges + ' relationships';

    relayout();
  }

  function relayout() {
    const count = state.cy.nodes(':visible').length;
    const layout = count < 160
      ? {
          name: 'cose',
          animate: false,
          fit: true,
          padding: 45,
          randomize: false,
          nodeRepulsion: 6000,
          idealEdgeLength: 78,
          gravity: 0.2,
          numIter: 350
        }
      : {
          name: 'grid',
          animate: false,
          fit: true,
          padding: 45,
          avoidOverlap: true,
          spacingFactor: 1.25
        };

    try {
      state.cy.elements(':visible').layout(layout).run();
    } catch (err) {
      console.warn(err);
    }
  }

  function focusNode(id) {
    const node = state.cy.getElementById(id);
    if (!node || node.empty()) return;

    state.focusedId = id;
    $('clear-focus').disabled = false;

    const neighborhood = node.closedNeighborhood();
    state.cy.elements().addClass('dimmed').removeClass('focused neighbor');
    neighborhood.removeClass('dimmed').addClass('neighbor');
    node.addClass('focused');

    state.cy.animate({
      fit: { eles: neighborhood, padding: 90 },
      duration: 250
    });

    renderInspector(id);

    if (window.innerWidth <= 980) {
      $('inspector-panel').classList.add('open');
    }
  }

  function clearFocus(recenter) {
    if (recenter === undefined) recenter = true;
    state.focusedId = null;
    if (!state.cy) return;

    state.cy.elements().removeClass('dimmed focused neighbor');
    $('clear-focus').disabled = true;
    $('entity-card').classList.add('hidden');
    $('inspector-empty').classList.remove('hidden');
    $('inspector-hint').textContent = 'Select a node to see what it connects to.';

    if (recenter) state.cy.fit(state.cy.elements(':visible'), 45);
  }

  function renderInspector(id) {
    const n = state.nodes.find(x => x.id === id);
    if (!n) return;

    $('inspector-empty').classList.add('hidden');
    $('entity-card').classList.remove('hidden');

    const singular = TYPE_LABELS[n.type].replace(/s$/, '');
    $('entity-kicker').textContent = singular;
    $('entity-name').textContent = n.name;

    const chips = [
      n.color,
      n.rarity,
      n.cardType,
      n.cost !== undefined && n.type === 'card' ? (n.cost === -1 ? 'X cost' : n.cost + ' cost') : ''
    ].filter(Boolean);

    $('entity-meta').innerHTML = chips.map(c => '<span class="chip">' + c + '</span>').join('');
    $('entity-description').textContent = n.description || 'No description available.';

    const connected = state.edges
      .filter(e => e.source === id || e.target === id)
      .map(e => {
        const otherId = e.source === id ? e.target : e.source;
        return { edge: e, node: state.nodes.find(x => x.id === otherId) };
      })
      .filter(x => x.node);

    $('relations-count').textContent = connected.length;

    if (!connected.length) {
      $('relations-list').innerHTML = '<div class="entity-description">No explicit relationships found in the current dataset.</div>';
      return;
    }

    $('relations-list').innerHTML = connected.slice(0, 120).map(item => {
      const edge = item.edge;
      const node = item.node;

      return '<div class="relation" data-target="' + node.id + '">' +
        '<span class="relation-dot" style="background:' + TYPE_COLORS[node.type] + '"></span>' +
        '<div><div class="relation-name">' + node.name + '</div>' +
        '<div class="relation-type">' + edge.relation + ' · ' + TYPE_LABELS[node.type].replace(/s$/, '') + '</div></div></div>';
    }).join('');

    $('relations-list').querySelectorAll('.relation').forEach(el => {
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

    state.visibleTypes = new Set(Object.keys(TYPE_LABELS));
    $('type-filters').querySelectorAll('input').forEach(i => i.checked = true);

    clearFocus(false);
    applyFilters();
  }

  async function boot() {
    try {
      const entries = await Promise.all(
        Object.entries(SOURCES).map(async pair => [pair[0], await loadJson(pair[1])])
      );

      const raw = Object.fromEntries(entries);
      state.nodes = normalizeData(raw);
      state.edges = buildEdges(state.nodes);

      initGraph();
      setupFilters();
      applyFilters();

      $('loading-state').classList.add('hidden');
      $('dataset-status').classList.add('ready');
      $('dataset-status').innerHTML = '<span class="status-dot"></span><span>Live dataset</span>';
      $('data-count').textContent = state.nodes.length + ' entities · ' + state.edges.length + ' explicit/inferred links';
    } catch (err) {
      console.error(err);
      $('loading-state').innerHTML = '<strong>Could not load STS2 data</strong><span>' + err.message + '</span>';
      $('dataset-status').innerHTML = '<span class="status-dot"></span><span>Data unavailable</span>';
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();