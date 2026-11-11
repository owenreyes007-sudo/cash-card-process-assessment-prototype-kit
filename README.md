# Cash Card Process Assessment – Prototype Kit

A static dashboard for finding and launching prototypes from the Cash Card Process Assessment. The central portal uses a small metadata catalog; the existing prototype source repositories remain their source of truth.

## Open the kit locally

In PowerShell, run `./run-local.ps1` from this folder, then open `http://localhost:8000/`.

## Contents

- `index.html`, `styles.css`, and `app.js`: responsive dashboard with search, category filters, and navigation.
- `catalog.json`: prototype descriptions, business problems, categories, previews, launch links, and source links.
- `Cash App final.html`: supplied standalone interactive card prototype, included so its launch link works from GitHub Pages.
- `Northstar_Card_Diagnostics_Final/`: the supplied local presenter build, kept for local demonstrations. The dashboard links to the existing Northstar GitHub Pages deployment instead, avoiding a second copy in the published portal.

## Update the catalog

Add or update a prototype entry in `catalog.json`. Use the existing public deployment when available and link to the original source repository. For local prototypes, include the complete files in this repository or link to a deployment so the card can launch for stakeholders.

## Existing source repositories

The GitHub account includes `card-diagnostics-automation`, `Cash-App-Advocate-Workflow-Guidance`, `Cash-App-Workflow-Tool`, plus earlier workflow iterations (`workflow-v2`, `workflow-v3`, and `depreciated_demo_1`). The earlier iterations are not listed as separate solutions. Confirm the advocate workflow deployment URL before using it in a formal stakeholder presentation.

