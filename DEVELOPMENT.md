# STS2 Bubble development

The public graph is intentionally built from a **pinned local snapshot** of Spire Archive rather than reading `main` at runtime. This keeps relationships reproducible while Slay the Spire 2 is changing during Early Access.

## Normal update cycle

1. `node scripts/update-data.mjs` — refresh `data/sts2/` and write snapshot metadata.
2. Review upstream game-data changes.
3. `node scripts/validate-graph.mjs` — verify semantic endpoints and source pinning.
4. Update semantic parsers/overrides when changed card text requires it.
5. `node scripts/build-vault.mjs` — regenerate the Obsidian vault.
6. Review the graph with provenance and relationship-family filters before deployment.

## Relationship policy

An edge should explain a mechanical interaction. A bare text mention is not enough.

Prefer explicit and high-confidence relationships such as `creates`, `applies`, `grants`, `triggers on`, `scales with`, `requires`, `moves from/to`, `channels`, `evokes`, `forges`, or a similarly precise verb. Subjective deck-building synergy should not be represented as a factual mechanical edge.

## Data provenance

`data/sts2/meta.json` records the exact Spire Archive source commit and reported game-data version used by the site. The UI exposes this snapshot information.

## Validation

GitHub Actions runs syntax checks plus `scripts/validate-graph.mjs` on pushes to the graph branch and on pull requests to `main`.
