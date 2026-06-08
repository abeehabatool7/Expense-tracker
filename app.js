'use strict';

const STORAGE_KEY = 'ledger_expenses';

const CATEGORY_COLORS = {
  'Food & Dining':  '#e87722',
  'Transport':      '#0891b2',
  'Utilities':      '#7c3aed',
  'Shopping':       '#db2777',
  'Entertainment':  '#0f766e',
  'Health':         '#15803d',
  'Education':      '#1d4ed8',
  'Travel':         '#0369a1',
  'Other':          '#64748b',
};

const CATEGORY_EMOJIS = {
  'Food & Dining':  '🍽️',
  'Transport':      '🚗',
  'Utilities':      '⚡',
  'Shopping':       '🛍️',
  'Entertainment':  '🎬',
  'Health':         '💊',
  'Education':      '📚',
  'Travel':         '✈️',
  'Other':          '📦',
};

let expenses = [];
let pendingDeleteId = null;
let chartInstances = {};

function load() {
  try {
    expenses = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch { expenses = []; }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function navigate(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const view = document.getElementById(`view-${viewId}`);
  if (view) view.classList.add('active');

  document.querySelectorAll(`[data-view="${viewId}"]`).forEach(btn => {
    if (btn.classList.contains('nav-btn')) btn.classList.add('active');
  });

  
  if (viewId === 'dashboard') renderDashboard();
  if (viewId === 'expenses')  renderExpenses();
  if (viewId === 'analytics') renderAnalytics();
  if (viewId === 'add')       prepareAddForm();
}

function fmt(amount) {
  return 'Rs ' + Number(amount).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function sortedExpenses() {
  return [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function renderDashboard() {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const now = new Date();
  const monthExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const avg = expenses.length ? total / expenses.length : 0;

  document.getElementById('stat-total').textContent = fmt(total);
  document.getElementById('stat-month').textContent = fmt(monthTotal);
  document.getElementById('stat-count').textContent = expenses.length;
  document.getElementById('stat-avg').textContent = fmt(avg);
  document.getElementById('sidebar-total').textContent = fmt(total);

  const dateEl = document.getElementById('header-date');
  dateEl.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  
  const recent = sortedExpenses().slice(0, 5);
  const container = document.getElementById('recent-list');
  if (!recent.length) {
    container.innerHTML = '<div class="empty-state small">No expenses yet. Add one to get started.</div>';
  } else {
    container.innerHTML = recent.map(e => `
      <div class="recent-item">
        <div class="recent-dot" style="background:${CATEGORY_COLORS[e.category] || '#8d8da0'}"></div>
        <div class="recent-info">
          <div class="recent-title">${escHtml(e.title)}</div>
          <div class="recent-meta">${escHtml(e.category)} · ${fmtDate(e.date)}</div>
        </div>
        <div class="recent-amount">${fmt(e.amount)}</div>
      </div>
    `).join('');
  }

  renderDashPie();
}

function renderDashPie() {
  const ctx = document.getElementById('dash-pie');
  const emptyEl = document.getElementById('pie-empty');
  const byCategory = groupByCategory();
  const cats = Object.keys(byCategory);

  if (chartInstances['dash-pie']) {
    chartInstances['dash-pie'].destroy();
    delete chartInstances['dash-pie'];
  }

  if (!cats.length) {
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');

  chartInstances['dash-pie'] = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: cats,
      datasets: [{
        data: cats.map(c => byCategory[c]),
        backgroundColor: cats.map(c => CATEGORY_COLORS[c] || '#8d8da0'),
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 8,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)}`,
          },
          backgroundColor: '#1a1a2a',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#f0ede8',
          bodyColor: '#9896a8',
          padding: 10,
        }
      }
    }
  });
}

function getFilteredExpenses() {
  const cat   = document.getElementById('filter-category').value;
  const from  = document.getElementById('filter-from').value;
  const to    = document.getElementById('filter-to').value;

  return sortedExpenses().filter(e => {
    if (cat && e.category !== cat) return false;
    if (from && e.date < from)     return false;
    if (to && e.date > to)         return false;
    return true;
  });
}

function renderExpenses() {
  const list = getFilteredExpenses();
  const tbody = document.getElementById('expense-tbody');
  const tableEmpty = document.getElementById('table-empty');
  const countLabel = document.getElementById('expenses-count-label');

  countLabel.textContent = `${list.length} ${list.length === 1 ? 'entry' : 'entries'}`;

  if (!list.length) {
    tbody.innerHTML = '';
    tableEmpty.classList.add('visible');
    return;
  }
  tableEmpty.classList.remove('visible');

  tbody.innerHTML = list.map(e => `
    <tr data-id="${e.id}">
      <td>
        <div style="font-weight:500">${escHtml(e.title)}</div>
      </td>
      <td>
        <span class="cat-badge">
          <span>${CATEGORY_EMOJIS[e.category] || '📦'}</span>
          ${escHtml(e.category)}
        </span>
      </td>
      <td style="color:var(--text-2);font-size:0.82rem">${fmtDate(e.date)}</td>
      <td class="notes-cell" title="${escHtml(e.notes || '')}">${escHtml(e.notes || '—')}</td>
      <td class="text-right">
        <span class="amount-cell">${fmt(e.amount)}</span>
      </td>
      <td class="text-center">
        <div class="action-btns">
          <button class="icon-btn edit" onclick="startEdit('${e.id}')" title="Edit">
            <svg viewBox="0 0 20 20" fill="none"><path d="M14.85 2.85a2.01 2.01 0 012.83 2.83l-9.5 9.5-3.5.67.67-3.5 9.5-9.5z" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <button class="icon-btn delete" onclick="confirmDelete('${e.id}')" title="Delete">
            <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function groupByCategory() {
  const map = {};
  expenses.forEach(e => {
    map[e.category] = (map[e.category] || 0) + e.amount;
  });
  return map;
}

function renderAnalytics() {
  const byCategory = groupByCategory();
  const cats = Object.keys(byCategory).sort((a, b) => byCategory[b] - byCategory[a]);
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  
  ['analytics-bar', 'analytics-doughnut', 'analytics-line'].forEach(id => {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  });

  
  const barCtx = document.getElementById('analytics-bar');
  const barEmpty = document.getElementById('bar-empty');
  if (!cats.length) {
    barEmpty.classList.remove('hidden');
  } else {
    barEmpty.classList.add('hidden');
    chartInstances['analytics-bar'] = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: cats.map(c => CATEGORY_EMOJIS[c] + ' ' + c),
        datasets: [{
          data: cats.map(c => byCategory[c]),
          backgroundColor: cats.map(c => CATEGORY_COLORS[c] + 'cc'),
          borderColor: cats.map(c => CATEGORY_COLORS[c]),
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: tooltipDefaults(),
        },
        scales: {
          x: { grid: { color: 'rgba(15,31,61,0.06)' }, ticks: { color: '#8a97ae', font: { size: 11 } } },
          y: { grid: { color: 'rgba(15,31,61,0.06)' }, ticks: { color: '#8a97ae', callback: v => 'Rs ' + v } },
        }
      }
    });
  }

  
  const doCtx = document.getElementById('analytics-doughnut');
  const doEmpty = document.getElementById('doughnut-empty');
  const legend = document.getElementById('analytics-legend');
  if (!cats.length) {
    doEmpty.classList.remove('hidden');
    legend.innerHTML = '';
  } else {
    doEmpty.classList.add('hidden');
    chartInstances['analytics-doughnut'] = new Chart(doCtx, {
      type: 'doughnut',
      data: {
        labels: cats,
        datasets: [{
          data: cats.map(c => byCategory[c]),
          backgroundColor: cats.map(c => CATEGORY_COLORS[c] + 'cc'),
          borderColor: cats.map(c => CATEGORY_COLORS[c]),
          borderWidth: 2,
          hoverOffset: 8,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: tooltipDefaults(),
        }
      }
    });

    legend.innerHTML = cats.map(c => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${CATEGORY_COLORS[c]}"></div>
        <span>${c}</span>
      </div>
    `).join('');
  }

  
  const lineCtx = document.getElementById('analytics-line');
  const lineEmpty = document.getElementById('line-empty');
  const monthlyData = buildMonthlyData();
  if (monthlyData.labels.length < 2) {
    lineEmpty.classList.remove('hidden');
  } else {
    lineEmpty.classList.add('hidden');
    chartInstances['analytics-line'] = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: monthlyData.labels,
        datasets: [{
          label: 'Monthly Spending',
          data: monthlyData.values,
          borderColor: '#1a6cff',
          backgroundColor: 'rgba(26,108,255,0.07)',
          borderWidth: 2.5,
          pointBackgroundColor: '#1a6cff',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.35,
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: tooltipDefaults(),
        },
        scales: {
          x: { grid: { color: 'rgba(15,31,61,0.06)' }, ticks: { color: '#8a97ae' } },
          y: { grid: { color: 'rgba(15,31,61,0.06)' }, ticks: { color: '#8a97ae', callback: v => 'Rs ' + v } },
        }
      }
    });
  }

  
  const breakdownList = document.getElementById('breakdown-list');
  if (!cats.length) {
    breakdownList.innerHTML = '<div class="empty-state small">No expenses yet</div>';
  } else {
    const max = byCategory[cats[0]];
    breakdownList.innerHTML = cats.map(c => `
      <div class="breakdown-item">
        <div class="breakdown-row">
          <span class="breakdown-name">${CATEGORY_EMOJIS[c]} ${c}</span>
          <span class="breakdown-amt">${fmt(byCategory[c])}</span>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill" style="width:${(byCategory[c]/max*100).toFixed(1)}%;background:${CATEGORY_COLORS[c]}"></div>
        </div>
      </div>
    `).join('');
  }
}

function buildMonthlyData() {
  if (!expenses.length) return { labels: [], values: [] };
  const map = {};
  expenses.forEach(e => {
    const d = new Date(e.date + 'T00:00:00');
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    map[key] = (map[key] || 0) + e.amount;
  });
  const sorted = Object.keys(map).sort();
  return {
    labels: sorted.map(k => {
      const [y, m] = k.split('-');
      return new Date(+y, +m-1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
    }),
    values: sorted.map(k => map[k]),
  };
}

function tooltipDefaults() {
  return {
    callbacks: { label: ctx => ` ${fmt(ctx.raw)}` },
    backgroundColor: '#0f1f3d',
    borderColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    titleColor: '#ffffff',
    bodyColor: 'rgba(255,255,255,0.65)',
    padding: 10,
    cornerRadius: 7,
  };
}

function prepareAddForm() {
  document.getElementById('form-title').textContent = 'Add Expense';
  document.getElementById('form-submit').textContent = 'Save Expense';
  document.getElementById('edit-id').value = '';
  document.getElementById('expense-form').reset();
  document.getElementById('input-date').value = today();
  clearFormErrors();
  updatePreview('');
  document.getElementById('char-count').textContent = '0/200';
}

function startEdit(id) {
  const expense = expenses.find(e => e.id === id);
  if (!expense) return;

  navigate('add');

  setTimeout(() => {
    document.getElementById('form-title').textContent = 'Edit Expense';
    document.getElementById('form-submit').textContent = 'Update Expense';
    document.getElementById('edit-id').value = id;

    document.getElementById('input-title').value    = expense.title;
    document.getElementById('input-amount').value   = expense.amount;
    document.getElementById('input-date').value     = expense.date;
    document.getElementById('input-category').value = expense.category;
    document.getElementById('input-notes').value    = expense.notes || '';

    clearFormErrors();
    updatePreview(expense.category);
    document.getElementById('char-count').textContent = `${(expense.notes || '').length}/200`;
  }, 50);
}

function clearFormErrors() {
  ['title', 'amount', 'date', 'category'].forEach(f => {
    const err = document.getElementById(`err-${f}`);
    const inp = document.getElementById(`input-${f}`);
    if (err) err.textContent = '';
    if (inp) inp.classList.remove('error');
  });
}

function validateForm() {
  let valid = true;
  const title    = document.getElementById('input-title').value.trim();
  const amount   = parseFloat(document.getElementById('input-amount').value);
  const date     = document.getElementById('input-date').value;
  const category = document.getElementById('input-category').value;

  clearFormErrors();

  if (!title) {
    setError('title', 'Title is required');
    valid = false;
  }
  if (!document.getElementById('input-amount').value || isNaN(amount) || amount <= 0) {
    setError('amount', 'Please enter a valid amount greater than 0');
    valid = false;
  }
  if (!date) {
    setError('date', 'Date is required');
    valid = false;
  }
  if (!category) {
    setError('category', 'Please select a category');
    valid = false;
  }

  return valid;
}

function setError(field, msg) {
  document.getElementById(`err-${field}`).textContent = msg;
  document.getElementById(`input-${field}`).classList.add('error');
}

function handleFormSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const id       = document.getElementById('edit-id').value;
  const title    = document.getElementById('input-title').value.trim();
  const amount   = parseFloat(parseFloat(document.getElementById('input-amount').value).toFixed(2));
  const date     = document.getElementById('input-date').value;
  const category = document.getElementById('input-category').value;
  const notes    = document.getElementById('input-notes').value.trim();

  if (id) {
    
    const idx = expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      expenses[idx] = { ...expenses[idx], title, amount, date, category, notes };
      showToast('Expense updated successfully', 'success');
    }
  } else {
    
    expenses.push({
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
      title, amount, date, category, notes,
      createdAt: new Date().toISOString(),
    });
    showToast('Expense added successfully', 'success');
  }

  save();
  document.getElementById('sidebar-total').textContent = fmt(expenses.reduce((s, e) => s + e.amount, 0));
  navigate('expenses');
}

function confirmDelete(id) {
  pendingDeleteId = id;
  document.getElementById('modal-backdrop').classList.add('open');
}

function executeDelete() {
  if (!pendingDeleteId) return;
  expenses = expenses.filter(e => e.id !== pendingDeleteId);
  save();
  pendingDeleteId = null;
  closeModal();
  renderExpenses();
  document.getElementById('sidebar-total').textContent = fmt(expenses.reduce((s, e) => s + e.amount, 0));
  showToast('Expense deleted', 'success');
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  pendingDeleteId = null;
}

let toastTimer;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

function updatePreview(cat) {
  const badge = document.getElementById('preview-badge');
  if (cat && CATEGORY_EMOJIS[cat]) {
    badge.textContent = CATEGORY_EMOJIS[cat] + ' ' + cat;
    badge.style.color = CATEGORY_COLORS[cat] || 'var(--text-2)';
  } else {
    badge.textContent = '—';
    badge.style.color = 'var(--text-2)';
  }
}

function toggleMobileMenu() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.getElementById('mobileOverlay');
  const hamburger = document.getElementById('hamburger');
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
  hamburger.classList.toggle('open');
}

function closeMobileMenu() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('mobileOverlay').classList.remove('active');
  document.getElementById('hamburger').classList.remove('open');
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── INIT ───────────────────────────────────────────────────
function init() {
  load();

  // Navigation
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', function() {
      const view = this.getAttribute('data-view');
      navigate(view);
      closeMobileMenu();
    });
  });

  // Form
  document.getElementById('expense-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('form-cancel').addEventListener('click', () => navigate('expenses'));

  // Category preview
  document.getElementById('input-category').addEventListener('change', function() {
    updatePreview(this.value);
  });

  // Notes char count
  document.getElementById('input-notes').addEventListener('input', function() {
    document.getElementById('char-count').textContent = `${this.value.length}/200`;
  });

  // Remove error on input
  ['input-title', 'input-amount', 'input-date', 'input-category'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
      this.classList.remove('error');
      const field = id.replace('input-', '');
      const err = document.getElementById(`err-${field}`);
      if (err) err.textContent = '';
    });
  });

  // Filters
  ['filter-category', 'filter-from', 'filter-to'].forEach(id => {
    document.getElementById(id).addEventListener('change', renderExpenses);
  });
  document.getElementById('clear-filters').addEventListener('click', () => {
    document.getElementById('filter-category').value = '';
    document.getElementById('filter-from').value = '';
    document.getElementById('filter-to').value = '';
    renderExpenses();
  });

  // Modal
  document.getElementById('modal-confirm').addEventListener('click', executeDelete);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-backdrop').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // Mobile
  document.getElementById('hamburger').addEventListener('click', toggleMobileMenu);
  document.getElementById('mobileOverlay').addEventListener('click', closeMobileMenu);

  // Start on dashboard
  navigate('dashboard');
}

document.addEventListener('DOMContentLoaded', init);

// Expose globals needed by inline handlers
window.startEdit = startEdit;
window.confirmDelete = confirmDelete;
