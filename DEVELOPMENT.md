# STS2 Bubble development

The public graph is intentionally built from a **pinned local snapshot** of Spire Archive rather than reading `main` at runtime. This keeps relationships reproducible while Slay the Spire 2 is changing during Early Access.

## Architecture and local development

The website is a generated, self-contained `index.html`. It embeds the stylesheet, Pixi 7.4.2, d3 7.9.0, browser code, and pinned JSON snapshot, so an HTML-only preview can render the graph. It loads no external runtime scripts. The graph's hover labels and inspector provide its reading UI. Deployment still serves static files and needs no npm runtime.

Edit `src/index.html`, `styles.css`, `app.js`, and `lib/` as source files, then run `npm run build:site` to regenerate the root `index.html`. esbuild is an exact, lockfile-pinned development dependency. Generated HTML has a source notice and is marked generated for GitHub diff display. Do not hand-edit the generated file. `npm run check` rebuilds it in memory and rejects any mismatch, including changes to the pinned snapshot or curated links.

Rendering is scheduled on simulation ticks and interaction changes. Settled layouts stop rebuilding edges; opening the quick switcher, hiding the tab, or focusing the inspector's connection controls pauses simulation work. Leaving the connection controls resumes an unfinished layout. Camera changes and selection still request a frame.

`lib/graph-geometry.mjs` assigns deterministic lanes to parallel and reciprocal edges, clips paths outside their nodes, and aligns arrows with the curve tangent. Single edges use straight lines; only multiple relationships need curves. The force layout uses one spring per unordered entity pair so additional semantic roles do not change their attraction.

`lib/graph-model.mjs` owns entity normalization, mention and mechanic parsers, ontology edges, character overrides, relationship families, and collision-safe vault paths. The browser, graph validator, and Obsidian generator import this same model. Change semantic rules there rather than maintaining separate browser and vault implementations.

`buildEdges` runs the card-type, tag, and character-mechanic parsers for every description as well as entity mentions, effects, and resources. Their endpoints include concrete Orbs, Summon, Osty commands, Forge, Replay, Stars, and card-type operations. Bare “interacts with” and “uses Stars” fallback labels are excluded. Tests exercise all five characters and card/power counterparts to catch missing parser integration.

Family labels and colors also live in the shared model. Keyword/tag membership has its own filter; upgrades, shuffling, automatic play, HP-loss limits, and other generated roles have specific families instead of falling into “Other.” Custom authored verbs can still use that fallback.

Each inspector relationship has a “Show connection” control. It highlights the directed path and its endpoints, labels the verb on the canvas, and shows the source entity's text without changing the selected note or shareable URL. Tracing reveals hidden endpoints and preserves edge filters; local direction toggles still govern the rest of the neighborhood. Changing filters clears a trace that is no longer visible. On mobile, tracing closes the reading drawer to reveal the graph; reopening Note retains the selected entity.

The inspector searches all eligible outgoing links and backlinks before pagination. Combine note names, verbs, character names, entity types, and provenance terms; every search term must match. Mechanic-family selection uses the same shared family definitions as the graph, and ordering can follow note names or mechanical verbs. Counts and empty states reflect both graph relationship filters and the inspector's search. Searching never adds edges from description mentions, changes graph filters, or clears a highlighted connection. Opening a different note resets the search and family selection while preserving the preferred ordering. The pure `lib/inspector-model.mjs` index keeps all distinct directed roles and is checked across every pinned entity.

Use Node 24 LTS at the exact version in `.nvmrc`, matching CI. Node 20 is out of support. With nvm installed:

```sh
nvm install
nvm use
npm ci --ignore-scripts
npm run check
python3 -m http.server 8000 --bind 127.0.0.1
```

`package.json` contains development dependencies only, including libraries bundled into the public page. Browser tests use the exact pinned Pixi/d3 distributions from the integrity-checked lockfile. Source-mode CDN scripts additionally require SHA-384 integrity matching those distributions; the builder rejects missing or mismatched integrity and unexpected script sources.

After source or data changes:

```sh
npm run build:site
npm run check
```

The root `index.html` carries all core assets and data with it. Browser checks exercise that exact file with sibling and external requests blocked, including desktop/mobile navigation, tracing, and reload. The source template is build input; `lib/browser-data.mjs` also supports fetching pinned files relative to the checkout. A separate source-mode browser check mounts the template at a nested path and verifies module, styling, and JSON loading.

For a portable preview that can be opened as a single file:

```sh
npm run build:preview
```

Open `dist/sts2-bubble-preview.html` in a browser, or pass `-- --output /tmp/preview.html` to write elsewhere. The builder validates the snapshot, embeds the stylesheet, bundles the same app/model/geometry with the exact locked Pixi/d3 versions, and includes every pinned JSON file plus curated links. No server or network request is needed. This is a generated artifact; edit the shared source files and regenerate it. CI checks deterministic snapshot parity, exercises a single HTML response with all asset/external requests blocked, and uploads the HTML for review.

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
5. `node scripts/build-vault.mjs` — regenerate the Obsidian vault and export curated links.
6. `npm run build:site` — regenerate `index.html` from the same shared model and current snapshot/curated links.
7. Run `npm run check` and browser tests, then review the graph with provenance and relationship-family filters before deployment.

The updater resolves one full upstream commit, downloads every file from that immutable commit, and validates the complete graph and current authored links before installing a staged directory. Failed downloads and validation never rewrite the existing snapshot. Installation retains the previous directory until the new snapshot is committed; a failed rename rolls back, and the next invocation recovers an interrupted updater after checking that its process has exited. The managed transaction is `data/.sts2-update/`, excluded from Git. Concurrent writers and recoveries are refused. The directory installation uses two renames, so do not run source-file readers or builds concurrently with a refresh. This protects against mixed snapshots and handles process interruptions; it is not a substitute for independent backups after hardware failure.

An unchanged upstream commit keeps every snapshot byte, including its original date. To recover an interrupted transaction without contacting upstream:

```sh
node scripts/update-data.mjs --recover
```

If transaction ownership is incomplete, belongs to another host, or recovery itself was interrupted, the updater preserves the transaction and reports its path for inspection. Do not delete it blindly; it may contain the previous snapshot.

## Backups and recovery

Keep development commits on a GitHub branch and keep an independent copy outside GitHub and this workspace. Generated previews and expiring CI artifacts are useful exports, but authored Obsidian text needs its own preserved state.

After committing code changes, create a recovery package:

```sh
npm run backup
# Or choose a new output directory and include notes edited in another vault:
npm run backup -- --output /tmp/sts2-recovery --vault /path/to/your/vault
```

The package contains `repository.bundle` with complete committed Git history, `authored-state.json` with current vault Markdown and `data/manual-links.json`, `manifest.json`, and `SHA256SUMS`. It captures uncommitted and untracked notes and preserves intentional Markdown deletions. Committed Obsidian defaults remain in Git history. Hidden vault settings, attachments, installed dependencies, credentials, and uncommitted code are outside the authored snapshot; preserve any needed attachments/settings separately. The command refuses shallow clones, pending snapshot transactions, uncommitted source changes, symlinked notes, and existing output directories.

Copy the entire package outside this workspace. To restore with the repository's standalone tooling (Node and Git only):

```sh
npm run restore -- --input /path/to/sts2-recovery --output /path/to/new-checkout
```

If no checkout is available, first clone `repository.bundle` into a temporary tools directory, then run its `scripts/restore-backup.mjs` with the same arguments. Restoration checks every checksum and authored path before creating a fresh checkout, verifies Git object integrity, checks out the recorded commit, and restores the authored Markdown/export state. It refuses to overwrite existing directories. The restored checkout is detached so it cannot accidentally push changes to the original branch; create a new development branch and reconnect `origin` to `https://github.com/notkohrt/notkohrt.github.io.git` when appropriate.

Inspect restored notes, install locked dependencies, regenerate the vault/site if authored changes were pending, and run validation before publishing. CI creates and restores a recovery package on every validation run and keeps the package artifact for 90 days; download periodic copies to independent storage.

## Security maintenance

`npm run check:security` enforces exact dependency versions matching the lockfile, source-script integrity, full commit pins for workflow actions, and agreement between the main ruleset's required checks and CI job names. `npm run check` includes this policy. CI uses Node 24-based Actions and the fixed `ubuntu-24.04` runner image. CI also audits all locked dependencies, including development libraries bundled into the site, and fails on high/critical advisories. Dependabot proposes weekly npm and GitHub Actions updates; there is no automatic merge. When updating Pixi/d3, update the source template's exact URL and SHA-384 integrity from the installed locked distribution, regenerate the site, and run browser checks.

The validation workflows have read-only repository permissions. Only the scheduled/manual data-refresh job can write its update branch and PR, and dispatch its validation run. GitHub does not trigger push/pull-request workflows for events created by `GITHUB_TOKEN`; the refresh job explicitly dispatches `validate.yml` on its new branch so it receives all three required checks without another credential. Job timeouts and concurrency limits bound redundant work. Runtime data is escaped before entering HTML, and the production page executes bundled code without an unversioned third-party widget.

The active repository ruleset `main` (ID `24717644`, verified 2026-10-08) is captured in `.github/main-ruleset.json`. It targets **only** `refs/heads/main`, requires `validate`, `browser`, and `supply-chain` from the GitHub Actions app, requires up-to-date checks, and prevents force pushes/deletion. There are no bypass actors, including administrators. It does not require another reviewer, so a sole maintainer can merge after CI passes. Development branches must remain outside its scope so commits can reach GitHub before their checks run.

Rulesets are repository settings; committing the JSON does not activate them. Inspect the actual ruleset and the effective rules on `main`:

```sh
gh api repos/notkohrt/notkohrt.github.io/rulesets/24717644
gh api repos/notkohrt/notkohrt.github.io/rules/branches/main
```

Edit the saved ruleset in GitHub Settings → Rules → Rulesets. An integration with administration-write permission can update it with `gh api --method PUT repos/notkohrt/notkohrt.github.io/rulesets/24717644 --input .github/main-ruleset.json`; inspect existing rules and preserve stronger protections before applying a replacement. Repository metadata reporting an account's admin role does not prove its integration can change settings; GitHub can reject the update with `Resource not accessible by integration`.

`.github/main-branch-protection.json` remains an alternative classic-protection template for repositories that do not use rulesets. The classic protection endpoint does not report ruleset enforcement; an empty classic-protection page does not imply `main` is unprotected. Verify effective rules after settings changes and periodically thereafter. No DNS, paid service, database, or application secret is required for this static site.

## Relationship policy

An edge should explain a mechanical interaction. A bare text mention is not enough. This applies to curated links as well: `references`, `related`, `synergizes`, `interacts with`, and bare `uses Stars`/`uses keyword` are not mechanical relationships. The validator and vault curator parser share this policy in `isMechanicalRelation`.

Prefer explicit and high-confidence relationships such as `creates`, `applies`, `grants`, `triggers on`, `scales with`, `requires`, `moves from/to`, `channels`, `evokes`, `forges`, or a similarly precise verb. Subjective deck-building synergy should not be represented as a factual mechanical edge.

Parse each mention in its own clause. In “Whenever you apply Poison, gain Strength,” Poison is the trigger and Strength is the reward. Keep both roles when one target is mentioned twice, honor negated actions, and prefer a full entity name over overlapping shorter names. A same-named metadata tag must not hide a unique card (Shiv); names shared by several cards or powers still need explicit disambiguation. Exceptional character overrides replace inferred relationships for that source/target pair.

Effect parsing separates conditions from rewards at commas, periods, and semicolons; published line breaks can wrap a sentence. Match each effect in its own clause and retain each distinct role. “Whenever you draw an Ethereal card, draw 1 card” both triggers on draw and draws. “Whenever you apply Vulnerable, draw 1 card” only draws. Resource edges must also distinguish triggering on Block/HP loss, granting Block/Energy, preventing gain, and limiting loss. Inflected verbs share a vocabulary, and negation belongs to its own action rather than a later action in the sentence.

Prohibitions and passive negation describe prevention, not positive actions: Runic Pyramid prevents discard, Retain prevents end-of-turn discard, and Eternal prevents transformation. An explicit “or” action list shares negation; a separate reward does not. Card-play caps are restrictions rather than plain play edges. Adding a modifier to an existing card or moving cards from another pile is not card creation; adding a copy is creation. “Whenever you add a card to your Deck” is an addition trigger rather than a creation reward. Cost filters (“a card that costs 2 or more”, “cards that do not cost 0”) do not modify costs; actual assignments, reductions, randomization, and extra costs do.

Relationship-family coloring follows the role before the object: “triggers on card creation” is a trigger and “requires Doom application” is a requirement. Regression tests cover these distinctions.

## Data provenance

`data/sts2/meta.json` records the exact Spire Archive source commit and reported game-data version used by the site. The UI exposes this snapshot information.

## Validation

`npm run check` checks every JavaScript module and security policy, validates the emitted graph and snapshot metadata, verifies the committed `index.html` against a deterministic rebuild, and runs parser/pinned-dataset regressions plus a complete website/vault parity check. Vault tests preserve curated text, compare every generated note's outgoing edges with the website model, and verify deterministic regeneration and safe failure on invalid curated links. Refresh tests exercise failed downloads, schema rejection, rollback, interruption recovery, and writer conflicts. Recovery tests restore full history and authored changes, and reject corrupted packages and unsafe paths.

The validator rejects duplicate IDs/paths, missing rule and manual endpoints, self edges, bare mentions, generic damage/play hubs, and unpinned metadata. It reports entity/character coverage and relationship-family counts. Some IDs in the upstream `card_powers.json` are absent from its entity lists; these are reported as `unresolved_card_power_mappings`, excluded from emitted edges, and kept separate from validation failures. Review these diagnostics during data updates instead of inventing replacement powers or altering the pinned input.

GitHub Actions runs semantic/vault, inspector-index, and geometry checks plus browser checks on pushes to `main`, `feat/sts2-graph-clean`, and `codex/**`, on pull requests to `main`, and on explicit workflow dispatches. It uploads the actual root `index.html`, the portable preview, and the generated vault. Browser checks cover self-contained rendering, tracing and parallel roles, backlink source text, connection search beyond the initial page, family selection and result counts, keyboard focus, filter invalidation, and mobile reading/graph transitions. The scheduled data-refresh workflow regenerates `index.html` and runs the same semantic/vault checks before opening a snapshot update PR containing both data and generated site, then dispatches the full validation workflow for the new branch. Parser regressions require review when upstream mechanics change.
