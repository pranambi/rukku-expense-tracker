# 💰 Rukku's Expense Tracker

A simple, private expense tracker that runs entirely in your browser. No sign-up, no server — your data is saved privately on your own device.

🔗 **Live app:** https://pranambi.github.io/rukku-expense-tracker/

## Features

- ➕ Add, ✏️ edit, and 🗑️ delete expenses (with undo)
- 🏷️ Quick category chips (Food, Transport, Shopping, Bills, Fun, Health, Other)
- 🎯 Monthly budget with a live status emoji and spent / left / used figures
- 🍩 Donut chart breakdown of spending by category
- 🔍 Search, filter by category, and filter by month
- 💱 Currency switch ($, ₹, €, £, ¥)
- ⬇️ Export and ⬆️ import your data as CSV
- 🔔 Toast notifications and a soft animated background
- 💾 Saves automatically in your browser (localStorage) — nothing is sent anywhere

## How it works

Pure HTML, CSS, and JavaScript — no frameworks, no build step. Just open `index.html`.

| File | Purpose |
|------|---------|
| `index.html` | Page structure |
| `style.css` | Styling and layout |
| `app.js` | App logic |
| `favicon.svg` | Browser tab icon |

## Privacy

All data lives in your browser's `localStorage`. It is never uploaded or shared. Opening the public link gives each visitor their own private, separate tracker.

## Run locally

Clone the repo and open `index.html` in any browser — that's it.
