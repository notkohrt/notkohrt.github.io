# STS2 Bubble development

The public graph is intentionally built from a **pinned local snapshot** of Spire Archive rather than reading `main` at runtime. This keeps relationships reproducible while Slay the Spire 2 is changing during Early Access.

## Architecture and local development

The website is static HTML/CSS and a browser ES module. Pixi 7.4.2 renders the graph and d3 7.9.0 runs the force simulation; the deployed site has no build step or npm runtime dependency. esbuild is a development dependency for the standalone preview artifact.

Rendering is scheduled on simulation ticks and interaction changes. Settled layouts stop rebuilding edges; opening the quick switcher or hiding the tab pauses simulation work. Camera changes and selection still request a frame.

`lib/graph-geometry.mjs` assigns deterministic lanes to parallel and reciprocal edges, clips paths outside their nodes, and aligns arrows with the curve tangent. Single edges use straight lines; only multiple relationships need curves. The force layout uses one spring per unordered entity pair so additional semantic roles do not change their attraction.

`lib/graph-model.mjs` owns entity normalization, mention and mechanic parsers, ontology edges, character overrides, relationship families, and collision-safe vault paths. The browser, graph validator, and Obsidian generator import this same model. Change semantic rules there rather than maintaining separate browser and vault implementations.

`buildEdges` runs the card-type, tag, and character-mechanic parsers for every description as well as entity mentions, effects, and resources. Their endpoints include concrete Orbs, Summon, Osty commands, Forge, Replay, Stars, and card-type operations. Bare “interacts with” and “uses Stars” fallback labels are excluded. Tests exercise all five characters and card/power counterparts to catch missing parser integration.

Family labels and colors also live in the shared model. Keyword/tag membership has its own filter; upgrades, shuffling, automatic play, HP-loss limits, and other generated roles have specific families instead of falling into “Other.” Custom authored verbs can still use that fallback.

Each inspector relationship has a “Show connection” control. It highlights the directed path and its endpoints, labels the verb on the canvas, and shows the source entity's text without changing the selected note or shareable URL. Tracing reveals hidden endpoints and preserves edge filters; local direction toggles still govern the rest of the neighborhood. Changing filters clears a trace that is no longer visible. On mobile, tracing closes the reading drawer to reveal the graph; reopening Note retains the selected entity.

Use Node 20, matching CI:

```sh
npm ci --ignore-scripts
npm run check
python3 -m http.server 8000 --bind 127.0.0.1
```

`package.json` contains development dependencies only. Browser tests use the exact pinned Pixi/d3 distributions from the integrity-checked lockfile and omit the optional tooltip widget, so graph checks are independent of external CDN availability.

Serve the complete checkout over HTTP so the HTML, stylesheet, ES modules, and pinned JSON files are available together. An individual `index.html` file preview cannot run this app. `lib/browser-data.mjs` resolves pinned data relative to the checkout, so hosting at a nested path works as well as hosting at the domain root. Browser checks verify styling and loading under a nested preview path.

For a portable preview that can be opened as a single file:

```sh
npm run build:preview
```

Open `dist/sts2-bubble-preview.html` in a browser, or pass `-- --output /tmp/preview.html` to write elsewhere. The builder validates the snapshot, embeds the stylesheet, bundles the same app/model/geometry with the exact locked Pixi/d3 versions, and includes every pinned JSON file plus curated links. It omits the optional external tooltip widget. No server or network request is needed. This is a generated artifact; edit the shared source files and regenerate it. CI checks deterministic snapshot parity, exercises a single HTML response with all asset/external requests blocked, and uploads the HTML for review.

```sh
npx playwright install chromium
npm run test:browser
```

If Chromium is already installed, `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser` uses it. The tests start their own local server on port 8123 and cover graph rendering, shareable URLs, filtered-note navigation, inspector pagination, keyboard focus, and mobile drawers.

Generate a vault without rewriting checkout files:

```sh
node scripts/build-vault.mjs --output /tmp/sts2-vault
```

This reads the pinned repository data and existing curated blocks, and writes entity notes plus `data/manual-links.json` under the output directory. To edit curated relationships there, open that directory's `vault` folder and regenerate using the same output path. The default command still writes into the repository's `vault` and exports the authored layer to the website.

## Normal update cycle

1. `node scripts/update-data.mjs` — refresh `data/sts2/` and write snapshot metadata.
2. Review upstream game-data changes.
3. `node scripts/validate-graph.mjs` — verify semantic endpoints and source pinning.
4. Update semantic parsers/overrides when changed card text requires it.
5. `node scripts/build-vault.mjs` — regenerate the Obsidian vault.
6. Review the graph with provenance and relationship-family filters before deployment.

## Relationship policy

An edge should explain a mechanical interaction. A bare text mention is not enough. This applies to curated links as well: `references`, `related`, `synergizes`, `interacts with`, and bare `uses Stars`/`uses keyword` are not mechanical relationships. The validator and vault curator parser share this policy in `isMechanicalRelation`.

Prefer explicit and high-confidence relationships such as `creates`, `applies`, `grants`, `triggers on`, `scales with`, `requires`, `moves from/to`, `channels`, `evokes`, `forges`, or a similarly precise verb. Subjective deck-building synergy should not be represented as a factual mechanical edge.

Parse each mention in its own clause. In “Whenever you apply Poison, gain Strength,” Poison is the trigger and Strength is the reward. Keep both roles when one target is mentioned twice, honor negated actions, and prefer a full entity name over overlapping shorter names. Exceptional character overrides replace inferred relationships for that source/target pair.

Effect parsing separates conditions from rewards at commas, periods, and semicolons; published line breaks can wrap a sentence. Match each effect in its own clause and retain each distinct role. “Whenever you draw an Ethereal card, draw 1 card” both triggers on draw and draws. “Whenever you apply Vulnerable, draw 1 card” only draws. Resource edges must also distinguish triggering on Block/HP loss, granting Block/Energy, preventing gain, and limiting loss. Inflected verbs share a vocabulary, and negation belongs to its own action rather than a later action in the sentence.

Relationship-family coloring follows the role before the object: “triggers on card creation” is a trigger and “requires Doom application” is a requirement. Regression tests cover these distinctions.

## Data provenance

`data/sts2/meta.json` records the exact Spire Archive source commit and reported game-data version used by the site. The UI exposes this snapshot information.

## Validation

`npm run check` checks every JavaScript module, validates the emitted graph and snapshot metadata, and runs parser/pinned-dataset regressions plus a complete website/vault parity check. Vault tests preserve curated text, compare every generated note's outgoing edges with the website model, and verify deterministic regeneration and safe failure on invalid curated links.

The validator rejects duplicate IDs/paths, missing rule and manual endpoints, self edges, bare mentions, generic damage/play hubs, and unpinned metadata. It reports entity/character coverage and relationship-family counts. Some IDs in the upstream `card_powers.json` are absent from its entity lists; these are reported as `unresolved_card_power_mappings`, excluded from emitted edges, and kept separate from validation failures. Review these diagnostics during data updates instead of inventing replacement powers or altering the pinned input.

GitHub Actions runs semantic/vault and geometry checks plus browser checks on pushes to `main`, `feat/sts2-graph-clean`, and `codex/**`, and on pull requests to `main`. Browser checks cover tracing and parallel roles, backlink source text, keyboard focus, filter invalidation, and mobile reading/graph transitions. The scheduled data-refresh workflow runs the same semantic/vault checks before opening a snapshot update PR; parser regressions require review when upstream mechanics change.
