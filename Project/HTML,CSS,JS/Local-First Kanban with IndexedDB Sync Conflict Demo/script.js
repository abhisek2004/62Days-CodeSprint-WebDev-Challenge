(function() {
    'use strict';

    // ----- DOM refs -----
    const boardsContainer = document.getElementById('boardsContainer');
    const boardNameInput = document.getElementById('boardNameInput');
    const addBoardBtn = document.getElementById('addBoardBtn');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const syncBtn = document.getElementById('syncBtn');
    const conflictBtn = document.getElementById('conflictBtn');
    const statusText = document.getElementById('statusText');
    const statusDetail = document.getElementById('statusDetail');
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    // Conflict Modal
    const conflictModal = document.getElementById('conflictModal');
    const closeConflictModal = document.getElementById('closeConflictModal');
    const localCard = document.getElementById('localCard');
    const remoteCard = document.getElementById('remoteCard');
    const chooseLocalBtn = document.getElementById('chooseLocalBtn');
    const chooseRemoteBtn = document.getElementById('chooseRemoteBtn');
    const mergeTitle = document.getElementById('mergeTitle');
    const mergeDesc = document.getElementById('mergeDesc');
    const mergeStatus = document.getElementById('mergeStatus');
    const mergeBtn = document.getElementById('mergeBtn');

    // Add Card Modal
    const addCardModal = document.getElementById('addCardModal');
    const closeAddCardModal = document.getElementById('closeAddCardModal');
    const cardTitleInput = document.getElementById('cardTitleInput');
    const cardDescInput = document.getElementById('cardDescInput');
    const cardStatusInput = document.getElementById('cardStatusInput');
    const addCardBtn = document.getElementById('addCardBtn');

    // ----- State -----
    let boards = [];
    let currentBoardId = null;
    let conflictData = null;
    let pendingAddCardBoardId = null;

    // ----- Theme -----
    function setTheme(dark) {
        document.body.classList.toggle('dark', dark);
        themeIcon.textContent = dark ? '☀️' : '🌙';
        themeLabel.textContent = dark ? 'Light' : 'Dark';
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        setTheme(!isDark);
    });

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme(true);
    }

    // ----- IndexedDB -----
    const DB_NAME = 'LocalKanbanDB';
    const STORE_NAME = 'boards';
    let db = null;

    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                }
            };
            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };
            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    function loadFromDB() {
        return new Promise((resolve, reject) => {
            if (!db) {
                resolve([]);
                return;
            }
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => {
                resolve(request.result || []);
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    function saveToDB(data) {
        return new Promise((resolve, reject) => {
            if (!db) {
                reject(new Error('DB not open'));
                return;
            }
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            request.onsuccess = () => {
                data.forEach(item => {
                    store.add(item);
                });
                resolve();
            };
            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    // ----- Initialize -----
    async function init() {
        try {
            await openDB();
            const data = await loadFromDB();
            boards = data.length > 0 ? data : getDefaultBoards();
            renderBoards();
            updateStatus('✅ Ready', 'Data loaded from IndexedDB');
        } catch (err) {
            console.error('Failed to initialize:', err);
            boards = getDefaultBoards();
            renderBoards();
            updateStatus('⚠️ Using memory storage', 'IndexedDB unavailable');
        }
    }

    function getDefaultBoards() {
        return [
            {
                id: 'board_1',
                name: 'Learning DSA',
                cards: [
                    { id: 'card_1', title: 'Study Arrays', description: 'Review array operations', status: 'todo' },
                    { id: 'card_2', title: 'Practice Linked Lists', description: 'Implement from scratch', status: 'in-progress' },
                    { id: 'card_3', title: 'Complete Trees Module', description: 'BST and traversal', status: 'done' }
                ]
            },
            {
                id: 'board_2',
                name: 'Project Tasks',
                cards: [
                    { id: 'card_4', title: 'Setup IndexedDB', description: 'Local-first storage', status: 'done' },
                    { id: 'card_5', title: 'Build Kanban UI', description: 'Drag and drop', status: 'in-progress' }
                ]
            }
        ];
    }

    // ----- Persist -----
    async function persist() {
        try {
            await saveToDB(boards);
            updateStatus('✅ Saved', 'Data persisted to IndexedDB');
        } catch (err) {
            console.error('Failed to persist:', err);
            updateStatus('⚠️ Save failed', 'Check console for details');
        }
    }

    // ----- Render -----
    function renderBoards() {
        if (boards.length === 0) {
            boardsContainer.innerHTML = '<div class="empty-state">No boards yet. Create your first board above!</div>';
            return;
        }

        let html = '';
        boards.forEach(board => {
            const todoCards = board.cards.filter(c => c.status === 'todo');
            const inProgressCards = board.cards.filter(c => c.status === 'in-progress');
            const doneCards = board.cards.filter(c => c.status === 'done');

            html += `
                <div class="board" data-board-id="${board.id}">
                    <div class="board-header">
                        <span class="board-title">📋 ${board.name}</span>
                        <div class="board-actions">
                            <button class="btn-add-card-board" data-board-id="${board.id}">➕ Add Card</button>
                            <button class="btn-delete-board" data-board-id="${board.id}">🗑️ Delete</button>
                        </div>
                    </div>
                    <div class="board-columns">
                        <div class="column" data-status="todo">
                            <div class="column-header">To Do <span class="card-count">(${todoCards.length})</span></div>
                            ${renderCards(todoCards)}
                        </div>
                        <div class="column" data-status="in-progress">
                            <div class="column-header">In Progress <span class="card-count">(${inProgressCards.length})</span></div>
                            ${renderCards(inProgressCards)}
                        </div>
                        <div class="column" data-status="done">
                            <div class="column-header">Done <span class="card-count">(${doneCards.length})</span></div>
                            ${renderCards(doneCards)}
                        </div>
                    </div>
                </div>
            `;
        });

        boardsContainer.innerHTML = html;

        // Add event listeners
        document.querySelectorAll('.btn-delete-board').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.boardId;
                deleteBoard(id);
            });
        });

        document.querySelectorAll('.btn-add-card-board').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.boardId;
                showAddCardModal(id);
            });
        });

        document.querySelectorAll('.btn-edit-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const boardId = btn.dataset.boardId;
                const cardId = btn.dataset.cardId;
                editCard(boardId, cardId);
            });
        });

        document.querySelectorAll('.btn-delete-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const boardId = btn.dataset.boardId;
                const cardId = btn.dataset.cardId;
                deleteCard(boardId, cardId);
            });
        });

        document.querySelectorAll('.btn-move-card').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const boardId = btn.dataset.boardId;
                const cardId = btn.dataset.cardId;
                moveCard(boardId, cardId);
            });
        });
    }

    function renderCards(cards) {
        if (cards.length === 0) {
            return '<div style="padding:0.5rem;text-align:center;opacity:0.3;font-size:0.8rem;">No cards</div>';
        }

        let html = '';
        cards.forEach(card => {
            const statusClass = `status-${card.status}`;
            const conflictClass = card._conflict ? 'conflict' : '';
            html += `
                <div class="card ${conflictClass}" data-card-id="${card.id}">
                    <span class="card-status-badge ${statusClass}">${card.status}</span>
                    <div class="card-title">${card.title}</div>
                    ${card.description ? `<div class="card-desc">${card.description}</div>` : ''}
                    <div class="card-actions">
                        <button class="btn-edit-card" data-board-id="${card._boardId}" data-card-id="${card.id}">✏️ Edit</button>
                        <button class="btn-delete-card" data-board-id="${card._boardId}" data-card-id="${card.id}">🗑️</button>
                        <button class="btn-move-card" data-board-id="${card._boardId}" data-card-id="${card.id}">↔️ Move</button>
                    </div>
                </div>
            `;
        });
        return html;
    }

    // ----- Board CRUD -----
    function addBoard() {
        const name = boardNameInput.value.trim();
        if (!name) {
            updateStatus('⚠️ Please enter a board name', '');
            return;
        }

        const newBoard = {
            id: 'board_' + Date.now(),
            name: name,
            cards: []
        };

        boards.push(newBoard);
        boardNameInput.value = '';
        renderBoards();
        persist();
        updateStatus('✅ Board created', `"${name}" added`);
    }

    function deleteBoard(id) {
        if (!confirm('Delete this board and all its cards?')) return;
        boards = boards.filter(b => b.id !== id);
        renderBoards();
        persist();
        updateStatus('🗑️ Board deleted', '');
    }

    // ----- Card CRUD -----
    function showAddCardModal(boardId) {
        pendingAddCardBoardId = boardId;
        cardTitleInput.value = '';
        cardDescInput.value = '';
        cardStatusInput.value = 'todo';
        addCardModal.style.display = 'flex';
    }

    function addCard() {
        const title = cardTitleInput.value.trim();
        if (!title) {
            updateStatus('⚠️ Please enter a card title', '');
            return;
        }

        const board = boards.find(b => b.id === pendingAddCardBoardId);
        if (!board) {
            updateStatus('⚠️ Board not found', '');
            return;
        }

        const newCard = {
            id: 'card_' + Date.now(),
            title: title,
            description: cardDescInput.value.trim(),
            status: cardStatusInput.value,
            _boardId: board.id
        };

        board.cards.push(newCard);
        addCardModal.style.display = 'none';
        renderBoards();
        persist();
        updateStatus('✅ Card added', `"${title}" added to ${board.name}`);
    }

    function deleteCard(boardId, cardId) {
        if (!confirm('Delete this card?')) return;
        const board = boards.find(b => b.id === boardId);
        if (board) {
            board.cards = board.cards.filter(c => c.id !== cardId);
            renderBoards();
            persist();
            updateStatus('🗑️ Card deleted', '');
        }
    }

    function editCard(boardId, cardId) {
        const board = boards.find(b => b.id === boardId);
        if (!board) return;
        const card = board.cards.find(c => c.id === cardId);
        if (!card) return;

        const newTitle = prompt('Edit card title:', card.title);
        if (newTitle === null) return;
        const newDesc = prompt('Edit description:', card.description || '');
        if (newDesc === null) return;

        card.title = newTitle.trim() || card.title;
        card.description = newDesc.trim();
        renderBoards();
        persist();
        updateStatus('✏️ Card updated', `"${card.title}"`);
    }

    function moveCard(boardId, cardId) {
        const board = boards.find(b => b.id === boardId);
        if (!board) return;
        const card = board.cards.find(c => c.id === cardId);
        if (!card) return;

        const statuses = ['todo', 'in-progress', 'done'];
        const currentIndex = statuses.indexOf(card.status);
        const nextIndex = (currentIndex + 1) % statuses.length;
        card.status = statuses[nextIndex];

        renderBoards();
        persist();
        updateStatus('↔️ Card moved', `"${card.title}" → ${card.status}`);
    }

    // ----- Conflict Simulation -----
    function simulateConflict() {
        // Find a card to create conflict for
        let targetCard = null;
        let targetBoard = null;

        for (const board of boards) {
            for (const card of board.cards) {
                if (!card._conflict) {
                    targetCard = card;
                    targetBoard = board;
                    break;
                }
            }
            if (targetCard) break;
        }

        if (!targetCard) {
            updateStatus('⚠️ No card available for conflict', 'Try creating a card first');
            return;
        }

        // Create local version (modified)
        const localVersion = {
            ...targetCard,
            title: targetCard.title + ' (local edit)',
            description: targetCard.description + ' - Modified locally',
            status: targetCard.status === 'done' ? 'todo' : 'done'
        };

        // Create remote version (different modification)
        const remoteVersion = {
            ...targetCard,
            title: targetCard.title + ' (remote edit)',
            description: targetCard.description + ' - Modified remotely',
            status: targetCard.status === 'todo' ? 'in-progress' : 'todo'
        };

        // Store conflict data
        conflictData = {
            boardId: targetBoard.id,
            cardId: targetCard.id,
            local: localVersion,
            remote: remoteVersion
        };

        // Mark card as in conflict
        targetCard._conflict = true;
        renderBoards();

        // Show conflict modal
        showConflictModal(localVersion, remoteVersion);

        updateStatus('⚡ Conflict detected!', 'Resolve using the modal');
    }

    function showConflictModal(local, remote) {
        // Populate local card
        localCard.innerHTML = `
            <div class="card-title">${local.title}</div>
            <div class="card-desc">${local.description || 'No description'}</div>
            <div class="card-status">Status: ${local.status}</div>
        `;

        // Populate remote card
        remoteCard.innerHTML = `
            <div class="card-title">${remote.title}</div>
            <div class="card-desc">${remote.description || 'No description'}</div>
            <div class="card-status">Status: ${remote.status}</div>
        `;

        // Populate merge fields
        mergeTitle.value = local.title;
        mergeDesc.value = local.description || '';
        mergeStatus.value = local.status;

        conflictModal.style.display = 'flex';
    }

    function resolveConflict(choice) {
        if (!conflictData) return;

        const board = boards.find(b => b.id === conflictData.boardId);
        if (!board) return;

        const cardIndex = board.cards.findIndex(c => c.id === conflictData.cardId);
        if (cardIndex === -1) return;

        let resolvedCard;

        if (choice === 'local') {
            resolvedCard = { ...conflictData.local };
        } else if (choice === 'remote') {
            resolvedCard = { ...conflictData.remote };
        } else if (choice === 'merge') {
            resolvedCard = {
                id: conflictData.cardId,
                title: mergeTitle.value.trim() || conflictData.local.title,
                description: mergeDesc.value.trim(),
                status: mergeStatus.value,
                _boardId: board.id
            };
        }

        resolvedCard._conflict = false;
        board.cards[cardIndex] = resolvedCard;

        conflictData = null;
        conflictModal.style.display = 'none';
        renderBoards();
        persist();
        updateStatus('✅ Conflict resolved', 'Card restored');
    }

    // ----- Sync Simulation -----
    function simulateSync() {
        updateStatus('🔄 Syncing...', 'Simulating sync process');
        
        // Simulate a sync delay
        setTimeout(() => {
            // Check for conflicts
            const hasConflict = boards.some(b => 
                b.cards.some(c => c._conflict)
            );

            if (hasConflict) {
                updateStatus('⚠️ Sync blocked', 'Conflicts detected! Resolve conflicts first.');
                return;
            }

            // Simulate a successful sync
            const timestamp = new Date().toLocaleTimeString();
            updateStatus('✅ Sync complete', `Last sync: ${timestamp}`);
            statusDetail.textContent = `Last sync: ${timestamp}`;
            
            // Add a sync log card to first board
            if (boards.length > 0) {
                const syncLog = {
                    id: 'sync_' + Date.now(),
                    title: '🔄 Sync Completed',
                    description: `Successful sync at ${timestamp}`,
                    status: 'done',
                    _boardId: boards[0].id
                };
                boards[0].cards.push(syncLog);
                renderBoards();
                persist();
            }
        }, 1000);
    }

    // ----- Clear all data -----
    function clearAllData() {
        if (!confirm('⚠️ This will delete ALL boards and cards. Are you sure?')) return;
        if (!confirm('⚠️ This action cannot be undone. Continue?')) return;

        boards = [];
        renderBoards();
        persist();
        updateStatus('🗑️ All data cleared', '');
    }

    // ----- Update status -----
    function updateStatus(text, detail) {
        statusText.textContent = text;
        if (detail) {
            statusDetail.textContent = detail;
        }
    }

    // ----- Event listeners -----
    addBoardBtn.addEventListener('click', addBoard);
    boardNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') addBoard();
    });

    clearAllBtn.addEventListener('click', clearAllData);
    syncBtn.addEventListener('click', simulateSync);
    conflictBtn.addEventListener('click', simulateConflict);

    // Conflict modal
    closeConflictModal.addEventListener('click', () => {
        conflictModal.style.display = 'none';
        // Remove conflict marker
        if (conflictData) {
            const board = boards.find(b => b.id === conflictData.boardId);
            if (board) {
                const card = board.cards.find(c => c.id === conflictData.cardId);
                if (card) card._conflict = false;
            }
            conflictData = null;
            renderBoards();
        }
    });

    chooseLocalBtn.addEventListener('click', () => resolveConflict('local'));
    chooseRemoteBtn.addEventListener('click', () => resolveConflict('remote'));
    mergeBtn.addEventListener('click', () => resolveConflict('merge'));

    // Add card modal
    closeAddCardModal.addEventListener('click', () => {
        addCardModal.style.display = 'none';
    });

    addCardBtn.addEventListener('click', addCard);

    // Close modals on backdrop click
    conflictModal.addEventListener('click', (e) => {
        if (e.target === conflictModal) {
            closeConflictModal.click();
        }
    });

    addCardModal.addEventListener('click', (e) => {
        if (e.target === addCardModal) {
            closeAddCardModal.click();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (conflictModal.style.display === 'flex') closeConflictModal.click();
            if (addCardModal.style.display === 'flex') closeAddCardModal.click();
        }
    });

    // ----- Expose for debugging -----
    window.__Kanban = {
        boards,
        addBoard,
        deleteBoard,
        addCard,
        deleteCard,
        editCard,
        moveCard,
        simulateConflict,
        simulateSync,
        clearAllData,
        persist
    };

    // ----- Start -----
    init();

    console.log('📋 Local-First Kanban initialized!');
    console.log('💡 Use "Simulate Sync" and "Trigger Conflict" to learn about local-first sync.');
})();