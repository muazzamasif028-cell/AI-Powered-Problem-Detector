// ============================================================
// 🚀 main.js
// SUPREME Counter — UI Controller & Event Bindings
// ============================================================

(function() {
    'use strict';

    // =============================================
    // 🔧 DOM ELEMENTS
    // =============================================
    const elements = {
        counterValue: document.getElementById('counterValue'),
        btnDecrease: document.getElementById('btnDecrease'),
        btnReset: document.getElementById('btnReset'),
        btnIncrease: document.getElementById('btnIncrease'),
        btnDouble: document.getElementById('btnDouble'),
        btnHalf: document.getElementById('btnHalf'),
        btnSetValue: document.getElementById('btnSetValue'),
        inputStep: document.getElementById('inputStep'),
        inputSetValue: document.getElementById('inputSetValue'),
        statTotalOps: document.getElementById('statTotalOps'),
        statPeak: document.getElementById('statPeak'),
        statLowest: document.getElementById('statLowest'),
        historyList: document.getElementById('historyList')
    };

    // =============================================
    // ⚙️ INITIALIZE COUNTER
    // =============================================
    const counter = new Counter(0, {
        step: 1,
        min: -100,
        max: 100,
        persist: true,
        storageKey: 'supreme-counter-state'
    });

    // =============================================
    // 🎨 UI UPDATE FUNCTIONS
    // =============================================

    /**
     * Update counter display
     */
    function updateDisplay() {
        const value = counter.getValue();
        const display = elements.counterValue;
        
        // Update value
        display.textContent = value;
        
        // Update color class based on value
        display.classList.remove('positive', 'negative', 'zero');
        if (value > 0) {
            display.classList.add('positive');
        } else if (value < 0) {
            display.classList.add('negative');
        } else {
            display.classList.add('zero');
        }
        
        // Add pulse animation
        display.classList.remove('pulse');
        void display.offsetWidth; // Trigger reflow
        display.classList.add('pulse');
    }

    /**
     * Update statistics display
     */
    function updateStats() {
        const stats = counter.getStats();
        
        elements.statTotalOps.textContent = stats.totalOperations;
        elements.statPeak.textContent = stats.peak;
        elements.statLowest.textContent = stats.lowest;
    }

    /**
     * Update history display
     */
    function updateHistory() {
        const history = counter.getHistory(5);
        
        if (history.length === 0) {
            elements.historyList.innerHTML = `
                <li class="history-item">
                    <span style="opacity:0.5;">No actions yet</span>
                </li>`;
            return;
        }
        
        elements.historyList.innerHTML = history.map(item => {
            const actionIcon = {
                'increment': '📈',
                'decrement': '📉',
                'reset': '🔄',
                'set': '🎯'
            };
            
            const actionColor = {
                'increment': '#3fb950',
                'decrement': '#f85149',
                'reset': '#d29922',
                'set': '#a855f7'
            };
            
            const time = new Date(item.timestamp);
            const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            return `
                <li class="history-item">
                    <span>
                        <span style="color:${actionColor[item.action]};margin-right:8px;">
                            ${actionIcon[item.action]} ${item.action}
                        </span>
                        <span style="color:#666;">
                            ${item.amount > 0 ? '+' : ''}${item.amount}
                        </span>
                    </span>
                    <span class="history-time">${timeStr}</span>
                </li>`;
        }).join('');
    }

    /**
     * Update step input
     */
    function updateStepInput() {
        elements.inputStep.value = counter.step;
    }

    /**
     * Full UI refresh
     */
    function refreshUI() {
        updateDisplay();
        updateStats();
        updateHistory();
    }

    // =============================================
    // 🎯 EVENT HANDLERS
    // =============================================

    /**
     * Handle increment
     */
    function handleIncrement() {
        const stepValue = parseInt(elements.inputStep.value) || counter.step;
        counter.increment(stepValue);
        refreshUI();
        showToast(`Increased by ${stepValue}`);
    }

    /**
     * Handle decrement
     */
    function handleDecrement() {
        const stepValue = parseInt(elements.inputStep.value) || counter.step;
        counter.decrement(stepValue);
        refreshUI();
        showToast(`Decreased by ${stepValue}`);
    }

    /**
     * Handle reset
     */
    function handleReset() {
        if (counter.getValue() === counter.initialValue) {
            showToast('Already at initial value');
            return;
        }
        
        counter.reset();
        refreshUI();
        showToast('Counter reset');
    }

    /**
     * Handle double
     */
    function handleDouble() {
        const oldValue = counter.getValue();
        counter.double();
        refreshUI();
        showToast(`Doubled: ${oldValue} → ${counter.getValue()}`);
    }

    /**
     * Handle half
     */
    function handleHalf() {
        const oldValue = counter.getValue();
        counter.half();
        refreshUI();
        showToast(`Halved: ${oldValue} → ${counter.getValue()}`);
    }

    /**
     * Handle set value
     */
    function handleSetValue() {
        const newValue = parseInt(elements.inputSetValue.value);
        
        if (isNaN(newValue)) {
            showToast('Please enter a valid number', 'error');
            return;
        }
        
        const oldValue = counter.getValue();
        counter.setValue(newValue);
        elements.inputSetValue.value = '';
        refreshUI();
        showToast(`Set: ${oldValue} → ${counter.getValue()}`);
    }

    /**
     * Handle step change
     */
    function handleStepChange() {
        const newStep = parseInt(elements.inputStep.value);
        
        if (isNaN(newStep) || newStep <= 0) {
            elements.inputStep.value = counter.step;
            showToast('Step must be greater than 0', 'error');
            return;
        }
        
        counter.setStep(newStep);
        showToast(`Step set to ${newStep}`);
    }

    /**
     * Handle keyboard shortcuts
     */
    function handleKeyboard(e) {
        switch (e.key) {
            case 'ArrowUp':
            case '+':
                e.preventDefault();
                handleIncrement();
                break;
                
            case 'ArrowDown':
            case '-':
                e.preventDefault();
                handleDecrement();
                break;
                
            case 'r':
            case 'R':
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    handleReset();
                }
                break;
                
            case 'd':
            case 'D':
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    handleDouble();
                }
                break;
                
            case 'h':
            case 'H':
                if (!e.ctrlKey && !e.metaKey) {
                    e.preventDefault();
                    handleHalf();
                }
                break;
                
            case 'Enter':
                if (document.activeElement === elements.inputSetValue) {
                    e.preventDefault();
                    handleSetValue();
                }
                break;
                
            case 'Escape':
                elements.inputSetValue.blur();
                elements.inputStep.blur();
                break;
        }
    }

    // =============================================
    // 🔔 TOAST NOTIFICATION
    // =============================================
    
    let toastTimeout;

    function showToast(message, type = 'info') {
        // Remove existing toast
        const existingToast = document.querySelector('.toast');
        if (existingToast) {
            existingToast.remove();
        }
        
        // Create new toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.textContent = message;
        
        if (type === 'error') {
            toast.style.borderColor = '#f85149';
            toast.style.color = '#f85149';
        }
        
        document.body.appendChild(toast);
        
        // Auto remove
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 2800);
    }

    // =============================================
    // 🔗 EVENT LISTENERS
    // =============================================

    // Button clicks
    elements.btnDecrease.addEventListener('click', handleDecrement);
    elements.btnReset.addEventListener('click', handleReset);
    elements.btnIncrease.addEventListener('click', handleIncrement);
    elements.btnDouble.addEventListener('click', handleDouble);
    elements.btnHalf.addEventListener('click', handleHalf);
    elements.btnSetValue.addEventListener('click', handleSetValue);

    // Input changes
    elements.inputStep.addEventListener('change', handleStepChange);
    elements.inputSetValue.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSetValue();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);

    // Counter events
    counter.on('change', (data) => {
        console.log(`Counter changed: ${data.action} → ${data.value}`);
    });

    counter.on('limitReached', (data) => {
        const message = data.type === 'max' 
            ? `Maximum limit reached: ${data.max}` 
            : `Minimum limit reached: ${data.min}`;
        showToast(message, 'error');
    });

    // =============================================
    // 🚀 INITIALIZATION
    // =============================================
    
    function init() {
        // Load saved state
        counter.load();
        
        // Initial UI render
        refreshUI();
        updateStepInput();
        
        // Set initial input values
        elements.inputStep.value = counter.step;
        elements.inputSetValue.placeholder = `Set value (${counter.minValue} to ${counter.maxValue})`;
        
        console.log('🚀 SUPREME Counter ready!');
        console.log('   Value:', counter.getValue());
        console.log('   Step:', counter.step);
        console.log('   Shortcuts: ↑ ↓ R D H');
    }

    // Start the app
    init();

})();
