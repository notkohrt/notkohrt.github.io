# STS2 Stars

STS2 Stars is a Slay the Spire 2 knowledge graph built from pinned data and shared mechanical parsers. The root `index.html` is self-contained and generated from `src/index.html`, `styles.css`, `app.js`, `lib/`, and `data/`.

After editing source or curated relationships, run `npm run build:site` and `npm run check`. See [DEVELOPMENT.md](DEVELOPMENT.md) for semantic policy, browser checks, snapshot updates, and Obsidian generation.

Open **Deck** above the graph to enter cards, copies, upgrades, and relics. Deck lab shows printed Energy costs, recorded Star charges, mechanic enablers and uses, and exact probabilities for a uniform draw sample. Character pool counts help find cards with specific mechanical roles. Load the Silent example to try it, or import a deck JSON. Decks stay in your browser; JSON and Obsidian note downloads provide portable copies. Read [the analysis methods](docs/analysis-methods.md) for assumptions and the command-line analyzer.

For offline use, open the site online, wait for **Offline ready** in the footer, and install it from Safari's Share → Add to Home Screen or Chrome's Install app menu. Launch the installed app once online and confirm readiness before airplane mode. Controls offers **Update app** after a complete new version downloads. The graph, wiki, data, filters, and local analysis work offline; external links require a connection.

For the complete offline website and Obsidian export, download **sts2-stars-offline** (explicit ZIP) or **sts2-stars-v1** (directory artifact) from a successful [validation run](https://github.com/notkohrt/notkohrt.github.io/actions/workflows/validate.yml), then extract it. On a computer, run the included `python3 serve.py` and open `http://localhost:8123/` for reliable PWA installation. Open `vault` in Obsidian separately. Direct HTML opening is a portable preview; iOS Files previews and `file://` cannot be relied on for installation. The package includes credits, pinned data, licenses, provenance, and checksums. GitHub may require sign-in; artifacts expire after 90 days, so keep your own copy.

On iPhone or iPad, use a hosted copy in Safari for the interactive graph. The Files HTML preview can display styling while preventing the app from running. A downloaded file works in a full desktop browser; an indefinite Files preview does not indicate that the graph is still building. The vault can also be opened in Obsidian Mobile. Downloading a CI build does not deploy that version to the public website.

Build locally with `npm ci --ignore-scripts`, `npm run check`, and `npm run build:offline` (Node pinned by `.nvmrc`, Python 3). Verify an extracted package with `npm run verify:v1 -- /path/to/build`. Offline output defaults to `dist/sts2-stars-offline` with a sibling `.zip`; choose a fresh directory with `-- --output /path/to/new-build` when another export already exists. See [DEVELOPMENT.md](DEVELOPMENT.md#installed-offline-app) for cache/update design and iPhone, Android, and Steam Deck checks.

Slay the Spire 2 and its game content are by [Mega Crit](https://www.megacrit.com/). STS2 Stars is an unofficial fan project. See [CREDITS.md](CREDITS.md) for attribution and the status of artwork permission for notes. See [the community launch draft](docs/community-launch.md) for the project domain and release plan.
