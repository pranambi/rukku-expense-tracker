// ===== Expense Tracker logic =====
// All data lives in the browser's localStorage, so it survives reloads.
// Nothing is ever sent to a server.

const STORAGE_KEY = "expenses.v1";
const SETTINGS_KEY = "expenses.settings.v1";
const CUSTOM_CATS_KEY = "expenses.customcats.v1";

// Emoji for each category (used in the list and breakdown)
const CATEGORY_EMOJI = {
  Food: "🍔",
  Transport: "🚗",
  Shopping: "🛍️",
  Bills: "🧾",
  Fun: "🎮",
  Health: "💊",
  Remittance: "🏡",
  Investment: "📈",
  "Self Improvement": "📚",
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
const typeExpenseBtn = $("typeExpenseBtn");
const typeIncomeBtn = $("typeIncomeBtn");

const totalSpentEl = $("totalSpent");
const totalIncomeEl = $("totalIncome");
const totalBalanceEl = $("totalBalance");
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
const currencySelect = $("currencySelect");
const prevMonthBtn = $("prevMonthBtn");
const nextMonthBtn = $("nextMonthBtn");
const activeMonthLabel = $("activeMonthLabel");

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
  Remittance: "#f59e0b",
  Investment: "#06b6d4",
  "Self Improvement": "#84cc16",
  Other: "#94a3b8",
};

const CUSTOM_COLORS = [
  "#e879f9","#fb7185","#34d399","#fbbf24","#60a5fa",
  "#f472b6","#a3e635","#2dd4bf","#c084fc","#facc15",
];

const toastHost = $("toastHost");
const addCategoryBtn = $("addCategoryBtn");
const newCatForm = $("newCatForm");
const newCatEmojiBtn = $("newCatEmojiBtn");
const emojiGrid = $("emojiGrid");
const newCatName = $("newCatName");
const newCatSave = $("newCatSave");
const newCatCancel = $("newCatCancel");

// --- State ---
let expenses = load(STORAGE_KEY, []);
let settings = load(SETTINGS_KEY, { currency: "₹", budget: 0 });
let customCats = load(CUSTOM_CATS_KEY, []); // [{name, emoji}]
let activeMonth = monthKey(Date.now());
let incomeMode = false;

function catEmoji(name) {
  return CATEGORY_EMOJI[name] ?? (customCats.find(c => c.name === name)?.emoji || "🏷️");
}
function catColor(name) {
  if (CATEGORY_COLOR[name]) return CATEGORY_COLOR[name];
  const idx = customCats.findIndex(c => c.name === name);
  return CUSTOM_COLORS[idx % CUSTOM_COLORS.length] ?? "#94a3b8";
}

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
function renderCustomChips() {
  // Remove previously injected custom chips (before the "+ Add" button)
  for (const el of [...categoryChips.querySelectorAll(".chip-custom")]) el.remove();
  // Rebuild filter dropdown custom options
  for (const el of [...filterCategory.querySelectorAll(".opt-custom")]) el.remove();
  for (const cc of customCats) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip chip-custom";
    btn.dataset.category = cc.name;
    const label = document.createTextNode(`${cc.emoji} ${cc.name} `);
    const del = document.createElement("span");
    del.className = "chip-del";
    del.textContent = "✕";
    del.title = "Remove category";
    del.addEventListener("click", (e) => { e.stopPropagation(); deleteCustomCat(cc.name); });
    btn.appendChild(label);
    btn.appendChild(del);
    categoryChips.insertBefore(btn, addCategoryBtn);
    const opt = document.createElement("option");
    opt.className = "opt-custom";
    opt.value = cc.name;
    opt.textContent = `${cc.emoji} ${cc.name}`;
    filterCategory.appendChild(opt);
  }
}

function setCategory(cat) {
  categoryInput.value = cat;
  for (const chip of categoryChips.children) {
    chip.classList.toggle("selected", chip.dataset.category === cat);
  }
}
categoryChips.addEventListener("click", (e) => {
  const chip = e.target.closest(".chip:not(.chip-add)");
  if (chip) setCategory(chip.dataset.category);
});

// ---- Add-category inline form ----
addCategoryBtn.addEventListener("click", () => {
  newCatForm.classList.add("open");
  addCategoryBtn.style.display = "none";
  newCatEmojiBtn.textContent = "😊";
  newCatName.value = "";
  closeEmojiGrid();
  newCatName.focus();
});

const EMOJI_OPTIONS = [
  "🍔","🍕","🍜","🍣","🍩","🍺","☕","🥗","🍗","🥩",
  "🚗","🚕","🚌","🚂","✈️","🚲","🛵","🚀","🚢","🏍️",
  "🛍️","👗","👠","💄","🛒","🎁","🪄","💍","👒","🧣",
  "🧾","💡","🔌","💧","🏠","📱","💻","🖨️","📡","🔑",
  "🎮","🎬","🎵","🎨","🎭","🎲","🃏","🎯","⚽","🏀",
  "💊","🏥","🧘","🏋️","🩺","💉","🩹","🧬","🫀","🦷",
  "🏡","🌳","🌻","🪴","🌊","🏔️","🌈","🌙","⭐","🔥",
  "📈","📊","💹","💰","🏦","💳","🪙","📉","🤝","📋",
  "📚","📖","✏️","🎓","🧪","🔭","🏆","🎤","🎙️","📝",
  "🐶","🐱","🐟","🌺","🦋","🐘","🦁","🐧","🐝","🦊",
  "🏷️","✨","💫","🎪","🎠","🎡","🎢","🎃","🎄","🌟",
];

(function buildEmojiGrid() {
  for (const em of EMOJI_OPTIONS) {
    const span = document.createElement("span");
    span.className = "emoji-cell";
    span.textContent = em;
    emojiGrid.appendChild(span);
  }
  document.body.appendChild(emojiGrid); // move to body so position:fixed works correctly
})();

function closeEmojiGrid() { emojiGrid.classList.remove("open"); }

newCatEmojiBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  if (emojiGrid.classList.contains("open")) { closeEmojiGrid(); return; }
  // Position the grid below the button using fixed coords
  const r = newCatEmojiBtn.getBoundingClientRect();
  emojiGrid.style.top = (r.bottom + 6) + "px";
  emojiGrid.style.left = r.left + "px";
  emojiGrid.classList.add("open");
});

emojiGrid.addEventListener("click", (e) => {
  const cell = e.target.closest(".emoji-cell");
  if (cell) {
    newCatEmojiBtn.textContent = cell.textContent;
    closeEmojiGrid();
    newCatName.focus();
  }
});

document.addEventListener("click", (e) => {
  if (emojiGrid.classList.contains("open") && !emojiGrid.contains(e.target) && e.target !== newCatEmojiBtn) {
    closeEmojiGrid();
  }
});

newCatCancel.addEventListener("click", closeNewCatForm);
newCatSave.addEventListener("click", saveNewCat);
newCatName.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); saveNewCat(); } });

function closeNewCatForm() {
  newCatForm.classList.remove("open");
  addCategoryBtn.style.display = "";
  closeEmojiGrid();
}

function saveNewCat() {
  const emoji = newCatEmojiBtn.textContent.trim() || "🏷️";
  const name = newCatName.value.trim();
  if (!name) { newCatName.focus(); return; }
  if (customCats.find(c => c.name.toLowerCase() === name.toLowerCase()) || CATEGORY_EMOJI[name]) {
    toast("⚠️ Category already exists"); return;
  }
  customCats.push({ name, emoji });
  localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(customCats));
  renderCustomChips();
  closeNewCatForm();
  setCategory(name);
  toast(`✅ "${emoji} ${name}" added`);
}

function deleteCustomCat(name) {
  customCats = customCats.filter(c => c.name !== name);
  localStorage.setItem(CUSTOM_CATS_KEY, JSON.stringify(customCats));
  if (categoryInput.value === name) setCategory("Food");
  renderCustomChips();
  toast(`🗑️ "${name}" removed`);
}

function setIncomeMode(on) {
  incomeMode = on;
  typeExpenseBtn.classList.toggle("active", !on);
  typeIncomeBtn.classList.toggle("active", on);
  categoryChips.hidden = on;
  descInput.placeholder = on ? "What was this income? (e.g. Salary)" : "What did you buy? (e.g. Coffee)";
  formTitle.textContent = on ? "Add income" : "Add an expense";
}
typeExpenseBtn.addEventListener("click", () => setIncomeMode(false));
typeIncomeBtn.addEventListener("click", () => setIncomeMode(true));

// ============ Add / Edit ============
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const desc = descInput.value.trim();
  const amount = parseFloat(amountInput.value);
  const category = incomeMode ? "Other" : categoryInput.value;
  const date = dateInput.value ? new Date(dateInput.value + "T12:00:00").getTime() : Date.now();
  if (!desc || isNaN(amount) || amount <= 0) return;

  const editingId = editIdInput.value;
  if (editingId) {
    const exp = expenses.find((x) => x.id === Number(editingId));
    if (exp) Object.assign(exp, { desc, amount, category, date });
    toast("✏️ Updated");
    exitEditMode();
  } else {
    const entry = { id: Date.now(), desc, amount, category, date };
    if (incomeMode) entry.credit = true;
    expenses.unshift(entry);
    toast(incomeMode ? "💰 Income added" : "✅ Expense added");
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
  setIncomeMode(!!exp.credit);
  editIdInput.value = id;
  descInput.value = exp.desc;
  amountInput.value = exp.amount;
  if (!exp.credit) setCategory(exp.category);
  dateInput.value = new Date(exp.date - new Date(exp.date).getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
  formTitle.textContent = exp.credit ? "Edit income" : "Edit expense";
  submitBtn.textContent = "Save changes";
  cancelEditBtn.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "center" });
  descInput.focus();
}

function exitEditMode() {
  editIdInput.value = "";
  setIncomeMode(false);
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
    .filter((e) => !e.credit && monthKey(e.date) === activeMonth)
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
[searchInput, filterCategory].forEach((el) =>
  el.addEventListener("input", renderList)
);

function getFiltered() {
  const q = searchInput.value.trim().toLowerCase();
  const cat = filterCategory.value;
  return expenses.filter((e) => {
    if (monthKey(e.date) !== activeMonth) return false;
    if (!e.credit && hiddenCategories.has(e.category)) return false;
    if (q && !e.desc.toLowerCase().includes(q)) return false;
    if (cat && e.category !== cat) return false;
    return true;
  });
}

// ============ CSV Export / Import ============
const CURRENCY_CODES = { "₹": "INR", "$": "USD", "€": "EUR", "£": "GBP", "¥": "JPY", "AED ": "AED" };

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
    rows.push([bankDateStr(e.date), e.desc, bankAmountStr(e.amount), currCode, "", e.credit ? "Credit" : "Debit", "SETTLED"]);
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
    const rawCat = cols[2] ? cols[2].trim() : "";
    const category = (CATEGORY_EMOJI[rawCat] || customCats.find(c => c.name === rawCat)) ? rawCat : "Other";
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
  [/careem pay|remit|exchange|western union|moneygram|money transfer|send.*home/i, "Remittance"],
  [/broker|invest|trading|\bstock\b|mutual fund|securities|portfolio/i, "Investment"],
  [/\bgym\b|fitness|yoga|pilates|\bbook\b|udemy|coursera|duolingo|skillshare|training|workshop|seminar|library/i, "Self Improvement"],
];

function guessCategoryFromDesc(desc) {
  for (const [pattern, cat] of BANK_CATEGORY_RULES) {
    if (pattern.test(desc)) return cat;
  }
  return "Other";
}

// Fixed AED peg rate + common currencies for future statements
const FX_TO_AED = { USD: 3.6725, EUR: 4.02, GBP: 4.68, INR: 0.044 };

function parseBankCSV(lines) {
  let added = 0;
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (cols.length < 6) continue;
    const debitCredit = cols[5].trim().toLowerCase();
    const isCredit = debitCredit === "credit";
    const dateStr = cols[0].trim();
    const desc = cols[1].trim();
    const currency = (cols[3] || "").trim().toUpperCase();
    const rawAmount = parseFloat(cols[2].replace(/,/g, ""));
    const fxRate = currency !== "AED" ? FX_TO_AED[currency] : null;
    let amount = fxRate ? rawAmount * fxRate : rawAmount;
    const date = new Date(dateStr).getTime();
    if (!desc || isNaN(amount) || amount <= 0) continue;
    const category = isCredit ? "Other" : guessCategoryFromDesc(desc);
    const entry = { id: Date.now() + i, desc, amount, category, date: isNaN(date) ? Date.now() : date };
    if (isCredit) entry.credit = true;
    if (fxRate) { entry.origAmount = rawAmount; entry.origCurrency = currency; entry.fxRate = fxRate; }
    expenses.unshift(entry);
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
  const debits = expenses.filter((e) => !e.credit && monthKey(e.date) === activeMonth);
  const total = debits.reduce((s, e) => s + e.amount, 0);
  const totalIncome = expenses.filter((e) => e.credit && monthKey(e.date) === activeMonth).reduce((s, e) => s + e.amount, 0);
  const byCategory = {};
  for (const e of debits) byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  let topCategory = null, topAmount = 0;
  for (const [c, a] of Object.entries(byCategory)) if (a > topAmount) { topAmount = a; topCategory = c; }
  return { total, totalIncome, byCategory, topCategory };
}

// ============ Month navigation ============
function renderMonthNav() {
  activeMonthLabel.textContent = monthLabel(activeMonth);
  nextMonthBtn.disabled = activeMonth >= monthKey(Date.now());
}

function shiftMonth(delta) {
  const [y, m] = activeMonth.split("-").map(Number);
  activeMonth = monthKey(new Date(y, m - 1 + delta).getTime());
  hiddenCategories.clear();
  render();
}

prevMonthBtn.addEventListener("click", () => shiftMonth(-1));
nextMonthBtn.addEventListener("click", () => shiftMonth(+1));

// ============ Rendering ============

const hiddenCategories = new Set();

function renderDonut(byCategory, total) {
  const allEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  if (total <= 0 || allEntries.length === 0) {
    donutWrap.hidden = true;
    breakdownEmptyEl.hidden = false;
    donutEl.style.background = "var(--panel-2)";
    legendEl.innerHTML = "";
    return;
  }
  donutWrap.hidden = false;
  breakdownEmptyEl.hidden = true;

  const visibleEntries = allEntries.filter(([cat]) => !hiddenCategories.has(cat));
  const visibleTotal = visibleEntries.reduce((s, [, a]) => s + a, 0);

  if (visibleTotal > 0) {
    let acc = 0;
    const segments = visibleEntries.map(([cat, amt]) => {
      const start = (acc / visibleTotal) * 360;
      acc += amt;
      const end = (acc / visibleTotal) * 360;
      return `${catColor(cat)} ${start}deg ${end}deg`;
    });
    donutEl.style.background = `conic-gradient(${segments.join(", ")})`;
    donutTotalEl.textContent = money(visibleTotal);
  } else {
    donutEl.style.background = "var(--panel-2)";
    donutTotalEl.textContent = money(0);
  }

  legendEl.innerHTML = "";
  for (const [cat, amt] of allEntries) {
    const isHidden = hiddenCategories.has(cat);
    const pct = isHidden ? null : (visibleTotal > 0 ? (amt / visibleTotal) * 100 : 0);
    const row = document.createElement("div");
    row.className = "legend-row" + (isHidden ? " legend-hidden" : "");
    row.innerHTML = `
      <span class="legend-dot" style="background:${isHidden ? "var(--muted)" : catColor(cat)}"></span>
      <span class="legend-name">${catEmoji(cat)} ${cat}</span>
      <span class="legend-val">${money(amt)}${isHidden ? "" : ` · ${pct.toFixed(0)}%`}</span>`;
    row.addEventListener("click", () => {
      if (hiddenCategories.has(cat)) hiddenCategories.delete(cat);
      else hiddenCategories.add(cat);
      const { byCategory: bc, total: t } = getStats();
      renderDonut(bc, t);
      renderSummaryCards(bc);
      renderList();
    });
    legendEl.appendChild(row);
  }
}

function renderSummaryCards(byCategory) {
  const visibleEntries = Object.entries(byCategory).filter(([cat]) => !hiddenCategories.has(cat));
  const visibleTotal = visibleEntries.reduce((s, [, a]) => s + a, 0);
  const totalIncome = expenses.filter((e) => e.credit && monthKey(e.date) === activeMonth).reduce((s, e) => s + e.amount, 0);
  const balance = totalIncome - visibleTotal;
  let topCat = null, topAmt = 0;
  for (const [c, a] of visibleEntries) if (a > topAmt) { topAmt = a; topCat = c; }
  totalSpentEl.textContent = money(visibleTotal);
  totalIncomeEl.textContent = money(totalIncome);
  totalBalanceEl.textContent = money(Math.abs(balance));
  totalBalanceEl.classList.toggle("negative", balance < 0);
  expenseCountEl.textContent = expenses.filter((e) => !e.credit && !hiddenCategories.has(e.category) && monthKey(e.date) === activeMonth).length;
  topCategoryEl.textContent = topCat ? `${catEmoji(topCat)} ${topCat}` : "—";
}

function render() {
  const { byCategory } = getStats();

  renderSummaryCards(byCategory);

  renderDonut(byCategory, Object.values(byCategory).reduce((s, a) => s + a, 0));

  renderMonthNav();
  renderBudget();
  renderList();
}

function renderList() {
  const filtered = getFiltered();
  const monthExpenses = expenses.filter((e) => monthKey(e.date) === activeMonth);
  const hasAny = monthExpenses.length > 0;
  const hasShown = filtered.length > 0;

  clearAllBtn.hidden = !expenses.length;
  emptyStateEl.hidden = hasAny;
  emptyStateEl.textContent = `No expenses for ${monthLabel(activeMonth)} yet. Add one above! 👆`;
  noMatchStateEl.hidden = !(hasAny && !hasShown);
  shownCountEl.textContent = hasAny ? `(${filtered.length}${filtered.length !== monthExpenses.length ? " of " + monthExpenses.length : ""})` : "";

  listEl.innerHTML = "";
  for (const exp of filtered) {
    const li = document.createElement("li");
    const isCredit = !!exp.credit;
    li.className = "expense" + (isCredit ? " credit-row" : "");
    const fxNote = exp.origCurrency
      ? `<div class="exp-fx">${exp.origAmount.toLocaleString("en-US", {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${exp.origCurrency} @ ${exp.fxRate}</div>`
      : "";
    li.innerHTML = `
      <span class="exp-emoji">${isCredit ? "💰" : catEmoji(exp.category)}</span>
      <div class="exp-main">
        <div class="exp-desc"></div>
        <div class="exp-meta">${isCredit ? "Income" : exp.category} · ${formatDate(exp.date)}</div>
        ${fxNote}
      </div>
      <span class="exp-amount">${isCredit ? "+" : ""}${money(exp.amount)}</span>
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
  renderCustomChips();
  setCategory("Food");
  render();
}
init();
