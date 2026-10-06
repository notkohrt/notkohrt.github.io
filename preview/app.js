(() => {
  const SOURCES = {
    card: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/cards.json',
    relic: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/relics.json',
    power: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/powers.json',
    potion: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/potions.json',
    enchantment: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/enchantments.json',
    keyword: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/keywords.json',
    mechanics: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/mechanics.json',
    cardPowers: 'https://raw.githubusercontent.com/nkhoit/spire-archive/main/data/sts2/card_powers.json'
  };

  const TYPE_COLORS = {
    card: 0x8b83d6,
    relic: 0xc19a63,
    power: 0xa276bd,
    potion: 0x65a7a1,
    enchantment: 0xc9829f,
    keyword: 0x7f9a72,
    mechanic: 0x6f8fb5,
    tag: 0x9a875f
  };

  const TYPE_CSS = {
    card: '#8b83d6',
    relic: '#c19a63',
    power: '#a276bd',
    potion: '#65a7a1',
    enchantment: '#c9829f',
    keyword: '#7f9a72',
    mechanic: '#6f8fb5',
    tag: '#9a875f'
  };

  const TYPE_LABELS = {
    card: 'Cards',
    relic: 'Relics',
    power: 'Powers',
    potion: 'Potions',
    enchantment: 'Enchantments',
    keyword: 'Keywords',
    mechanic: 'Mechanics',
    tag: 'Tags'
  };

  const TYPE_FOLDERS = {
    card: 'Cards',
    relic: 'Relics',
    power: 'Powers',
    potion: 'Potions',
    enchantment: 'Enchantments',
    keyword: 'Keywords',
    mechanic: 'Mechanics',
    tag: 'Tags'
  };

  const state = {
    nodes: [],
    edges: [],
    byId: new Map(),
    outAdj: new Map(),
    inAdj: new Map(),

    pixi: null,
    world: null,
    edgeLayer: null,
    nodeLayer: null,
    labelLayer: null,
    overlayLayer: null,
    hoverLabel: null,
    focusLabel: null,
    nodeViews: new Map(),
    staticLabels: new Map(),

    visibleNodes: [],
    visibleEdges: [],
    simEdges: [],
    simulation: null,

    focusedId: null,
    hoveredId: null,
    viewMode: 'global',
    depth: 1,
    visibleTypes: new Set(Object.keys(TYPE_LABELS)),

    paletteIndex: 0,
    paletteMatches: [],

    draggingNode: null,
    panning: false,
    panStart: null,
    worldStart: null,
    panMoved: false,

    touchPointers: new Map(),
    pinchStart: null,

    settings: {
      center: 0.012,
      repel: 170,
      link: 0.28,
      distance: 92
    }
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
        tags: card.tags || [],
        target: card.target || '',
        vars: card.vars || {},
        upgrade: card.upgrade || {},
        imageUrl: card.image_url || ''
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
        color: potion.color || '',
        target: potion.target || ''
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

    const mechanicGroups = ['core_concepts', 'orbs'];
    for (const group of mechanicGroups) {
      for (const item of (raw.mechanics && raw.mechanics[group]) || []) {
        const name = String(item.title || item.name || item.id || '')
          .replace(/\s*\([^)]*\)\s*$/, '')
          .trim();
        nodes.push({
          id: nodeId('mechanic', item.id || slug(name)),
          sourceId: item.id || slug(name),
          type: 'mechanic',
          name,
          description: item.description || '',
          mechanicGroup: group
        });
      }
    }

    const tags = new Set();
    for (const card of raw.card) {
      for (const tag of card.tags || []) tags.add(tag);
    }
    for (const tag of tags) {
      nodes.push({
        id: nodeId('tag', slug(tag)),
        sourceId: slug(tag),
        type: 'tag',
        name: tag,
        description: 'Card tag used by Slay the Spire 2.'
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

  function buildEdges(nodes, manualLinks, cardPowers) {
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

      for (const tag of card.tags || []) {
        const target = nodeId('tag', slug(tag));
        if (byId.has(target)) pushEdge(card.id, target, 'has tag', 'explicit');
      }

      for (const power of (cardPowers && cardPowers[card.sourceId]) || []) {
        const target = nodeId('power', power.id);
        if (byId.has(target)) pushEdge(card.id, target, 'applies / grants', 'explicit');
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
    state.byId = new Map(state.nodes.map(n => [n.id, n]));
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
      node.degree = (state.outAdj.get(node.id) || []).length + (state.inAdj.get(node.id) || []).length;
      node.radius = 4.8 + Math.min(8.5, Math.sqrt(node.degree + 1) * 1.25);
      if (!Number.isFinite(node.x)) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 40 + Math.random() * 260;
        node.x = Math.cos(angle) * distance;
        node.y = Math.sin(angle) * distance;
      }
    }
  }

  function initPixi() {
    const host = $('graph-canvas');

    state.pixi = new PIXI.Application({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });

    host.appendChild(state.pixi.view);

    state.pixi.stage.eventMode = 'static';
    state.pixi.stage.hitArea = state.pixi.screen;

    state.world = new PIXI.Container();
    state.edgeLayer = new PIXI.Graphics();
    state.nodeLayer = new PIXI.Container();
    state.labelLayer = new PIXI.Container();
    state.overlayLayer = new PIXI.Container();

    state.world.addChild(state.edgeLayer, state.nodeLayer, state.labelLayer, state.overlayLayer);
    state.pixi.stage.addChild(state.world);

    centerWorld();

    state.hoverLabel = makeOverlayLabel();
    state.focusLabel = makeOverlayLabel();
    state.overlayLayer.addChild(state.hoverLabel, state.focusLabel);
    state.hoverLabel.visible = false;
    state.focusLabel.visible = false;

    state.pixi.stage.on('pointerdown', onStagePointerDown);
    state.pixi.stage.on('pointermove', onStagePointerMove);
    state.pixi.stage.on('pointerup', onStagePointerUp);
    state.pixi.stage.on('pointerupoutside', onStagePointerUp);

    state.pixi.view.addEventListener('wheel', onWheel, { passive: false });
    state.pixi.view.addEventListener('touchstart', onTouchStart, { passive: false });
    state.pixi.view.addEventListener('touchmove', onTouchMove, { passive: false });
    state.pixi.view.addEventListener('touchend', onTouchEnd, { passive: false });
    state.pixi.view.addEventListener('touchcancel', onTouchEnd, { passive: false });

    new ResizeObserver(() => {
      state.pixi.stage.hitArea = state.pixi.screen;
    }).observe(host);

    state.pixi.ticker.add(renderFrame);
  }

  function makeOverlayLabel() {
    const label = new PIXI.Text('', {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 11,
      fill: 0xe0e0e0,
      stroke: 0x1e1e1e,
      strokeThickness: 4,
      align: 'center'
    });
    label.anchor.set(0.5, 0);
    label.eventMode = 'none';
    return label;
  }

  function centerWorld() {
    if (!state.pixi || !state.world) return;
    state.world.scale.set(1);
    state.world.position.set(state.pixi.screen.width / 2, state.pixi.screen.height / 2);
  }

  function createNodeView(node) {
    const view = new PIXI.Container();
    const circle = new PIXI.Graphics();

    view.addChild(circle);
    view.eventMode = 'static';
    view.cursor = 'pointer';
    view.hitArea = new PIXI.Circle(0, 0, node.radius + 8);
    view._nodeId = node.id;
    view._circle = circle;

    view.on('pointerdown', e => {
      e.stopPropagation();
      if (state.touchPointers.size >= 2) return;
      state.draggingNode = node;
      const p = state.world.toLocal(e.global);
      node.fx = node.x;
      node.fy = node.y;
      node._dragOffsetX = node.x - p.x;
      node._dragOffsetY = node.y - p.y;
      if (state.simulation) state.simulation.alphaTarget(0.22).restart();
    });

    view.on('pointertap', e => {
      e.stopPropagation();
      if (state.focusedId === node.id) clearFocus();
      else focusNode(node.id);
    });

    view.on('pointerover', () => {
      state.hoveredId = node.id;
      styleNodeView(node);
      state.hoverLabel.text = node.name;
      state.hoverLabel.visible = true;
    });

    view.on('pointerout', () => {
      if (state.hoveredId === node.id) state.hoveredId = null;
      styleNodeView(node);
      state.hoverLabel.visible = false;
    });

    styleNodeView(node);
    return view;
  }

  function styleNodeView(node) {
    const view = state.nodeViews.get(node.id);
    if (!view) return;

    const selected = state.focusedId === node.id;
    const hovered = state.hoveredId === node.id;
    const related = !state.focusedId || state.viewMode === 'local' || isDirectNeighbor(node.id);
    const circle = view._circle;

    circle.clear();

    if (selected) circle.lineStyle(2.3, 0xb8adff, 1);
    else if (hovered) circle.lineStyle(1.8, 0x9c8df4, 1);
    else circle.lineStyle(0.8, 0x161616, 0.95);

    circle.beginFill(TYPE_COLORS[node.type], selected || hovered ? 1 : 0.88);
    circle.drawCircle(0, 0, selected ? node.radius + 2.2 : node.radius);
    circle.endFill();

    view.alpha = related ? 1 : 0.1;
  }

  function isDirectNeighbor(id) {
    if (!state.focusedId) return true;
    if (id === state.focusedId) return true;

    return (state.outAdj.get(state.focusedId) || []).some(e => e.target === id) ||
      (state.inAdj.get(state.focusedId) || []).some(e => e.source === id);
  }

  function shouldShowStaticLabel(node) {
    if (state.viewMode === 'local') return state.visibleNodes.length <= 160 || node.degree >= 3;
    if (state.visibleNodes.length <= 170) return true;
    return node.degree >= 9;
  }

  function createStaticLabel(node) {
    const label = new PIXI.Text(node.name, {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 9.5,
      fill: 0xbebebe,
      stroke: 0x1e1e1e,
      strokeThickness: 3
    });
    label.anchor.set(0.5, 0);
    label.eventMode = 'none';
    state.labelLayer.addChild(label);
    state.staticLabels.set(node.id, label);
  }

  function rebuildScene() {
    for (const child of state.nodeLayer.removeChildren()) child.destroy({ children: true });
    for (const child of state.labelLayer.removeChildren()) child.destroy();
    state.nodeViews.clear();
    state.staticLabels.clear();

    for (const node of state.visibleNodes) {
      const view = createNodeView(node);
      state.nodeViews.set(node.id, view);
      state.nodeLayer.addChild(view);

      if (shouldShowStaticLabel(node)) createStaticLabel(node);
    }

    state.focusLabel.visible = Boolean(state.focusedId && state.byId.has(state.focusedId));
    updateAllNodeStyles();
    rebuildSimulation();
    renderFrame();
  }

  function rebuildSimulation() {
    if (state.simulation) state.simulation.stop();

    state.simEdges = state.visibleEdges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relation: edge.relation,
      provenance: edge.provenance
    }));

    const linkForce = d3.forceLink(state.simEdges)
      .id(d => d.id)
      .distance(state.settings.distance)
      .strength(state.settings.link);

    state.simulation = d3.forceSimulation(state.visibleNodes)
      .force('link', linkForce)
      .force('charge', d3.forceManyBody().strength(-state.settings.repel).distanceMax(650))
      .force('x', d3.forceX(0).strength(state.settings.center))
      .force('y', d3.forceY(0).strength(state.settings.center))
      .force('collide', d3.forceCollide(d => d.radius + 4).strength(0.7).iterations(1))
      .velocityDecay(0.34)
      .alphaDecay(0.024)
      .alphaMin(0.002)
      .alpha(0.9)
      .restart();

    $('physics-badge').classList.add('active');
  }

  function updatePhysics() {
    state.settings.center = Number($('center-force').value) / 1000;
    state.settings.repel = Number($('repel-force').value);
    state.settings.link = Number($('link-force').value) / 100;
    state.settings.distance = Number($('link-distance').value);

    if (!state.simulation) return;

    state.simulation.force('charge').strength(-state.settings.repel);
    state.simulation.force('x').strength(state.settings.center);
    state.simulation.force('y').strength(state.settings.center);

    const link = state.simulation.force('link');
    link.distance(state.settings.distance).strength(state.settings.link);

    state.simulation.alpha(0.72).restart();
    $('physics-badge').classList.add('active');
  }

  function restructureGraph() {
    for (const node of state.visibleNodes) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 45 + Math.random() * 260;
      node.x = Math.cos(angle) * distance;
      node.y = Math.sin(angle) * distance;
      node.vx = (Math.random() - 0.5) * 5;
      node.vy = (Math.random() - 0.5) * 5;

      if (!$('pin-dragged').checked) {
        node.fx = null;
        node.fy = null;
      }
    }

    if (state.simulation) state.simulation.alpha(1).restart();
    $('physics-badge').classList.add('active');
  }

  function renderFrame() {
    if (!state.edgeLayer || !state.world) return;

    drawEdges();

    for (const node of state.visibleNodes) {
      const view = state.nodeViews.get(node.id);
      if (view) view.position.set(node.x || 0, node.y || 0);

      const label = state.staticLabels.get(node.id);
      if (label) {
        label.position.set(node.x || 0, (node.y || 0) + node.radius + 4);
        label.alpha = !state.focusedId || state.viewMode === 'local' || isDirectNeighbor(node.id) ? 0.9 : 0.08;
        label.visible = state.world.scale.x >= 0.38 || state.viewMode === 'local';
      }
    }

    if (state.hoveredId) {
      const node = state.byId.get(state.hoveredId);
      if (node) state.hoverLabel.position.set(node.x || 0, (node.y || 0) + node.radius + 6);
    }

    if (state.focusedId) {
      const node = state.byId.get(state.focusedId);
      if (node && state.nodeViews.has(node.id)) {
        state.focusLabel.text = node.name;
        state.focusLabel.position.set(node.x || 0, (node.y || 0) + node.radius + 7);
        state.focusLabel.visible = !state.staticLabels.has(node.id);
      } else {
        state.focusLabel.visible = false;
      }
    } else {
      state.focusLabel.visible = false;
    }

    if (state.simulation) {
      const active = state.simulation.alpha() > 0.015 || Boolean(state.draggingNode);
      $('physics-badge').classList.toggle('active', active);
    }
  }

  function drawEdges() {
    state.edgeLayer.clear();

    for (const edge of state.simEdges) {
      const source = edge.source;
      const target = edge.target;
      if (!source || !target || !Number.isFinite(source.x) || !Number.isFinite(target.x)) continue;

      let color = 0x505050;
      let alpha = edge.provenance === 'description' ? 0.16 : 0.26;
      let width = 0.75;

      if (edge.provenance === 'curated') {
        color = 0x8978ef;
        alpha = 0.66;
        width = 1.3;
      } else if (edge.provenance === 'explicit') {
        color = 0x777777;
        alpha = 0.38;
      }

      if (state.focusedId && state.viewMode === 'global') {
        const touches = source.id === state.focusedId || target.id === state.focusedId;
        alpha = touches ? Math.max(alpha, 0.76) : 0.025;
        width = touches ? Math.max(width, 1.15) : 0.55;
      }

      state.edgeLayer.lineStyle(width, color, alpha);
      state.edgeLayer.moveTo(source.x, source.y);
      state.edgeLayer.lineTo(target.x, target.y);
    }
  }

  function onStagePointerDown(e) {
    if (state.touchPointers.size >= 2) return;
    if (state.draggingNode) return;
    state.panning = true;
    state.panMoved = false;
    state.panStart = { x: e.global.x, y: e.global.y };
    state.worldStart = { x: state.world.position.x, y: state.world.position.y };
  }

  function onStagePointerMove(e) {
    if (state.touchPointers.size >= 2) return;

    if (state.draggingNode) {
      const p = state.world.toLocal(e.global);
      state.draggingNode.fx = p.x + (state.draggingNode._dragOffsetX || 0);
      state.draggingNode.fy = p.y + (state.draggingNode._dragOffsetY || 0);
      return;
    }

    if (state.panning && state.panStart && state.worldStart) {
      const dx = e.global.x - state.panStart.x;
      const dy = e.global.y - state.panStart.y;
      if (Math.hypot(dx, dy) > 5) state.panMoved = true;

      state.world.position.set(
        state.worldStart.x + dx,
        state.worldStart.y + dy
      );
    }
  }

  function onStagePointerUp() {
    const wasDraggingNode = Boolean(state.draggingNode);
    const wasBackgroundTap = state.panning && !state.panMoved && !wasDraggingNode;

    if (state.draggingNode) {
      if (!$('pin-dragged').checked) {
        state.draggingNode.fx = null;
        state.draggingNode.fy = null;
      }

      state.draggingNode._dragOffsetX = 0;
      state.draggingNode._dragOffsetY = 0;
      state.draggingNode = null;

      if (state.simulation) state.simulation.alphaTarget(0);
    }

    state.panning = false;
    state.panMoved = false;
    state.panStart = null;
    state.worldStart = null;

    if (wasBackgroundTap && state.focusedId) {
      clearFocus();
    }
  }

  function onTouchStart(e) {
    if (e.touches.length < 2) return;
    e.preventDefault();

    state.panning = false;
    state.panMoved = false;

    if (state.draggingNode) {
      if (!$('pin-dragged').checked) {
        state.draggingNode.fx = null;
        state.draggingNode.fy = null;
      }
      state.draggingNode = null;
      if (state.simulation) state.simulation.alphaTarget(0);
    }

    const a = e.touches[0];
    const b = e.touches[1];
    const rect = state.pixi.view.getBoundingClientRect();
    const midpoint = {
      x: (a.clientX + b.clientX) / 2 - rect.left,
      y: (a.clientY + b.clientY) / 2 - rect.top
    };
    const scale = state.world.scale.x;

    state.pinchStart = {
      distance: Math.max(1, Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY)),
      scale,
      worldX: (midpoint.x - state.world.position.x) / scale,
      worldY: (midpoint.y - state.world.position.y) / scale
    };
  }

  function onTouchMove(e) {
    if (e.touches.length < 2 || !state.pinchStart) return;
    e.preventDefault();

    const a = e.touches[0];
    const b = e.touches[1];
    const rect = state.pixi.view.getBoundingClientRect();
    const midpoint = {
      x: (a.clientX + b.clientX) / 2 - rect.left,
      y: (a.clientY + b.clientY) / 2 - rect.top
    };
    const distance = Math.max(1, Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY));
    const newScale = Math.max(0.12, Math.min(3.2,
      state.pinchStart.scale * (distance / state.pinchStart.distance)
    ));

    state.world.scale.set(newScale);
    state.world.position.set(
      midpoint.x - state.pinchStart.worldX * newScale,
      midpoint.y - state.pinchStart.worldY * newScale
    );
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      state.pinchStart = null;
      state.touchPointers.clear();
    }
  }

  function onWheel(e) {
    e.preventDefault();

    const rect = state.pixi.view.getBoundingClientRect();
    const point = new PIXI.Point(e.clientX - rect.left, e.clientY - rect.top);
    const oldScale = state.world.scale.x;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.max(0.12, Math.min(3.2, oldScale * factor));

    const worldX = (point.x - state.world.position.x) / oldScale;
    const worldY = (point.y - state.world.position.y) / oldScale;

    state.world.scale.set(newScale);
    state.world.position.set(
      point.x - worldX * newScale,
      point.y - worldY * newScale
    );
  }

  function zoomBy(factor) {
    const point = new PIXI.Point(state.pixi.screen.width / 2, state.pixi.screen.height / 2);
    const oldScale = state.world.scale.x;
    const newScale = Math.max(0.12, Math.min(3.2, oldScale * factor));
    const worldX = (point.x - state.world.position.x) / oldScale;
    const worldY = (point.y - state.world.position.y) / oldScale;

    state.world.scale.set(newScale);
    state.world.position.set(
      point.x - worldX * newScale,
      point.y - worldY * newScale
    );
  }

  function fitGraph() {
    if (!state.visibleNodes.length || !state.pixi) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const node of state.visibleNodes) {
      minX = Math.min(minX, node.x || 0);
      minY = Math.min(minY, node.y || 0);
      maxX = Math.max(maxX, node.x || 0);
      maxY = Math.max(maxY, node.y || 0);
    }

    const width = Math.max(140, maxX - minX);
    const height = Math.max(140, maxY - minY);
    const padding = state.viewMode === 'local' ? 110 : 75;
    const scale = Math.max(0.12, Math.min(2.3,
      Math.min(
        state.pixi.screen.width / (width + padding * 2),
        state.pixi.screen.height / (height + padding * 2)
      )
    ));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    state.world.scale.set(scale);
    state.world.position.set(
      state.pixi.screen.width / 2 - centerX * scale,
      state.pixi.screen.height / 2 - centerY * scale
    );
  }

  function renderTypeFilters() {
    $('type-filters').innerHTML = Object.entries(TYPE_LABELS).map(([type, label]) =>
      '<label class="check-item"><input type="checkbox" data-type="' + type + '" checked><span>' + label + '</span></label>'
    ).join('');

    $('type-filters').querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) state.visibleTypes.add(input.dataset.type);
        else state.visibleTypes.delete(input.dataset.type);
        applyFilters(true);
      });
    });
  }

  function renderLegend() {
    $('legend-items').innerHTML = Object.entries(TYPE_LABELS).map(([type, label]) =>
      '<div class="legend-row"><span class="legend-left"><span class="legend-dot" style="background:' +
      TYPE_CSS[type] + '"></span>' + label + '</span></div>'
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
      $(id).addEventListener(id === 'search-input' ? 'input' : 'change', () => applyFilters(true));
    });

    ['center-force', 'repel-force', 'link-force', 'link-distance'].forEach(id => {
      $(id).addEventListener('input', updatePhysics);
    });

    $('reheat-graph').addEventListener('click', restructureGraph);

    $('global-mode').addEventListener('click', () => setViewMode('global'));
    $('local-mode').addEventListener('click', () => setViewMode('local'));

    document.querySelectorAll('.depth-button').forEach(button => {
      button.addEventListener('click', () => {
        state.depth = Number(button.dataset.depth);
        document.querySelectorAll('.depth-button').forEach(b => b.classList.toggle('active', b === button));
        if (state.viewMode === 'local') applyFilters(true);
      });
    });

    $('reset-filters').addEventListener('click', resetFilters);
    $('clear-focus').addEventListener('click', clearFocus);
    $('fit-graph').addEventListener('click', fitGraph);
    $('zoom-in').addEventListener('click', () => zoomBy(1.18));
    $('zoom-out').addEventListener('click', () => zoomBy(1 / 1.18));

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
    applyFilters(true);
  }

  function matchesFilters(node) {
    if (!state.visibleTypes.has(node.type)) return false;

    const q = norm($('search-input').value);
    if (q && !(norm(node.name).includes(q) || norm(node.description).includes(q))) return false;

    const color = $('color-filter').value;
    if (color !== 'all' && node.color !== color) return false;

    const rarity = $('rarity-filter').value;
    if (rarity !== 'all' && node.rarity !== rarity) return false;

    const cardType = $('card-type-filter').value;
    if (cardType !== 'all' && (node.type !== 'card' || node.cardType !== cardType)) return false;

    const cost = $('cost-filter').value;
    if (cost !== 'all' && (node.type !== 'card' || String(node.cost) !== cost)) return false;

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

  function applyFilters(shouldFit) {
    const baseAllowed = new Set(state.nodes.filter(matchesFilters).map(n => n.id));
    let visible = new Set(baseAllowed);

    if (state.viewMode === 'local' && state.focusedId && baseAllowed.has(state.focusedId)) {
      visible = collectLocal(state.focusedId, baseAllowed);
    }

    let visibleEdges = state.edges.filter(e => visible.has(e.source) && visible.has(e.target));

    if ($('isolated-filter').checked && !$('search-input').value && state.viewMode === 'global') {
      const connected = new Set();

      for (const edge of visibleEdges) {
        connected.add(edge.source);
        connected.add(edge.target);
      }

      visible = new Set([...visible].filter(id => connected.has(id) || id === state.focusedId));
      visibleEdges = state.edges.filter(e => visible.has(e.source) && visible.has(e.target));
    }

    state.visibleNodes = [...visible].map(id => state.byId.get(id)).filter(Boolean);
    state.visibleEdges = visibleEdges;

    rebuildScene();

    const modeLabel = state.viewMode === 'local' ? 'local · depth ' + state.depth : 'global';
    $('graph-summary').textContent = modeLabel + ' · ' + state.visibleNodes.length + ' nodes · ' + state.visibleEdges.length + ' links';
    $('selection-hint').classList.toggle('hidden', !(state.viewMode === 'local' && !state.focusedId));

    if (shouldFit) setTimeout(fitGraph, 160);
  }

  function updateAllNodeStyles() {
    for (const node of state.visibleNodes) styleNodeView(node);
  }

  function focusNode(id) {
    const node = state.byId.get(id);
    if (!node) return;

    state.focusedId = id;
    $('clear-focus').disabled = false;
    renderInspector(id);

    if (state.viewMode === 'local') {
      applyFilters(true);
    } else {
      updateAllNodeStyles();
      setTimeout(() => fitNeighborhood(id), 20);
    }

    if (window.innerWidth <= 900) $('inspector-panel').classList.add('open');
  }

  function fitNeighborhood(id) {
    const ids = new Set([id]);

    for (const edge of state.outAdj.get(id) || []) ids.add(edge.target);
    for (const edge of state.inAdj.get(id) || []) ids.add(edge.source);

    const nodes = [...ids].map(nodeIdValue => state.byId.get(nodeIdValue)).filter(node => node && state.nodeViews.has(node.id));
    if (!nodes.length) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of nodes) {
      minX = Math.min(minX, node.x || 0);
      minY = Math.min(minY, node.y || 0);
      maxX = Math.max(maxX, node.x || 0);
      maxY = Math.max(maxY, node.y || 0);
    }

    const width = Math.max(90, maxX - minX);
    const height = Math.max(90, maxY - minY);
    const scale = Math.max(0.2, Math.min(2.2,
      Math.min(
        state.pixi.screen.width / (width + 220),
        state.pixi.screen.height / (height + 220)
      )
    ));

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    state.world.scale.set(scale);
    state.world.position.set(
      state.pixi.screen.width / 2 - centerX * scale,
      state.pixi.screen.height / 2 - centerY * scale
    );
  }

  function clearFocus() {
    state.focusedId = null;
    $('clear-focus').disabled = true;
    $('inspector-panel').classList.remove('open');

    $('entity-card').classList.add('hidden');
    $('inspector-empty').classList.remove('hidden');
    $('note-path').textContent = 'No note selected';
    $('note-panel-title').textContent = 'Reading view';

    if (state.viewMode === 'local') applyFilters(true);
    else updateAllNodeStyles();
  }

  function relationRow(edge, node, direction) {
    const provenance = edge.provenance === 'curated' ? 'curated' :
      edge.provenance === 'explicit' ? 'explicit' :
      edge.provenance === 'name-match' ? 'matched' : 'text';

    return '<div class="relation" data-target="' + htmlEsc(node.id) + '">' +
      '<span class="relation-dot" style="background:' + TYPE_CSS[node.type] + '"></span>' +
      '<div><div class="relation-name">' + htmlEsc(node.name) + '</div>' +
      '<div class="relation-type">' + htmlEsc(direction + ' · ' + edge.relation) +
      ' · <span class="relation-provenance">' + htmlEsc(provenance) + '</span></div></div></div>';
  }

  function renderInspector(id) {
    const node = state.byId.get(id);
    if (!node) return;

    $('inspector-empty').classList.add('hidden');
    $('entity-card').classList.remove('hidden');

    $('note-path').textContent = TYPE_FOLDERS[node.type] + ' / ' + node.name + '.md';
    $('note-panel-title').textContent = 'Reading view';
    $('entity-kicker').textContent = TYPE_LABELS[node.type].replace(/s$/, '');
    $('entity-name').textContent = node.name;

    const chips = [
      node.color,
      node.rarity,
      node.cardType,
      node.cost !== undefined && node.type === 'card' ? (node.cost === -1 ? 'X cost' : node.cost + ' cost') : '',
      node.degree ? node.degree + ' links' : ''
    ].filter(Boolean);

    $('entity-meta').innerHTML = chips.map(c => '<span class="chip">' + htmlEsc(c) + '</span>').join('');
    $('entity-description').textContent = node.description || 'No description available.';

    const facts = [];
    if (node.type === 'card') {
      if (node.target) facts.push(['Target', node.target]);
      if (node.keywords && node.keywords.length) facts.push(['Keywords', node.keywords.join(', ')]);
      if (node.tags && node.tags.length) facts.push(['Tags', node.tags.join(', ')]);
      if (node.vars && Object.keys(node.vars).length) {
        facts.push(['Base values', Object.entries(node.vars).map(([k,v]) => k.replace(/^power_/, '') + ': ' + v).join(' · ')]);
      }
    } else if (node.type === 'potion' && node.target) {
      facts.push(['Target', node.target]);
    } else if (node.type === 'mechanic' && node.mechanicGroup) {
      facts.push(['Mechanic group', node.mechanicGroup.replace(/_/g, ' ')]);
    }

    if (facts.length) {
      $('entity-facts').classList.remove('hidden');
      $('entity-facts').innerHTML = facts.map(([label, value]) =>
        '<div class="fact-card"><div class="fact-label">' + htmlEsc(label) + '</div><div class="fact-value">' + htmlEsc(value) + '</div></div>'
      ).join('');
    } else {
      $('entity-facts').classList.add('hidden');
      $('entity-facts').innerHTML = '';
    }

    const upgrade = node.type === 'card' ? (node.upgrade || {}) : {};
    if (Object.keys(upgrade).length) {
      $('upgrade-section').classList.remove('hidden');
      const description = upgrade.description ? '<div class="upgrade-card">' + htmlEsc(upgrade.description) + '</div>' : '';
      const deltas = Object.entries(upgrade)
        .filter(([key]) => key !== 'description')
        .map(([key, value]) =>
          '<div class="upgrade-delta"><span class="upgrade-key">' + htmlEsc(key.replace(/_/g, ' ')) +
          '</span><span class="upgrade-value">+' + htmlEsc(value) + '</span></div>'
        ).join('');
      $('upgrade-card').innerHTML = description + deltas;
    } else {
      $('upgrade-section').classList.add('hidden');
      $('upgrade-card').innerHTML = '';
    }

    const outgoing = (state.outAdj.get(id) || []).map(edge => ({
      edge,
      node: state.byId.get(edge.target)
    })).filter(item => item.node);

    const incoming = (state.inAdj.get(id) || []).map(edge => ({
      edge,
      node: state.byId.get(edge.source)
    })).filter(item => item.node);

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

    $('center-force').value = 12;
    $('repel-force').value = 170;
    $('link-force').value = 28;
    $('link-distance').value = 92;
    $('pin-dragged').checked = false;

    state.visibleTypes = new Set(Object.keys(TYPE_LABELS));
    $('type-filters').querySelectorAll('input').forEach(i => i.checked = true);

    updatePhysics();
    applyFilters(true);
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
      .filter(node => !q || norm(node.name).includes(q) || norm(node.description).includes(q))
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
      ? state.paletteMatches.map((node, index) =>
          '<div class="palette-result' + (index === state.paletteIndex ? ' active' : '') + '" data-id="' + htmlEsc(node.id) + '">' +
          '<span class="palette-result-dot" style="background:' + TYPE_CSS[node.type] + '"></span>' +
          '<span class="palette-result-name">' + htmlEsc(node.name) + '</span>' +
          '<span class="palette-result-meta">' + htmlEsc(TYPE_LABELS[node.type].replace(/s$/, '')) + '</span></div>'
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

    const node = state.byId.get(id);
    if (!node) return;

    if (!matchesFilters(node)) {
      $('search-input').value = '';
      $('color-filter').value = 'all';
      $('rarity-filter').value = 'all';
      $('card-type-filter').value = 'all';
      $('cost-filter').value = 'all';

      state.visibleTypes.add(node.type);
      const typeBox = $('type-filters').querySelector('input[data-type="' + node.type + '"]');
      if (typeBox) typeBox.checked = true;

      applyFilters(false);
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
      state.edges = buildEdges(state.nodes, manualLinks, raw.cardPowers);
      buildAdjacency();

      initPixi();
      setupControls();
      applyFilters(false);

      setTimeout(fitGraph, 500);

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