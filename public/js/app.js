document.addEventListener('DOMContentLoaded', async function() {
    // --- Globals ---
    const initialStateElement = document.getElementById('initial-state-data');
    const initialMatchState = initialStateElement ? JSON.parse(initialStateElement.textContent || 'null') : null;

    let jwtToken = null;
    let currentThrow = { base: null, multiplier: 1 };
    let soundSettings = { useSoundEffects: true };
    let setupPlayers = []; // Client-side state for the setup screen
    let previousMatchState = null; // To detect leg wins

    // --- JWT Management ---
    async function initializeAuth() {
        console.log('[initializeAuth] Starting authentication process...');
        jwtToken = localStorage.getItem('darts_jwt');
        if (!jwtToken) {
            // If we don't have a token, get one from the server.
            try {
                const response = await fetch('index.php', {
                    method: 'POST',
                    headers: { 'X-Action': 'auth:getToken' }
                });
                const data = await response.json();
                if (data.success && data.token) {
                    jwtToken = data.token;
                    localStorage.setItem('darts_jwt', jwtToken);
                    console.log('[initializeAuth] New JWT fetched and stored.');
                }
            } catch (e) {
                console.error("Could not fetch auth token.", e);
                alert("Authentication failed. Please refresh.");
            }
        } else {
            console.log('[initializeAuth] JWT found in localStorage.');
        }
    }

    // --- Helper Functions ---
    async function postAction(action, data = {}) {
        // The JWT is now our authorization mechanism, replacing the CSRF token.
        if (!jwtToken) throw new Error("Authentication token is missing.");
        const formData = new FormData();
        for (const key in data) {
            formData.append(key, data[key]);
        }

        console.log(`[postAction] Sending action: '${action}' with data:`, data);

        try {
            const response = await fetch('index.php', {
                method: 'POST',
                headers: {
                    'X-Action': action,
                    'Authorization': `Bearer ${jwtToken}`
                },
                body: formData,
            });

            console.log(`[postAction] Received response with status: ${response.status}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const responseData = await response.json();
            console.log('[postAction] Parsed response data:', responseData);
            return responseData;
        } catch (error) {
            console.error('Error posting action:', error);
            alert('An error occurred. Please check the console and refresh the page.');
            return { success: false };
        }
    }

    await initializeAuth(); // Ensure we have a token before doing anything else.

    function showScreen(screenId) {
        console.log(`[showScreen] Activating screen: '${screenId}'`);
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            // Initialize the screen's logic only when it becomes active
            if (screenId === 'setupScreen') initSetupScreen();
            // Game screen is now initialized dynamically, not on page load
            if (screenId === 'statsScreen') initStatsScreen();
            if (screenId === 'matchHistoryScreen') initMatchHistoryScreen();
            if (screenId === 'matchSummaryScreen' && initialMatchState) showMatchSummary(initialMatchState);
        }
    }

    function playSound(soundId) {
        if (!soundSettings.useSoundEffects) return;
        console.log(`[playSound] Attempting to play sound: '${soundId}'`);
        const sound = document.getElementById(soundId);
        if (sound && sound.dataset.failed !== 'true') {
            sound.currentTime = 0;
            const playPromise = sound.play();
            if (playPromise !== undefined) {
                playPromise.catch(error => {
                    console.error(`Could not play sound '${soundId}'. It will be disabled.`, error);
                    sound.dataset.failed = 'true';
                });
            }
        }
    }

    async function handleReset() {
        console.log('[handleReset] Attempting to reset game...');
        if (confirm('Are you sure you want to start a new game? All progress will be lost.')) {
            const res = await postAction('session:reset');
            if (res.success) {
                console.log('[handleReset] Reset successful, reloading.');
                window.location.reload();
            }
        }
    }

    // --- Setup Screen Logic ---
    // Fetches and renders the list of players in the current setup session.

    async function handleAddPlayer() {
        const newPlayerNameInput = document.getElementById('newPlayerName');
        const name = newPlayerNameInput.value.trim();
        if (name) {
            console.log(`[handleAddPlayer] Attempting to add player: '${name}'`);
            // Add player to permanent storage, but manage setup list on the client
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

    function updatePlayerList(players) {
        const playerListDiv = document.getElementById('playerList');
        console.log('[updatePlayerList] Rendering player list:', players);
        playerListDiv.innerHTML = players.map(playerName => `
            <div class="player-tag">
                <span class="player-tag__name">${escapeHTML(playerName)}</span>
                <span class="player-tag__remove-btn" data-name="${escapeHTML(playerName)}">×</span>
            </div>
        `).join('');
    }

    function initSetupScreen() {
        const addPlayerBtn = document.getElementById('addPlayerBtn');
        const newPlayerNameInput = document.getElementById('newPlayerName');
        const playerListDiv = document.getElementById('playerList');
        const startGameBtn = document.getElementById('startGameBtn');

        if (addPlayerBtn.dataset.initialized) return; // Prevent re-attaching listeners

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
                players: JSON.stringify(setupPlayers) // Send the player list to the server
            });
            console.log('[startGameBtn.click] Received response:', res);
            console.log('%c[startGameBtn.click] Match object from server:', 'color: orange; font-weight: bold;', res.match);

            if (res.success && res.match) {
                // Instead of reloading, initialize the game screen with the new match state
                initGameScreen(res.match);
                showScreen('gameScreen');
            } else {
                alert(`Error starting game: ${res.message || 'An unknown error occurred.'}`);
            }
        });

        addPlayerBtn.dataset.initialized = 'true';
        // Initial load of players in setup
        updatePlayerList(setupPlayers);
    }

    // --- Game Screen Logic ---
    function initGameScreen(match) {
        const gameScreen = document.getElementById('gameScreen');
        const keypad = gameScreen.querySelector('.dartboard-keypad');
        const modDouble = document.getElementById('modDouble');
        const modTreble = document.getElementById('modTreble');
        const inputDisplay = document.getElementById('inputDisplay');
        const undoBtn = document.getElementById('undoBtn');
        const nextLegBtn = document.getElementById('nextLegBtn');
    
        // --- Execution starts here ---
        updateGameUI(match); // Always update the UI with the new match state FIRST.

        // This function updates the UI without a page reload.
        function updateGameUI(match) {
            console.log('%c[updateGameUI] Entry Point', 'color: green; font-weight: bold;', 'Rendering with match object:', match);

            // --- DEBUGGING: Add a strong guard clause ---
            if (!match || !match.players || !match.players.length) {
                console.error('[updateGameUI] ABORTING RENDER: Match object is invalid or has no players.', match);
                alert("Debug: updateGameUI was called with invalid data. See console for details.");
                return;
            }
    
            const player = match.players[match.currentPlayerIndex] || {};
            const scoreControls = document.querySelector('.controls');
            const winModal = document.getElementById('winModal');

            console.log('[updateGameUI] Hiding modal and showing score input by default.');
    
            // Update Header
            const matchScore = match.players.map(p => `${p.name.split(' ')[0]} (${p.legsWon})`).join(' - ');
            document.getElementById('legDisplay').innerText = `Leg ${match.currentLeg} | ${matchScore}`;
    
            // Update Active Player Display
            document.getElementById('activeName').innerText = player.name;
            console.log('[updateGameUI] Current player object:', player);
            document.getElementById('activeScore').innerText = player.score;
            const totalPointsScored = (match.gameType - player.score);
            const legAvg = player.dartsThrown > 0 ? (totalPointsScored / player.dartsThrown * 3).toFixed(2) : '0.00';
            document.getElementById('activeAvg').innerText = `Avg: ${legAvg}`;
    
            // Update Checkout Hint
            try {
                if (match.checkoutAssistant) {
                    document.getElementById('checkoutHint').innerText = getCheckoutGuide(player.score);
                } else {
                    document.getElementById('checkoutHint').innerText = "";
                }
            } catch (e) {
                console.error("Failed to render checkout hint. Continuing UI update.", e);
                document.getElementById('checkoutHint').innerText = ""; // Ensure it's cleared on error
            }
    
            // This UI element is not currently supported by the backend state.
            document.getElementById('dartsThrownDisplay').innerHTML = '';
    
            // Update Leaderboard (using BEM classes)
            try {
                const leaderboardElement = document.getElementById('leaderboard');
                leaderboardElement.innerHTML = match.players.map((p, index) => {
                    const pTotalPoints = (match.gameType - p.score);
                    const pLegAvg = p.dartsThrown > 0 ? (pTotalPoints / p.dartsThrown * 3).toFixed(2) : '0.00';
                    return `
                        <div class="player-card ${index === match.currentPlayerIndex ? 'player-card--active' : ''}">
                            <span class="player-card__name">${p.name}</span>
                            <span class="player-card__score">${p.score}</span>
                            <span class="player-card__avg">Avg: ${pLegAvg}</span>
                        </div>
                    `;
                }).join('');
            } catch (e) {
                console.error("Failed to render leaderboard. Continuing UI update.", e);
            }
    
            // Update sound settings from the server state
            soundSettings.useSoundEffects = match.soundEffects;
    
            // Redraw chart with new data
            drawBurnDownChart(match);
    
            // Store the current state to compare against the next one
            previousMatchState = JSON.parse(JSON.stringify(match));

            // Default UI state for an active leg
            if (winModal) winModal.style.display = 'none';
            if (scoreControls) {
                scoreControls.style.display = 'block';
            }
        }
    
    
        function updateMultiplierButtons() {
            console.log(`[updateMultiplierButtons] Setting multiplier to: ${currentThrow.multiplier}`);
            modDouble.classList.toggle('active', currentThrow.multiplier === 2);
            modTreble.classList.toggle('active', currentThrow.multiplier === 3);
        }

        function updateInputDisplay() {
            console.log('[updateInputDisplay] Updating input display.');
            const score = currentThrow.base ? (currentThrow.base * currentThrow.multiplier) : 0;
            inputDisplay.innerText = score;
        }

        // Attach event listeners only if they haven't been attached before.
        if (!gameScreen.dataset.initialized) {
            console.log('[initGameScreen] Attaching event listeners for the first time.');
            
            // Generate number pad
            const numbersContainer = gameScreen.querySelector('.numbers');
            if (numbersContainer.children.length === 0) {
                for (let i = 1; i <= 20; i++) {
                    const btn = document.createElement('button');
                    btn.className = 'key';
                    btn.dataset.score = i;
                    btn.innerText = i;
                    numbersContainer.appendChild(btn);
                }
            }

            document.getElementById('resetGameBtn').addEventListener('click', handleReset);

            modDouble.addEventListener('click', () => {
                currentThrow.multiplier = currentThrow.multiplier === 2 ? 1 : 2;
                updateMultiplierButtons();
                updateInputDisplay();
            });

            modTreble.addEventListener('click', () => {
                currentThrow.multiplier = currentThrow.multiplier === 3 ? 1 : 3;
                updateMultiplierButtons();
                updateInputDisplay();
            });

            keypad.addEventListener('click', async (e) => {
                if (!e.target.matches('.key[data-score]')) return;
                const baseScore = parseInt(e.target.dataset.score, 10);
                const isBull = baseScore === 50;
                const remainingScore = previousMatchState.players[previousMatchState.currentPlayerIndex].score;
                currentThrow.base = baseScore;
                const score = currentThrow.base * currentThrow.multiplier;

                // Determine if the throw is a bust or a valid checkout
                const isBust = (remainingScore - score) < 0 || (remainingScore - score) === 1;
                const isCheckout = (remainingScore - score) === 0 && (currentThrow.multiplier === 2 || isBull);
                console.log(`[keypad.click] Score: ${score}, isBust: ${isBust}, isCheckout: ${isCheckout}`);
                
                const res = await postAction('game:score', { 
                    score, 
                    isBust,
                    isCheckout,
                    matchState: JSON.stringify(previousMatchState)
                });

                console.log('[keypad.click] Received response from game:score:', res);
                if (res.success) {
                    const newMatchState = res.match;
                    const currentPlayerIndex = previousMatchState.currentPlayerIndex;
                    const newPlayerState = newMatchState.players[currentPlayerIndex];
                    const oldPlayerState = previousMatchState.players.find(p => p.name === newPlayerState.name);

                    // Check for a match win
                    if (newMatchState.isOver) {
                        console.log('[keypad.click] Match is over.');
                        playSound('winSound');
                        showMatchSummary(newMatchState);
                        return;
                    }

                    // Check for a leg win
                    if (newPlayerState && oldPlayerState && newPlayerState.legsWon > oldPlayerState.legsWon) {
                        console.log(`[keypad.click] Leg won by ${newPlayerState.name}.`);
                        playSound('winSound');
                        showWinModal(newPlayerState, newMatchState); // Pass the new state
                    } else {
                        // It was a regular turn, just update the UI
                        playSound('dartHitSound');
                        updateGameUI(newMatchState);
                    }
                } else {
                    alert(`Error: ${res.message || 'Could not submit score.'}`);
                }
                currentThrow = { base: null, multiplier: 1 };
                updateMultiplierButtons();
                updateInputDisplay();
            });

            undoBtn.addEventListener('click', async () => {
                console.log('[undoBtn.click] Attempting to undo last action...');
                const res = await postAction('game:undo', {
                    matchState: JSON.stringify(previousMatchState)
                });
                console.log('[undoBtn.click] Received response:', res);
                if (res.success) {
                    updateGameUI(res.match);
                }
            });

            if (nextLegBtn) {
                nextLegBtn.addEventListener('click', async () => {
                    console.log('[nextLegBtn.click] Attempting to start next leg...');
                    const res = await postAction('game:nextLeg', {
                        matchState: JSON.stringify(previousMatchState)
                    });
                    console.log('[nextLegBtn.click] Received response:', res);
                    if (res.success) {
                        document.getElementById('winModal').style.display = 'none';
                        updateGameUI(res.match);
                    }
                });
            }

            gameScreen.dataset.initialized = 'true';
        } // End of one-time listener attachment

        // Initial chart draw
        google.charts.load('current', { 'packages': ['corechart'] });
        // We no longer call drawBurnDownChart from the callback, as it has no context of the match state.
        // Instead, updateGameUI will call it directly once the library is loaded.
        google.charts.setOnLoadCallback(function() {
            console.log('[Google Charts] Library loaded. UI will now draw charts when updated.');
        });
    
        function drawBurnDownChart(matchState = null) {
            console.log('[drawBurnDownChart] Drawing chart with state:', matchState);
            const container = document.getElementById('burnDownChartContainer');
            if (!container || !google.visualization || !matchState) return;

            // Wrap the entire chart drawing logic in a try-catch block
        try {
            const history = matchState.history;
            const players = matchState.players;

            const dataTable = new google.visualization.DataTable();
            dataTable.addColumn('number', 'Turn');
            players.forEach(p => dataTable.addColumn('number', p.name));

            // Add the starting point
            const initialRow = [0, ...players.map(() => matchState.gameType)];
            dataTable.addRow(initialRow);

            // Process history to build the chart data
            const turnScores = players.map(() => matchState.gameType);
            let turnCount = 0;
            history.forEach((turnState) => {
                turnCount++;
                turnScores[turnState.playerIndex] = turnState.previousScore;
                // Add a row for each player's turn to create a stepped chart
                if ((turnCount - 1) % players.length === players.length - 1 || turnCount === history.length) {
                    dataTable.addRow([Math.ceil(turnCount / players.length), ...turnScores.slice()]);
                }
            });

            const options = {
                title: 'Score Burn-Down',
                titleTextStyle: { color: '#FFF', fontName: 'Segoe UI' },
                curveType: 'none',
                legend: { position: 'top', textStyle: { color: '#CCC', fontName: 'Segoe UI' } },
                backgroundColor: 'transparent',
                chartArea: { backgroundColor: 'transparent', width: '85%', height: '65%' },
                hAxis: { 
                    title: 'Turn Number',
                    titleTextStyle: { color: '#999', fontName: 'Segoe UI' },
                    textStyle: { color: '#999', fontName: 'Segoe UI' } 
                },
                vAxis: { 
                    textStyle: { color: '#999', fontName: 'Segoe UI' },
                    gridlines: { color: '#444' },
                    baselineColor: '#666'
                },
            };

            const chart = new google.visualization.LineChart(container);
            chart.draw(dataTable, options);
        } catch (e) {
            console.error("Failed to draw burn-down chart. Continuing UI update.", e);
            container.innerHTML = '<p style="color: #dc3545; text-align: center;">Error rendering chart.</p>';
        }
        } catch (e) {
            console.error("Failed to draw burn-down chart. Continuing UI update.", e);
            container.innerHTML = '<p style="color: #dc3545; text-align: center;">Error rendering chart.</p>';
        }
    }

    function showWinModal(winningPlayer, matchState) {
        console.log('[showWinModal] Displaying leg win modal for:', winningPlayer);
        const winModal = document.getElementById('winModal');
        const scoreControls = document.querySelector('.controls');
        document.getElementById('winnerText').innerText = `${winningPlayer.name} wins the leg!`;
        const totalPoints = (matchState.gameType);
        const legAvg = winningPlayer.dartsThrown > 0 ? (totalPoints / winningPlayer.dartsThrown * 3).toFixed(2) : '0.00';
        document.getElementById('winnerStats').innerText = `Final 3-Dart Avg: ${legAvg}`;
        if (scoreControls) {
            scoreControls.style.display = 'none';
        }
        winModal.style.display = 'flex';
    }

    let selectedH2HPlayers = [];

    // --- Stats & History Screens ---
    async function initStatsScreen() {
        console.log('[loadStatsScreen] Loading stats screen data...');
        const res = await postAction('player:get_all');
        if (res.success) {
            const players = res.players;
            const ul = document.getElementById('registeredPlayersUl');
            if (!players || players.length === 0) {
                console.log('[loadStatsScreen] No registered players found.');
                ul.innerHTML = '<li>No registered players found.</li>';
                return;
            }

            ul.innerHTML = '';
            players.forEach(p => {
                const li = document.createElement('li');
                li.innerText = p.name;
                li.dataset.playerName = p.name;
                li.onclick = () => handlePlayerStatSelection(p.name, players);
                ul.appendChild(li);
            });
            // Reset selection when loading the screen
            selectedH2HPlayers = [];
            updateStatsDisplay(players);
        }
    }

    function handlePlayerStatSelection(playerName, allPlayers) {
        console.log(`[handlePlayerStatSelection] Player selected: '${playerName}'`);
        const index = selectedH2HPlayers.indexOf(playerName);
        if (index > -1) {
            selectedH2HPlayers.splice(index, 1); // Deselect
        } else {
            if (selectedH2HPlayers.length < 2) {
                selectedH2HPlayers.push(playerName); // Select
            }
        }
        updateStatsDisplay(allPlayers);
    }

    function updateStatsDisplay(allPlayers) {
        console.log('[updateStatsDisplay] Updating stats display for selection:', selectedH2HPlayers);
        // Update visual selection
        document.querySelectorAll('#registeredPlayersUl li').forEach(li => {
            li.classList.toggle('player-stats-list__item--active', selectedH2HPlayers.includes(li.dataset.playerName));
        });

        if (selectedH2HPlayers.length === 2) {
            displayH2HStats(selectedH2HPlayers[0], selectedH2HPlayers[1]);
        } else if (selectedH2HPlayers.length === 1) {
            displayPlayerStats(selectedH2HPlayers[0], allPlayers);
        } else {
            const detailsContainer = document.getElementById('playerStatsDetails');
            detailsContainer.innerHTML = `<p class="player-stats-details__message">Select one player for individual stats, or two for a head-to-head comparison.</p>`;
        }
    }

    function displayPlayerStats(playerName, allPlayers) {
        console.log(`[displayPlayerStats] Displaying single player stats for: '${playerName}'`);
        const detailsContainer = document.getElementById('playerStatsDetails');
        const player = allPlayers.find(p => p.name === playerName);

        if (!player) {
            detailsContainer.innerHTML = `<p>Could not find stats for ${playerName}.</p>`;
            return;
        }

        const overallAvg = (player.totalDartsThrown > 0 ? (player.totalPointsScored / player.totalDartsThrown * 3) : 0).toFixed(2);

        detailsContainer.innerHTML = `
            <h2 class="player-stats-details__title">${player.name}</h2>
            <div class="player-stats-details__grid">
                <div class="stat-card">
                    <span class="stat-card__label">Overall 3-Dart Avg</span>
                    <span class="stat-card__value">${overallAvg}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-card__label">Legs Won</span>
                    <span class="stat-card__value">${player.legsWon || 0}</span>
                </div>
                <div class="stat-card">
                    <span class="stat-card__label">Matches Played</span>
                    <span class="stat-card__value">${player.gamesPlayed || 0}</span>
                </div>
            </div>
            <div id="avgHistoryChart" class="player-stats-details__avg-chart"></div>
        `;

        drawAverageHistoryChart(player);
    }

    async function displayH2HStats(player1Name, player2Name) {
        console.log(`[displayH2HStats] Displaying H2H stats for: '${player1Name}' vs '${player2Name}'`);
        const detailsContainer = document.getElementById('playerStatsDetails');
        detailsContainer.innerHTML = `<p class="player-stats-details__message">Loading Head-to-Head stats...</p>`;

        const result = await postAction('stats:h2h', { player1: player1Name, player2: player2Name });
        console.log('[displayH2HStats] Received H2H data:', result);

        if (result.success) {
            const h2h = result.data;
            detailsContainer.innerHTML = `
                <div class="h2h-stats">
                    <h2 class="h2h-stats__title">${player1Name} vs ${player2Name}</h2>
                    <div class="h2h-stats__record">
                        <div class="h2h-stats__player">
                            <span class="h2h-stats__wins">${h2h.player1_wins}</span>
                            <span class="h2h-stats__name">${player1Name}</span>
                        </div>
                        <div class="h2h-stats__vs">vs</div>
                        <div class="h2h-stats__player">
                            <span class="h2h-stats__wins">${h2h.player2_wins}</span>
                            <span class="h2h-stats__name">${player2Name}</span>
                        </div>
                    </div>
                    <p class="h2h-stats__total">Total Matches: ${h2h.total_matches}</p>
                </div>
            `;
        } else {
            detailsContainer.innerHTML = `<p class="player-stats-details__message">Could not load Head-to-Head stats.</p>`;
        }
    }

    function drawAverageHistoryChart(player) {
        console.log('[drawAverageHistoryChart] Drawing average history for:', player);
        const container = document.getElementById('avgHistoryChart');
        if (!container || !google.visualization || !player.averageHistory || player.averageHistory.length === 0) {
            container.innerHTML = '<p class="player-stats-details__message">Not enough data for average history chart.</p>';
            return;
        }

        const data = new google.visualization.DataTable();
        data.addColumn('string', 'Leg');
        data.addColumn('number', '3-Dart Average');
        data.addColumn({ role: 'style', type: 'string' });

        player.averageHistory.forEach((avg, index) => {
            data.addRow([`Leg ${index + 1}`, avg, 'color: #00d1b2']);
        });

        const options = {
            title: 'Average Over Last 10 Legs',
            titleTextStyle: { color: 'var(--text-color)', fontName: 'Segoe UI' },
            legend: { position: 'none' },
            backgroundColor: 'transparent',
            chartArea: { backgroundColor: 'transparent', width: '85%', height: '70%' },
            hAxis: { textStyle: { color: 'var(--text-color-secondary)' } },
            vAxis: { textStyle: { color: 'var(--text-color-secondary)' }, gridlines: { color: 'var(--border-color)' } },
            bar: { groupWidth: '60%' }
        };

        const chart = new google.visualization.BarChart(container);
        chart.draw(data, options);
    }

    async function initMatchHistoryScreen() {
        console.log('[loadMatchHistory] Loading match history...');
        const container = document.getElementById('matchHistoryContainer');
        container.innerHTML = '<p>Loading match history...</p>';
        const res = await postAction('stats:matches');
        const matches = res.matches || [];
        console.log('[loadMatchHistory] Received matches:', matches);
        if (matches.length === 0) {
            container.innerHTML = '<p>No completed matches found.</p>';
            return;
        }
        container.innerHTML = matches.map((match, index) => {
            const winner = match.standings[0];
            const opponent = match.standings[1];
            const score = `${winner.legsWon} - ${opponent ? opponent.legsWon : 'N/A'}`;
            const date = new Date(match.timestamp).toLocaleString();
            return `
                <div class="match-card">
                    <div class="match-card__header" onclick="toggleMatchDetails(${index})">
                        <div>
                            <span class="match-card__winner">🏆 ${winner.name}</span>
                            <span>vs ${opponent ? opponent.name : '...'} (${score})</span>
                        </div>
                        <span class="match-card__date">${date}</span>
                    </div>
                    <div class="match-card__details" id="match-details-${index}">
                        <table class="match-card__summary-table summary-table">
                            <thead><tr><th>Player</th><th>Legs Won</th><th>Match Avg</th></tr></thead>
                            <tbody>
                                ${match.standings.map(p => `<tr><td>${p.name}</td><td>${p.legsWon}</td><td>${p.average}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.toggleMatchDetails = function(index) {
        console.log(`[toggleMatchDetails] Toggling details for match index: ${index}`);
        const details = document.getElementById(`match-details-${index}`);
        if (details) {
            details.style.display = details.style.display === 'block' ? 'none' : 'block';
        }
    }

    function showMatchSummary(match) {
        console.log('[showMatchSummary] Displaying match summary:', match);
        const winner = match.standings[0];
        document.getElementById('matchWinnerName').innerText = `${winner.name} is the winner!`;
        // You can build a more detailed summary table here if needed.
        
        const startNewMatchBtn = document.getElementById('startNewMatchBtn');
        if (startNewMatchBtn) startNewMatchBtn.addEventListener('click', handleReset);

        showScreen('matchSummaryScreen');
    }

    function getCheckoutGuide(score) {
        if (score > 170 || score < 2) return '';
        const checkouts = {
            170: "T20 T20 Bull", 167: "T20 T19 Bull", 164: "T20 T18 Bull", 161: "T20 T17 Bull", 160: "T20 T20 D20", 158: "T20 T20 D19", 157: "T20 T19 D20", 156: "T20 T20 D18", 154: "T20 T18 D20", 153: "T20 T19 D18", 152: "T20 T20 D16", 151: "T20 T17 D20", 150: "T20 T18 D18", 149: "T20 T19 D16", 148: "T20 T16 D20", 147: "T20 T17 D18", 146: "T20 T18 D16", 145: "T20 T15 D20", 144: "T20 T20 D12", 143: "T20 T17 D16", 142: "T20 T14 D20", 141: "T20 T19 D12", 140: "T20 T16 D16", 139: "T20 T13 D20", 138: "T20 T18 D12", 137: "T19 T16 D16", 136: "T20 T20 D8", 135: "T20 T17 D12", 134: "T20 T14 D16", 133: "T20 T19 D8", 132: "T20 T16 D12", 131: "T20 T13 D16", 130: "T20 T18 D8", 129: "T19 T20 D6", 128: "T18 T14 D16", 127: "T20 T17 D8", 126: "T19 T19 D6", 125: "Bull T20 D7", 124: "T20 D16 D16", 123: "T19 T16 D9", 122: "T18 T20 D4", 121: "T20 T15 D8", 120: "T20 20 D20", 119: "T19 T10 D16", 118: "T20 18 D20", 117: "T20 17 D20", 116: "T20 16 D20", 115: "T20 15 D20", 114: "T20 14 D20", 113: "T20 13 D20", 112: "T20 12 D20", 111: "T20 19 D16", 110: "T20 10 D20", 109: "T20 9 D20", 108: "T20 16 D16", 107: "T19 10 D20", 106: "T20 14 D16", 105: "T20 13 D16", 104: "T18 10 D20", 103: "T20 3 D20", 102: "T20 10 D16", 101: "T17 10 D20", 100: "T20 D20", 99: "T19 10 D16", 98: "T20 D19", 97: "T19 D20", 96: "T20 D18", 95: "T19 D19", 94: "T18 D20", 93: "T19 D18", 92: "T20 D16", 91: "T17 D20", 90: "T20 D15", 89: "T19 D16", 88: "T16 D20", 87: "T17 D18", 86: "T18 D16", 85: "T15 D20", 84: "T20 D12", 83: "T17 D16", 82: "T14 D20", 81: "T19 D12", 80: "T20 D10", 79: "T13 D20", 78: "T18 D12", 77: "T19 D10", 76: "T20 D8", 75: "T17 D12", 74: "T14 D16", 73: "T19 D8", 72: "T16 D12", 71: "T13 D16", 70: "T18 D8", 69: "T15 D12", 68: "T20 D4", 67: "T17 D8", 66: "T10 D18", 65: "T19 D4", 64: "T16 D8", 63: "T13 D12", 62: "T10 D16", 61: "T15 D8", 60: "20 D20", 59: "19 D20", 58: "18 D20", 57: "17 D20", 56: "16 D20", 55: "15 D20", 54: "14 D20", 53: "13 D20", 52: "12 D20", 51: "11 D20", 50: "10 D20", 49: "9 D20", 48: "8 D20", 47: "7 D20", 46: "6 D20", 45: "5 D20", 44: "4 D20", 43: "3 D20", 42: "2 D20", 41: "1 D20", 40: "D20", 39: "7 D16", 38: "D19", 37: "5 D16", 36: "D18", 35: "3 D16", 34: "D17", 33: "1 D16", 32: "D16", 31: "15 D8", 30: "D15", 29: "13 D8", 28: "D14", 27: "11 D8", 26: "D13", 25: "9 D8", 24: "D12", 23: "7 D8", 22: "D11", 21: "5 D8", 20: "D10", 19: "3 D8", 18: "D9", 17: "1 D8", 16: "D8", 15: "7 D4", 14: "D7", 13: "5 D4", 12: "D6", 11: "3 D4", 10: "D5", 9: "1 D4", 8: "D4", 7: "3 D2", 6: "D3", 5: "1 D2", 4: "D2", 3: "1 D1", 2: "D1"
        };
        // Return the checkout string or an empty string if not found.
        // This is safer than assuming the key exists.
        return checkouts[score] || '';
    }

    function escapeHTML(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, (match) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[match]));
    }

    window.showScreen = showScreen;

    // Initial screen setup
    // Always start on the setup screen in a stateless model
    showScreen('setupScreen');
});