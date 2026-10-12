# Research: what a "calculate anything" app should cover

This note records the survey done before building the hub, the decisions it led to, and the accuracy pitfalls we designed around. Only public category structures and published formulas were consulted. No third-party content was copied; formulas are not proprietary.

## 1. What the best tools offer

| Source type | What stood out | What we took from it |
| --- | --- | --- |
| Large calculator hubs (calculator.net groups roughly 200 tools into four sections: financial, fitness and health, math, other; Omni-style hubs add science, everyday life and niche topics) | Breadth with a predictable page shape: inputs on the left, results and a worked explanation on the right, a related list underneath. Search is the main way in. | One consistent calculator page, a command palette plus on-page search, categories with counts, related links, show-the-working. |
| Graphing tools (Desmos, GeoGebra) | Instant plotting, several functions at once, pan and zoom by gesture, tables of values, points of interest (roots, intercepts, intersections). | A canvas plotter with up to 6 functions, drag/pinch/wheel/keyboard navigation, key-point detection and a values table. |
| Computational answer engines (WolframAlpha style, Google calculator) | Natural phrasing: "15% of 84", "5 km in miles", "days between dates". Instant result while typing. | A smart input line with a safe parser and a natural-language layer for percentages, tips, discounts, units, currency and dates. |
| Operating-system and handheld calculators (Windows and macOS modes, Casio fx and TI scientific) | Scientific keypad, degree/radian/grad, memory and Ans, programmer mode with bin/oct/dec/hex, bit toggles and word sizes, history tape. | Scientific keypad, angle toggle, Ans and named variables, programmer calculator with 8/16/32/64-bit two's complement and bit grid, history. |
| Unit converters | Many categories, swap button, "all units at once" table. | 16 unit categories plus currency and number bases; swap; full conversion table. |
| Health and fitness tools | BMI, BMR/TDEE, body fat, ideal weight, due date, water, macros, heart rate zones. Results always carry a "screening, not diagnosis" caveat. | Eleven health calculators with formula choice and caveats. |
| Finance sites | Loans with amortization, mortgages with extra payments, compound interest, retirement, investment returns, tax. | 30 finance calculators with charts and schedules. |

## 2. Categories and what each offers

1. **Smart and scientific**: smart calculator, scientific keypad, programmer, graphing.
2. **Finance (30)**: simple and compound interest, EMI with amortization, mortgage with extra and one-time payments, loan comparison, affordability, SIP/RD, step-up SIP, FD, lump sum vs SIP, savings goal, present/future value, NPV and IRR, CAGR, ROI, inflation, rule of 72, retirement, FIRE, systematic withdrawal, credit card payoff, break-even, GST/VAT/sales tax, discount, markup and margin, salary and hourly, tip split, depreciation (three methods), slab income tax, APR to APY.
3. **Converters (18)**: length, area, volume, mass, temperature, speed, pressure, energy, power, time, data size, angle, fuel economy, force, frequency, cooking, currency, number bases.
4. **Algebra and solvers (6)**: linear, quadratic, cubic, systems of equations, matrices (determinant, inverse, transpose, rank, add, subtract, multiply), complex numbers.
5. **Statistics and probability (7)**: descriptive statistics, regression and correlation, normal, binomial and Poisson distributions, permutations and combinations, confidence interval.
6. **Geometry and trigonometry (5)**: 10 flat shapes, 9 solids, right triangle, coordinate geometry, trig values.
7. **Number theory (8)**: prime factors and divisors, GCD/LCM, exact fractions, Roman numerals, number to words (international and Indian), sequences and series, rounding and scientific notation, random numbers.
8. **Health and fitness (11)**, **Date and time (7)**, **Percentages, ratios and grades (5)**, **Everyday and home (8)**, **Physics and chemistry (7)**.

Final scope: 116 calculators and tools (see the README table for the count per category).

## 3. Formulas and references used

- Simple interest `I = P r t / 100`. Compound `A = P (1 + r/n)^(n t)`, continuous `A = P e^(r t)`. Effective rate `(1 + r/n)^n - 1`.
- EMI `P i (1+i)^n / ((1+i)^n - 1)`, `i` = annual rate / 12. Reference check: 10,00,000 at 8.5% for 20 years = 8,678.23. Mortgage check: 300,000 at 6.5% for 30 years = 1,896.20 per month.
- Annuities: `FV = P ((1+i)^n - 1)/i`, times `(1+i)` for deposits at the start of a period. NPV `sum CF_t / (1+r)^t`; IRR by bisection.
- CAGR `(end/begin)^(1/years) - 1`. Rule of 72 and the exact `ln 2 / ln(1+r)`.
- BMI `kg / m^2` with WHO cut-offs (18.5, 25, 30) and the lower Asian cut-offs (23, 27.5) shown alongside.
- BMR: Mifflin-St Jeor `10 kg + 6.25 cm - 5 age + 5 / -161` (recommended default), revised Harris-Benedict (1984 coefficients), Katch-McArdle `370 + 21.6 lean kg`. TDEE uses the standard activity factors 1.2 to 1.9.
- Body fat: U.S. Navy circumference method (log10 form, centimetres). Ideal weight: Devine, Robinson, Miller, Hamwi.
- Due date: Naegele's rule, LMP + 280 days, shifted by cycle length minus 28.
- Statistics: sample variance divides by `n - 1`; quartiles by linear interpolation (Excel QUARTILE.INC / R type 7). Normal CDF through a series/continued-fraction `erf`, inverse CDF by Acklam's approximation with one Halley refinement; binomial and Poisson probabilities through log-gamma (Lanczos) to avoid overflow.
- Cubic roots by the depressed-cubic method (trigonometric branch for three real roots). Quadratic roots use the cancellation-free form `q = -(b + sign(b) sqrt(D))/2`.
- Geometry: Heron's formula, Ramanujan's ellipse perimeter approximation, standard solid formulas.
- Projectile motion and ideal gas law with `g = 9.80665 m/s^2` and `R = 8.314462618 J/(mol K)`.
- Currency: the optional live fetch uses the ECB-based Frankfurter service (keyless, daily reference rates). The offline snapshot is clearly labelled as indicative.

## 4. Accuracy pitfalls and how they are handled

- **Floating point.** `0.1 + 0.2` must be `0.3`. The smart calculator uses decimal.js with 50 significant digits and rounds only for display (default 12 digits, configurable). Money calculators work in doubles and display rounded to the currency's minor unit; schedules are closed by forcing the final balance to zero so drift never shows.
- **Degrees vs radians.** Exact special angles are short-circuited in degree mode so `sin(30)` is exactly `0.5` and `tan(90)` reports "undefined" rather than a huge number.
- **Percent semantics.** `200 + 10%` means 200 plus 10% of 200 (220), matching phone calculators; `50 * 10%` is 5.
- **BMR and BMI variants.** Different formulas disagree by up to about 10%. All variants are shown and named; caveats say BMI ignores muscle mass and that cut-offs differ for children and some populations.
- **Tax regimes differ by country, year and filing status.** There is no pretence of a single correct tax. The income tax calculator takes user-editable slabs; the bundled example is labelled illustrative. GST/VAT takes a rate input because rates differ by item and country.
- **Date arithmetic.** Dates are UTC-midnight integers so daylight saving never shifts a day. Adding a month clamps to the end of shorter months (31 Jan + 1 month = 28/29 Feb). Time zones use the IANA database through `Intl` and resolve the wall clock to an instant with a two-step offset correction around DST changes.
- **Units.** Data sizes distinguish KB (1000) from KiB (1024). Cup sizes differ (US 236.6 mL, metric 250 mL, UK 284 mL) and are separate units. Fuel economy is inverse, so conversions invert instead of scaling. Temperature uses offsets, not ratios. Month and year use averages and are labelled.
- **Integer limits.** Prime factorisation guards the 2^53 range; fractions, Fibonacci and the programmer calculator use BigInt so large values stay exact. Factorials are capped at 3000.
- **Currency.** Mid-market reference rates exclude bank spreads; the app says so next to the converter. Live rates are cached for a week and any network failure silently falls back to the snapshot.
- **No code execution.** Expressions go through a tokenizer and recursive-descent parser. There is no `eval` and no `Function`; names resolve only against an own-property table of constants and functions.

## 5. Decisions

- Vite with vanilla JavaScript: no framework needed because every calculator is declarative data (inputs plus a pure `run` function), rendered by one small form engine. The maths lives in pure modules that run unchanged under Node's test runner.
- Declarative calculator registry, so search, categories, routing, share links, validation and tests come for free for every calculator.
- Hash routing (`#/c/emi?p=...`) so the app works on any static host and sub-path with relative assets; per-calculator state sits in the hash.
- Offline first: a generated service worker precaches the build; no server, no secrets.
