# Deck analysis methods

Deck lab describes the entered deck using the pinned snapshot and existing graph roles. It does not rank cards or predict wins. All calculations work offline in the self-contained website. No deck data is sent to a service.

## Sampling model

For a deck of `N` copies with `K` copies of a card and a uniform sample of `n` cards without replacement, the number of copies drawn is hypergeometric:

`P(X = k) = C(K, k) C(N − K, n − k) / C(N, n)`.

The implementation builds that distribution sequentially instead of using factorials. This avoids overflow and supports full-deck samples. The interface shows `P(X ≥ 1)`. The library also supports minimum-copy requirements. Tests compare every possible hand for decks up to eight cards against both single-card and pair calculations.

For two distinct card IDs, the groups are disjoint. Inclusion–exclusion gives:

`P(A and B) = P(A) + P(B) − P(A or B)`.

Base and upgraded copies of the same ID are combined for draw probabilities, even though their listed costs are tracked separately. Relics are always-present loadout items and never enter the deck-size denominator. Samples smaller than a pair cannot contain both pieces. The browser and CLI cap the requested sample at deck size, so a portable deck keeps the same interpretation in both.

This is a uniform draw sample, not an opening-hand or turn simulation. Innate, starting-hand relics, extra draw, tutors, generated cards, exhaust during combat, and reshuffles change actual draws. Enter the complete draw pile, not just combo pieces. Pair odds do not determine whether the cards can be played together, whether a power is already active, or whether sequencing is possible.

## Mechanic coverage

`lib/deck-analysis.mjs` classifies exact existing target IDs and mechanical verbs into enablers and uses/payoffs. Requirements and modifiers stay separate from producers. For example, `requires Stars` never becomes `gains Stars`. A card that has Sly is a discard payoff; a card that actually discards is an enabler. Self-exhausting cards can enable exhaust triggers.

Coverage also follows one hop through a power explicitly **granted** by a selected card or relic. It does not follow arbitrary graph paths, requirements, or mentions. Each root card or relic is counted once per role, with deck copies attached, even if the card and its granted power both express that role. Original edge IDs and the grant path remain available as evidence. Clicking evidence returns to the original graph connection.

Mechanic roles currently use base-card descriptions and the shared graph. Selecting upgraded copies changes recorded costs and keyword facts, but upgrade-exclusive roles may be absent. A shared target establishes a candidate interaction to inspect; it does not establish a valid combo, infinite, expected damage, or card quality. Conditions, timing, target ownership, and other mechanics must still be read.

Character censuses use cards with that color and Common/Uncommon/Rare rarity. They exclude starter, token, Ancient, and event cards. Counts describe the archive's catalog; mode-specific eligibility and reward-generation weights are unavailable. Counting 26 Rare cards out of 82 does not imply a 26/82 chance to receive a Rare card.

## Resource and upgrade interpretation

`lib/card-facts.mjs` interprets `upgrade.cost` and `upgrade.star_cost` as replacement values. Other numeric upgrade fields are displayed as stored deltas. For example, Dark Embrace's Energy upgrade is **2 → 1**, not +1. The inspector and generated Obsidian notes use the same helper.

Fixed, X, unplayable, and unknown Energy costs remain distinct. The average includes only playable cards with recorded nonnegative fixed Energy costs and shows its denominator. Conditional refunds and discounts are not simulated. A zero-Energy card may still have a positive Star cost. Only recorded positive Star costs enter that count; an omitted field is not fabricated.

Positive integer Star costs also create `requires Stars` edges with the recorded amount in the evidence note. These independent metadata facts are added after description-role overrides, so an exceptional scaling description does not erase the printed requirement. The same edges appear in the website, validator, and vault.

## Persistence and reproduction

The versioned `sts2-stars-deck-v1` JSON stores entity IDs, copy counts, upgrade state, selected relics, draw sample size, combo selection, and source snapshot identity. Browser storage is optional; denial does not prevent analysis or downloads. Imports validate known IDs, quantities, and bounds before replacing a draft. Imported decks saved against another snapshot receive a review notice. No code or snapshot refresh runs during import.

Download an Obsidian note to place in the generated vault. Its links use the same collision-safe paths as the graph model. The note records the full source commit, assumptions, draw results, and mechanic evidence. Regeneration of entity notes does not automatically update an exported personal deck report.

For batch or reproducible use from a full checkout:

```sh
npm run analyze:deck -- --example --draws 5 --first card:BLADE_DANCE --second card:ACCURACY
npm run analyze:deck -- --input /path/to/sts2-stars-deck.json --format json
npm run analyze:deck -- --input /path/to/sts2-stars-deck.json --output /path/to/new-report.md
```

The CLI reads the same pinned snapshot and shared analysis model as the website. It rejects an existing output file. JSON results retain detailed edge evidence; Markdown contains Obsidian links. Numerical results have no timestamps or random simulation input.

## Review checkpoints

1. Degree and centrality were rejected as proxies for card strength. Generic hubs and duplicate card/power records would distort rankings.
2. Drawing a pair was separated from playing it. Uniform sampling assumptions remain visible rather than claiming opening-hand or turn accuracy.
3. Metadata review exposed missing Star costs and replacement cost upgrades. Both were fixed in shared code, with website/vault parity checks.
4. Producer counts were kept distinct from requirements and uses. Coverage reports observed mechanics rather than adding subjective synergy edges.
5. Browser and CLI imports were unified around the same portable document validator. Partial combo selections, sample capping, and base/upgraded copy grouping keep the same meaning across both workflows.

Win rates, pick rates, and causal card-strength estimates need run histories and encounter context. Damage-efficiency rankings, automatic turn plans, and infinite detection additionally need a more complete rules engine. Those claims are outside this feature's evidence; they should not be inferred from its descriptive statistics.
