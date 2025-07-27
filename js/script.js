            // DOM Elements
const loginContainer = document.getElementById('login-container');
const dashboardContainer = document.getElementById('dashboard-container');
const loginForm = document.getElementById('login-form');

const initialBalanceEl = document.getElementById('initial-balance');
const currentBalanceEl = document.getElementById('current-balance');
const pnlValueEl = document.getElementById('pnl-value');
const aiStatusEl = document.getElementById('ai-status');
const livePriceEl = document.getElementById('live-price');
const livePriceLabel = document.getElementById('live-price-label');
const profitWalletEl = document.getElementById('profit-wallet');
const precisionMetricEl = document.getElementById('precision-metric');
const adaptabilityMetricEl = document.getElementById('adaptability-metric');

const startBtn = document.getElementById('start-ai-btn');
const stopBtn = document.getElementById('stop-ai-btn');
const resetBtn = document.getElementById('reset-sim-btn');
const depositBtn = document.getElementById('deposit-btn');
const withdrawBtn = document.getElementById('withdraw-btn');
const tradeAmountInput = document.getElementById('trade-amount-input');
const leverageSlider = document.getElementById('leverage-slider');
const leverageValueEl = document.getElementById('leverage-value');
const opLevelSelect = document.getElementById('op-level-select');

const profitTargetInput = document.getElementById('profit-target-input');
const withdrawPercentInput = document.getElementById('withdraw-percent-input');
const autofixProfitCheckbox = document.getElementById('autofix-profit-checkbox');

const totalTradesCounterEl = document.getElementById('total-trades-counter');
const profitCounterEl = document.getElementById('profit-counter');
const lossCounterEl = document.getElementById('loss-counter');
const systemCounterEl = document.getElementById('system-counter');
const fixationCounterEl = document.getElementById('fixation-counter');

const tradeLogEl = document.getElementById('trade-log');
const chartCanvas = document.getElementById('balance-chart');

const modalOverlay = document.getElementById('modal-overlay');
const modalForm = document.getElementById('modal-form');
const modalTitle = document.getElementById('modal-title');
const modalAmountInput = document.getElementById('modal-amount');
const modalSubmitBtn = document.getElementById('modal-submit-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalError = document.getElementById('modal-error');

const reportModal = document.getElementById('report-modal');
const showReportBtn = document.getElementById('show-report-btn');
const closeReportBtn = document.querySelector('.report-close-btn');
const reportFilters = document.querySelector('.report-filters');

// Calendar Elements
const calendarContainer = document.getElementById('calendar-container');
const calendarToggleBtn = document.getElementById('calendar-toggle-btn');
const monthYearEl = document.getElementById('month-year');
const calendarGrid = document.getElementById('calendar-days-grid');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');

// State variables
let simulationTimeout;
let chart;
let pnlByAssetChart, precisionChart;
let state;
let currentModalAction = null;
let calendarDate = new Date();
const assets = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];

function getInitialState() {
    const initialBalance = 1000000;
    return {
        initialBalance: initialBalance,
        currentBalance: initialBalance,
        profitWallet: 0,
        profitFixationBase: initialBalance,
        fixationEvents: 0,
        aiRunning: false,
        signalHistory: [], 
        modelConfidence: 0.6, // Start with a neutral-positive confidence
        modelAdaptability: 0,
        chartData: {
            labels: [],
            datasets: [{
                label: 'Баланс кошелька',
                data: [],
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
                tension: 0.1
            }]
        }
    };
}

function saveState() {
    localStorage.setItem('tradingAiState', JSON.stringify(state));
}

function loadState() {
    const savedState = localStorage.getItem('tradingAiState');
    if (savedState) {
        state = JSON.parse(savedState);
        // Date objects are not preserved in JSON, so we need to restore them
        state.signalHistory.forEach(s => s.timestamp = new Date(s.timestamp));
    } else {
        state = getInitialState();
    }
}

function formatCurrency(value) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function logEntry(message, type = 'system', date = new Date()) {
    const entry = document.createElement('div');
    entry.classList.add('log-entry', `log-${type}`);
    const timestamp = date.toLocaleTimeString('ru-RU');
    entry.innerHTML = `<span class="log-timestamp">[${timestamp}]</span> ${message}`;
    tradeLogEl.insertBefore(entry, tradeLogEl.firstChild);
}

function updateSignalCounters() {
    const executedTrades = state.signalHistory.filter(s => s.traded);
    const profitableTrades = executedTrades.filter(s => s.pnl > 0).length;
    const losingTrades = executedTrades.length - profitableTrades;
    const skippedSignals = state.signalHistory.filter(s => !s.traded && !s.isEvent).length;

    totalTradesCounterEl.textContent = executedTrades.length;
    profitCounterEl.textContent = profitableTrades;
    lossCounterEl.textContent = losingTrades;
    systemCounterEl.textContent = skippedSignals;
    fixationCounterEl.textContent = state.fixationEvents || 0;
}

function updateMetrics() {
    const pnl = state.currentBalance + state.profitWallet - state.initialBalance;
    const pnlPercent = state.initialBalance > 0 ? (pnl / state.initialBalance) * 100 : 0;
    initialBalanceEl.textContent = formatCurrency(state.initialBalance);
    currentBalanceEl.textContent = formatCurrency(state.currentBalance);
    profitWalletEl.textContent = formatCurrency(state.profitWallet);
    pnlValueEl.textContent = `${formatCurrency(pnl)} (${pnlPercent.toFixed(2)}%)`;
    pnlValueEl.className = pnl >= 0 ? 'profit' : 'loss';

    const executedTrades = state.signalHistory.filter(s => s.traded);
    const profitableTrades = executedTrades.filter(t => t.pnl > 0);
    const precision = executedTrades.length > 0 ? (profitableTrades.length / executedTrades.length) * 100 : 0;
    precisionMetricEl.textContent = `${precision.toFixed(2)}%`;
    
    adaptabilityMetricEl.textContent = `${state.modelAdaptability.toFixed(2)}%`;
    updateSignalCounters();
}

function updateAiStatus(status, className) {
    aiStatusEl.textContent = status;
    aiStatusEl.className = className;
}

function initializeChart() {
    const ctx = chartCanvas.getContext('2d');
    if (chart) chart.destroy();
    chart = new Chart(ctx, {
        type: 'line',
        data: state.chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { ticks: { color: '#e0e0e0' } }, x: { ticks: { color: '#e0e0e0' } } },
            plugins: { legend: { labels: { color: '#e0e0e0' } } }
        }
    });
}

function updateChart() {
    const now = new Date();
    state.chartData.labels.push(now.toLocaleTimeString('ru-RU'));
    state.chartData.datasets[0].data.push(state.currentBalance);
    if (state.chartData.labels.length > 100) {
        state.chartData.labels.shift();
        state.chartData.datasets[0].data.shift();
    }
    chart.update();
}

function checkAndFixProfit() {
    if (!autofixProfitCheckbox.checked) return;
    const profitTargetPercent = parseFloat(profitTargetInput.value) / 100;
    const withdrawPercent = parseFloat(withdrawPercentInput.value) / 100;
    if (isNaN(profitTargetPercent) || isNaN(withdrawPercent) || profitTargetPercent <= 0 || withdrawPercent <= 0) return;
    const targetBalance = state.profitFixationBase * (1 + profitTargetPercent);
    if (state.currentBalance > targetBalance) {
        const profitMade = state.currentBalance - state.profitFixationBase;
        const amountToFix = profitMade * withdrawPercent;
        state.currentBalance -= amountToFix;
        state.profitWallet += amountToFix;
        state.profitFixationBase = state.currentBalance;
        state.fixationEvents = (state.fixationEvents || 0) + 1;
        
        const message = `ФИКСАЦИЯ: Достигнута цель в ${profitTargetInput.value}%. ${formatCurrency(amountToFix)} переведено в сейф.`;
        const type = 'fixation';
        const timestamp = new Date();
        logEntry(message, type, timestamp);
        state.signalHistory.push({
            timestamp: timestamp,
            traded: false,
            isEvent: true,
            log: { message, type }
        });

        updateMetrics();
    }
}

const calculateMA = (data, period) => {
    if (data.length < period) return 0;
    const sum = data.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
};

async function runSimulation() {
    if (!state.aiRunning) return;

    const tradeAmount = parseFloat(tradeAmountInput.value);
    const leverage = parseInt(leverageSlider.value);

    if (isNaN(tradeAmount) || tradeAmount <= 0) {
        logEntry(`<strong>ОШИБКА:</strong> Неверная сумма сделки. ИИ остановлен.`, 'loss');
        stopAI(false); return;
    }
    if (tradeAmount > state.currentBalance) {
        logEntry(`<strong>ОШИБКА:</strong> Сумма сделки превышает баланс. ИИ остановлен.`, 'loss');
        stopAI(false); return;
    }

    const asset = assets[Math.floor(Math.random() * assets.length)];
    const klinesUrl = `https://api.binance.com/api/v3/klines?symbol=${asset}&interval=1m&limit=30`;

    try {
        const klinesResponse = await fetch(klinesUrl);
        if (!klinesResponse.ok) throw new Error(`Ошибка сети Binance (klines)`);
        const klines = await klinesResponse.json();
        
        if (klines.length < 21) throw new Error(`Недостаточно данных для анализа ${asset}`);

        const closePrices = klines.map(k => parseFloat(k[4]));
        const openPrices = klines.map(k => parseFloat(k[1]));
        
        const shortMA = calculateMA(closePrices, 5);
        const longMA = calculateMA(closePrices, 20);
        const isBullishTrend = shortMA > longMA;

        const latestPrice = closePrices[closePrices.length - 1];
        const previousPrice = closePrices[closePrices.length - 2];
        livePriceLabel.textContent = `Live Price (${asset})`;
        livePriceEl.textContent = formatCurrency(latestPrice);

        let shouldTrade = false;
        let tradeType = '';
        
        const lastCandleOpen = openPrices[openPrices.length - 1];
        const lastCandleClose = closePrices[closePrices.length - 1];
        const isLastCandleGreen = lastCandleClose > lastCandleOpen;
        const isLastCandleRed = lastCandleClose < lastCandleOpen;

        if (isBullishTrend && isLastCandleGreen) {
            shouldTrade = true;
            tradeType = 'LONG';
        } else if (!isBullishTrend && isLastCandleRed) {
            shouldTrade = true;
            tradeType = 'SHORT';
        }

        const signal = { timestamp: new Date(), traded: false, pnl: 0, asset: asset };
        let message, type;

        // Reinforcement Learning Simulation
        if (shouldTrade && Math.random() < state.modelConfidence) {
            const priceChange = latestPrice - previousPrice;
            let pnl = 0;
            
            if (tradeType === 'LONG') {
                pnl = (priceChange / previousPrice) * tradeAmount * leverage;
            } else { // SHORT
                pnl = (-priceChange / previousPrice) * tradeAmount * leverage;
            }

            state.currentBalance += pnl;
            message = `<strong>АДАПТИВНАЯ СДЕЛКА:</strong> ${asset} (${leverage}x). PnL: ${formatCurrency(pnl)}`;
            type = pnl >= 0 ? 'profit' : 'loss';
            signal.traded = true;
            signal.pnl = pnl;
            
            // Learning from outcome
            if (pnl > 0) {
                state.modelConfidence = Math.min(1, state.modelConfidence + 0.05);
                state.modelAdaptability += 0.1;
            } else {
                state.modelConfidence = Math.max(0.1, state.modelConfidence - 0.1);
                state.modelAdaptability += 0.05;
            }

        } else {
            message = `<strong>ФИЛЬТР (RL):</strong> ${asset}. Низкая уверенность модели (${(state.modelConfidence*100).toFixed(0)}%). Пропуск.`;
            type = 'system';
        }
        
        logEntry(message, type, signal.timestamp);
        signal.log = { message, type };
        state.signalHistory.push(signal);
        
        checkAndFixProfit();
        updateMetrics();
        updateChart();
        saveState();

        simulationTimeout = setTimeout(runSimulation, 5000);

    } catch (error) {
        logEntry(`<strong>ОШИБКА:</strong> ${error.message}`, 'loss');
        updateAiStatus('Ошибка API', 'status-error');
        stopAI(false);
    }
}

function startAI() {
    if (state.aiRunning) return;
    state.aiRunning = true;
    const controlsToDisable = [tradeAmountInput, leverageSlider, opLevelSelect, startBtn, showReportBtn, profitTargetInput, withdrawPercentInput, autofixProfitCheckbox];
    controlsToDisable.forEach(el => el.disabled = true);
    stopBtn.disabled = false;

    updateAiStatus('Работает', 'status-running');
    logEntry('<strong>СИСТЕМА:</strong> Когнитивное ядро активировано. RL-модуль включен.', 'system');
    runSimulation();
}

function stopAI(logUserStop = true) {
    if (!state.aiRunning) return;
    state.aiRunning = false;
    clearTimeout(simulationTimeout);
    const controlsToEnable = [tradeAmountInput, leverageSlider, opLevelSelect, startBtn, showReportBtn, profitTargetInput, withdrawPercentInput, autofixProfitCheckbox];
    controlsToEnable.forEach(el => el.disabled = false);
    stopBtn.disabled = true;

    if (logUserStop) {
        updateAiStatus('Остановлен', 'status-stopped');
        logEntry('<strong>СИСТЕМА:</strong> Когнитивное ядро в режиме ожидания.');
    }
}

function resetSimulation() {
    stopAI(false);
    state = getInitialState();
    saveState();
    tradeLogEl.innerHTML = '';
    livePriceLabel.textContent = 'Live Asset Price';
    livePriceEl.textContent = 'N/A';
    tradeAmountInput.value = "1000";
    leverageSlider.value = "25";
    leverageValueEl.textContent = "25x";
    opLevelSelect.value = "retail";
    initializeDashboard();
    logEntry('<strong>СИСТЕМА:</strong> Симуляция сброшена. Хранилище очищено.');
}

function repopulateLog() {
    tradeLogEl.innerHTML = '';
    // Create a copy before reversing to not mutate the original array
    const historyToShow = [...state.signalHistory];
    historyToShow.reverse().forEach(signal => {
        if (signal.log) {
            logEntry(signal.log.message, signal.log.type, signal.timestamp);
        }
    });
}

function initializeDashboard() {
    updateMetrics();
    initializeChart();
    repopulateLog(); // Repopulate log from history
    state.chartData.labels = [];
    state.chartData.datasets[0].data = [];
    const now = new Date().toLocaleTimeString('ru-RU');
    state.chartData.labels.push(now);
    state.chartData.datasets[0].data.push(state.currentBalance);
    chart.update();

    updateAiStatus('Остановлен', 'status-stopped');
    startBtn.disabled = false;
    stopBtn.disabled = true;
    const controlsToEnable = [tradeAmountInput, leverageSlider, opLevelSelect, showReportBtn, profitTargetInput, withdrawPercentInput, autofixProfitCheckbox];
    controlsToEnable.forEach(el => el.disabled = false);
}

// --- Modal Functions ---
function showModal(type) {
    currentModalAction = type;
    modalError.textContent = '';
    modalAmountInput.value = '';
    if (type === 'deposit') {
        modalTitle.textContent = 'Ввод Средств';
        modalSubmitBtn.textContent = 'Ввести';
    } else {
        modalTitle.textContent = 'Вывод Средств';
        modalSubmitBtn.textContent = 'Вывести';
    }
    modalOverlay.style.display = 'flex';
    modalAmountInput.focus();
}

function hideModal() {
    modalOverlay.style.display = 'none';
}

function handleWalletTransaction(e) {
    e.preventDefault();
    const amount = parseFloat(modalAmountInput.value);
    modalError.textContent = '';

    if (isNaN(amount) || amount <= 0) {
        modalError.textContent = 'Пожалуйста, введите корректную сумму.';
        return;
    }

    if (currentModalAction === 'deposit') {
        state.initialBalance += amount;
        state.currentBalance += amount;
        logEntry(`<strong>ВВОД:</strong> ${formatCurrency(amount)} зачислены на счет.`, 'wallet');
    } else if (currentModalAction === 'withdraw') {
        if (amount > state.currentBalance) {
            modalError.textContent = 'Недостаточно средств для вывода.';
            return;
        }
        state.currentBalance -= amount;
        logEntry(`<strong>ВЫВОД:</strong> ${formatCurrency(amount)} списаны со счета.`, 'wallet');
    }
    
    updateMetrics();
    updateChart();
    saveState();
    hideModal();
}

// --- Report Generation ---
function generateReport(filter) {
    const now = new Date();
    let filteredSignals = state.signalHistory;
    let periodLabel = 'Все время';

    if (filter instanceof Date) {
        const selectedDate = filter;
        filteredSignals = state.signalHistory.filter(s => s.timestamp.toDateString() === selectedDate.toDateString());
        periodLabel = selectedDate.toLocaleDateString('ru-RU');
    } else {
        const periodLabels = { minute: 'Последняя минута', hour: 'Последний час', day: 'Сегодня', all: 'Все время'};
        periodLabel = periodLabels[filter];
        if (filter === 'minute') {
            filteredSignals = state.signalHistory.filter(s => now - s.timestamp < 60 * 1000);
        } else if (filter === 'hour') {
            filteredSignals = state.signalHistory.filter(s => now - s.timestamp < 60 * 60 * 1000);
        } else if (filter === 'day') {
            filteredSignals = state.signalHistory.filter(s => s.timestamp.toDateString() === now.toDateString());
        }
    }
    
    document.getElementById('report-period').textContent = periodLabel;

    const executedTrades = filteredSignals.filter(s => s.traded);
    const profitableTrades = executedTrades.filter(t => t.pnl > 0);
    
    const totalSignals = filteredSignals.filter(s => !s.isEvent).length;
    const totalTrades = executedTrades.length;
    const precision = totalTrades > 0 ? (profitableTrades.length / totalTrades) * 100 : 0;
    const recall = totalSignals > 0 ? (profitableTrades.length / totalSignals) * 100 : 0;
    
    const grossProfit = profitableTrades.reduce((sum, t) => sum + t.pnl, 0);
    const grossLoss = executedTrades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0);
    const profitFactor = grossLoss !== 0 ? Math.abs(grossProfit / grossLoss) : Infinity;
    const netProfit = grossProfit + grossLoss;

    // Update table
    const tableBody = document.getElementById('report-table-body');
    tableBody.innerHTML = `
        <tr><td>Всего проанализировано сигналов</td><td>${totalSignals}</td></tr>
        <tr><td>Исполнено сделок</td><td>${totalTrades}</td></tr>
        <tr><td>Precision</td><td>${precision.toFixed(2)}%</td></tr>
        <tr><td>Recall</td><td>${recall.toFixed(2)}%</td></tr>
        <tr><td>Profit Factor</td><td>${profitFactor.toFixed(2)}</td></tr>
        <tr><td>Чистая прибыль</td><td class="${netProfit >= 0 ? 'profit' : 'loss'}">${formatCurrency(netProfit)}</td></tr>
    `;

    // PnL by Asset Chart
    const pnlByAsset = {};
    assets.forEach(a => pnlByAsset[a] = 0);
    executedTrades.forEach(trade => {
        if (pnlByAsset[trade.asset] !== undefined) {
            pnlByAsset[trade.asset] += trade.pnl;
        }
    });
    
    if (pnlByAssetChart) pnlByAssetChart.destroy();
    pnlByAssetChart = new Chart(document.getElementById('pnl-by-asset-chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(pnlByAsset),
            datasets: [{
                label: 'Net PnL by Asset',
                data: Object.values(pnlByAsset),
                backgroundColor: Object.values(pnlByAsset).map(pnl => pnl >= 0 ? 'rgba(40, 167, 69, 0.6)' : 'rgba(220, 53, 69, 0.6)'),
                borderColor: Object.values(pnlByAsset).map(pnl => pnl >= 0 ? '#28a745' : '#dc3545'),
                borderWidth: 1
            }]
        },
        options: { scales: { y: { ticks: { color: '#e0e0e0' } }, x: { ticks: { color: '#e0e0e0' } } }, plugins: { legend: { display: false } } }
    });

    // Precision Over Time Chart
    const precisionOverTime = [];
    let wins = 0;
    for (let i = 0; i < executedTrades.length; i++) {
        if (executedTrades[i].pnl > 0) wins++;
        precisionOverTime.push((wins / (i + 1)) * 100);
    }
    if (precisionChart) precisionChart.destroy();
    precisionChart = new Chart(document.getElementById('precision-chart').getContext('2d'), {
        type: 'line',
        data: {
            labels: Array.from({ length: precisionOverTime.length }, (_, i) => i + 1),
            datasets: [{
                label: 'Precision (%)',
                data: precisionOverTime,
                borderColor: '#007bff',
                tension: 0.1,
                pointRadius: 0
            }]
        },
        options: { scales: { y: { ticks: { color: '#e0e0e0' }, min: 0, max: 100 }, x: { ticks: { color: '#e0e0e0' } } }, plugins: { legend: { labels: { color: '#e0e0e0' } } } }
    });
}

// --- Calendar Logic ---
function renderCalendar() {
    calendarGrid.innerHTML = '';
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    monthYearEl.textContent = `${calendarDate.toLocaleString('ru-RU', { month: 'long' })} ${year}`;

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    dayNames.forEach(name => {
        const dayNameEl = document.createElement('div');
        dayNameEl.textContent = name;
        dayNameEl.classList.add('calendar-day-name');
        calendarGrid.appendChild(dayNameEl);
    });

    const activeDays = new Set(state.signalHistory.map(s => s.timestamp.toDateString()));

    for (let i = 0; i < firstDayOfMonth; i++) {
        calendarGrid.appendChild(document.createElement('div')).classList.add('empty');
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = document.createElement('div');
        dayEl.textContent = day;
        dayEl.classList.add('calendar-day');
        const currentDate = new Date(year, month, day);
        dayEl.dataset.date = currentDate.toISOString().split('T')[0];
        if (activeDays.has(currentDate.toDateString())) {
            dayEl.classList.add('active-day');
        }
        calendarGrid.appendChild(dayEl);
    }
}

// --- Event Listeners ---

loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    loadState(); // Load saved state on login
    loginContainer.style.display = 'none';
    dashboardContainer.style.display = 'block';
    initializeDashboard();
    logEntry('<strong>СИСТЕМА:</strong> Сессия восстановлена. Когнитивное ядро готово.', 'system');
});

leverageSlider.addEventListener('input', (e) => {
    leverageValueEl.textContent = `${e.target.value}x`;
});

startBtn.addEventListener('click', startAI);
stopBtn.addEventListener('click', () => stopAI(true));
resetBtn.addEventListener('click', resetSimulation);

depositBtn.addEventListener('click', () => showModal('deposit'));
withdrawBtn.addEventListener('click', () => showModal('withdraw'));

modalCancelBtn.addEventListener('click', hideModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) hideModal(); });
modalForm.addEventListener('submit', handleWalletTransaction);

// Report Modal Listeners
showReportBtn.addEventListener('click', () => {
    renderCalendar();
    generateReport('day'); // Default to day view
    reportFilters.querySelector('.active').classList.remove('active');
    reportFilters.querySelector('[data-filter="day"]').classList.add('active');
    reportModal.style.display = 'block';
});
closeReportBtn.addEventListener('click', () => {
    reportModal.style.display = 'none';
});
window.addEventListener('click', (e) => {
    if (e.target == reportModal) {
        reportModal.style.display = 'none';
    }
});
reportFilters.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON' && e.target.id !== 'calendar-toggle-btn') {
        reportFilters.querySelector('.active').classList.remove('active');
        e.target.classList.add('active');
        const filter = e.target.dataset.filter;
        generateReport(filter);
    }
});

// Calendar Listeners
calendarToggleBtn.addEventListener('click', () => {
    const isHidden = calendarContainer.style.display === 'none';
    calendarContainer.style.display = isHidden ? 'block' : 'none';
});
prevMonthBtn.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
});
nextMonthBtn.addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
});
calendarGrid.addEventListener('click', (e) => {
    if (e.target.classList.contains('calendar-day') && !e.target.classList.contains('empty')) {
        const selectedDate = new Date(e.target.dataset.date);
        generateReport(selectedDate);
        if(reportFilters.querySelector('.active')) {
            reportFilters.querySelector('.active').classList.remove('active');
        }
        calendarToggleBtn.classList.add('active');
    }
});
