import { SOURCES, SOURCE_META_URL, normalizeData, buildEdges, relationFamily, createNodePaths } from './lib/graph-model.mjs';

(() => {
  const RELATION_FAMILY_LABELS = {
    creation: 'Create / transform',
    application: 'Apply / grant',
    trigger: 'Triggers / payoffs',
    scaling: 'Scaling',
    requirement: 'Requirements',
    movement: 'Move / play',
    modification: 'Modify / retain',
    resource: 'Resources / actions',
    other: 'Other'
  };

  const RELATION_FAMILY_COLORS = {
    creation: 0x72b6d9,
    application: 0x70b58a,
    trigger: 0xd5a85f,
    scaling: 0xb985d6,
    requirement: 0xd27b72,
    movement: 0x7f9fd1,
    modification: 0xc58aa8,
    resource: 0x8da56e,
    other: 0x6f747c
  };

  const RELATION_FAMILY_CSS = {
    creation: '#72b6d9',
    application: '#70b58a',
    trigger: '#d5a85f',
    scaling: '#b985d6',
    requirement: '#d27b72',
    movement: '#7f9fd1',
    modification: '#c58aa8',
    resource: '#8da56e',
    other: '#6f747c'
  };

  const TYPE_COLORS = {
    card: 0x8b83d6,
    relic: 0xc19a63,
    power: 0xa276bd,
    potion: 0x65a7a1,
    enchantment: 0xc9829f,
    keyword: 0x7f9a72,
    mechanic: 0x6f8fb5,
    tag: 0x9a875f,
    effect: 0x7f8794
  };

  const TYPE_CSS = {
    card: '#8b83d6',
    relic: '#c19a63',
    power: '#a276bd',
    potion: '#65a7a1',
    enchantment: '#c9829f',
    keyword: '#7f9a72',
    mechanic: '#6f8fb5',
    tag: '#9a875f',
    effect: '#7f8794'
  };

  const TYPE_LABELS = {
    card: 'Cards',
    relic: 'Relics',
    power: 'Powers',
    potion: 'Potions',
    enchantment: 'Enchantments',
    keyword: 'Keywords',
    mechanic: 'Mechanics',
    tag: 'Tags',
    effect: 'Effects'
  };

  const state = {
    nodes: [],
    edges: [],
    byId: new Map(),
    nodePaths: new Map(),
    outAdj: new Map(),
    inAdj: new Map(),

    pixi: null,
    renderPending: null,
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
    visibleProvenance: new Set(),
    visibleRelationFamilies: new Set(),
    datasetMeta: {},

    paletteIndex: 0,
    paletteMatches: [],
    paletteReturnFocus: null,
    inspectorId: null,
    inspectorLimits: { outgoing: 50, incoming: 50 },

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
      autoStart: false,
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
      requestRender();
    }).observe(host);

    document.addEventListener('visibilitychange', syncAnimation);
  }

  // Render on simulation ticks and interaction changes. A settled graph should
  // not rebuild every edge and redraw WebGL continuously while someone reads.
  function requestRender() {
    if (state.renderPending !== null || document.hidden || !state.pixi) return;
    state.renderPending = requestAnimationFrame(() => {
      state.renderPending = null;
      renderFrame();
      state.pixi.render();
    });
  }

  function syncAnimation() {
    const paused = document.hidden || !$('palette-backdrop').classList.contains('hidden');
    if (paused) state.simulation?.stop();
    else {
      if (state.simulation?.alpha() >= state.simulation?.alphaMin()) state.simulation.restart();
      requestRender();
    }
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
      node._dragMoved = false;
      node._pointerStartX = e.global.x;
      node._pointerStartY = e.global.y;

      const p = state.world.toLocal(e.global);
      node.fx = node.x;
      node.fy = node.y;
      node._dragOffsetX = node.x - p.x;
      node._dragOffsetY = node.y - p.y;

      if (state.simulation) state.simulation.alphaTarget(0.22).restart();
    });

    view.on('pointertap', e => {
      e.stopPropagation();

      if (node._dragMoved) {
        node._dragMoved = false;
        return;
      }

      if (state.focusedId === node.id) clearFocus();
      else focusNode(node.id);
    });

    view.on('pointerover', () => {
      state.hoveredId = node.id;
      styleNodeView(node);
      state.hoverLabel.text = node.name;
      state.hoverLabel.visible = true;
      requestRender();
    });

    view.on('pointerout', () => {
      if (state.hoveredId === node.id) state.hoveredId = null;
      styleNodeView(node);
      state.hoverLabel.visible = false;
      requestRender();
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
    requestRender();
  }

  function rebuildSimulation() {
    if (state.simulation) state.simulation.stop();

    state.simEdges = state.visibleEdges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relation: edge.relation,
      family: relationFamily(edge.relation),
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
      .on('tick', requestRender)
      .on('end', requestRender)
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
      const active = state.simulation.alpha() >= state.simulation.alphaMin() || Boolean(state.draggingNode);
      $('physics-badge').classList.toggle('active', active);
      $('physics-badge').textContent = active ? 'live physics' : 'layout settled';
    }
  }

  function drawEdges() {
    state.edgeLayer.clear();

    for (const edge of state.simEdges) {
      const source = edge.source;
      const target = edge.target;
      if (!source || !target || !Number.isFinite(source.x) || !Number.isFinite(target.x)) continue;

      const dx = target.x - source.x;
      const dy = target.y - source.y;
      const length = Math.hypot(dx, dy);
      if (length < 1) continue;

      const ux = dx / length;
      const uy = dy / length;
      const sourceRadius = source.radius || 4;
      const targetRadius = target.radius || 4;
      const startX = source.x + ux * Math.min(sourceRadius + 1, length * 0.25);
      const startY = source.y + uy * Math.min(sourceRadius + 1, length * 0.25);
      const endX = target.x - ux * Math.min(targetRadius + 2, length * 0.3);
      const endY = target.y - uy * Math.min(targetRadius + 2, length * 0.3);

      const family = edge.family || relationFamily(edge.relation);
      let color = RELATION_FAMILY_COLORS[family] || RELATION_FAMILY_COLORS.other;
      let alpha = edge.provenance === 'description' ? 0.12 : 0.24;
      let width = 0.8;
      let emphasize = false;

      if (edge.provenance === 'curated') {
        alpha = 0.7;
        width = 1.45;
      } else if (edge.provenance === 'explicit') {
        alpha = 0.42;
        width = 1;
      }

      if (state.focusedId) {
        const touches = source.id === state.focusedId || target.id === state.focusedId;
        emphasize = touches;
        if (state.viewMode === 'global') {
          alpha = touches ? Math.max(alpha, 0.82) : 0.018;
          width = touches ? Math.max(width, 1.35) : 0.5;
        } else if (touches) {
          alpha = Math.max(alpha, 0.76);
          width = Math.max(width, 1.25);
        }
      }

      state.edgeLayer.lineStyle(width, color, alpha);
      state.edgeLayer.moveTo(startX, startY);
      state.edgeLayer.lineTo(endX, endY);

      const showArrow = emphasize || (state.viewMode === 'local' && state.visibleEdges.length <= 90);
      if (showArrow && alpha > 0.08) {
        const arrowLength = 7;
        const arrowWidth = 3.4;
        const baseX = endX - ux * arrowLength;
        const baseY = endY - uy * arrowLength;
        const px = -uy;
        const py = ux;

        state.edgeLayer.beginFill(color, Math.min(0.9, alpha + 0.08));
        state.edgeLayer.drawPolygon([
          endX, endY,
          baseX + px * arrowWidth, baseY + py * arrowWidth,
          baseX - px * arrowWidth, baseY - py * arrowWidth
        ]);
        state.edgeLayer.endFill();
      }
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
      const node = state.draggingNode;
      const dx = e.global.x - (node._pointerStartX || e.global.x);
      const dy = e.global.y - (node._pointerStartY || e.global.y);

      if (Math.hypot(dx, dy) > 6) node._dragMoved = true;

      const p = state.world.toLocal(e.global);
      node.fx = p.x + (node._dragOffsetX || 0);
      node.fy = p.y + (node._dragOffsetY || 0);
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
      requestRender();
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
      state.draggingNode._pointerStartX = null;
      state.draggingNode._pointerStartY = null;
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
    requestRender();
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
    requestRender();
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
    requestRender();
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
    requestRender();
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

  function edgePassesFilters(edge) {
    if (!state.visibleProvenance.has(edge.provenance || 'description')) return false;
    if (!state.visibleRelationFamilies.has(relationFamily(edge.relation))) return false;
    return true;
  }

  function renderEdgeFilters() {
    const provenanceCounts = new Map();
    const familyCounts = new Map();

    for (const edge of state.edges) {
      const provenance = edge.provenance || 'description';
      const family = relationFamily(edge.relation);
      provenanceCounts.set(provenance, (provenanceCounts.get(provenance) || 0) + 1);
      familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
    }

    const provenances = [...provenanceCounts.keys()].sort();
    state.visibleProvenance = new Set(provenances);
    state.visibleRelationFamilies = new Set(Object.keys(RELATION_FAMILY_LABELS).filter(key => familyCounts.has(key)));

    $('provenance-filters').innerHTML = provenances.map(value =>
      '<label class="toggle-row compact-toggle"><input type="checkbox" data-provenance="' + htmlEsc(value) + '" checked>' +
      '<span>' + htmlEsc(value) + '</span><span class="filter-count">' + provenanceCounts.get(value) + '</span></label>'
    ).join('');

    $('relation-filters').innerHTML = Object.entries(RELATION_FAMILY_LABELS)
      .filter(([key]) => familyCounts.has(key))
      .map(([key, label]) =>
        '<label class="toggle-row compact-toggle"><input type="checkbox" data-relation-family="' + htmlEsc(key) + '" checked>' +
        '<span class="family-label"><span class="family-swatch" style="background:' + RELATION_FAMILY_CSS[key] + '"></span>' +
        htmlEsc(label) + '</span><span class="filter-count">' + familyCounts.get(key) + '</span></label>'
      ).join('');

    $('provenance-filters').querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) state.visibleProvenance.add(input.dataset.provenance);
        else state.visibleProvenance.delete(input.dataset.provenance);
        applyFilters(true);
        if (state.focusedId) renderInspector(state.focusedId);
      });
    });

    $('relation-filters').querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => {
        if (input.checked) state.visibleRelationFamilies.add(input.dataset.relationFamily);
        else state.visibleRelationFamilies.delete(input.dataset.relationFamily);
        applyFilters(true);
        if (state.focusedId) renderInspector(state.focusedId);
      });
    });
  }

  function setNodeInUrl(id, replace) {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('node', id);
    else url.searchParams.delete('node');
    const stateValue = id ? { node: id } : {};
    if (replace) window.history.replaceState(stateValue, '', url);
    else window.history.pushState(stateValue, '', url);
  }

  function syncFocusFromUrl() {
    const id = new URL(window.location.href).searchParams.get('node');
    if (id && state.byId.has(id)) focusNode(id, false);
    else clearFocus(false);
  }

  function optionize(el, values, formatter) {
    formatter = formatter || (v => v);
    const first = el.options[0].outerHTML;

    el.innerHTML = first + values
      .filter(value => value !== null && value !== undefined && value !== '')
      .sort((a, b) => String(a).localeCompare(String(b)))
      .map(v => '<option value="' + htmlEsc(v) + '">' + htmlEsc(formatter(v)) + '</option>')
      .join('');
  }

  function setupControls() {
    renderTypeFilters();
    renderLegend();
    renderEdgeFilters();

    optionize($('color-filter'), [...new Set(state.nodes.map(n => n.color).filter(Boolean))]);
    optionize(
      $('rarity-filter'),
      [...new Set(
        state.nodes
          .filter(n => ['card', 'relic', 'potion', 'enchantment'].includes(n.type))
          .map(n => n.rarity)
          .filter(Boolean)
      )]
    );
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
        document.querySelectorAll('.depth-button').forEach(b => {
          b.classList.toggle('active', b === button);
          b.setAttribute('aria-pressed', String(b === button));
        });
        if (state.viewMode === 'local') applyFilters(true);
      });
    });

    $('reset-filters').addEventListener('click', resetFilters);
    $('clear-focus').addEventListener('click', clearFocus);
    $('copy-link').addEventListener('click', async () => {
      if (!state.focusedId) return;
      const url = new URL(window.location.href);
      url.searchParams.set('node', state.focusedId);

      try {
        await navigator.clipboard.writeText(url.toString());
        const button = $('copy-link');
        const previous = button.textContent;
        button.textContent = 'Copied';
        setTimeout(() => { button.textContent = previous; }, 1200);
      } catch (_) {
        window.prompt('Copy this node link:', url.toString());
      }
    });
    $('fit-graph').addEventListener('click', fitGraph);
    $('zoom-in').addEventListener('click', () => zoomBy(1.18));
    $('zoom-out').addEventListener('click', () => zoomBy(1 / 1.18));

    $('filters-toggle').addEventListener('click', () => setPanelOpen('filters', true, true));
    $('filters-close').addEventListener('click', () => setPanelOpen('filters', false));
    $('inspector-toggle').addEventListener('click', () => setPanelOpen('inspector', true, true));
    $('inspector-close').addEventListener('click', () => setPanelOpen('inspector', false));
    window.matchMedia('(max-width: 900px)').addEventListener('change', syncPanels);
    syncPanels();

    $('command-button').addEventListener('click', openPalette);
    $('palette-close').addEventListener('click', closePalette);
    $('palette-backdrop').addEventListener('mousedown', e => {
      if (e.target === $('palette-backdrop')) closePalette();
    });
    $('palette-input').addEventListener('input', updatePalette);
    $('palette-input').addEventListener('keydown', handlePaletteKeys);
    for (const direction of ['outgoing', 'incoming']) {
      const list = $(direction === 'outgoing' ? 'outgoing-list' : 'backlinks-list');
      list.addEventListener('click', e => {
        const relation = e.target.closest('.relation[data-target]');
        if (relation) {
          focusNode(relation.dataset.target);
          $('entity-name').focus({ preventScroll: true });
        } else if (e.target.closest('.relations-more')) {
          state.inspectorLimits[direction] += 50;
          renderInspector(state.focusedId);
          const more = list.querySelector('.relations-more');
          (more || list.querySelector('.relation:last-child'))?.focus({ preventScroll: true });
        }
      });
    }

    window.addEventListener('popstate', syncFocusFromUrl);

    document.addEventListener('keydown', e => {
      if (!$('palette-backdrop').classList.contains('hidden') && e.key === 'Tab') {
        const first = $('palette-input'), last = $('palette-close');
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      const ctrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k';

      if (ctrlK) {
        e.preventDefault();
        openPalette();
        return;
      }

      if (e.key === '/' && !document.activeElement.matches('input, textarea, select, [contenteditable="true"]')) {
        e.preventDefault();
        if (window.innerWidth <= 900) setPanelOpen('filters', true);
        $('search-input').focus();
      }

      if (e.key === 'Escape') {
        if (!$('palette-backdrop').classList.contains('hidden')) closePalette();
        else if (window.innerWidth <= 900 && $('filters-panel').classList.contains('open')) setPanelOpen('filters', false);
        else if (window.innerWidth <= 900 && $('inspector-panel').classList.contains('open')) setPanelOpen('inspector', false);
        else clearFocus();
      }
    });
  }

  function syncPanels() {
    const mobile = window.innerWidth <= 900;
    for (const name of ['filters', 'inspector']) {
      const panel = $(name + '-panel');
      const open = panel.classList.contains('open');
      panel.inert = mobile && !open;
      $(name + '-toggle').setAttribute('aria-expanded', String(mobile && open));
    }
  }

  function setPanelOpen(name, open, moveFocus = false) {
    const panel = $(name + '-panel');
    const returnFocus = !open && panel.contains(document.activeElement);
    if (open && window.innerWidth <= 900) {
      $('filters-panel').classList.remove('open');
      $('inspector-panel').classList.remove('open');
    }
    panel.classList.toggle('open', open);
    syncPanels();
    if (returnFocus) $(name + '-toggle').focus();
    if (moveFocus && window.innerWidth <= 900) $(name + '-close').focus();
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    $('global-mode').classList.toggle('active', mode === 'global');
    $('local-mode').classList.toggle('active', mode === 'local');
    $('global-mode').setAttribute('aria-pressed', String(mode === 'global'));
    $('local-mode').setAttribute('aria-pressed', String(mode === 'local'));
    document.querySelectorAll('.depth-button').forEach(button => { button.disabled = mode !== 'local'; });
    $('depth-controls').classList.toggle('disabled', mode !== 'local');
    $('selection-hint').classList.toggle('hidden', !(mode === 'local' && !state.focusedId));
    applyFilters(true);
  }

  function matchesFilters(node) {
    if (!state.visibleTypes.has(node.type)) return false;

    const q = norm($('search-input').value);
    if (q && !(norm(node.name).includes(q) || norm(node.description).includes(q))) return false;

    const rarity = $('rarity-filter').value;
    if (rarity !== 'all' && ['card', 'relic', 'potion', 'enchantment'].includes(node.type)) {
      if (node.rarity !== rarity) return false;
    }

    const cardType = $('card-type-filter').value;
    if (cardType !== 'all' && node.type === 'card' && node.cardType !== cardType) return false;

    const cost = $('cost-filter').value;
    if (cost !== 'all' && node.type === 'card' && String(node.cost) !== cost) return false;

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
            if (!edgePassesFilters(edge)) continue;
            if (baseAllowed.has(edge.target) && !found.has(edge.target)) {
              found.add(edge.target);
              next.add(edge.target);
            }
          }
        }

        if (incoming) {
          for (const edge of state.inAdj.get(id) || []) {
            if (!edgePassesFilters(edge)) continue;
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
    const eligibleEdges = state.edges.filter(edgePassesFilters);
    let visible = new Set(baseAllowed);

    const color = $('color-filter').value;
    if (color !== 'all') {
      const contextColors = new Set(['shared', 'colorless', 'status', 'curse', 'token', 'event', 'quest']);
      const seeds = new Set(
        state.nodes
          .filter(node => baseAllowed.has(node.id) && node.color === color)
          .map(node => node.id)
      );

      visible = new Set(seeds);

      for (const edge of eligibleEdges) {
        let otherId = null;

        if (seeds.has(edge.source)) otherId = edge.target;
        else if (seeds.has(edge.target)) otherId = edge.source;

        if (!otherId || !baseAllowed.has(otherId)) continue;

        const other = state.byId.get(otherId);
        if (!other) continue;

        if (!other.color || other.color === color || contextColors.has(other.color)) {
          visible.add(otherId);
        }
      }
    }

    if (state.viewMode === 'local' && state.focusedId && visible.has(state.focusedId)) {
      visible = collectLocal(state.focusedId, visible);
    }

    let visibleEdges = eligibleEdges.filter(e => visible.has(e.source) && visible.has(e.target));

    if ($('isolated-filter').checked && !$('search-input').value && state.viewMode === 'global') {
      const connected = new Set();

      for (const edge of visibleEdges) {
        connected.add(edge.source);
        connected.add(edge.target);
      }

      visible = new Set([...visible].filter(id => connected.has(id) || id === state.focusedId));
      visibleEdges = eligibleEdges.filter(e => visible.has(e.source) && visible.has(e.target));
    }

    if (state.focusedId && !visible.has(state.focusedId)) {
      state.focusedId = null;
      setNodeInUrl(null, true);
      $('clear-focus').disabled = true;
      $('copy-link').disabled = true;
      document.title = 'STS2 Bubble — Slay the Spire 2 Interaction Graph';
      $('entity-card').classList.add('hidden');
      $('inspector-empty').classList.remove('hidden');
      $('note-path').textContent = 'No note selected';
      $('note-panel-title').textContent = 'Reading view';
      setPanelOpen('inspector', false);
    }

    state.visibleNodes = [...visible].map(id => state.byId.get(id)).filter(Boolean);
    state.visibleEdges = visibleEdges;

    rebuildScene();

    const modeLabel = state.viewMode === 'local' ? 'local · depth ' + state.depth : 'global';
    const colorLabel = $('color-filter').value !== 'all' ? ' · ' + $('color-filter').value : '';
    $('graph-summary').textContent = modeLabel + colorLabel + ' · ' + state.visibleNodes.length + ' nodes · ' + state.visibleEdges.length + ' links';
    $('selection-hint').classList.toggle('hidden', !(state.viewMode === 'local' && !state.focusedId));

    if (shouldFit) setTimeout(fitGraph, 160);
  }

  function updateAllNodeStyles() {
    for (const node of state.visibleNodes) styleNodeView(node);
    requestRender();
  }

  function focusNode(id, writeUrl = true) {
    const node = state.byId.get(id);
    if (!node) return;

    // Navigation must also reveal a note excluded by the current character or
    // node filters. Edge filters remain useful while reading that note.
    const reveal = !state.visibleNodes.some(visible => visible.id === id);
    if (reveal) {
      $('search-input').value = '';
      for (const filter of ['color-filter', 'rarity-filter', 'card-type-filter', 'cost-filter']) $(filter).value = 'all';
      state.visibleTypes.add(node.type);
      const typeBox = $('type-filters').querySelector('input[data-type="' + node.type + '"]');
      if (typeBox) typeBox.checked = true;
    }

    state.focusedId = id;
    if (writeUrl) setNodeInUrl(id, false);
    document.title = node.name + ' — STS2 Bubble';
    $('clear-focus').disabled = false;
    $('copy-link').disabled = false;
    renderInspector(id);

    if (state.viewMode === 'local' || reveal) {
      applyFilters(true);
    } else {
      updateAllNodeStyles();
      setTimeout(() => fitNeighborhood(id), 20);
    }

    if (window.innerWidth <= 900) setPanelOpen('inspector', true);
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
    requestRender();
  }

  function clearFocus(writeUrl = true) {
    state.focusedId = null;
    if (writeUrl) setNodeInUrl(null, false);
    document.title = 'STS2 Bubble — Slay the Spire 2 Interaction Graph';
    $('clear-focus').disabled = true;
    $('copy-link').disabled = true;
    setPanelOpen('inspector', false);

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
      edge.provenance === 'derived' ? 'derived' :
      edge.provenance === 'name-match' ? 'matched' : 'text';

    const family = relationFamily(edge.relation);
    return '<button type="button" class="relation" data-target="' + htmlEsc(node.id) + '">' +
      '<span class="relation-dot" style="background:' + TYPE_CSS[node.type] + '"></span>' +
      '<span><span class="relation-name">' + htmlEsc(node.name) + '</span>' +
      '<span class="relation-type"><span class="relation-family-dot" style="background:' + RELATION_FAMILY_CSS[family] + '"></span>' +
      htmlEsc(direction + ' · ' + edge.relation) +
      ' · <span class="relation-provenance">' + htmlEsc(provenance) + '</span></span></span></button>';
  }

  function renderInspector(id) {
    const node = state.byId.get(id);
    if (!node) return;
    if (state.inspectorId !== id) {
      state.inspectorId = id;
      state.inspectorLimits = { outgoing: 50, incoming: 50 };
      $('inspector-panel').scrollTop = 0;
    }

    $('inspector-empty').classList.add('hidden');
    $('entity-card').classList.remove('hidden');

    $('note-path').textContent = state.nodePaths.get(node.id);
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
          '</span><span class="upgrade-value">' + htmlEsc(
            typeof value === 'number' ? (value > 0 ? '+' + value : String(value)) :
            Array.isArray(value) ? value.join(', ') : String(value)
          ) + '</span></div>'
        ).join('');
      $('upgrade-card').innerHTML = description + deltas;
    } else {
      $('upgrade-section').classList.add('hidden');
      $('upgrade-card').innerHTML = '';
    }

    const outgoing = (state.outAdj.get(id) || [])
      .filter(edgePassesFilters)
      .map(edge => ({ edge, node: state.byId.get(edge.target) }))
      .filter(item => item.node);

    const incoming = (state.inAdj.get(id) || [])
      .filter(edgePassesFilters)
      .map(edge => ({ edge, node: state.byId.get(edge.source) }))
      .filter(item => item.node);

    $('outgoing-count').textContent = outgoing.length;
    $('backlinks-count').textContent = incoming.length;

    const renderRelations = (items, direction, label) => {
      const limit = state.inspectorLimits[direction];
      const sorted = items.sort((a, b) => a.node.name.localeCompare(b.node.name) || a.edge.relation.localeCompare(b.edge.relation));
      if (!sorted.length) return '<div class="empty-links">No ' + label + ' matching relationship filters.</div>';
      const rows = sorted.slice(0, limit).map(item => relationRow(item.edge, item.node, direction === 'outgoing' ? 'to' : 'from')).join('');
      return rows + (sorted.length > limit ? '<button type="button" class="ghost-button relations-more">Show more ' + label + ' (' + (sorted.length - limit) + ' remaining)</button>' : '');
    };
    $('outgoing-list').innerHTML = renderRelations(outgoing, 'outgoing', 'outgoing links');
    $('backlinks-list').innerHTML = renderRelations(incoming, 'incoming', 'backlinks');
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

    state.visibleProvenance = new Set([...$('provenance-filters').querySelectorAll('input')].map(i => i.dataset.provenance));
    $('provenance-filters').querySelectorAll('input').forEach(i => i.checked = true);
    state.visibleRelationFamilies = new Set([...$('relation-filters').querySelectorAll('input')].map(i => i.dataset.relationFamily));
    $('relation-filters').querySelectorAll('input').forEach(i => i.checked = true);

    updatePhysics();
    applyFilters(true);
    if (state.focusedId) renderInspector(state.focusedId);
  }

  function openPalette() {
    if (!$('palette-backdrop').classList.contains('hidden')) { $('palette-input').focus(); return; }
    state.paletteReturnFocus = document.activeElement;
    $('palette-backdrop').classList.remove('hidden');
    $('palette-input').setAttribute('aria-expanded', 'true');
    document.querySelector('.app-shell').inert = true;
    syncAnimation();
    $('palette-input').value = '';
    state.paletteIndex = 0;
    updatePalette();
    setTimeout(() => $('palette-input').focus(), 0);
  }

  function closePalette() {
    $('palette-backdrop').classList.add('hidden');
    $('palette-input').setAttribute('aria-expanded', 'false');
    document.querySelector('.app-shell').inert = false;
    syncAnimation();
    const previous = state.paletteReturnFocus;
    if (previous?.isConnected && !previous.closest('[inert]')) previous.focus({ preventScroll: true });
    else $('command-button').focus();
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

    state.paletteIndex = Math.max(0, Math.min(state.paletteIndex, state.paletteMatches.length - 1));

    $('palette-results').innerHTML = state.paletteMatches.length
      ? state.paletteMatches.map((node, index) =>
          '<div role="option" id="palette-result-' + index + '" aria-selected="' + (index === state.paletteIndex) + '" class="palette-result' + (index === state.paletteIndex ? ' active' : '') + '" data-id="' + htmlEsc(node.id) + '">' +
          '<span class="palette-result-dot" style="background:' + TYPE_CSS[node.type] + '"></span>' +
          '<span class="palette-result-name">' + htmlEsc(node.name) + '</span>' +
          '<span class="palette-result-meta">' + htmlEsc(TYPE_LABELS[node.type].replace(/s$/, '')) + '</span></div>'
        ).join('')
      : '<div class="empty-links">No matching notes.</div>';

    if (state.paletteMatches.length) {
      $('palette-input').setAttribute('aria-activedescendant', 'palette-result-' + state.paletteIndex);
      $('palette-result-' + state.paletteIndex).scrollIntoView({ block: 'nearest' });
    } else $('palette-input').removeAttribute('aria-activedescendant');

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
      e.stopPropagation();
      closePalette();
    }
  }

  function openPaletteResult(id) {
    closePalette();
    focusNode(id);
    if (state.byId.has(id)) $('entity-name').focus({ preventScroll: true });
  }

  async function boot() {
    try {
      const [entries, datasetMeta] = await Promise.all([
        Promise.all(Object.entries(SOURCES).map(async pair => [pair[0], await loadJson('/' + pair[1])])),
        loadJson('/' + SOURCE_META_URL)
      ]);

      const raw = Object.fromEntries(entries);
      const manualLinks = await loadJson('./data/manual-links.json');
      state.datasetMeta = datasetMeta || {};

      state.nodes = normalizeData(raw);
      state.nodePaths = createNodePaths(state.nodes);
      state.edges = buildEdges(state.nodes, manualLinks, raw.cardPowers);
      buildAdjacency();

      initPixi();
      setupControls();
      applyFilters(false);

      const initialNode = new URL(window.location.href).searchParams.get('node');
      if (initialNode && state.byId.has(initialNode)) {
        focusNode(initialNode, false);
      } else if (initialNode) {
        setNodeInUrl(null, true);
      }

      setTimeout(() => initialNode ? fitNeighborhood(initialNode) : fitGraph(), 500);

      $('loading-state').classList.add('hidden');
      $('dataset-status').classList.add('ready');
      const version = state.datasetMeta.game_data_version ? 'v' + state.datasetMeta.game_data_version : 'snapshot';
      $('dataset-status').innerHTML = '<span class="status-dot"></span><span>' + htmlEsc(version) + ' ready</span>';
      $('data-count').textContent = state.nodes.length + ' notes · ' + state.edges.length + ' links';
      if ($('data-snapshot')) {
        const shortSha = String(state.datasetMeta.source_commit || '').slice(0, 7);
        const date = state.datasetMeta.snapshot_date || '';
        $('data-snapshot').textContent = [version, date, shortSha].filter(Boolean).join(' · ');
      }
    } catch (err) {
      console.error(err);
      $('loading-state').innerHTML = '<strong>Could not load STS2 data</strong><span>' + htmlEsc(err.message) + '</span>';
      $('dataset-status').innerHTML = '<span class="status-dot"></span><span>Data unavailable</span>';
    }
  }

  window.addEventListener('DOMContentLoaded', boot);
})();
