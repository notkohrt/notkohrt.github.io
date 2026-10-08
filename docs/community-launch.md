# STS2 Stars community launch

Working draft for the v1.0.2 website and optional Obsidian vault, targeting **r/SlayTheSpire2**. Use **STS2 Stars** as the project name. **https://sts2stars.com/** is live, HTTPS enforcement is enabled, and deployment checks passed. The owner has shared the site with a few friends for initial testing; the Reddit announcement has not been posted.

## Launch order

1. Keep `sts2stars.com` as the verified project URL, with `notkohrt.pro` reserved for the future developer site.
2. Complete the r/SlayTheSpire2 post draft below, including its final website link.
3. Build and verify the website/vault ZIP from the clean release commit, then publish it as a permanent public GitHub Release asset. Add that download link to the post.
4. Verify the project domain, HTTPS, sharing preview, and mobile graph before posting.

Mega Crit attribution stays in the website and distribution. The pending artwork permission request for notes stays recorded in `CREDITS.md`; awaiting its response is not a build or community-launch gate. Do not describe the pending request as a grant.

## Project domain

Selected and purchased: **sts2stars.com**, matching **STS2 Stars** in the app and post. Squarespace is the registrar and DNS provider. See [the domain migration plan](domain-plan.md) for the exact GitHub Pages records, ownership protection, and deployment checks.

Canonical/Open Graph/Twitter URLs and production checks derive from repository `CNAME`. The published site, vault entry page, and post draft use `sts2stars.com`. The certificate covers the apex and `www`; live Chromium/WebKit checks verified the sharing image, canonical destination, redirect, and mobile graph. A future developer site needs a separate hosting destination.

## Initial feedback

Use the repository's [feedback forms](https://github.com/notkohrt/notkohrt.github.io/issues/new/choose) for browser bugs or mechanical relationship corrections. Collect the relevant note/card name, the actual and expected behavior, a public note link or reproduction steps, and the device/browser for UI problems. For relationship reports, include game text or an explanation of the mechanic; a shared word or subjective synergy alone should not add a factual edge.

Review reports against the pinned dataset before changing parsers. A mechanic introduced after the displayed game-data version may require a reviewed snapshot update. Prefer shared parser fixes; reserve curated overrides for exceptional mechanics. These forms collect feedback without adding runtime analytics or another service.

## Reddit post draft

### Title

I built STS2 Stars: a searchable map of Slay the Spire 2 mechanics

### Body

I've been working on **STS2 Stars**, an interactive graph for exploring how cards, relics, powers, and other Slay the Spire 2 mechanics connect.

**Try it:** https://sts2stars.com/

Start with **Find** to search for a card or mechanic. Open its **Local** graph to explore nearby connections, then use **Show connection** in the note panel to highlight a specific relationship and its direction. You can also filter by character, entity type, and mechanic.

The aim is to make the links useful: applying a power, creating a card, or triggering an effect should produce a connection. A passing text mention alone shouldn't.

There's also an optional **Obsidian vault** with the same notes and relationships: [release ZIP — add the public download link before posting]. On phones, use the website in your browser for the interactive graph.

This first public version uses pinned game data **v0.107.1**, with the data version shown on the site. I'd appreciate reports of missing or misleading connections, confusing labels, or mobile problems. Including the card or relic name and what you expected to see would help me fix them.

Slay the Spire 2 is by **Mega Crit**. This is an unofficial fan project; the data comes from **Spire Archive**.

## Before posting

- Confirm r/SlayTheSpire2's current rules and choose the appropriate flair. The rules API was blocked by this cloud's proxy on 2026-10-08, so no flair or self-promotion rule is assumed here.
- Verify the final website link and replace the release ZIP placeholder after the draft is complete.
- Use the permanent project URL rather than the developer domain or an Actions artifact link.
- Keep the public post's data version accurate if the pinned dataset changes before release.
- Post only when explicitly instructed; this is a draft, not a scheduled announcement.
