# CCNA Study Rig

Single-page static study tool for CCNA v7 *Introduction to Networks* — Modules 11 (IPv4),
12 (IPv6), 17 (Build a Small Network). No build step, no backend: open it, and it works.
Deploys to GitHub Pages as a folder.

## Run locally

No server needed — content is bundled into the page, so you can **double-click `index.html`**
and it works straight from the filesystem. (A local server is still fine if you prefer it:

```bash
python3 -m http.server 8000   # → http://localhost:8000
```)

## Deploy to GitHub Pages

1. Push this folder to a repo.
2. In the repo → Settings → Pages → Source: **GitHub Actions** or **Deploy from a branch** (`main`, root).
3. Done. The service worker then caches everything for offline use on your phone.

## Features

- **Learn** — a 2-minute guided walkthrough (address/mask picture with live highlight, the
  terms in one line each, and the magic-number trick) that builds intuition before any drilling.
  This is the default tab for a reason.
- **Practice** (trainers) — subnetting drill that *unlocks one field at a time* with progressive
  hints (no more six empty boxes at once), "I need N subnets / N hosts", VLSM planner, IPv4
  calculator with visual binary AND, IPv6 abbreviator/expander, EUI-64 converter (bit-flip
  highlighted), IPv6 type identifier, /48→/64 subnet-ID drill.
- **Notes** — condensed section-by-section notes, collapsible, with comparison tables; check
  "learned" on a section to feed Progress.
- **Cheat sheet** — searchable command list (host + IOS) with syntax, purpose, sample output.
- **Flashcards** — Leitner spaced repetition; Space flips, ← Again / → Good.
- **Quiz** — MCQ + type-the-command, scenario-style, optional timer, explanations, records scores.
- **Troubleshooting simulator** — 4 scripted scenarios (duplex mismatch, wrong mask, missing
  gateway, DNS) with a console you choose commands on.
- **Progress** — localStorage tracking, weak-topic signals, export/import as JSON.
- **Cram** — exam-eve must-know facts + formulas per module.
- Dark default / light toggle, mobile responsive, keyboard-friendly.

## Data & content

Content lives in `data/*.json` (schema in `data/SCHEMA.json`). The runtime loads a bundle,
`data/content.js`, generated from those files — so editing content never touches logic.

Two ways to update content:

1. **In-app import** (easiest, no redeploy): Progress → Content data → Import content, and pick a
   JSON exported from the same menu (or from `data/*.json` files). The imported data is stored in
   localStorage and overrides the bundle. “Reset content” returns to the built-in copy.
2. **Edit + rebuild**: edit `data/*.json`, then run `node tools/build-data.js` and redeploy.

The curriculum text is standard CCNA v7 ITN content; when you paste your actual slides, diff them
against these files and adjust.

Math engine is in `js/lib/net.js` and `js/lib/ipv6.js` (environment-agnostic, unit-tested).

## Tests

```bash
node test/net.test.js       # subnetting math
node test/ipv6.test.js      # IPv6 abbreviation/EUI-64/classification
node test/verify_content.js # recomputes question answer keys from stems
```
