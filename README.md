# Finance Toolkit (Simple interest calculator)

Interest, loan and savings calculators in one fast, dependency-free page.

**Live demo:** https://shishir19999.github.io/Simple-interest-calculator/

## Features

- Five calculators in accessible tabs: simple interest, compound interest (choose the compounding frequency, including continuous), EMI / loan with a full amortization table, SIP / recurring deposit, and fixed deposit maturity. A side-by-side simple vs compound comparison is included.
- Interactive growth chart (inline SVG, no libraries) with hover tooltip and keyboard inspection (arrow keys).
- Sliders and number inputs stay in sync; inline validation with clear error messages.
- Currency selector with locale-aware formatting (INR, USD, EUR, GBP, JPY and more).
- Calculation history saved in the browser (localStorage) with restore, delete and clear.
- Shareable result links: every result is encoded in the URL parameters.
- Export the schedule to CSV, and a print stylesheet for clean paper or PDF output.
- Light and dark themes: follows the system setting, remembers your choice, no flash on load.
- Subtle parallax hero and scroll-reveal animations (transform and opacity only). They are switched off automatically for `prefers-reduced-motion`, on small screens and on low-power devices.
- Responsive from 320px wide, keyboard friendly, skip link, visible focus rings, AA contrast, custom 404 page.

## How it works

- `math.js` holds all the finance maths as pure functions (UMD style, so it runs in the browser and in Node).
- `script.js` is the UI: tabs, form, chart, history, sharing and export.
- Everything uses relative paths, so it works from any sub-folder such as GitHub Pages project sites.

Formulas: simple interest `P x r x t / 100`; compound `P (1 + r/n)^(n t)`; EMI `P i (1+i)^n / ((1+i)^n - 1)` with monthly rate `i`; recurring deposits compound monthly (deposit at the start or end of each month, your choice). Results are estimates, not financial advice.

## Run locally

No build step. Open `index.html` directly, or serve the folder with any static server, for example:

```
npx serve .
```

## Tests

The maths has unit tests using Node's built-in test runner (Node 18 or newer, no dependencies):

```
npm test
```

## Deploy to GitHub Pages

In the repository settings choose Pages, then deploy from the main branch root. The `.nojekyll` file is already included.
