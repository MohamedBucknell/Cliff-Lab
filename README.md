# CLiFF · Lab Shuffle

An interactive laboratory layout challenge. Arrange equipment, edit proximity weights, and compare saved layouts with a live score.

[Open the live site](https://cliff-lab-shuffle.noblestoat514.chatgpt.site)

## Features

- Move, rotate, rename, and resize equipment placards.
- Add or remove objects across every saved layout using one shared inventory.
- Keep each layout's equipment positions and proximity weights independent.
- Edit a symmetric affinity matrix and see scores update immediately.
- Detect footprint conflicts, optical-table boundaries, and entrance obstructions.
- Save and load team layouts, undo changes, and run a three-minute challenge.

AFM-IR has a fixed position and footprint while present. It can be removed from the shared inventory.

## Run locally

There is no build step or dependency installation. With Python 3 installed, run:

```sh
python3 -m http.server 8000 --directory dist
```

Then open <http://localhost:8000> in a modern browser.

## Tests

With a recent Node.js release installed, run:

```sh
node --test tests/layouts.test.cjs
```

The tests cover shared additions and removals, legacy data migration, saved placements, undo, persistence, empty inventories, and storage failures.

## Files

| File | Purpose |
| --- | --- |
| `dist/index.html` | Interface and styling |
| `dist/app.js` | Controls, rendering, saved layouts, and browser storage |
| `dist/layout-state.js` | Shared inventory, placement, migration, and scoring |
| `tests/layouts.test.cjs` | State and event-handler tests |
| `.openai/hosting.json` | Existing ChatGPT Sites hosting configuration |

Serve `dist/` with any static web host. The hosting manifest identifies the existing ChatGPT Site; a separate Site deployment needs its own project identity.

## Saved data

Layouts and the shared object inventory are stored in `localStorage` under `cliffLayoutsV8`. Changes apply to all layouts saved in the same browser for the same site origin. They do not sync across devices or different website addresses.

Earlier `cliffDraftV7`, `cliffTeams`, and `cliffAffinity` data is migrated on first use. Those original keys are retained. The repository includes the imported starting layout, not a user's browser-saved layouts.

## Scoring

Scores use weighted straight-line distances between object centers, with an eight-point penalty for each conflicting object. This is a layout discussion tool; travel paths, service clearances, and robot reach are not modeled.
