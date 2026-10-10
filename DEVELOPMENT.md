# STS2 Stars development

The public graph is intentionally built from a **pinned local snapshot** of Spire Archive rather than reading `main` at runtime. This keeps relationships reproducible while Slay the Spire 2 is changing during Early Access.

## Architecture and local development

The website is a generated, self-contained `index.html`. It embeds the stylesheet, Pixi 7.4.2, d3 7.9.0, browser code, and pinned JSON snapshot, so an HTML-only preview can render the graph. It loads no external runtime scripts. The graph's hover labels and inspector provide its reading UI. Deployment still serves static files and needs no npm runtime.

Edit `src/index.html`, `styles.css`, `app.js`, and `lib/` as source files, then run `npm run build:site` to regenerate the root `index.html`. esbuild is an exact, lockfile-pinned development dependency. Generated HTML has a source notice and is marked generated for GitHub diff display. Do not hand-edit the generated file. `npm run check` rebuilds it in memory and rejects any mismatch, including changes to the pinned snapshot or curated links.

Rendering is scheduled on simulation ticks and interaction changes. Settled layouts stop rebuilding edges; opening the quick switcher, hiding the tab, or focusing the inspector's connection controls pauses simulation work. Leaving the connection controls resumes an unfinished layout. Camera changes and selection still request a frame.

`lib/graph-geometry.mjs` assigns deterministic lanes to parallel and reciprocal edges, clips paths outside their nodes, and aligns arrows with the curve tangent. Single edges use straight lines; only multiple relationships need curves. The force layout uses one spring per unordered entity pair so additional semantic roles do not change their attraction.

`lib/graph-model.mjs` owns entity normalization, mention and mechanic parsers, ontology edges, character overrides, relationship families, and collision-safe vault paths. The browser, graph validator, and Obsidian generator import this same model. Change semantic rules there rather than maintaining separate browser and vault implementations.

`lib/deck-analysis.mjs` provides exact hypergeometric draw probabilities, pair probabilities, mechanic role coverage, character censuses, input validation, and Obsidian-compatible reports. `lib/deck-lab-ui.mjs` owns the native dialog, private browser persistence, portable JSON imports/exports, and evidence navigation. The graph pauses behind the dialog. `lib/card-facts.mjs` keeps cost replacements and upgrade facts consistent between the inspector, analysis, and vault. Positive recorded Star costs produce quantified requirement edges after description-role overrides. Read [analysis methods and review checkpoints](docs/analysis-methods.md) before extending these calculations. Run `npm run analyze:deck -- --example` for the shared command-line workflow.

`buildEdges` runs the card-type, tag, and character-mechanic parsers for every description as well as entity mentions, effects, and resources. Their endpoints include concrete Orbs, Summon, Osty commands, Forge, Replay, Stars, and card-type operations. Bare “interacts with” and “uses Stars” fallback labels are excluded. Tests exercise all five characters and card/power counterparts to catch missing parser integration.

Family labels and colors also live in the shared model. Keyword/tag membership has its own filter; upgrades, shuffling, automatic play, HP-loss limits, and other generated roles have specific families instead of falling into “Other.” Custom authored verbs can still use that fallback.

Each inspector relationship has a “Show connection” control. It highlights the directed path and its endpoints, labels the verb on the canvas, and shows the source entity's text without changing the selected note or shareable URL. Tracing reveals hidden endpoints and preserves edge filters; local direction toggles still govern the rest of the neighborhood. Changing filters clears a trace that is no longer visible. On mobile, tracing closes the reading drawer to reveal the graph; reopening Note retains the selected entity.

The inspector searches all eligible outgoing links and backlinks before pagination. Combine note names, verbs, character names, entity types, and provenance terms; every search term must match. Mechanic-family selection uses the same shared family definitions as the graph, and ordering can follow note names or mechanical verbs. Family-option counts follow the search text before applying the selected family, so switching families shows the remaining alternatives. Overall counts retain the eligible graph total for comparison. Searching never adds edges from description mentions, changes graph filters, or clears a highlighted connection. “Show more” focuses the first newly revealed connection so keyboard reading continues through the new page. Opening a different note resets the search and family selection while preserving the preferred ordering. The pure `lib/inspector-model.mjs` index keeps all distinct directed roles and is checked across every pinned entity.

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

Open `dist/sts2-stars-preview.html` in a browser, or pass `-- --output /tmp/preview.html` to write elsewhere. The builder validates the snapshot, embeds the stylesheet, bundles the same app/model/geometry with the exact locked Pixi/d3 versions, and includes every pinned JSON file plus curated links. No server or network request is needed. This is a generated artifact; edit the shared source files and regenerate it. CI checks deterministic snapshot parity, exercises a single HTML response with all asset/external requests blocked, and uploads the HTML for review.

Self-contained HTML still needs a browser that runs JavaScript and supports WebGL. iPhone/iPad Files Quick Look can render the static page while leaving scripts unexecuted. Use a hosted copy in Safari on those devices. The initial HTML shows browser-opening guidance with no spinner; `boot` switches to loading only when JavaScript runs. Data and renderer failures stop the spinner and retain actionable guidance. Initialization also handles a module executing after `DOMContentLoaded`, so delayed script evaluation cannot leave a working browser waiting forever.

For a complete v1 build containing that website and the generated Obsidian vault:

```sh
npm run build:v1
# Choose a fresh directory when the default output already exists:
npm run build:v1 -- --output /tmp/sts2-v1-review
npm run verify:v1 -- /tmp/sts2-v1-review
```

The builder uses the same website renderer and vault generator without rewriting the checkout. It rejects stale root HTML, pending snapshot transactions, and unexported curated relationships. It copies the pinned JSON files, attribution, vault reading instructions, and only the two repository-owned Obsidian defaults (`app.json` and `graph.json`). It adds no plugin, artwork download, private vault settings, or attachment. The output directory must be new; a failed build removes only the directory it created.

`manifest.json` records v1's package version, full source commit, local-change status, exact Node/dependency versions, lockfile SHA-256, snapshot metadata, and entity/relationship counts. No wall-clock timestamp enters the build, so unchanged inputs produce identical files and checksums. Local builds with source edits are clearly marked as development builds; reproducible distributions use a clean commit. CI packages before its in-checkout vault generation so the source status stays clean. `SHA256SUMS` covers every other packaged file, including the manifest. These hashes detect corruption or edits; they do not authenticate the publisher.

Verification rejects missing, extra, duplicate, unsafe, symlinked, or changed files; compares the embedded website snapshot to the packaged data; and checks every entity note and curated export against the shared model. Use the verifier from the recorded source commit when checking an older build whose semantic parsers or note templates may differ. Browser tests exercise the packaged `index.html` with all linked assets and external requests blocked, including mobile navigation and connection tracing.

Download **sts2-stars-v1** from a successful validation run's Artifacts section, sign in to GitHub if prompted, and extract the ZIP before opening `index.html` or the `vault` folder. Actions retains this artifact for 90 days. A workspace file link is not a registered ChatGPT download artifact and can produce “could not download artifact”; use the GitHub artifact link and keep an independent copy. The complete build is an export; the separate recovery artifact preserves source history and authored state for restoration.

`lib/project.mjs` supplies the project name and slug to browser titles, export builders, and future snapshot metadata. Keep the static HTML branding, package metadata, CI artifact names, and documentation in sync. The existing `sts2-bubble-build-v1` and `sts2-bubble-recovery-v1` format identifiers are stable compatibility identifiers, retained across the STS2 Stars rename. The pinned snapshot's historical metadata is unchanged; rebranding does not rewrite game data or mechanics.

```sh
npx playwright install chromium
npx playwright install webkit
npm run test:browser
```

If Chromium is already installed, `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:browser -- --project=chromium` uses it. The tests start their own local server on port 8123 and cover graph rendering, shareable URLs, filtered-note navigation, inspector pagination, keyboard focus, and mobile drawers. The `webkit` project runs focused startup checks with Safari's engine: an actual local HTML file, mobile note search and tracing, JavaScript-disabled previews, late module evaluation, and renderer failure. This tests engine compatibility; it does not reproduce iOS Files Quick Look. CI installs both browsers and requires both projects in the existing `browser` job. If local WebKit download is blocked by cloud egress, run the available Chromium checks locally and verify WebKit in CI; environment-settings publication is not a development prerequisite.

The `production` CI job checks the HTTPS origin derived from `CNAME` after pushes to `main`. It runs separately from local browser tests and polls for HTML whose SHA-256 matches the checked-out build, allowing three minutes for Pages deployment/cache propagation. Chromium and WebKit then verify the canonical destination, sharing metadata and exact image bytes, the apex/`www` alias redirect, styling, pinned graph counts, mobile note search, and directed relationship tracing on the live site, without external runtime script/style/data requests. TLS verification remains enabled. This provides live verification from GitHub's runner when the cloud environment cannot access the public domain.

For an already deployed build, run `npx playwright test --config playwright.production.config.mjs`, or dispatch `validate.yml` with `verify_production=true` on a ref containing that exact HTML. Normal branch/PR checks and automated snapshot-refresh dispatches leave this input false, so they do not expect unpublished changes to be live. Main's existing three required checks still validate changes before merging; production checks report deployment/hosting failures after publication.

`CNAME` is the single hostname configuration for generated canonical/sharing URLs and production checks. Source HTML uses `{{SITE_ORIGIN}}`; the builder resolves it to HTTPS and rejects stale, missing, or conflicting domain metadata. `npm run plan:domain -- sts2stars.com` previews the configuration without writing files or changing DNS. The live domain is `sts2stars.com`, with HTTPS enforcement enabled; [the domain reference](docs/domain-plan.md) records the verified migration and Squarespace DNS configuration. For future domain changes, review `CNAME` and regenerated `index.html` together, and publish after DNS is configured. Raw source-template previews can retain metadata placeholders; deployed root HTML always resolves them.

The repository's issue forms distinguish browser bugs from mechanical relationship corrections. Reproduce reported UI problems using the hosted site and the supplied device/browser context. Compare relationship reports to the pinned game-data version and require a mechanical explanation before adding an edge; newer game text may need a reviewed snapshot update. Keep fixes in shared parsers where possible and use curated overrides for exceptional mechanics.

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

Describe existing state separately from actions. Creating Upgraded cards does not upgrade cards already owned. “Upgraded Attacks deal additional damage” requires upgraded cards; it does not upgrade them. Keep actual Upgrade commands, passive upgrades, historical conditions, and correctly spelled “Upgrading”, “Shuffling”, and “Evoking” verbs. The generic Transform effect describes card operations, so a relic transforming itself into another relic does not receive that card-operation edge. Effect matching also excludes pile names before determining an action's negation scope.

Relationship-family coloring follows the role before the object: “triggers on card creation” is a trigger and “requires Doom application” is a requirement. Regression tests cover these distinctions.

## Data provenance

`data/sts2/meta.json` records the exact Spire Archive source commit and reported game-data version used by the site. The UI exposes this snapshot information.

## Validation

`npm run check` checks every JavaScript module and security policy, validates the emitted graph and snapshot metadata, verifies the committed `index.html` against a deterministic rebuild, and runs parser/pinned-dataset regressions plus a complete website/vault parity check. Vault tests preserve curated text, compare every generated note's outgoing edges with the website model, and verify deterministic regeneration and safe failure on invalid curated links. Refresh tests exercise failed downloads, schema rejection, rollback, interruption recovery, and writer conflicts. Recovery tests restore full history and authored changes, and reject corrupted packages and unsafe paths.

The validator rejects duplicate IDs/paths, missing rule and manual endpoints, self edges, bare mentions, generic damage/play hubs, and unpinned metadata. It reports entity/character coverage and relationship-family counts. Some IDs in the upstream `card_powers.json` are absent from its entity lists; these are reported as `unresolved_card_power_mappings`, excluded from emitted edges, and kept separate from validation failures. Review these diagnostics during data updates instead of inventing replacement powers or altering the pinned input.

GitHub Actions runs semantic/vault, inspector-index, and geometry checks plus browser checks on pushes to `main`, `feat/sts2-graph-clean`, and `codex/**`, on pull requests to `main`, and on explicit workflow dispatches. It uploads the actual root `index.html`, the portable preview, and the generated vault. Browser checks cover self-contained rendering, tracing and parallel roles, backlink source text, connection search beyond the initial page, family selection and result counts, keyboard focus, filter invalidation, and mobile reading/graph transitions. The scheduled data-refresh workflow regenerates `index.html` and runs the same semantic/vault checks before opening a snapshot update PR containing both data and generated site, then dispatches the full validation workflow for the new branch. Parser regressions require review when upstream mechanics change.
