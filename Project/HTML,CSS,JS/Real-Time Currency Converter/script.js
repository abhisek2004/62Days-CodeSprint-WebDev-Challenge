
const API_URL = "https://open.er-api.com/v6/latest/USD"; 

let exchangeRates = {};
let currencies = [];
let lastUpdated = '';

// DOM Elements
const amountInput = document.getElementById('amount');
const currencySymbol = document.getElementById('currency-symbol');
const swapBtn = document.getElementById('swap-btn');
const resultAmount = document.getElementById('result-amount');
const resultRate = document.getElementById('result-rate');
const resultDate = document.getElementById('result-date');

// Helpers for native formatting and Emojis
const getFlagEmoji = (currencyCode) => {

    if (currencyCode === 'EUR') return '🇪🇺';
    if (currencyCode === 'BTC') return '₿';
    if (currencyCode === 'XAU') return '🪙';
    if (currencyCode === 'XAG') return '🥈';
    
    // Convert first two letters to Regional Indicator Symbols
    const countryCode = currencyCode.substring(0, 2);
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
    try {
        return String.fromCodePoint(...codePoints);
    } catch(e) {
        return '🏳️';
    }
};

const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });
function getCurrencyName(code) {
    try { return currencyNames.of(code); } 
    catch(e) { return code; }
}

function getCurrencySymbolInfo(code) {
    try {
        const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0);
        const symbol = parts.find(p => p.type === 'currency');
        return symbol ? symbol.value : '';
    } catch(e) { return ''; }
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(num);
}

// Custom Dropdown Component
class CustomSelect {
    constructor(elementId, defaultCode, onChange) {
        this.container = document.getElementById(elementId);
        this.selectedDisplay = this.container.querySelector('.select-selected');
        this.itemsContainer = this.container.querySelector('.select-items');
        this.listContainer = this.container.querySelector('.currency-list');
        this.searchInput = this.container.querySelector('.search-currency');
        this.onChange = onChange;
        
        this.currentCode = defaultCode;
        this.isOpen = false;
        
        this.setupEvents();
    }
    
    setupEvents() {
        this.selectedDisplay.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });
        this.searchInput.addEventListener('input', (e) => this.filterList(e.target.value));
        this.searchInput.addEventListener('click', e => e.stopPropagation());
    }
    
    toggle() {
        document.querySelectorAll('.select-items').forEach(el => {
            if (el !== this.itemsContainer) el.classList.add('hide');
        });
        
        this.isOpen = !this.isOpen;
        this.itemsContainer.classList.toggle('hide', !this.isOpen);
        
        if (this.isOpen) {
            this.searchInput.value = '';
            this.filterList('');
            this.searchInput.focus();
        }
    }
    
    close() {
        this.isOpen = false;
        this.itemsContainer.classList.add('hide');
    }
    
    populate(currenciesList) {
        this.currencies = currenciesList;
        this.renderList(currenciesList);
        this.updateDisplay(this.currentCode);
    }
    
    renderList(list) {
        this.listContainer.innerHTML = '';
        list.forEach(code => {
            const div = document.createElement('div');
            div.className = `currency-item ${code === this.currentCode ? 'active' : ''}`;
            const flag = getFlagEmoji(code);
            const name = getCurrencyName(code);
            
            div.innerHTML = `
                <span class="flag">${flag}</span>
                <div class="curr-info">
                    <span class="code">${code}</span>
                    <span class="name">${name}</span>
                </div>
            `;
            
            div.addEventListener('click', (e) => {
                e.stopPropagation();
                this.setValue(code);
                this.close();
                if(this.onChange) this.onChange();
            });
            
            this.listContainer.appendChild(div);
        });
    }
    
    filterList(query) {
        query = query.toLowerCase();
        const filtered = this.currencies.filter(code => {
            const name = getCurrencyName(code).toLowerCase();
            return code.toLowerCase().includes(query) || name.includes(query);
        });
        this.renderList(filtered);
    }
    
    updateDisplay(code) {
        const flag = getFlagEmoji(code);
        this.selectedDisplay.innerHTML = `
            <span class="flag">${flag}</span>
            <span class="code">${code}</span>
            <svg class="chevron" viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 10l5 5 5-5z"/></svg>
        `;
    }
    
    setValue(code) {
        this.currentCode = code;
        this.updateDisplay(code);
        this.renderList(this.currencies); // re-render to update 'active' highlight
    }
    
    getValue() { return this.currentCode; }
}

// Initialization & Logic
let fromSelect, toSelect;

async function fetchRates() {
    try {
        const res = await fetch(API_URL);
        const data = await res.json();
        
        exchangeRates = data.rates;
        currencies = Object.keys(exchangeRates);
        
        const dateObj = new Date(data.time_last_update_utc);
        lastUpdated = dateObj.toLocaleString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', 
            hour: '2-digit', minute: '2-digit'
        });
        
        initUI();
    } catch (err) {
        console.error("Error fetching rates:", err);
        resultAmount.textContent = "Error loading rates.";
    }
}

function initUI() {
    fromSelect = new CustomSelect('from-currency', 'USD', handleConvert);
    toSelect = new CustomSelect('to-currency', 'EUR', handleConvert);
    
    fromSelect.populate(currencies);
    toSelect.populate(currencies);
    
    document.addEventListener('click', () => {
        fromSelect.close();
        toSelect.close();
    });
    
    amountInput.addEventListener('input', handleConvert);
    
    swapBtn.addEventListener('click', () => {
        const temp = fromSelect.getValue();
        fromSelect.setValue(toSelect.getValue());
        toSelect.setValue(temp);
        handleConvert();
    });
    
    handleConvert();
}

function handleConvert() {
    const amount = parseFloat(amountInput.value) || 0;
    const from = fromSelect.getValue();
    const to = toSelect.getValue();
    
    // Dynamic Input Padding & Symbol
    const sym = getCurrencySymbolInfo(from);
    currencySymbol.textContent = sym;
    const padding = Math.max(20 + (sym.length * 14), 48);
    amountInput.style.paddingLeft = `${padding}px`;
    
    // Calculate rate (converting through USD base)
    const rate = exchangeRates[to] / exchangeRates[from];
    const result = amount * rate;
    
    // Render Results
    resultAmount.textContent = `${formatNumber(result)} ${to}`;
    resultRate.textContent = `1 ${from} = ${formatNumber(rate)} ${to}`;
    resultDate.textContent = `Last updated: ${lastUpdated}`;
}

// Boot up
fetchRates();