# STS2 Bubble community launch

Working draft for the website and optional Obsidian vault, targeting **r/SlayTheSpire2**. The currently deployed build is v1.0.1. Keep the **STS2 Bubble** name; `sts2bubble.com` is the preferred domain candidate, subject to availability and registration.

## Launch order

1. Choose the project domain, keeping `notkohrt.pro` for the developer site.
2. Complete the r/SlayTheSpire2 post draft below, including its final website link.
3. Build and verify the website/vault ZIP from the clean release commit, then publish it as a permanent public GitHub Release asset. Add that download link to the post.
4. Verify the project domain, HTTPS, sharing preview, and mobile graph before posting.

Mega Crit attribution stays in the website and distribution. The pending artwork permission request for notes stays recorded in `CREDITS.md`; awaiting its response is not a build or community-launch gate. Do not describe the pending request as a grant.

## Project domain

Selected naming direction: retain **STS2 Bubble** so the name in the app, post, and domain agrees.

Candidates, with availability unverified:

| Candidate | Reason |
| --- | --- |
| `sts2bubble.com` | Matches the existing project name; first choice. |
| `sts2bubble.net` | Keeps the exact name with a familiar alternative suffix. |
| `sts2bubble.app` | Keeps the exact name and describes a browser app. |

A registry lookup for `sts2bubble.com` was blocked by this cloud's network proxy on 2026-10-08. Availability is unverified for every candidate above; these are naming suggestions, not claims of availability or price. Confirm registration and renewal cost at a registrar before choosing.

When a domain is chosen, update the Pages custom domain and DNS, repository `CNAME`, canonical/Open Graph/Twitter URLs in `src/index.html`, and the base URL in `playwright.production.config.mjs`. Regenerate `index.html`, update public documentation and post links, and run existing validation plus the live production checks. Preserve the current live site until the replacement is ready. Each GitHub Pages site has one configured custom domain; decide which Pages site will serve the developer domain if both sites will use GitHub Pages. This document makes no hosting or DNS changes.

## Reddit post draft

### Title

I built STS2 Bubble: a searchable map of Slay the Spire 2 mechanics

### Body

I've been working on **STS2 Bubble**, an interactive graph for exploring how cards, relics, powers, and other Slay the Spire 2 mechanics connect.

**Try it:** [project website — add the final domain]

Start with **Find** to search for a card or mechanic. Open its **Local** graph to explore nearby connections, then use **Show connection** in the note panel to highlight a specific relationship and its direction. You can also filter by character, entity type, and mechanic.

The aim is to make the links useful: applying a power, creating a card, or triggering an effect should produce a connection. A passing text mention alone shouldn't.

There's also an optional **Obsidian vault** with the same notes and relationships: [release ZIP — add the public download link before posting]. On phones, use the website in your browser for the interactive graph.

This first public version uses pinned game data **v0.107.1**, with the data version shown on the site. I'd appreciate reports of missing or misleading connections, confusing labels, or mobile problems. Including the card or relic name and what you expected to see would help me fix them.

Slay the Spire 2 is by **Mega Crit**. This is an unofficial fan project; the data comes from **Spire Archive**.

## Before posting

- Confirm r/SlayTheSpire2's current rules and choose the appropriate flair. The rules API was blocked by this cloud's proxy on 2026-10-08, so no flair or self-promotion rule is assumed here.
- Replace the website and release ZIP placeholders above after the draft is complete.
- Use the permanent project URL rather than the developer domain or an Actions artifact link.
- Keep the public post's data version accurate if the pinned dataset changes before release.
- Post only when explicitly instructed; this is a draft, not a scheduled announcement.
