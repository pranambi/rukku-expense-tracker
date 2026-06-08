// ===== Expense Tracker logic =====
// All data lives in the browser's localStorage, so it survives reloads.
// Nothing is ever sent to a server.

const STORAGE_KEY = "expenses.v1";
const SETTINGS_KEY = "expenses.settings.v1";

// Emoji for each category (used in the list and breakdown)
const CATEGORY_EMOJI = {
  Food: "🍔",
  Transport: "🚗",
  Shopping: "🛍️",
  Bills: "🧾",
  Fun: "🎮",
  Health: "💊",
  Other: "📦",
};

// --- Element references ---
const $ = (id) => document.getElementById(id);

const form = $("expenseForm");
const editIdInput = $("editId");
const descInput = $("descInput");
const amountInput = $("amountInput");
const categoryInput = $("categoryInput");
const categoryChips = $("categoryChips");
const dateInput = $("dateInput");
const formTitle = $("formTitle");
const submitBtn = $("submitBtn");
const cancelEditBtn = $("cancelEditBtn");

const totalSpentEl = $("totalSpent");
const expenseCountEl = $("expenseCount");
const topCategoryEl = $("topCategory");

const budgetInput = $("budgetInput");
const budgetSymbol = $("budgetSymbol");
const budgetFill = $("budgetFill");
const budgetMeta = $("budgetMeta");
const budgetEmoji = $("budgetEmoji");
const budgetFigures = $("budgetFigures");
const bSpent = $("bSpent");
const bRemaining = $("bRemaining");
const bPct = $("bPct");
const budgetHint = $("budgetHint");

const searchInput = $("searchInput");
const filterCategory = $("filterCategory");
const filterMonth = $("filterMonth");
const currencySelect = $("currencySelect");

const exportBtn = $("exportBtn");
const importBtn = $("importBtn");
const importFile = $("importFile");

const listEl = $("expenseList");
const emptyStateEl = $("emptyState");
const noMatchStateEl = $("noMatchState");
const shownCountEl = $("shownCount");
const clearAllBtn = $("clearAllBtn");

const breakdownSection = $("breakdownSection");
const donutWrap = $("donutWrap");
const donutEl = $("donut");
const donutTotalEl = $("donutTotal");
const legendEl = $("legend");
const breakdownEmptyEl = $("breakdownEmpty");

// A distinct colour per category, used by the donut + legend.
const CATEGORY_COLOR = {
  Food: "#f97316",
  Transport: "#38bdf8",
  Shopping: "#a78bfa",
  Bills: "#f43f5e",
  Fun: "#22c55e",
  Health: "#ec4899",
  Other: "#94a3b8",
};

const toastHost = $("toastHost");

// --- State ---
let expenses = load(STORAGE_KEY, []);
let settings = load(SETTINGS_KEY, { currency: "₹", budget: 0 });

// --- Storage helpers ---
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveExpenses() { localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses)); }
function saveSettings() { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }

// --- Formatting ---
function money(n) { return settings.currency + n.toFixed(2); }
function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key) {
  const [y, m] = key.split("-");
  return new Date(y, m - 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
// Local YYYY-MM-DD for the <input type="date"> default
function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

// ============ Category chips ============
// The hidden #categoryInput holds the value; chips are the clickable UI.
function setCategory(cat) {
  categoryInput.value = cat;
  for (const chip of categoryChips.children) {
    chip.classList.toggle("selected", chip.dataset.category === cat);
  }
}
categoryChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip) setCategory(chip.dataset.category);
});

// ============ Add / Edit ============
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const desc = descInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = categoryInput.value;
  const date = dateInput.value ? new Date(dateInput.value + "T12:00:00").getTime() : Date.now();
  if (!desc || isNaN(amount) || amount <= 0) return;

  const editingId = editIdInput.value;
  if (editingId) {
    const exp = expenses.find((x) => x.id === Number(editingId));
    if (exp) Object.assign(exp, { desc, amount, category, date });
    toast("✏️ Expense updated");
    exitEditMode();
  } else {
    expenses.unshift({ id: Date.now(), desc, amount, category, date });
    toast("✅ Expense added");
  }
  saveExpenses();
  render();
  form.reset();
  setCategory("Food");
  dateInput.value = todayISO();
  descInput.focus();
});

function enterEditMode(id) {
  const exp = expenses.find((x) => x.id === id);
  if (!exp) return;
  editIdInput.value = id;
  descInput.value = exp.desc;
  amountInput.value = exp.amount;
  setCategory(exp.category);
  dateInput.value = new Date(exp.date - new Date(exp.date).getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
  formTitle.textContent = "Edit expense";
  submitBtn.textContent = "Save changes";
  cancelEditBtn.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  descInput.focus();
}

function exitEditMode() {
  editIdInput.value = "";
  formTitle.textContent = "Add an expense";
  submitBtn.textContent = "+ Add";
  cancelEditBtn.hidden = true;
  form.reset();
  setCategory("Food");
  dateInput.value = todayISO();
}
cancelEditBtn.addEventListener("click", exitEditMode);

// ============ Delete (with Undo) ============
function deleteExpense(id) {
  const idx = expenses.findIndex((x) => x.id === id);
  if (idx === -1) return;
  const [removed] = expenses.splice(idx, 1);
  saveExpenses();
  render();
  toast("🗑️ Expense deleted", {
    actionLabel: "Undo",
    onAction: () => {
      expenses.splice(idx, 0, removed);
      saveExpenses();
      render();
      toast("↩️ Restored");
    },
  });
}

clearAllBtn.addEventListener("click", () => {
  if (!expenses.length) return;
  if (confirm("Delete ALL expenses? This cannot be undone.")) {
    const backup = expenses.slice();
    expenses = [];
    saveExpenses();
    render();
    toast("🗑️ All expenses cleared", {
      actionLabel: "Undo",
      onAction: () => { expenses = backup; saveExpenses(); render(); toast("↩️ Restored"); },
    });
  }
});

// ============ Budget ============
budgetInput.addEventListener("input", () => {
  settings.budget = parseFloat(budgetInput.value) || 0;
  saveSettings();
  renderBudget();
});

function renderBudget() {
  budgetSymbol.textContent = settings.currency;
  const spentThisMonth = expenses
    .filter((e) => monthKey(e.date) === monthKey(Date.now()))
    .reduce((s, e) => s + e.amount, 0);

  // No budget set → friendly prompt, hide the figures
  if (!settings.budget || settings.budget <= 0) {
    budgetFill.style.width = "0%";
    budgetFill.className = "budget-fill";
    budgetMeta.className = "budget-meta";
    budgetMeta.textContent = "No budget set — add one to track your limit.";
    budgetEmoji.textContent = "💡";
    budgetFigures.hidden = true;
    budgetHint.hidden = false;
    budgetHint.textContent = "Set a monthly budget to track your spending.";
    return;
  }

  const pct = (spentThisMonth / settings.budget) * 100;
  budgetFill.style.width = Math.min(pct, 100) + "%";
  const remaining = settings.budget - spentThisMonth;

  budgetFill.className = "budget-fill";
  budgetMeta.className = "budget-meta";

  // Status emoji reacts to how close you are to the limit
  let emoji;
  if (pct >= 100) {
    budgetFill.classList.add("over");
    budgetMeta.classList.add("over");
    budgetMeta.textContent = `⚠️ Over budget by ${money(Math.abs(remaining))} this month!`;
    emoji = "🚨";
  } else if (pct >= 80) {
    budgetFill.classList.add("warn");
    budgetMeta.classList.add("warn");
    budgetMeta.textContent = `Heads up — ${money(remaining)} left of your ${money(settings.budget)} budget.`;
    emoji = "😬";
  } else if (pct >= 50) {
    budgetMeta.textContent = `${money(spentThisMonth)} of ${money(settings.budget)} spent this month.`;
    emoji = "🙂";
  } else {
    budgetMeta.textContent = `${money(spentThisMonth)} of ${money(settings.budget)} spent this month.`;
    emoji = "😌";
  }

  // Fill the panel with live figures
  budgetEmoji.textContent = emoji;
  budgetFigures.hidden = false;
  budgetHint.hidden = true;
  bSpent.textContent = money(spentThisMonth);
  bRemaining.textContent = money(Math.max(remaining, 0));
  bRemaining.classList.toggle("over", remaining < 0);
  bPct.textContent = Math.round(pct) + "%";
  bPct.classList.toggle("over", pct >= 100);
}

// ============ Currency ============
currencySelect.addEventListener("change", () => {
  settings.currency = currencySelect.value;
  saveSettings();
  render();
});

// ============ Filters ============
[searchInput, filterCategory, filterMonth].forEach((el) =>
  el.addEventListener("input", renderList)
);

function getFiltered() {
  const q = searchInput.value.trim().toLowerCase();
  const cat = filterCategory.value;
  const month = filterMonth.value;
  return expenses.filter((e) => {
    if (q && !e.desc.toLowerCase().includes(q)) return false;
    if (cat && e.category !== cat) return false;
    if (month && monthKey(e.date) !== month) return false;
    return true;
  });
}

// ============ CSV Export / Import ============
const CURRENCY_CODES = { "₹": "INR", "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY" };

function bankDateStr(ts) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}
function bankAmountStr(n) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

exportBtn.addEventListener("click", () => {
  if (!expenses.length) return toast("Nothing to export yet");
  const currCode = CURRENCY_CODES[settings.currency] || settings.currency;
  const rows = [["Date", "Details", "Amount", "Currency", "Balance", "Debit/Credit", "Status"]];
  for (const e of expenses) {
    rows.push([bankDateStr(e.date), e.desc, bankAmountStr(e.amount), currCode, "", "Debit", "SETTLED"]);
  }
  const csv = rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `expenses-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast("⬇️ Exported CSV");
});

importBtn.addEventListener("click", () => importFile.click());
importFile.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const added = parseCSV(reader.result);
      if (added > 0) { saveExpenses(); render(); toast(`⬆️ Imported ${added} expense${added > 1 ? "s" : ""}`); }
      else toast("No valid rows found in that file");
    } catch {
      toast("⚠️ Couldn't read that CSV");
    }
    importFile.value = "";
  };
  reader.readAsText(file);
});

// Minimal CSV parser that handles quoted fields and commas inside quotes.
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return 0;
  const headers = splitCSVLine(lines[0]);
  // Detect bank statement format: Date, Details, Amount, Currency, Balance, Debit/Credit, Status
  if (headers.length >= 6 &&
      headers[0].toLowerCase().includes("date") &&
      headers[1].toLowerCase().includes("details") &&
      headers[5].toLowerCase().replace(/[^a-z]/g, "").includes("debit")) {
    return parseBankCSV(lines);
  }
  // Original app export format: Description, Amount, Category, Date
  let added = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 3) continue;
    const desc = (cols[0] || "").trim();
    const amount = parseFloat(cols[1]);
    const category = CATEGORY_EMOJI[cols[2]] ? cols[2].trim() : "Other";
    const date = cols[3] ? new Date(cols[3]).getTime() : Date.now();
    if (!desc || isNaN(amount) || amount <= 0) continue;
    expenses.unshift({ id: Date.now() + i, desc, amount, category, date: isNaN(date) ? Date.now() : date });
    added++;
  }
  return added;
}

const BANK_CATEGORY_RULES = [
  [/\btaxi\b|\buber\b|\bmetro\b|\bbus\b|transport|airline|flight|careem.*cab|cab\b/i, "Transport"],
  [/restaurant|cafeteria|catering|sweets|bakery|\bfood\b|burger|pizza|\bcafe\b|coffee|diner|corn\b/i, "Food"],
  [/supermarket|hypermarket|\bmarket\b|\bmall\b|\bstore\b|\bshop\b/i, "Shopping"],
  [/electricity|water\b|telecom|internet|\bmobile\b|dewa|etisalat|\bdu\b|e&|digital app/i, "Bills"],
  [/netflix|spotify|youtube|instagram|google\*/i, "Fun"],
  [/pharmacy|hospital|clinic|medical|health|doctor/i, "Health"],
];

function guessCategoryFromDesc(desc) {
  for (const [pattern, cat] of BANK_CATEGORY_RULES) {
    if (pattern.test(desc)) return cat;
  }
  return "Other";
}

function parseBankCSV(lines) {
  let added = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 6) continue;
    const debitCredit = cols[5].trim().toLowerCase();
    if (debitCredit === "credit") continue; // skip income/salary rows
    const dateStr = cols[0].trim();
    const desc = cols[1].trim();
    const amount = parseFloat(cols[2].replace(/,/g, ""));
    const date = new Date(dateStr).getTime();
    if (!desc || isNaN(amount) || amount <= 0) continue;
    const category = guessCategoryFromDesc(desc);
    expenses.unshift({ id: Date.now() + i, desc, amount, category, date: isNaN(date) ? Date.now() : date });
    added++;
  }
  return added;
}
function splitCSVLine(line) {
  const out = [];
  let cur = "", inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else {
      if (ch === '"') inQ = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

// ============ Stats ============
function getStats() {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = {};
  for (const e of expenses) byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  let topCategory = null, topAmount = 0;
  for (const [c, a] of Object.entries(byCategory)) if (a > topAmount) { topAmount = a; topCategory = c; }
  return { total, byCategory, topCategory };
}

// ============ Rendering ============
function refreshMonthFilter() {
  const months = [...new Set(expenses.map((e) => monthKey(e.date)))].sort().reverse();
  const current = filterMonth.value;
  filterMonth.innerHTML = '<option value="">All months</option>';
  for (const m of months) {
    const opt = document.createElement("option");
    opt.value = m;
    opt.textContent = monthLabel(m);
    filterMonth.appendChild(opt);
  }
  if (months.includes(current)) filterMonth.value = current;
}

function renderDonut(byCategory, total) {
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  // Empty state
  if (total <= 0 || entries.length === 0) {
    donutWrap.hidden = true;
    breakdownEmptyEl.hidden = false;
    donutEl.style.background = "var(--panel-2)";
    legendEl.innerHTML = "";
    return;
  }
  donutWrap.hidden = false;
  breakdownEmptyEl.hidden = true;

  // Build the conic-gradient: each category is a slice sized by its share.
  let acc = 0;
  const segments = entries.map(([cat, amt]) => {
    const start = (acc / total) * 360;
    acc += amt;
    const end = (acc / total) * 360;
    return `${CATEGORY_COLOR[cat]} ${start}deg ${end}deg`;
  });
  donutEl.style.background = `conic-gradient(${segments.join(", ")})`;
  donutTotalEl.textContent = money(total);

  // Legend
  legendEl.innerHTML = "";
  for (const [cat, amt] of entries) {
    const pct = (amt / total) * 100;
    const row = document.createElement("div");
    row.className = "legend-row";
    row.innerHTML = `
      <span class="legend-dot" style="background:${CATEGORY_COLOR[cat]}"></span>
      <span class="legend-name">${CATEGORY_EMOJI[cat]} ${cat}</span>
      <span class="legend-val">${money(amt)} · ${pct.toFixed(0)}%</span>`;
    legendEl.appendChild(row);
  }
}

function render() {
  const { total, byCategory, topCategory } = getStats();

  totalSpentEl.textContent = money(total);
  expenseCountEl.textContent = expenses.length;
  topCategoryEl.textContent = topCategory ? `${CATEGORY_EMOJI[topCategory]} ${topCategory}` : "—";

  renderDonut(byCategory, total);

  refreshMonthFilter();
  renderBudget();
  renderList();
}

function renderList() {
  const filtered = getFiltered();
  const hasAny = expenses.length > 0;
  const hasShown = filtered.length > 0;

  clearAllBtn.hidden = !hasAny;
  emptyStateEl.hidden = hasAny;
  noMatchStateEl.hidden = !(hasAny && !hasShown);
  shownCountEl.textContent = hasAny ? `(${filtered.length}${filtered.length !== expenses.length ? " of " + expenses.length : ""})` : "";

  listEl.innerHTML = "";
  for (const exp of filtered) {
    const li = document.createElement("li");
    li.className = "expense";
    li.innerHTML = `
      <span class="exp-emoji">${CATEGORY_EMOJI[exp.category]}</span>
      <div class="exp-main">
        <div class="exp-desc"></div>
        <div class="exp-meta">${exp.category} · ${formatDate(exp.date)}</div>
      </div>
      <span class="exp-amount">${money(exp.amount)}</span>
      <div class="row-actions">
        <button class="icon-btn edit-btn" title="Edit">✏️</button>
        <button class="icon-btn del-btn" title="Delete">✕</button>
      </div>`;
    li.querySelector(".exp-desc").textContent = exp.desc;
    li.querySelector(".edit-btn").addEventListener("click", () => enterEditMode(exp.id));
    li.querySelector(".del-btn").addEventListener("click", () => deleteExpense(exp.id));
    listEl.appendChild(li);
  }
}

// ============ Toasts ============
function toast(message, { actionLabel, onAction, duration = 4000 } = {}) {
  const el = document.createElement("div");
  el.className = "toast";
  const span = document.createElement("span");
  span.textContent = message;
  el.appendChild(span);

  if (actionLabel && onAction) {
    const btn = document.createElement("button");
    btn.className = "undo-btn";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => { dismiss(); onAction(); });
    el.appendChild(btn);
  }
  toastHost.appendChild(el);

  const timer = setTimeout(dismiss, duration);
  function dismiss() {
    clearTimeout(timer);
    el.classList.add("out");
    setTimeout(() => el.remove(), 200);
  }
}

// ============ Init ============
function init() {
  currencySelect.value = settings.currency;
  budgetInput.value = settings.budget || "";
  dateInput.value = todayISO();
  setCategory("Food");
  render();
}
init();
