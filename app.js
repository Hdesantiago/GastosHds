const DB_NAME = 'GastosQuincenaDB';
const DB_VERSION = 1;
let db;
let selectedQuincenaId = null;
let selectedConceptId = null;
let selectedDebtId = null;
let editingQuincenaId = null;
let installPromptEvent = null;

const elements = {
  quincenaSelect: document.getElementById('quincena-select'),
  incomeDisplay: document.getElementById('income-display'),
  totalBudget: document.getElementById('total-budget'),
  totalSpent: document.getElementById('total-spent'),
  totalRemaining: document.getElementById('total-remaining'),
  totalSaved: document.getElementById('total-saved'),
  conceptsTableBody: document.querySelector('#concepts-table tbody'),
  btnAddQuincena: document.getElementById('btn-add-quincena'),
  btnInstall: document.getElementById('btn-install'),
  btnAddConcept: document.getElementById('btn-add-concept'),
  btnEditConcept: document.getElementById('btn-edit-concept'),
  btnDeleteConcept: document.getElementById('btn-delete-concept'),
  modalOverlay: document.getElementById('modal-overlay'),
  modalQuincena: document.getElementById('modal-quincena'),
  formQuincena: document.getElementById('form-quincena'),
  quincenaYear: document.getElementById('quincena-year'),
  quincenaMonth: document.getElementById('quincena-month'),
  quincenaPeriod: document.getElementById('quincena-period'),
  quincenaIncome: document.getElementById('quincena-income'),
  btnEditIncome: document.getElementById('btn-edit-income'),
  modalConcept: document.getElementById('modal-concept'),
  formConcept: document.getElementById('form-concept'),
  conceptName: document.getElementById('concept-name'),
  conceptType: document.getElementById('concept-type'),
  conceptBudget: document.getElementById('concept-budget'),
  conceptModalTitle: document.getElementById('concept-modal-title'),
  modalDetail: document.getElementById('modal-detail'),
  detailTitle: document.getElementById('detail-title'),
  detailSubtitle: document.getElementById('detail-subtitle'),
  detailBudget: document.getElementById('detail-budget'),
  detailSpent: document.getElementById('detail-spent'),
  detailRemaining: document.getElementById('detail-remaining'),
  detailSaved: document.getElementById('detail-saved'),
  formTransaction: document.getElementById('form-transaction'),
  transactionNote: document.getElementById('transaction-note'),
  transactionAmount: document.getElementById('transaction-amount'),
  movementList: document.getElementById('movement-list')
};

elements.tabButtons = document.querySelectorAll('.tab-button');
elements.tabResumen = document.getElementById('tab-resumen');
elements.tabDeudas = document.getElementById('tab-deudas');
elements.btnAddDebt = document.getElementById('btn-add-debt');
elements.debtsTableBody = document.querySelector('#debts-table tbody');
elements.modalDebt = document.getElementById('modal-debt');
elements.formDebt = document.getElementById('form-debt');
elements.debtName = document.getElementById('debt-name');
elements.debtAmount = document.getElementById('debt-amount');
elements.totalDebts = document.getElementById('total-debts');

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      if (!database.objectStoreNames.contains('quincenas')) {
        const store = database.createObjectStore('quincenas', { keyPath: 'id', autoIncrement: true });
        store.createIndex('period', 'period', { unique: false });
      }
      if (!database.objectStoreNames.contains('conceptos')) {
        const store = database.createObjectStore('conceptos', { keyPath: 'id', autoIncrement: true });
        store.createIndex('quincenaId', 'quincenaId', { unique: false });
      }
      if (!database.objectStoreNames.contains('movimientos')) {
        const store = database.createObjectStore('movimientos', { keyPath: 'id', autoIncrement: true });
        store.createIndex('conceptoId', 'conceptoId', { unique: false });
      }
      if (!database.objectStoreNames.contains('deudas')) {
        const store = database.createObjectStore('deudas', { keyPath: 'id', autoIncrement: true });
        store.createIndex('name', 'name', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      db = event.target.result;
      resolve();
    };

    request.onerror = () => reject(request.error);
  });
}

function tx(storeNames, mode = 'readonly') {
  return db.transaction(storeNames, mode);
}

function getObjectStore(storeName, mode = 'readonly') {
  return tx([storeName], mode).objectStore(storeName);
}

function getAll(storeName, indexName, query) {
  return new Promise((resolve, reject) => {
    const store = getObjectStore(storeName);
    const request = indexName ? store.index(indexName).getAll(query) : store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getById(storeName, id) {
  return new Promise((resolve, reject) => {
    const request = getObjectStore(storeName).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = getObjectStore(storeName, 'readwrite').put(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function add(storeName, value) {
  return new Promise((resolve, reject) => {
    const request = getObjectStore(storeName, 'readwrite').add(value);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 2 }).format(value);
}

function getCurrentQuincena() {
  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    period: now.getDate() <= 15 ? 1 : 2
  };
}

async function init() {
  await openDb();
  await ensureDefaultQuincena();
  bindEvents();
  registerServiceWorker();
  await renderQuincenas();
}

function hideInstallButton() {
  if (elements.btnInstall) {
    elements.btnInstall.classList.add('hidden');
  }
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch((error) => {
      console.error('Service Worker registration failed:', error);
    });
  }
}

async function ensureDefaultQuincena() {
  const allQuincenas = await getAll('quincenas');
  if (allQuincenas.length === 0) {
    const current = getCurrentQuincena();
    await add('quincenas', {
      year: current.year,
      month: current.month,
      period: current.period,
      income: 0,
      createdAt: new Date().toISOString()
    });
  }
}

function buildQuincenaLabel(item) {
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${monthNames[item.month - 1]} ${item.year} · Quincena ${item.period}`;
}

async function renderQuincenas() {
  const quincenas = await getAll('quincenas');
  const sorted = quincenas.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    if (a.month !== b.month) return b.month - a.month;
    return b.period - a.period;
  });

  elements.quincenaSelect.innerHTML = '';
  sorted.forEach((item) => {
    const option = document.createElement('option');
    option.value = item.id;
    option.textContent = buildQuincenaLabel(item);
    elements.quincenaSelect.appendChild(option);
  });

  if (!selectedQuincenaId) {
    selectedQuincenaId = sorted[0]?.id;
  }

  elements.quincenaSelect.value = selectedQuincenaId;
  await renderCurrentQuincena();
}

async function renderCurrentQuincena() {
  if (!selectedQuincenaId) return;
  const quincena = await getById('quincenas', Number(selectedQuincenaId));
  if (!quincena) return;
  elements.incomeDisplay.value = formatCurrency(quincena.income || 0);
  await renderConcepts();
}

async function renderConcepts() {
  const conceptos = await getAll('conceptos', 'quincenaId', Number(selectedQuincenaId));
  const movements = await getAll('movimientos');
  let totalBudget = 0;
  let totalSpent = 0;
  let totalRemaining = 0;
  let totalSaved = 0;

  elements.conceptsTableBody.innerHTML = '';

  conceptos.forEach((concepto) => {
    const conceptMovements = movements.filter((mov) => mov.conceptoId === concepto.id);
    const spent = conceptMovements.reduce((sum, mov) => sum + Number(mov.amount), 0);
    const remaining = Math.max(0, Number(concepto.budget) - spent);
    const saved = concepto.type === 'ahorro' ? remaining : 0;

    totalBudget += Number(concepto.budget);
    totalSpent += spent;
    totalRemaining += remaining;
    totalSaved += saved;

    const row = document.createElement('tr');
    row.dataset.conceptId = concepto.id;
    row.innerHTML = `
      <td>${concepto.name}</td>
      <td>${concepto.type === 'ahorro' ? 'Ahorro' : 'Gasto'}</td>
      <td>${formatCurrency(concepto.budget)}</td>
      <td>${formatCurrency(spent)}</td>
      <td>${formatCurrency(remaining)}</td>
      <td>${formatCurrency(saved)}</td>
    `;

    row.addEventListener('click', () => openConceptDetail(concepto.id));
    elements.conceptsTableBody.appendChild(row);
  });

  elements.totalBudget.textContent = formatCurrency(totalBudget);
  elements.totalSpent.textContent = formatCurrency(totalSpent);
  elements.totalRemaining.textContent = formatCurrency(totalRemaining);
  elements.totalSaved.textContent = formatCurrency(totalSaved);
}

function bindEvents() {
  elements.btnAddQuincena.addEventListener('click', () => openQuincenaForm());
  elements.btnAddConcept.addEventListener('click', () => openConceptForm());
  elements.btnEditConcept.addEventListener('click', async () => {
    const conceptId = selectedConceptId;
    if (!conceptId) return;

    elements.modalDetail.classList.add('hidden');
    elements.modalOverlay.classList.add('hidden');
    await openConceptForm(conceptId);
  });
  elements.btnDeleteConcept.addEventListener('click', async () => {
    await deleteConcept();
  });
  elements.quincenaSelect.addEventListener('change', async (event) => {
    selectedQuincenaId = event.target.value;
    await renderCurrentQuincena();
  });

  if (elements.btnInstall) {
    elements.btnInstall.addEventListener('click', async () => {
      if (!installPromptEvent) return;
      installPromptEvent.prompt();
      const result = await installPromptEvent.userChoice;
      if (result.outcome === 'accepted') {
        hideInstallButton();
      }
      installPromptEvent = null;
    });
  }

  document.querySelectorAll('[data-close="true"]').forEach((button) => {
    button.addEventListener('click', closeModals);
  });

  elements.modalOverlay.addEventListener('click', closeModals);

  elements.formQuincena.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveQuincena();
  });

  elements.formConcept.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveConcept();
  });

  elements.formTransaction.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveTransaction();
  });

  // Tabs
  elements.tabButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const tab = e.currentTarget.dataset.tab;
      showTab(tab);
    });
  });

  // Quincena edit button
  if (elements.btnEditIncome) {
    elements.btnEditIncome.addEventListener('click', async () => {
      if (!selectedQuincenaId) return;
      await openQuincenaForm(Number(selectedQuincenaId));
    });
  }
  // Deudas
  if (elements.btnAddDebt) {
    elements.btnAddDebt.addEventListener('click', () => openDebtForm());
  }
  if (elements.formDebt) {
    elements.formDebt.addEventListener('submit', async (event) => {
      event.preventDefault();
      await saveDebt();
    });
  }
}

function openModal(modal) {
  modal.classList.remove('hidden');
  elements.modalOverlay.classList.remove('hidden');
}

function closeModals() {
  document.querySelectorAll('.modal').forEach((modal) => modal.classList.add('hidden'));
  elements.modalOverlay.classList.add('hidden');
  selectedConceptId = null;
  editingQuincenaId = null;
}

async function saveQuincena() {
  const year = Number(elements.quincenaYear.value);
  const month = Number(elements.quincenaMonth.value);
  const period = Number(elements.quincenaPeriod.value);
  const income = Number(elements.quincenaIncome.value);

  if (!year || !month || !period) return;

  if (editingQuincenaId) {
    const existing = await getById('quincenas', Number(editingQuincenaId));
    if (!existing) return;
    await put('quincenas', {
      ...existing,
      year,
      month,
      period,
      income,
      updatedAt: new Date().toISOString()
    });
  } else {
    await add('quincenas', { year, month, period, income, createdAt: new Date().toISOString() });
  }
  closeModals();
  await renderQuincenas();
}

async function openQuincenaForm(quincenaId = null) {
  if (quincenaId) {
    const q = await getById('quincenas', Number(quincenaId));
    if (!q) return;
    elements.quincenaYear.value = q.year;
    elements.quincenaMonth.value = q.month;
    elements.quincenaPeriod.value = q.period;
    elements.quincenaIncome.value = q.income ?? 0;
    editingQuincenaId = Number(quincenaId);
  } else {
    const current = getCurrentQuincena();
    elements.quincenaYear.value = current.year;
    elements.quincenaMonth.value = current.month;
    elements.quincenaPeriod.value = current.period;
    elements.quincenaIncome.value = 0;
    editingQuincenaId = null;
  }

  openModal(elements.modalQuincena);
}

async function openConceptForm(conceptId = null) {
  if (conceptId) {
    const concepto = await getById('conceptos', Number(conceptId));
    if (!concepto) return;

    elements.conceptModalTitle.textContent = 'Editar concepto';
    elements.conceptName.value = concepto.name;
    elements.conceptType.value = concepto.type || 'gasto';
    elements.conceptBudget.value = concepto.budget ?? '0';
    selectedConceptId = Number(conceptId);
  } else {
    elements.conceptModalTitle.textContent = 'Agregar concepto';
    elements.conceptName.value = '';
    elements.conceptType.value = 'gasto';
    elements.conceptBudget.value = '0';
    selectedConceptId = null;
  }

  openModal(elements.modalConcept);
}

async function saveConcept() {
  const name = elements.conceptName.value.trim();
  const type = elements.conceptType.value;
  const budget = Number(elements.conceptBudget.value);
  const editingConceptId = selectedConceptId;

  if (!name || isNaN(budget)) return;

  if (editingConceptId) {
    const existing = await getById('conceptos', editingConceptId);
    if (!existing) return;

    await put('conceptos', {
      ...existing,
      name,
      type,
      budget,
      updatedAt: new Date().toISOString()
    });
  } else {
    await add('conceptos', {
      quincenaId: Number(selectedQuincenaId),
      name,
      type,
      budget,
      createdAt: new Date().toISOString()
    });
  }

  const conceptToOpen = editingConceptId;
  closeModals();
  await renderConcepts();

  if (conceptToOpen) {
    await openConceptDetail(conceptToOpen);
  }
}

async function openConceptDetail(conceptId) {
  selectedConceptId = Number(conceptId);
  const concepto = await getById('conceptos', selectedConceptId);
  if (!concepto) return;

  const movements = await getAll('movimientos', 'conceptoId', selectedConceptId);
  const spent = movements.reduce((sum, mov) => sum + Number(mov.amount), 0);
  const remaining = Math.max(0, Number(concepto.budget) - spent);
  const saved = concepto.type === 'ahorro' ? remaining : 0;

  elements.detailTitle.textContent = concepto.name;
  elements.detailSubtitle.textContent = `Tipo: ${concepto.type === 'ahorro' ? 'Ahorro' : 'Gasto'}`;
  elements.detailBudget.textContent = formatCurrency(concepto.budget);
  elements.detailSpent.textContent = formatCurrency(spent);
  elements.detailRemaining.textContent = formatCurrency(remaining);
  elements.detailSaved.textContent = formatCurrency(saved);
  elements.transactionNote.value = '';
  elements.transactionAmount.value = '0';
  elements.movementList.innerHTML = '';

  if (movements.length === 0) {
    elements.movementList.innerHTML = '<li>No hay movimientos aún.</li>';
  } else {
    movements
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((mov) => {
        const item = document.createElement('li');
        item.innerHTML = `
          <strong>${mov.note}</strong>
          <div>${formatCurrency(mov.amount)} · ${new Date(mov.date).toLocaleDateString('es-MX')}</div>
        `;
        elements.movementList.appendChild(item);
      });
  }

  openModal(elements.modalDetail);
}

async function deleteConcept() {
  if (!selectedConceptId) return;

  const confirmed = window.confirm('¿Deseas eliminar este concepto y todos sus movimientos?');
  if (!confirmed) return;

  const concepto = await getById('conceptos', selectedConceptId);
  if (!concepto) return;

  const movements = await getAll('movimientos', 'conceptoId', selectedConceptId);
  const transaction = db.transaction(['conceptos', 'movimientos'], 'readwrite');
  const conceptosStore = transaction.objectStore('conceptos');
  const movimientosStore = transaction.objectStore('movimientos');

  conceptosStore.delete(selectedConceptId);
  movements.forEach((movement) => movimientosStore.delete(movement.id));

  await new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  selectedConceptId = null;
  closeModals();
  await renderConcepts();
}

async function saveTransaction() {
  if (!selectedConceptId) return;
  const note = elements.transactionNote.value.trim();
  const amount = Number(elements.transactionAmount.value);

  if (!note || !amount || amount <= 0) return;

  await add('movimientos', {
    conceptoId: selectedConceptId,
    note,
    amount,
    date: new Date().toISOString()
  });

  await renderConcepts();
  await openConceptDetail(selectedConceptId);
}

// --- Tabs and Deudas functions ---
function showTab(tab) {
  elements.tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  if (tab === 'deudas') {
    elements.tabResumen.classList.add('hidden');
    elements.tabDeudas.classList.remove('hidden');
    renderDebts();
  } else {
    elements.tabDeudas.classList.add('hidden');
    elements.tabResumen.classList.remove('hidden');
    renderConcepts();
  }
}

async function renderDebts() {
  const debts = await getAll('deudas');
  elements.debtsTableBody.innerHTML = '';
  
  let totalDebts = 0;

  debts.forEach((debt) => {
    const debtAmount = Number(debt.amount) || 0;
    totalDebts += debtAmount;
    
    const row = document.createElement('tr');
    row.dataset.debtId = debt.id;
    row.innerHTML = `
      <td>${debt.name}</td>
      <td>${formatCurrency(debtAmount)}</td>
      <td>
        <button class="btn-secondary btn-edit-debt" data-id="${debt.id}">Editar</button>
        <button class="btn-danger btn-delete-debt" data-id="${debt.id}">Eliminar</button>
      </td>
    `;

    elements.debtsTableBody.appendChild(row);
  });

  // Update total debts display
  elements.totalDebts.textContent = formatCurrency(totalDebts);

  // attach handlers
  elements.debtsTableBody.querySelectorAll('.btn-edit-debt').forEach((b) => {
    b.addEventListener('click', (e) => openDebtForm(Number(e.currentTarget.dataset.id)));
  });
  elements.debtsTableBody.querySelectorAll('.btn-delete-debt').forEach((b) => {
    b.addEventListener('click', (e) => deleteDebt(Number(e.currentTarget.dataset.id)));
  });
}

async function openDebtForm(debtId = null) {
  if (debtId) {
    const debt = await getById('deudas', Number(debtId));
    if (!debt) return;
    elements.debtName.value = debt.name;
    elements.debtAmount.value = debt.amount ?? '0';
    selectedDebtId = Number(debtId);
    document.getElementById('debt-modal-title').textContent = 'Editar deuda';
  } else {
    elements.debtName.value = '';
    elements.debtAmount.value = '0';
    selectedDebtId = null;
    document.getElementById('debt-modal-title').textContent = 'Agregar deuda';
  }

  openModal(elements.modalDebt);
}

async function saveDebt() {
  const name = elements.debtName.value.trim();
  const amount = Number(elements.debtAmount.value);

  if (!name || isNaN(amount)) return;

  if (selectedDebtId) {
    const existing = await getById('deudas', selectedDebtId);
    if (!existing) return;
    await put('deudas', {
      ...existing,
      name,
      amount,
      updatedAt: new Date().toISOString()
    });
  } else {
    await add('deudas', { name, amount, createdAt: new Date().toISOString() });
  }

  closeModals();
  await renderDebts();
}

async function deleteDebt(id) {
  const confirmed = window.confirm('¿Deseas eliminar esta deuda?');
  if (!confirmed) return;

  const txReq = db.transaction(['deudas'], 'readwrite');
  const store = txReq.objectStore('deudas');
  store.delete(id);

  await new Promise((resolve, reject) => {
    txReq.oncomplete = () => resolve();
    txReq.onerror = () => reject(txReq.error);
  });

  await renderDebts();
}

window.addEventListener('DOMContentLoaded', init);

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  installPromptEvent = event;
  if (elements.btnInstall) {
    elements.btnInstall.classList.remove('hidden');
  }
});
