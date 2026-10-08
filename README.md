# STS2 Stars

STS2 Stars is a Slay the Spire 2 knowledge graph built from pinned data and shared mechanical parsers. The root `index.html` is self-contained and generated from `src/index.html`, `styles.css`, `app.js`, `lib/`, and `data/`.

After editing source or curated relationships, run `npm run build:site` and `npm run check`. See [DEVELOPMENT.md](DEVELOPMENT.md) for semantic policy, browser checks, snapshot updates, and Obsidian generation.

For the complete website and Obsidian export, download **sts2-stars-v1** from a successful [validation run](https://github.com/notkohrt/notkohrt.github.io/actions/workflows/validate.yml), then extract the ZIP. Open `index.html` in a browser or open the `vault` folder in Obsidian. The package includes credits, pinned data, source/toolchain metadata, and checksums. GitHub may require sign-in to download Actions artifacts; they expire after 90 days, so keep your own copy.

On iPhone or iPad, use a hosted copy in Safari for the interactive graph. The Files HTML preview can display styling while preventing the app from running. A downloaded file works in a full desktop browser; an indefinite Files preview does not indicate that the graph is still building. The vault can also be opened in Obsidian Mobile. Downloading a CI build does not deploy that version to the public website.

Build locally with `npm ci --ignore-scripts`, `npm run check`, and `npm run build:v1`. Verify an extracted package with `npm run verify:v1 -- /path/to/build`. Build output defaults to `dist/sts2-stars-v1`; choose a fresh directory with `-- --output /path/to/new-build` when another export already exists.

Slay the Spire 2 and its game content are by [Mega Crit](https://www.megacrit.com/). STS2 Stars is an unofficial fan project. See [CREDITS.md](CREDITS.md) for attribution and the status of artwork permission for notes. See [the community launch draft](docs/community-launch.md) for the project domain and release plan.
