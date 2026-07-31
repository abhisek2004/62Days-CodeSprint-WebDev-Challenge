/**
 * AEGISVAULT - Client-Side WebCrypto Password Vault & Master Key Encryptor
 * Zero-Knowledge AES-256-GCM Encryption Engine using SubtleCrypto
 */

(function () {
    'use strict';

    // ==========================================
    // STATE & CONFIGURATION
    // ==========================================
    let currentMasterKey = null;
    let vaultItems = []; // Decrypted items stored ONLY while unlocked
    let activeTab = 'all-items';
    let searchQuery = '';
    let sortAsc = true;
    let filterOnlyWeak = false;

    // Auto-lock state
    let autoLockSeconds = 300; // 5 mins default
    let remainingLockSeconds = 300;
    let autoLockInterval = null;

    // Storage Keys
    const STORAGE_VERIFY_KEY = 'aegis_verification';
    const STORAGE_VAULT_KEY = 'aegis_encrypted_vault';

    const VERIFY_STRING = 'AEGIS_VERIFY_KEY_VALID_2026';

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const authScreen = document.getElementById('auth-screen');
    const vaultDashboard = document.getElementById('vault-dashboard');
    const setupForm = document.getElementById('setup-form');
    const loginForm = document.getElementById('login-form');

    // Setup fields
    const setupPassInput = document.getElementById('setup-password');
    const setupConfirmInput = document.getElementById('setup-confirm');
    const iterationsSelect = document.getElementById('pbkdf2-iterations');
    const setupStrengthBar = document.querySelector('#setup-strength-bar div');

    // Login fields
    const loginPassInput = document.getElementById('login-password');
    const btnResetVault = document.getElementById('btn-reset-vault');
    const btnImportAuth = document.getElementById('btn-import-auth');

    // Dashboard Header & Nav
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const btnNewEntry = document.getElementById('btn-new-entry');
    const btnLockVault = document.getElementById('btn-lock-vault');
    const autolockSelect = document.getElementById('autolock-select');
    const autolockTimerDisplay = document.getElementById('autolock-timer');
    const btnExtendSession = document.getElementById('btn-extend-session');
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    const currentTabTitle = document.getElementById('current-tab-title');

    // Metrics
    const metricTotalItems = document.getElementById('metric-total-items');
    const metricVaultScore = document.getElementById('metric-vault-score');
    const metricWeakCount = document.getElementById('metric-weak-count');

    // Badges
    const badgeTotalCount = document.getElementById('badge-total-count');
    const badgeLoginsCount = document.getElementById('badge-logins-count');
    const badgeCardsCount = document.getElementById('badge-cards-count');
    const badgeNotesCount = document.getElementById('badge-notes-count');
    const badgeFavoritesCount = document.getElementById('badge-favorites-count');

    // Container
    const vaultItemsContainer = document.getElementById('vault-items-container');
    const emptyState = document.getElementById('empty-state');

    // Sort & Filter
    const btnSortTitle = document.getElementById('btn-sort-title');
    const btnFilterWeak = document.getElementById('btn-filter-weak');

    // Modals
    const modalEntry = document.getElementById('modal-entry');
    const entryForm = document.getElementById('entry-form');
    const entryIdInput = document.getElementById('entry-id');
    const entryCategorySelect = document.getElementById('entry-category');
    const entryTitleInput = document.getElementById('entry-title');
    const entryUsernameInput = document.getElementById('entry-username');
    const entryUrlInput = document.getElementById('entry-url');
    const entryPasswordInput = document.getElementById('entry-password');
    const entryNotesInput = document.getElementById('entry-notes');
    const entryFavoriteCheckbox = document.getElementById('entry-favorite');
    const entryStrengthBar = document.querySelector('#entry-strength-bar div');
    const entryStrengthText = document.getElementById('entry-strength-text');
    const btnQuickGenerate = document.getElementById('btn-quick-generate');
    const btnCopyEntryPass = document.getElementById('btn-copy-entry-pass');

    // Generator Modal
    const modalGenerator = document.getElementById('modal-generator');
    const navBtnGenerator = document.getElementById('nav-btn-generator');
    const genResultDisplay = document.getElementById('gen-result');
    const btnGenRefresh = document.getElementById('btn-gen-refresh');
    const btnGenCopy = document.getElementById('btn-gen-copy');
    const genLengthRange = document.getElementById('gen-length-range');
    const genLengthVal = document.getElementById('gen-length-val');
    const genIncUpper = document.getElementById('gen-inc-uppercase');
    const genIncLower = document.getElementById('gen-inc-lowercase');
    const genIncNumbers = document.getElementById('gen-inc-numbers');
    const genIncSymbols = document.getElementById('gen-inc-symbols');
    const genExcAmbiguous = document.getElementById('gen-exc-ambiguous');
    const genEntropyLbl = document.getElementById('gen-entropy');
    const genStrengthLbl = document.getElementById('gen-strength-label');
    const genCrackTimeLbl = document.getElementById('gen-crack-time');

    // Analyzer Modal
    const modalAnalyzer = document.getElementById('modal-analyzer');
    const navBtnAnalyzer = document.getElementById('nav-btn-analyzer');
    const analyzerScoreNum = document.getElementById('analyzer-score-num');
    const analyzerVerdictTitle = document.getElementById('analyzer-verdict-title');
    const analyzerVerdictDesc = document.getElementById('analyzer-verdict-desc');
    const analyzerWeakCnt = document.getElementById('analyzer-weak-cnt');
    const analyzerReusedCnt = document.getElementById('analyzer-reused-cnt');
    const listAnalyzerWeak = document.getElementById('list-analyzer-weak');
    const listAnalyzerReused = document.getElementById('list-analyzer-reused');

    // Backup Modal
    const modalBackup = document.getElementById('modal-backup');
    const navBtnExport = document.getElementById('nav-btn-export');
    const btnDoExport = document.getElementById('btn-do-export');
    const btnTriggerImportFile = document.getElementById('btn-trigger-import-file');
    const fileImportInput = document.getElementById('file-import-input');

    // Toast container
    const toastContainer = document.getElementById('toast-container');

    // ==========================================
    // WEBCRYPTO HELPER FUNCTIONS (SubtleCrypto)
    // ==========================================

    function bufToHex(buffer) {
        return Array.from(new Uint8Array(buffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    function hexToBuf(hexString) {
        const bytes = new Uint8Array(hexString.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
        }
        return bytes.buffer;
    }

    function generateRandomSalt(length = 16) {
        const salt = new Uint8Array(length);
        window.crypto.getRandomValues(salt);
        return bufToHex(salt);
    }

    /**
     * Derives an AES-GCM 256-bit Key from Master Password using PBKDF2
     */
    async function deriveMasterKey(password, saltHex, iterations = 250000) {
        const enc = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            enc.encode(password),
            'PBKDF2',
            false,
            ['deriveKey']
        );

        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: hexToBuf(saltHex),
                iterations: parseInt(iterations, 10),
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    /**
     * Encrypts plain JavaScript Object or string using AES-256-GCM
     */
    async function encryptObject(cryptoKey, dataObj) {
        const enc = new TextEncoder();
        const jsonStr = JSON.stringify(dataObj);
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM

        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: iv },
            cryptoKey,
            enc.encode(jsonStr)
        );

        return {
            iv: bufToHex(iv),
            ciphertext: bufToHex(ciphertextBuffer)
        };
    }

    /**
     * Decrypts AES-256-GCM payload back to JS Object
     */
    async function decryptObject(cryptoKey, ivHex, ciphertextHex) {
        const dec = new TextDecoder();
        const iv = hexToBuf(ivHex);
        const ciphertext = hexToBuf(ciphertextHex);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            cryptoKey,
            ciphertext
        );

        const jsonStr = dec.decode(decryptedBuffer);
        return JSON.parse(jsonStr);
    }

    // ==========================================
    // AUTHENTICATION & VAULT INIT
    // ==========================================

    function initApp() {
        const verificationData = localStorage.getItem(STORAGE_VERIFY_KEY);
        if (verificationData) {
            // Existing Vault
            setupForm.classList.add('hidden');
            loginForm.classList.remove('hidden');
        } else {
            // First Time Setup
            setupForm.classList.remove('hidden');
            loginForm.classList.add('hidden');
        }
        setupEventListeners();
    }

    // Setup Master Password
    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pass = setupPassInput.value;
        const confirm = setupConfirmInput.value;
        const iterations = iterationsSelect.value;

        if (pass !== confirm) {
            showToast('Master passwords do not match!', 'error');
            return;
        }
        if (pass.length < 8) {
            showToast('Master password must be at least 8 characters long.', 'error');
            return;
        }

        try {
            showToast('Deriving key & initializing vault...', 'info');
            const salt = generateRandomSalt(16);
            const key = await deriveMasterKey(pass, salt, iterations);

            // Create verification payload
            const verifyPayload = await encryptObject(key, { payload: VERIFY_STRING });

            const verificationRecord = {
                salt: salt,
                iterations: iterations,
                iv: verifyPayload.iv,
                ciphertext: verifyPayload.ciphertext
            };

            localStorage.setItem(STORAGE_VERIFY_KEY, JSON.stringify(verificationRecord));
            
            // Initial empty vault
            const initialVaultPayload = await encryptObject(key, []);
            localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(initialVaultPayload));

            currentMasterKey = key;
            vaultItems = [];

            showToast('Vault created successfully!', 'success');
            unlockVault();
        } catch (err) {
            console.error(err);
            showToast('Failed to initialize vault.', 'error');
        }
    });

    // Login to Vault
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pass = loginPassInput.value;
        const verificationRaw = localStorage.getItem(STORAGE_VERIFY_KEY);

        if (!verificationRaw) {
            showToast('No vault found. Please reset or create setup.', 'error');
            return;
        }

        try {
            const verifyRecord = JSON.parse(verificationRaw);
            const key = await deriveMasterKey(pass, verifyRecord.salt, verifyRecord.iterations);

            // Verify Key
            const decryptedVerify = await decryptObject(key, verifyRecord.iv, verifyRecord.ciphertext);

            if (decryptedVerify && decryptedVerify.payload === VERIFY_STRING) {
                currentMasterKey = key;
                await loadEncryptedVault();
                unlockVault();
                showToast('Vault unlocked successfully!', 'success');
            } else {
                showToast('Invalid Master Password.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Decryption failed! Incorrect master password.', 'error');
        }
    });

    // Reset Vault
    btnResetVault.addEventListener('click', () => {
        if (confirm('WARNING: Are you sure you want to permanently erase your vault data? This action cannot be undone!')) {
            localStorage.removeItem(STORAGE_VERIFY_KEY);
            localStorage.removeItem(STORAGE_VAULT_KEY);
            vaultItems = [];
            currentMasterKey = null;
            location.reload();
        }
    });

    // Unlock Screen Transition
    function unlockVault() {
        authScreen.classList.add('hidden');
        vaultDashboard.classList.remove('hidden');
        startAutoLockTimer();
        renderDashboard();
    }

    // Lock Vault
    function lockVault() {
        currentMasterKey = null;
        vaultItems = [];
        stopAutoLockTimer();
        loginPassInput.value = '';
        vaultDashboard.classList.add('hidden');
        authScreen.classList.remove('hidden');
        loginForm.classList.remove('hidden');
        setupForm.classList.add('hidden');
        showToast('Vault Locked.', 'info');
    }

    btnLockVault.addEventListener('click', lockVault);

    // ==========================================
    // VAULT DATA STORAGE & ENCRYPTION
    // ==========================================

    async function loadEncryptedVault() {
        const rawVault = localStorage.getItem(STORAGE_VAULT_KEY);
        if (!rawVault || !currentMasterKey) {
            vaultItems = [];
            return;
        }
        try {
            const encryptedRecord = JSON.parse(rawVault);
            vaultItems = await decryptObject(currentMasterKey, encryptedRecord.iv, encryptedRecord.ciphertext);
            if (!Array.isArray(vaultItems)) vaultItems = [];
        } catch (err) {
            console.error('Failed to load vault items:', err);
            vaultItems = [];
            showToast('Error reading vault records.', 'error');
        }
    }

    async function saveEncryptedVault() {
        if (!currentMasterKey) return;
        try {
            const encryptedRecord = await encryptObject(currentMasterKey, vaultItems);
            localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify(encryptedRecord));
            renderDashboard();
        } catch (err) {
            console.error('Failed to save encrypted vault:', err);
            showToast('Error encrypting and saving vault data!', 'error');
        }
    }

    // ==========================================
    // RENDER & UI LOGIC
    // ==========================================

    function renderDashboard() {
        updateBadgesAndMetrics();
        renderVaultItems();
    }

    function updateBadgesAndMetrics() {
        const total = vaultItems.length;
        const logins = vaultItems.filter(i => i.category === 'logins').length;
        const cards = vaultItems.filter(i => i.category === 'cards').length;
        const notes = vaultItems.filter(i => i.category === 'notes').length;
        const favorites = vaultItems.filter(i => i.favorite).length;

        badgeTotalCount.textContent = total;
        badgeLoginsCount.textContent = logins;
        badgeCardsCount.textContent = cards;
        badgeNotesCount.textContent = notes;
        badgeFavoritesCount.textContent = favorites;

        metricTotalItems.textContent = total;

        // Health Score & Weak Items calculation
        let weakCount = 0;
        let totalScore = 0;

        vaultItems.forEach(item => {
            if (item.password) {
                const entropy = calculateEntropy(item.password);
                if (entropy < 60 || item.password.length < 12) {
                    weakCount++;
                }
                totalScore += Math.min(100, Math.floor((entropy / 90) * 100));
            } else {
                totalScore += 80;
            }
        });

        const overallHealth = total > 0 ? Math.round(totalScore / total) : 100;
        metricVaultScore.textContent = overallHealth + '%';
        metricWeakCount.textContent = weakCount;
    }

    function renderVaultItems() {
        vaultItemsContainer.innerHTML = '';

        // Filter by Tab
        let filtered = vaultItems.filter(item => {
            if (activeTab === 'all-items') return true;
            if (activeTab === 'favorites') return item.favorite;
            return item.category === activeTab;
        });

        // Filter by Search Query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(item => {
                return (
                    (item.title && item.title.toLowerCase().includes(q)) ||
                    (item.username && item.username.toLowerCase().includes(q)) ||
                    (item.url && item.url.toLowerCase().includes(q)) ||
                    (item.notes && item.notes.toLowerCase().includes(q))
                );
            });
        }

        // Filter Weak Passwords
        if (filterOnlyWeak) {
            filtered = filtered.filter(item => {
                if (!item.password) return false;
                const entropy = calculateEntropy(item.password);
                return entropy < 60 || item.password.length < 12;
            });
        }

        // Sort
        filtered.sort((a, b) => {
            const tA = (a.title || '').toLowerCase();
            const tB = (b.title || '').toLowerCase();
            return sortAsc ? tA.localeCompare(tB) : tB.localeCompare(tA);
        });

        if (filtered.length === 0) {
            emptyState.classList.remove('hidden');
        } else {
            emptyState.classList.add('hidden');
            filtered.forEach(item => {
                const card = createItemCard(item);
                vaultItemsContainer.appendChild(card);
            });
        }
    }

    function createItemCard(item) {
        const card = document.createElement('div');
        card.className = 'vault-card';

        const categoryIconMap = {
            logins: 'fa-user-lock',
            cards: 'fa-credit-card',
            notes: 'fa-note-sticky'
        };

        const initial = (item.title || 'U').charAt(0).toUpperCase();

        card.innerHTML = `
            <div class="card-top">
                <div class="card-icon-title">
                    <div class="card-favicon">${initial}</div>
                    <div class="card-title-text">
                        <h4>${escapeHtml(item.title)}</h4>
                        ${item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener" class="card-url">${escapeHtml(item.url)}</a>` : ''}
                    </div>
                </div>
                <div class="card-actions">
                    <button class="btn-icon btn-star ${item.favorite ? 'starred' : ''}" title="Favorite">
                        <i class="fa-${item.favorite ? 'solid' : 'regular'} fa-star"></i>
                    </button>
                    <button class="btn-icon btn-edit" title="Edit">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-icon btn-delete" title="Delete">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
            </div>

            ${item.username ? `
                <div class="card-field">
                    <span class="card-field-val">${escapeHtml(item.username)}</span>
                    <button class="btn-icon btn-copy-user" title="Copy Username">
                        <i class="fa-solid fa-copy"></i>
                    </button>
                </div>
            ` : ''}

            ${item.password ? `
                <div class="card-field">
                    <span class="card-field-val card-pass-hidden" data-password="${escapeHtml(item.password)}">• • • • • • • • • •</span>
                    <div style="display:flex; gap:2px;">
                        <button class="btn-icon btn-toggle-card-pass" title="Show/Hide Password">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="btn-icon btn-copy-card-pass" title="Copy Password">
                            <i class="fa-solid fa-copy"></i>
                        </button>
                    </div>
                </div>
            ` : ''}

            ${item.notes ? `
                <div class="card-field">
                    <span class="card-field-val" style="font-style:italic; font-family:var(--font-sans);">${escapeHtml(item.notes.substring(0, 40))}${item.notes.length > 40 ? '...' : ''}</span>
                </div>
            ` : ''}

            <div class="card-bottom-actions">
                <span class="badge-tag"><i class="fa-solid ${categoryIconMap[item.category] || 'fa-key'}"></i> ${item.category}</span>
                <span style="font-size:0.72rem; color:var(--text-dim);">${new Date(item.updatedAt || Date.now()).toLocaleDateString()}</span>
            </div>
        `;

        // Card Button Event Handlers
        const btnStar = card.querySelector('.btn-star');
        btnStar.addEventListener('click', () => {
            item.favorite = !item.favorite;
            saveEncryptedVault();
        });

        const btnEdit = card.querySelector('.btn-edit');
        btnEdit.addEventListener('click', () => openEntryModal(item));

        const btnDelete = card.querySelector('.btn-delete');
        btnDelete.addEventListener('click', () => {
            if (confirm(`Delete vault item "${item.title}"?`)) {
                vaultItems = vaultItems.filter(i => i.id !== item.id);
                saveEncryptedVault();
                showToast('Item deleted.', 'info');
            }
        });

        const btnCopyUser = card.querySelector('.btn-copy-user');
        if (btnCopyUser) {
            btnCopyUser.addEventListener('click', () => {
                copyToClipboard(item.username, 'Username copied to clipboard!');
            });
        }

        const btnTogglePass = card.querySelector('.btn-toggle-card-pass');
        const passValSpan = card.querySelector('.card-pass-hidden');
        if (btnTogglePass && passValSpan) {
            btnTogglePass.addEventListener('click', () => {
                const isHidden = passValSpan.textContent.includes('•');
                if (isHidden) {
                    passValSpan.textContent = item.password;
                    btnTogglePass.innerHTML = '<i class="fa-solid fa-eye-slash"></i>';
                } else {
                    passValSpan.textContent = '• • • • • • • • • •';
                    btnTogglePass.innerHTML = '<i class="fa-solid fa-eye"></i>';
                }
            });
        }

        const btnCopyPass = card.querySelector('.btn-copy-card-pass');
        if (btnCopyPass) {
            btnCopyPass.addEventListener('click', () => {
                copyToClipboard(item.password, 'Password copied to clipboard!');
            });
        }

        return card;
    }

    // ==========================================
    // ENTRY CREATE / EDIT MODAL LOGIC
    // ==========================================

    function openEntryModal(item = null) {
        if (item) {
            document.getElementById('modal-entry-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Vault Item';
            entryIdInput.value = item.id;
            entryCategorySelect.value = item.category || 'logins';
            entryTitleInput.value = item.title || '';
            entryUsernameInput.value = item.username || '';
            entryUrlInput.value = item.url || '';
            entryPasswordInput.value = item.password || '';
            entryNotesInput.value = item.notes || '';
            entryFavoriteCheckbox.checked = !!item.favorite;
        } else {
            document.getElementById('modal-entry-title').innerHTML = '<i class="fa-solid fa-key"></i> Add Vault Item';
            entryForm.reset();
            entryIdInput.value = '';
            entryCategorySelect.value = activeTab !== 'all-items' && activeTab !== 'favorites' ? activeTab : 'logins';
        }
        updateEntryStrengthMeter();
        modalEntry.classList.remove('hidden');
    }

    entryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const id = entryIdInput.value || 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const newItem = {
            id: id,
            category: entryCategorySelect.value,
            title: entryTitleInput.value.trim(),
            username: entryUsernameInput.value.trim(),
            url: entryUrlInput.value.trim(),
            password: entryPasswordInput.value,
            notes: entryNotesInput.value.trim(),
            favorite: entryFavoriteCheckbox.checked,
            updatedAt: Date.now()
        };

        const existingIdx = vaultItems.findIndex(i => i.id === id);
        if (existingIdx >= 0) {
            vaultItems[existingIdx] = newItem;
        } else {
            vaultItems.push(newItem);
        }

        saveEncryptedVault();
        modalEntry.classList.add('hidden');
        showToast('Vault record saved and encrypted!', 'success');
    });

    entryPasswordInput.addEventListener('input', updateEntryStrengthMeter);

    function updateEntryStrengthMeter() {
        const val = entryPasswordInput.value;
        const entropy = calculateEntropy(val);
        let color = '#ff5252';
        let label = 'Weak';
        let width = '20%';

        if (val.length === 0) {
            width = '0%';
            label = 'Empty';
        } else if (entropy >= 80) {
            color = '#00e676';
            label = 'Very Strong (' + Math.round(entropy) + ' bits entropy)';
            width = '100%';
        } else if (entropy >= 60) {
            color = '#00c6ff';
            label = 'Strong (' + Math.round(entropy) + ' bits entropy)';
            width = '75%';
        } else if (entropy >= 40) {
            color = '#ffd600';
            label = 'Moderate (' + Math.round(entropy) + ' bits entropy)';
            width = '50%';
        } else {
            color = '#ff5252';
            label = 'Weak (' + Math.round(entropy) + ' bits entropy)';
            width = '25%';
        }

        entryStrengthBar.style.width = width;
        entryStrengthBar.style.backgroundColor = color;
        entryStrengthText.textContent = `Password Strength: ${label}`;
    }

    btnQuickGenerate.addEventListener('click', () => {
        const generated = generateCryptographicPassword(20, true, true, true, true, false);
        entryPasswordInput.value = generated;
        updateEntryStrengthMeter();
        showToast('Generated strong password!', 'info');
    });

    btnCopyEntryPass.addEventListener('click', () => {
        if (entryPasswordInput.value) {
            copyToClipboard(entryPasswordInput.value, 'Password copied to clipboard!');
        }
    });

    // ==========================================
    // CRYPTOGRAPHIC PASSWORD GENERATOR
    // ==========================================

    function generateCryptographicPassword(length, incUpper, incLower, incNum, incSym, excAmb) {
        let upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let lower = 'abcdefghijklmnopqrstuvwxyz';
        let numbers = '0123456789';
        let symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';

        if (excAmb) {
            upper = upper.replace(/[IO]/g, '');
            lower = lower.replace(/[l]/g, '');
            numbers = numbers.replace(/[01]/g, '');
        }

        let charset = '';
        if (incUpper) charset += upper;
        if (incLower) charset += lower;
        if (incNum) charset += numbers;
        if (incSym) charset += symbols;

        if (!charset) charset = lower + numbers;

        // Use SubtleCrypto CSPRNG
        const randomValues = new Uint32Array(length);
        window.crypto.getRandomValues(randomValues);

        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset[randomValues[i] % charset.length];
        }

        return result;
    }

    function calculateEntropy(password) {
        if (!password) return 0;
        let poolSize = 0;
        if (/[a-z]/.test(password)) poolSize += 26;
        if (/[A-Z]/.test(password)) poolSize += 26;
        if (/[0-9]/.test(password)) poolSize += 10;
        if (/[^a-zA-Z0-9]/.test(password)) poolSize += 32;

        if (poolSize === 0) poolSize = 26;
        return password.length * Math.log2(poolSize);
    }

    function estimateCrackTime(entropy) {
        // Assume 100 billion guesses per second (high-end GPU cluster)
        const guesses = Math.pow(2, entropy);
        const seconds = guesses / 1e11;

        if (seconds < 1) return 'Instant';
        if (seconds < 60) return `${Math.round(seconds)} seconds`;
        if (seconds < 3600) return `${Math.round(seconds / 60)} minutes`;
        if (seconds < 86400) return `${Math.round(seconds / 3600)} hours`;
        if (seconds < 31536000 * 30) return `${Math.round(seconds / 86400)} days`;
        if (seconds < 31536000 * 1000) return `${Math.round(seconds / 31536000)} years`;
        return 'Centuries';
    }

    function updateGeneratorUI() {
        const len = parseInt(genLengthRange.value, 10);
        genLengthVal.textContent = len;

        const pass = generateCryptographicPassword(
            len,
            genIncUpper.checked,
            genIncLower.checked,
            genIncNumbers.checked,
            genIncSymbols.checked,
            genExcAmbiguous.checked
        );

        genResultDisplay.textContent = pass;
        const entropy = calculateEntropy(pass);
        genEntropyLbl.textContent = `${Math.round(entropy)} bits`;
        genCrackTimeLbl.textContent = estimateCrackTime(entropy);

        if (entropy >= 80) genStrengthLbl.textContent = 'Very Strong';
        else if (entropy >= 60) genStrengthLbl.textContent = 'Strong';
        else if (entropy >= 40) genStrengthLbl.textContent = 'Moderate';
        else genStrengthLbl.textContent = 'Weak';
    }

    // Generator Event Listeners
    [genLengthRange, genIncUpper, genIncLower, genIncNumbers, genIncSymbols, genExcAmbiguous].forEach(el => {
        el.addEventListener('input', updateGeneratorUI);
    });

    btnGenRefresh.addEventListener('click', updateGeneratorUI);
    btnGenCopy.addEventListener('click', () => {
        copyToClipboard(genResultDisplay.textContent, 'Generated password copied!');
    });

    // ==========================================
    // VAULT HEALTH & STRENGTH ANALYZER
    // ==========================================

    function runVaultAnalyzer() {
        listAnalyzerWeak.innerHTML = '';
        listAnalyzerReused.innerHTML = '';

        const passMap = new Map();
        const weakList = [];
        const reusedList = [];

        vaultItems.forEach(item => {
            if (!item.password) return;
            const entropy = calculateEntropy(item.password);

            if (entropy < 60 || item.password.length < 12) {
                weakList.push(item);
            }

            if (passMap.has(item.password)) {
                passMap.get(item.password).push(item);
            } else {
                passMap.set(item.password, [item]);
            }
        });

        passMap.forEach((items) => {
            if (items.length > 1) {
                items.forEach(i => reusedList.push(i));
            }
        });

        // Weak List Render
        analyzerWeakCnt.textContent = weakList.length;
        if (weakList.length === 0) {
            listAnalyzerWeak.innerHTML = '<li style="color:var(--accent);">All passwords meet security threshold!</li>';
        } else {
            weakList.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<span><strong>${escapeHtml(item.title)}</strong> (${item.password.length} chars)</span> <button class="btn-link btn-fix">Fix</button>`;
                li.querySelector('.btn-fix').addEventListener('click', () => {
                    modalAnalyzer.classList.add('hidden');
                    openEntryModal(item);
                });
                listAnalyzerWeak.appendChild(li);
            });
        }

        // Reused List Render
        analyzerReusedCnt.textContent = reusedList.length;
        if (reusedList.length === 0) {
            listAnalyzerReused.innerHTML = '<li style="color:var(--accent);">No reused passwords detected!</li>';
        } else {
            reusedList.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<span><strong>${escapeHtml(item.title)}</strong> (${escapeHtml(item.username)})</span> <button class="btn-link btn-fix">Fix</button>`;
                li.querySelector('.btn-fix').addEventListener('click', () => {
                    modalAnalyzer.classList.add('hidden');
                    openEntryModal(item);
                });
                listAnalyzerReused.appendChild(li);
            });
        }

        // Calculate score
        let total = vaultItems.length;
        let penalty = (weakList.length * 15) + (reusedList.length * 10);
        let score = Math.max(0, 100 - penalty);

        analyzerScoreNum.textContent = score + '%';
        if (score > 85) {
            analyzerVerdictTitle.textContent = 'Excellent Vault Security';
            analyzerVerdictDesc = 'Your credentials are highly robust with strong entropy.';
        } else if (score > 60) {
            analyzerVerdictTitle.textContent = 'Moderate Protection Level';
            analyzerVerdictDesc = 'Consider updating weak or reused passwords.';
        } else {
            analyzerVerdictTitle.textContent = 'Vulnerable Credentials Detected';
            analyzerVerdictDesc = 'Action recommended: Update highlighted accounts immediately.';
        }

        modalAnalyzer.classList.remove('hidden');
    }

    // ==========================================
    // BACKUP IMPORT / EXPORT (ENCRYPTED JSON)
    // ==========================================

    btnDoExport.addEventListener('click', async () => {
        if (!currentMasterKey || vaultItems.length === 0) {
            showToast('No records available to export.', 'error');
            return;
        }

        try {
            const verifyRecord = JSON.parse(localStorage.getItem(STORAGE_VERIFY_KEY));
            const encryptedVault = await encryptObject(currentMasterKey, vaultItems);

            const exportPayload = {
                generator: 'AEGISVAULT_WEBCRYPTO_v1',
                timestamp: new Date().toISOString(),
                salt: verifyRecord.salt,
                iterations: verifyRecord.iterations,
                verification: {
                    iv: verifyRecord.iv,
                    ciphertext: verifyRecord.ciphertext
                },
                vault: {
                    iv: encryptedVault.iv,
                    ciphertext: encryptedVault.ciphertext
                }
            };

            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', dataStr);
            downloadAnchor.setAttribute('download', `aegis_vault_backup_${Date.now()}.vault.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();

            showToast('Encrypted vault exported successfully!', 'success');
            modalBackup.classList.add('hidden');
        } catch (err) {
            console.error('Export failed:', err);
            showToast('Export failed!', 'error');
        }
    });

    btnTriggerImportFile.addEventListener('click', () => fileImportInput.click());
    btnImportAuth.addEventListener('click', () => {
        modalBackup.classList.remove('hidden');
    });

    fileImportInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (!importedData.verification || !importedData.vault) {
                    showToast('Invalid backup file structure.', 'error');
                    return;
                }

                // If currently unlocked with master key
                if (currentMasterKey) {
                    // Decrypt imported vault
                    const importedVaultItems = await decryptObject(
                        currentMasterKey,
                        importedData.vault.iv,
                        importedData.vault.ciphertext
                    );

                    if (Array.isArray(importedVaultItems)) {
                        // Merge vault items
                        const existingIds = new Set(vaultItems.map(i => i.id));
                        let addedCount = 0;

                        importedVaultItems.forEach(item => {
                            if (!existingIds.has(item.id)) {
                                vaultItems.push(item);
                                addedCount++;
                            }
                        });

                        saveEncryptedVault();
                        showToast(`Restored & merged ${addedCount} records!`, 'success');
                        modalBackup.classList.add('hidden');
                    }
                } else {
                    // If at lock screen, ask user for master password used in backup
                    const pass = prompt('Enter the Master Password for this backup file:');
                    if (!pass) return;

                    const key = await deriveMasterKey(pass, importedData.salt, importedData.iterations);
                    const verifyPayload = await decryptObject(key, importedData.verification.iv, importedData.verification.ciphertext);

                    if (verifyPayload && verifyPayload.payload === VERIFY_STRING) {
                        localStorage.setItem(STORAGE_VERIFY_KEY, JSON.stringify({
                            salt: importedData.salt,
                            iterations: importedData.iterations,
                            iv: importedData.verification.iv,
                            ciphertext: importedData.verification.ciphertext
                        }));

                        localStorage.setItem(STORAGE_VAULT_KEY, JSON.stringify({
                            iv: importedData.vault.iv,
                            ciphertext: importedData.vault.ciphertext
                        }));

                        currentMasterKey = key;
                        await loadEncryptedVault();
                        unlockVault();
                        modalBackup.classList.add('hidden');
                        showToast('Encrypted vault restored and unlocked!', 'success');
                    } else {
                        showToast('Failed to decrypt backup! Wrong master password.', 'error');
                    }
                }
            } catch (err) {
                console.error(err);
                showToast('Failed to parse backup file.', 'error');
            }
        };
        reader.readAsText(file);
    });

    // ==========================================
    // AUTO-LOCK INACTIVITY TIMER
    // ==========================================

    function startAutoLockTimer() {
        stopAutoLockTimer();
        remainingLockSeconds = autoLockSeconds;
        updateTimerDisplay();

        if (autoLockSeconds > 0) {
            autoLockInterval = setInterval(() => {
                remainingLockSeconds--;
                updateTimerDisplay();

                if (remainingLockSeconds <= 0) {
                    lockVault();
                }
            }, 1000);
        }
    }

    function stopAutoLockTimer() {
        if (autoLockInterval) {
            clearInterval(autoLockInterval);
            autoLockInterval = null;
        }
    }

    function resetActivityTimer() {
        if (currentMasterKey && autoLockSeconds > 0) {
            remainingLockSeconds = autoLockSeconds;
            updateTimerDisplay();
        }
    }

    function updateTimerDisplay() {
        if (autoLockSeconds === 0) {
            autolockTimerDisplay.textContent = 'OFF';
            return;
        }
        const m = Math.floor(remainingLockSeconds / 60).toString().padStart(2, '0');
        const s = (remainingLockSeconds % 60).toString().padStart(2, '0');
        autolockTimerDisplay.textContent = `${m}:${s}`;
    }

    autolockSelect.addEventListener('change', () => {
        autoLockSeconds = parseInt(autolockSelect.value, 10);
        startAutoLockTimer();
    });

    btnExtendSession.addEventListener('click', () => {
        resetActivityTimer();
        showToast('Auto-lock timer reset.', 'info');
    });

    // User Activity Listeners
    ['mousemove', 'keydown', 'click'].forEach(evt => {
        window.addEventListener(evt, resetActivityTimer);
    });

    // ==========================================
    // UTILITIES & EVENT LISTENERS
    // ==========================================

    function setupEventListeners() {
        // Toggle Password Inputs (Eye icon)
        document.querySelectorAll('.toggle-pass-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.getAttribute('data-target');
                const input = document.getElementById(targetId);
                if (input) {
                    const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
                    input.setAttribute('type', type);
                    btn.innerHTML = `<i class="fa-solid fa-${type === 'password' ? 'eye' : 'eye-slash'}"></i>`;
                }
            });
        });

        // Setup password strength live listener
        setupPassInput.addEventListener('input', () => {
            const entropy = calculateEntropy(setupPassInput.value);
            let pct = Math.min(100, Math.round((entropy / 80) * 100));
            setupStrengthBar.style.width = pct + '%';
            setupStrengthBar.style.backgroundColor = pct > 75 ? '#00e676' : pct > 45 ? '#ffd600' : '#ff5252';
        });

        // Nav Tabs
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                activeTab = item.getAttribute('data-tab');
                currentTabTitle.textContent = item.innerText.replace(/[0-9]/g, '').trim();
                renderVaultItems();
            });
        });

        // Search Input
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            if (searchQuery) clearSearchBtn.classList.remove('hidden');
            else clearSearchBtn.classList.add('hidden');
            renderVaultItems();
        });

        clearSearchBtn.addEventListener('click', () => {
            searchInput.value = '';
            searchQuery = '';
            clearSearchBtn.classList.add('hidden');
            renderVaultItems();
        });

        // Keyboard Shortcut Ctrl+K for search
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                searchInput.focus();
            }
        });

        // New Item Triggers
        btnNewEntry.addEventListener('click', () => openEntryModal());
        document.querySelector('.btn-trigger-new').addEventListener('click', () => openEntryModal());

        // Modal Close Buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                btn.closest('.modal-overlay').classList.add('hidden');
            });
        });

        // Open Modal Tool Buttons
        navBtnGenerator.addEventListener('click', () => {
            updateGeneratorUI();
            modalGenerator.classList.remove('hidden');
        });

        navBtnAnalyzer.addEventListener('click', () => runVaultAnalyzer());
        navBtnExport.addEventListener('click', () => modalBackup.classList.remove('hidden'));

        // Sort Title
        btnSortTitle.addEventListener('click', () => {
            sortAsc = !sortAsc;
            btnSortTitle.classList.toggle('active', !sortAsc);
            renderVaultItems();
        });

        // Filter Weak
        btnFilterWeak.addEventListener('click', () => {
            filterOnlyWeak = !filterOnlyWeak;
            btnFilterWeak.classList.toggle('active', filterOnlyWeak);
            renderVaultItems();
        });
    }

    function copyToClipboard(text, message = 'Copied to clipboard!') {
        if (!navigator.clipboard) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            textarea.remove();
            showToast(message, 'info');
            return;
        }

        navigator.clipboard.writeText(text).then(() => {
            showToast(message, 'info');
        }).catch(err => {
            console.error('Copy failed:', err);
            showToast('Failed to copy text.', 'error');
        });
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const iconMap = {
            success: 'fa-circle-check',
            error: 'fa-triangle-exclamation',
            info: 'fa-circle-info'
        };
        toast.innerHTML = `<i class="fa-solid ${iconMap[type]}"></i> <span>${escapeHtml(message)}</span>`;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initialize Application
    document.addEventListener('DOMContentLoaded', initApp);

})();
