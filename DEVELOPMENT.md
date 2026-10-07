# STS2 Bubble development

The public graph is intentionally built from a **pinned local snapshot** of Spire Archive rather than reading `main` at runtime. This keeps relationships reproducible while Slay the Spire 2 is changing during Early Access.

## Architecture and local development

The website is static HTML/CSS and a browser ES module. Pixi 7.4.2 renders the graph and d3 7.9.0 runs the force simulation; there is no production bundler or npm runtime dependency.

Rendering is scheduled on simulation ticks and interaction changes. Settled layouts stop rebuilding edges; opening the quick switcher or hiding the tab pauses simulation work. Camera changes and selection still request a frame.

`lib/graph-model.mjs` owns entity normalization, mention and mechanic parsers, ontology edges, character overrides, relationship families, and collision-safe vault paths. The browser, graph validator, and Obsidian generator import this same model. Change semantic rules there rather than maintaining separate browser and vault implementations.

Use Node 20, matching CI:

```sh
npm ci --ignore-scripts
npm run check
python3 -m http.server 8000 --bind 127.0.0.1
```

`package.json` contains development dependencies only. Browser tests use the exact pinned Pixi/d3 distributions from the integrity-checked lockfile and omit the optional tooltip widget, so graph checks are independent of external CDN availability.

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

An edge should explain a mechanical interaction. A bare text mention is not enough. This applies to curated links as well: `references`, `related`, and `synergizes` are not mechanical relationships.

Prefer explicit and high-confidence relationships such as `creates`, `applies`, `grants`, `triggers on`, `scales with`, `requires`, `moves from/to`, `channels`, `evokes`, `forges`, or a similarly precise verb. Subjective deck-building synergy should not be represented as a factual mechanical edge.

Parse each mention in its own clause. In “Whenever you apply Poison, gain Strength,” Poison is the trigger and Strength is the reward. Keep both roles when one target is mentioned twice, honor negated actions, and prefer a full entity name over overlapping shorter names. Exceptional character overrides replace inferred relationships for that source/target pair.

Relationship-family coloring follows the role before the object: “triggers on card creation” is a trigger and “requires Doom application” is a requirement. Regression tests cover these distinctions.

## Data provenance

`data/sts2/meta.json` records the exact Spire Archive source commit and reported game-data version used by the site. The UI exposes this snapshot information.

## Validation

`npm run check` checks every JavaScript module, validates the emitted graph and snapshot metadata, and runs parser/pinned-dataset regressions plus a complete website/vault parity check. Vault tests preserve curated text, compare every generated note's outgoing edges with the website model, and verify deterministic regeneration and safe failure on invalid curated links.

The validator rejects duplicate IDs/paths, missing rule and manual endpoints, self edges, bare mentions, generic damage/play hubs, and unpinned metadata. It reports entity/character coverage and relationship-family counts. Some IDs in the upstream `card_powers.json` are absent from its entity lists; these are reported as `unresolved_card_power_mappings`, excluded from emitted edges, and kept separate from validation failures. Review these diagnostics during data updates instead of inventing replacement powers or altering the pinned input.

GitHub Actions runs semantic/vault checks and browser checks on pushes and pull requests. The scheduled data-refresh workflow runs the same semantic/vault checks before opening a snapshot update PR; parser regressions require review when upstream mechanics change.
