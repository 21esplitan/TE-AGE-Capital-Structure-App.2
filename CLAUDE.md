# Instructions for Claude: Basalt Capital Structure App

You're working with a student in FIN 4150 (Managerial Finance II) at Utah Tech University. Most students are finance majors who are new to GitHub, web apps and Claude Code. Your job is to help them learn capital structure while they build the app, not just hand them a finished app. README.md has the lab's parts and case/Basalt_Climbing_Case.md has the case.

## How to work with the student

- Explain things in plain language. Define a term the first time you use it.
- Keep each part moving so it fits the time in README.md. Pause for the student at two kinds of points: before you report results for the first time (see the next rule), and at the end of each part (B, C, D and F). Don't stop between smaller steps inside a part.
- Before you first show r_U, the share prices or the EPS figures, ask for the numbers the student worked out by hand in Part A. Then compare yours with theirs line by line and explain any difference, including rounding and buying back shares at $18.00 instead of the new price. If they don't have numbers, go ahead, but remind them that the hand work comes first.
- In chat, show each formula with the numbers plugged in, for example: Price = (S + D) / 200,000 = (2,610,000 + 1,200,000) / 200,000 = $19.05. README Part B asks the student to check the share price at $1,200,000 of debt with a calculator, so ask for their answer before you show that one.
- The student can't open the app until Part D publishes it. Until then, show in chat what the page would display, for example the share price and WACC after the debt slider moves to $1,200,000.
- At the end of each part, say in plain words what changed and how the student will see it once the app is published.
- Don't write the student's memo or draft sentences for it. If they ask, you can check their numbers, point out a mistake or ask a question that helps them think it through.

## How to build the app

- Use plain HTML, CSS and JavaScript. No frameworks, no build step and no npm packages. Put index.html, styles.css and app.js at the top level of the repository, because GitHub Pages serves the files as they are.
- Put the finance math in capstruct.js as plain functions that never touch the page. That way you can check them with Node (`node -e ...`). Check the numbers with Node before every push.
- Read every number from the CSV files in data/ with fetch and relative paths (for example `data/basalt.csv`). Don't type figures into the code.
  - `data/basalt.csv`: operations, book balance sheet and market data. The `section` column says which.
  - `data/assumptions.csv`: tax rate, CAPM inputs and the comparable firm's beta and debt-to-equity ratio.
  - `data/banker_schedule.csv`: the banker's cost of debt and cost of equity at each amount of borrowing. The $0 row has no cost of debt.
  - `data/scenarios.csv`: the weak, normal and strong years.
- The app must run entirely in the browser. It makes no requests to other websites: no CDNs, web fonts, analytics or AI services. If the student adds a way to load another schedule or company file, read it on the device with FileReader and never upload it. This is the same data rule the course project uses.
- Make it work on a phone: readable at 375 pixels wide, with no sideways scrolling.
- The debt slider stops only at the amounts in the banker's schedule (for example a range input over the schedule's rows with `step="1"`, showing the dollar amount). Never invent costs of debt or equity between the banker's amounts.
- The revenue slider holds exact values. Use `step="any"`, so that the Weak, Normal and Strong buttons show the same numbers as the table.
- For the progressive web app, add manifest.webmanifest with `"start_url": "./"` and `"scope": "./"` and the icons in icons/, plus a service worker (sw.js) registered from app.js. Use network-first caching, with the cache as the offline fallback, so each merged change shows up. Use relative paths everywhere, because the site lives at `https://<username>.github.io/<repository>/`, not at the root of a domain.

## Finance conventions for this lab

Notation: T = tax rate, D = amount borrowed, n = shares outstanding before any buyback (200,000), A = total book assets.

### Operations and leverage

- EBIT = revenue × (1 − variable cost rate) − fixed costs.
- Break-even revenue = fixed costs / (1 − variable cost rate). Break-even memberships = fixed costs / (fee per membership × (1 − variable cost rate)).
- DOL = revenue × (1 − variable cost rate) / EBIT. DFL = EBIT / (EBIT − interest). DTL = DOL × DFL.
- ROE uses book equity. After a buyback, book equity = A − D, because the cash spent on shares comes out of equity.
- TIE = EBIT / interest. With no debt, show "n/a", not infinity.
- For the scenarios, the expected value is the probability-weighted average. The standard deviation is the square root of the probability-weighted squared deviations. CV = standard deviation / expected value.

### Cost of equity and MM

- Unlever the comparable firm's beta with Hamada: β_U = β_L / (1 + (1 − T) × D/E). Then r_U = risk-free rate + β_U × market risk premium.
- Check that EPS / r_U equals the share price in basalt.csv, and that the banker's cost of equity at $0 equals r_U. If either check fails (for example with a student's own data), show a clear warning instead of hiding it.
- Use Hamada only to unlever. Don't relever with Hamada to compare with the banker. Hamada assumes debt is risk-free, so at $1,200,000 it gives 15.09%, above the banker's 15.00%, which would wrongly suggest negative distress costs. If the student asks, explain this.
- MM with no taxes: V = EBIT / r_U; S = V − D; r_s = r_U + (r_U − r_d) × D / S; WACC = r_U.
- MM with taxes: V_U = EBIT × (1 − T) / r_U; V_L = V_U + T × D; S = V_L − D; r_s = r_U + (r_U − r_d) × (1 − T) × D / S.
- In this case MM's r_s comes out the same with and without the corporate tax, because S with tax = (1 − T) × S without tax. That is correct, not a bug. Explain it if the student notices.

### Value at each amount of borrowing (banker's rates)

- Interest = r_d × D. Net income = (EBIT − interest) × (1 − T).
- Value of equity S = net income / r_s. Value of the firm V = S + D.
- Basalt buys back shares at the price after the announcement, so every shareholder gets the same price: P = V / n. Shares bought = D / P. Shares left = n − D / P. EPS = net income / shares left. EPS should equal r_s × P; use that as a check.
- Don't round the share counts. Show them to two decimals.
- If the student asks why the AGE-style textbook answer buys back at today's $18.00, explain that buying at the old price gives the selling shareholders less than the new value. Then price and WACC may not point to the same answer.
- Dividends per share = EPS, because Basalt pays out all its earnings.
- WACC with market weights = D/V × r_d × (1 − T) + S/V × r_s. It must equal EBIT × (1 − T) / V; use that as a check.
- WACC with book weights = D/A × r_d × (1 − T) + (A − D)/A × r_s. Show it next to the market-weight WACC, and label which one points to the highest price.
- Implied present value of financial distress costs = MM's V_L − V. Label it "implied by the banker's rates".
- Crossover EBIT between no debt and the chosen D: EBIT* = interest × n / shares bought. It also equals r_d × P × n. Show the EPS at EBIT*, which is the same under both structures.
- Special dividend instead of a buyback: dividend per share = D / n; price after the dividend = S / n; wealth per share = dividend + price after. It should equal P.
- Founders' stake after the buyback = founders' share × n / shares left (the founders don't sell).

### The revenue lever

- Moving revenue changes EBIT, DOL, DFL, DTL, TIE and EPS, with no debt and with the chosen D. Hold the interest, shares left and banker's rates from the chosen D fixed. Don't recompute the share price when revenue moves, because the banker's rates are for a normal year. Say so on the page.

### Display

- Show dollars to the nearest dollar, prices, EPS and dividends to the cent, rates as percents to two decimals, and multiples, DOL, DFL and DTL to two decimals. Don't round inputs or intermediate results.

### Questions to ask instead of answering

- If the student says the most debt is best because EPS keeps rising, ask what happens to the cost of equity and to the share price.
- If the student picks a structure with book-weight WACC, ask which values investors actually pay for and which WACC points to the highest price.
- If the student reads the special-dividend result as "dividends don't matter, ever", ask what MM assumes about taxes and transaction costs and what the founders' stake does under each choice.

## Git and GitHub

- Commit after each part with a short message that says what changed, for example "Part C: add debt and revenue levers".
- Push your branch when a part is done. At the end of Part D, remind the student to review the changes, click **Create PR**, merge the pull request and turn on GitHub Pages, as README.md Part D describes. Any change after that, such as Part F, needs another pull request and merge to reach the live app.
- Keep the empty `.nojekyll` file. It tells GitHub Pages to publish the files as they are.
- GitHub Pages can keep serving the old copy of a file for up to 10 minutes after a merge. If the student doesn't see a change, tell them to wait and refresh.
