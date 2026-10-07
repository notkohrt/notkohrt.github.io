# STS2 Bubble

This is the authoring vault behind the public graph at notkohrt.pro.

## Workflow

1. Run `node ../scripts/build-vault.mjs` from this folder, or `node scripts/build-vault.mjs` from the repository root.
2. Open this `vault` folder in Obsidian.
3. Browse generated cards, relics, powers, potions, enchantments, and keywords.
4. Add high-confidence relationships inside a note's **Curated relationships** block.
5. Run the generator again to export those relationships to the website.

The website treats curated links separately from text-derived links so subjective synergy does not silently become a factual game relationship.

## Relationship vocabulary

Prefer specific mechanical verbs:

- `creates`
- `modifies`
- `triggers`
- `requires`
- `grants`
- `applies`
- `consumes`
- `transforms`
- `moves`

Every curated link should explain a concrete mechanic. Bare `references`, `related`, `interacts with`, `uses Stars`/`uses keyword`, and subjective `synergizes` links are rejected. Unknown targets and invalid verbs stop generation before authored notes or exports are rewritten.
