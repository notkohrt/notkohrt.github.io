# STS2 Bubble

This is the authoring vault behind the public graph at notkohrt.pro.

Slay the Spire 2 and its game content are by [Mega Crit](https://www.megacrit.com/). This is an unofficial fan project; see [[README#Credits|Credits]] for attribution and the artwork permission request.

## Workflow

Open this `vault` folder in Obsidian and browse the generated cards, relics, powers, potions, enchantments, keywords, and mechanics. A downloaded build is ready to read after extracting the ZIP.

To author relationships and update the website, use a full repository checkout:

1. Run `npm run build:vault` from the repository root.
2. Add high-confidence relationships inside a note's **Curated relationships** block.
3. Run `npm run build:vault` again to export those relationships, then `npm run build:site` and `npm run check`.

The downloaded build includes the generated notes and website. Its scripts and complete source history are available in the repository recorded in the build's `manifest.json`. Preserve your edited notes before replacing a downloaded vault.

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
