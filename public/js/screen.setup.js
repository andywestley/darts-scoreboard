window.DartsApp = window.DartsApp || {};

window.DartsApp.initSetupScreen = function() {
    const { postAction, showScreen, initGameScreen, escapeHTML } = window.DartsApp;
    let setupPlayers = []; // Client-side state for the setup screen

    const addPlayerBtn = document.getElementById('addPlayerBtn');
    const newPlayerNameInput = document.getElementById('newPlayerName');
    const playerListDiv = document.getElementById('playerList');
    const startGameBtn = document.getElementById('startGameBtn');

    if (addPlayerBtn.dataset.initialized) return; // Prevent re-attaching listeners

    function updatePlayerList(players) {
        console.log('[updatePlayerList] Rendering player list:', players);
        playerListDiv.innerHTML = players.map(playerName => `
            <div class="player-tag">
                <span class="player-tag__name">${escapeHTML(playerName)}</span>
                <span class="player-tag__remove-btn" data-name="${escapeHTML(playerName)}">×</span>
            </div>
        `).join('');
    }

    async function handleAddPlayer() {
        const name = newPlayerNameInput.value.trim();
        if (name) {
            console.log(`[handleAddPlayer] Attempting to add player: '${name}'`);
            await postAction('player:persist', { playerName: name });

            if (!setupPlayers.includes(name)) {
                setupPlayers.push(name);
                updatePlayerList(setupPlayers);
            }
            newPlayerNameInput.value = '';
            newPlayerNameInput.focus();
        }
    }

    function handleRemovePlayer(name) {
        setupPlayers = setupPlayers.filter(p => p !== name);
        updatePlayerList(setupPlayers);
    }

    addPlayerBtn.addEventListener('click', handleAddPlayer);
    newPlayerNameInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') handleAddPlayer();
    });

    playerListDiv.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('player-tag__remove-btn')) {
            const name = e.target.dataset.name;
            console.log(`[playerListDiv.click] Attempting to remove player: '${name}'`);
            handleRemovePlayer(name);
        }
    });

    startGameBtn.addEventListener('click', async () => {
        console.log('[startGameBtn.click] Attempting to start game...');
        if (setupPlayers.length === 0) {
            alert('Please add at least one player to start a game.');
            return;
        }
        const res = await postAction('game:start', {
            gameType: document.getElementById('gameType').value,
            matchLegs: document.getElementById('matchLegs').value,
            checkoutAssistantToggle: document.getElementById('checkoutAssistantToggle').checked,
            soundEffectsToggle: document.getElementById('soundEffectsToggle').checked,
            players: JSON.stringify(setupPlayers)
        });
        console.log('[startGameBtn.click] Received response:', res);

        if (res.success && res.match) {
            initGameScreen(res.match);
            showScreen('gameScreen');
        } else {
            alert(`Error starting game: ${res.message || 'An unknown error occurred.'}`);
        }
    });

    addPlayerBtn.dataset.initialized = 'true';
    updatePlayerList(setupPlayers);
};