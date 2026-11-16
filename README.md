# Basalt Capital Structure App

**FIN 4150 · Capital Structure**

You will use Claude Code to build a web app that reads Basalt Climbing Co.'s figures and a banker's estimates of its borrowing costs. The app works out what each amount of borrowing does to Basalt's share price, earnings per share (EPS), risk and cost of capital, and it has levers you can move. You then publish it with GitHub Pages, so it installs on your phone or laptop like any other app. A web app that installs this way is called a progressive web app (PWA).

The lab has two sessions. In Session 1 you work the case by hand. In Session 2 you build the app and check it against your hand work.

## What's in this repository

| File | What it is |
|---|---|
| `case/Basalt_Climbing_Case.md` | The case |
| `data/basalt.csv` | Basalt's operations, book balance sheet and market data. The `section` column says which. |
| `data/assumptions.csv` | Tax rate, CAPM inputs and the comparable firm's beta and debt-to-equity ratio |
| `data/banker_schedule.csv` | The banker's cost of debt and cost of equity at each amount of borrowing |
| `data/scenarios.csv` | Weak, normal and strong years |
| `data/banker_schedule_tight_credit.csv` | A second banker's schedule, for Part F |
| `icons/` | The app's icons |
| `CLAUDE.md` | Instructions Claude reads at the start of every session. Read it so you know how Claude has been told to work with you. |

## Session 1

### Part A: By hand (no AI)

Answer case questions 1, 2, 7, 10 and 11 by hand. A calculator is fine. Keep your work next to you in Session 2, because Claude will ask for your numbers.

## Session 2

### Part B: Build the calculator (20 minutes)

Start a Claude Code session on your repository and paste this prompt:

> Read CLAUDE.md, README.md and case/Basalt_Climbing_Case.md. Build the first version of the app: a page that reads the files in data/ and shows Basalt's unlevered cost of equity and, for each amount of borrowing in the banker's schedule, the share price, shares repurchased, EPS, TIE, WACC with market and with book weights, MM's value and the implied cost of financial distress. Walk me through it.

Then:

- When Claude asks for your Part A numbers, give them. If yours don't match Claude's, figure out who is right and why. Rounding counts, and so does the price Basalt pays for the shares it buys back.
- Check one number yourself with a calculator: the share price with $1,200,000 of debt, ((600,000 − 78,000) × 0.75 / 0.15 + 1,200,000) / 200,000. It should match the app.

### Part C: Add the levers (20 minutes)

Write your own prompt asking Claude to add two sliders and some buttons.

1. **Debt.** It stops only at the banker's amounts. When it moves, the app shows:
   - the share price, shares repurchased and shares left
   - EPS, dividends per share and TIE
   - WACC with market and with book weights
   - MM's value and the implied cost of financial distress
   - what a special dividend of the same amount would leave each shareholder
   - the founders' share of the company
2. **Revenue.** When it moves, the app shows EBIT, DOL, DFL and DTL. It also shows EPS and TIE with no debt and with the chosen debt, and the EBIT at which the two EPS figures are equal.
3. Add **Weak**, **Normal** and **Strong** buttons that set revenue to the case's three kinds of year, and a **Best price** button that sets debt to the amount with the highest share price.

Also ask for a table of expected ROE, standard deviation of ROE and coefficient of variation, with no debt and with the chosen debt. You can't open the app until Part D publishes it, so ask Claude to show you in chat what the page shows after **Best price** and **Weak**. The share price should match your Part A work. You'll click the buttons yourself after Part D.

### Part D: Make it installable and publish it (15 minutes)

1. Paste this prompt: "Make this a progressive web app. Add a web app manifest that uses the icons in icons/ and a service worker so it installs and works offline. Then commit and push."
2. In the **Changes** card beside the chat, click the line counts (like `+120 -0`) to see every change Claude made. Read through it.
3. Click **Create PR**. On GitHub, open your repository's **Pull requests** tab and open the new pull request. Click **Merge pull request**, then **Confirm merge**.
4. On GitHub, go to your repository's **Settings**, then **Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose **main** and **/ (root)**, and click **Save**.
5. Wait a few minutes and refresh the Pages screen. Your app's address appears at the top. It looks like `https://your-username.github.io/capital-structure-lab/`.

   If the address doesn't appear, open your repository's **Actions** tab and look for a run called **pages build and deployment**. If there's no such run after a few minutes, go back to **Settings**, then **Pages**. Set the branch to **None** and click **Save**. Then choose **main** and **/ (root)** again and click **Save**. When the run in the **Actions** tab has a green check, refresh the Pages screen.
6. Open the address and install the app. In Chrome or Edge, click the install icon in the address bar. On an iPhone, tap Share, then **Add to Home Screen**.

### Part E: Use the levers (10 minutes)

Use your app to answer the memo questions in the Canvas assignment. Every answer should cite a number from the app or your Part A work.

### Part F (optional): A nervous lender

Ask Claude to add a button that loads a different banker's schedule from your device. The file must be read in the browser and never uploaded. Test it with `data/banker_schedule_tight_credit.csv`, where lenders charge more as Basalt borrows. Which amount of borrowing gives the highest share price now, and why did it move?

Part D already merged your first pull request. To get this change onto your live app, click **Create PR** again and merge the new pull request.

## Submit

In the Canvas assignment, paste your app's address, your repository's address and your memo.
