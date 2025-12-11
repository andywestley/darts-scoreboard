document.addEventListener('DOMContentLoaded', function() {
    // --- Globals & Initial State ---
    const initialStateElement = document.getElementById('initial-state-data');
    const initialMatchState = initialStateElement ? JSON.parse(initialStateElement.textContent || 'null') : null;

    let currentThrow = { base: null, multiplier: 1 };
    let soundSettings = { useSoundEffects: true };
    let previousMatchState = null; // To detect leg wins

    // --- Helper Functions ---
    async function postAction(action, data = {}) {
        const formData = new FormData();
        formData.append('action', action);
        for (const key in data) {
            formData.append(key, data[key]);
        }

        try {
            const response = await fetch('index.php', {
                method: 'POST',
                body: formData
            });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('Error posting action:', error);
            alert('An error occurred. Please check the console and refresh the page.');
            return { success: false };
        }
    }

    function showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            if (screenId === 'statsScreen') loadStatsScreen();
            if (screenId === 'matchHistoryScreen') loadMatchHistory();
        }
    }

    function playSound(soundId) {
        if (!soundSettings.useSoundEffects) return;
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

    // --- Setup Screen Logic ---
    const addPlayerBtn = document.getElementById('addPlayerBtn');
    const newPlayerNameInput = document.getElementById('newPlayerName');
    const playerListDiv = document.getElementById('playerList');
    const startGameBtn = document.getElementById('startGameBtn');

    async function renderSetupPlayers() {
        const response = await postAction('get_setup_players'); // Need to implement this action
        // For now, we'll just use the JS-side list until we fetch it
    }

    async function handleAddPlayer() {
        const name = newPlayerNameInput.value.trim();
        if (name) {
            const res = await postAction('add_player', { name });
            if (res.success) {
                updatePlayerList(res.players);
                newPlayerNameInput.value = '';
                newPlayerNameInput.focus();
            }
        }
    }

    function updatePlayerList(players) {
        playerListDiv.innerHTML = players.map(p => `
            <div class="player-tag">
                <span class="player-tag__name">${p.name}</span>
                <span class="player-tag__remove-btn" data-id="${p.id}">×</span>
            </div>
        `).join('');
    }

    if (addPlayerBtn) {
        addPlayerBtn.addEventListener('click', handleAddPlayer);
        newPlayerNameInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') handleAddPlayer();
        });

        playerListDiv.addEventListener('click', async (e) => {
            if (e.target.classList.contains('player-tag__remove-btn')) {
                const id = e.target.dataset.id;
                const res = await postAction('remove_player', { id });
                if (res.success) updatePlayerList(res.players);
            }
        });

        startGameBtn.addEventListener('click', async () => {
            const res = await postAction('start_game', {
                gameType: document.getElementById('gameType').value,
                matchLegs: document.getElementById('matchLegs').value,
                checkoutAssistantToggle: document.getElementById('checkoutAssistantToggle').checked,
                soundEffectsToggle: document.getElementById('soundEffectsToggle').checked,
            });
            // A page reload is appropriate here as we are transitioning from setup to the game screen.
            if (res.success) window.location.reload();
        });
    }

    // --- Game Screen Logic ---
    const gameScreen = document.getElementById('gameScreen');
    if (gameScreen && gameScreen.classList.contains('active')) {
        const keypad = gameScreen.querySelector('.dartboard-keypad');
        const modDouble = document.getElementById('modDouble');
        const modTreble = document.getElementById('modTreble');
        const inputDisplay = document.getElementById('inputDisplay');
        const undoBtn = document.getElementById('undoBtn');
        const nextLegBtn = document.getElementById('nextLegBtn');

        function initGameUI(match) {
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
            updateGameUI(match);
            gameScreen.dataset.rendered = 'true';
        }
    
        // This function is the core of the refactor. It updates the UI without a page reload.
        function updateGameUI(match) {
            if (!match || !match.players) return;
    
            const leg = match.currentLeg;
            const player = match.players[leg.currentPlayerIndex];
    
            // Update Header
            const matchScore = match.players.map(p => `${p.name.split(' ')[0]} (${p.legsWon})`).join(' - ');
            document.getElementById('legDisplay').innerText = `Leg ${leg.number} | ${matchScore}`;
    
            // Update Active Player Display
            document.getElementById('activeName').innerText = player.name;
            document.getElementById('activeScore').innerText = player.score;
            const legAvg = player.dartsThrown > 0 ? (player.totalPointsScored / player.dartsThrown * 3).toFixed(2) : '0.00';
            document.getElementById('activeAvg').innerText = `Avg: ${legAvg}`;

            // Update Checkout Hint
            if (match.settings.useCheckoutAssistant) {
                document.getElementById('checkoutHint').innerText = getCheckoutGuide(player.score) || "";
            } 

            // Update Darts Thrown Display
            const dartsDisplay = document.getElementById('dartsThrownDisplay');
            dartsDisplay.innerHTML = [0, 1, 2].map(i => {
                const score = leg.turnScores[i];
                const isActive = (i === leg.turnScores.length);
                return `<span class="dart-score ${isActive ? 'active' : ''}">${score !== undefined ? score : '-'}</span>`;
            }).join('');

            // Update Leaderboard (using BEM classes)
            const leaderboardElement = document.getElementById('leaderboard');
            leaderboardElement.innerHTML = match.players.map((p, index) => {
                const pLegAvg = p.dartsThrown > 0 ? (p.totalPointsScored / p.dartsThrown * 3).toFixed(2) : '0.00';
                return `
                    <div class="player-card ${index === leg.currentPlayerIndex ? 'player-card--active' : ''}">
                        <span class="player-card__name">${p.name}</span>
                        <span class="player-card__score">${p.score}</span>
                        <span class="player-card__avg">Avg: ${pLegAvg}</span>
                    </div>
                `;
            });
    
            // Update sound settings from the server state
            soundSettings.useSoundEffects = match.settings.useSoundEffects;
    
            // Redraw chart with new data
            drawBurnDownChart(match);
    
            // Store the current state to compare against the next one
            previousMatchState = JSON.parse(JSON.stringify(match));
        }
    
    
        function updateMultiplierButtons() {
            modDouble.classList.toggle('active', currentThrow.multiplier === 2);
            modTreble.classList.toggle('active', currentThrow.multiplier === 3);
        }

        function updateInputDisplay() {
            const score = currentThrow.base ? (currentThrow.base * currentThrow.multiplier) : 0;
            inputDisplay.innerText = score;
        }

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
            if (e.target.matches('.key[data-score]')) {
                const baseScore = parseInt(e.target.dataset.score);
                const isBull = baseScore === 50;
                currentThrow.base = baseScore;
                const score = currentThrow.base * currentThrow.multiplier;
                
                const res = await postAction('submit_score', { score, multiplier: currentThrow.multiplier, isBull });
                if (res.success) {
                    const newMatchState = res.match;
                    const currentPlayerName = previousMatchState.players[previousMatchState.currentLeg.currentPlayerIndex].name;
                    const newPlayerState = newMatchState.players.find(p => p.name === currentPlayerName);
                    const oldPlayerState = previousMatchState.players.find(p => p.name === currentPlayerName);

                    // Check for a match win
                    if (res.match.isOver) {
                        playSound('winSound');
                        showMatchSummary(res.match);
                        return;
                    }

                    // Check for a leg win
                    if (newPlayerState.legsWon > oldPlayerState.legsWon) {
                        playSound('winSound');
                        showWinModal(newPlayerState);
                    } else {
                        // It was a regular turn, just update the UI
                        playSound('dartHitSound');
                        updateGameUI(newMatchState);
                    }
                }
                currentThrow = { base: null, multiplier: 1 };
                updateMultiplierButtons();
                updateInputDisplay();
            }
        });

        undoBtn.addEventListener('click', async () => {
            const res = await postAction('undo');
            if (res.success) {
                updateGameUI(res.match);
            }
        });

        if (nextLegBtn) {
            nextLegBtn.addEventListener('click', async () => {
                const res = await postAction('start_new_leg');
                if (res.success) {
                    document.getElementById('winModal').style.display = 'none';
                    updateGameUI(res.match);
                }
            });
        }

        function showWinModal(winningPlayer) {
            const winModal = document.getElementById('winModal');
            document.getElementById('modalWinnerText').innerText = `${winningPlayer.name} Wins the Leg!`;
            const legAvg = winningPlayer.dartsThrown > 0 ? (winningPlayer.totalPointsScored / winningPlayer.dartsThrown * 3).toFixed(2) : '0.00';
            document.getElementById('winnerStats').innerText = `Final 3-Dart Avg: ${legAvg}`;
            winModal.style.display = 'flex';
        }

        // Initial chart draw
        google.charts.load('current', { 'packages': ['corechart'] });
        google.charts.setOnLoadCallback(drawBurnDownChart);

        function drawBurnDownChart(matchState = null) {
            const container = document.getElementById('burnDownChartContainer');
            if (!container || !google.visualization || !matchState) return;

            const leg = matchState.currentLeg;
            const history = leg.history;
            const players = matchState.players;

            const dataTable = new google.visualization.DataTable();
            dataTable.addColumn('number', 'Darts Thrown');
            players.forEach(p => dataTable.addColumn('number', p.name));

            // Add the starting point
            const initialRow = [0, ...players.map(() => matchState.settings.startScore)];
            dataTable.addRow(initialRow);

            // Process history to build the chart data
            let totalDarts = 0;
            history.forEach((state) => {
                totalDarts++;
                const scores = state.players.map(p => p.score);
                dataTable.addRow([totalDarts, ...scores]);
            });

            // Add the current turn's darts
            if (leg.turnScores.length > 0) {
                const currentScores = players.map(p => p.score);
                dataTable.addRow([totalDarts + leg.turnScores.length, ...currentScores]);
            }

            const options = {
                title: 'Score Burn-Down',
                titleTextStyle: { color: '#FFF', fontName: 'Segoe UI' },
                curveType: 'none',
                legend: { position: 'top', textStyle: { color: '#CCC', fontName: 'Segoe UI' } },
                backgroundColor: 'transparent',
                chartArea: { backgroundColor: 'transparent', width: '85%', height: '65%' },
                hAxis: { 
                    title: 'Darts Thrown in Leg',
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
        }

        // Initial UI setup from session data
        if (initialMatchState) {
            initGameUI(initialMatchState);
        }
    }

    let selectedH2HPlayers = [];

    // --- Stats & History Screens ---
    async function loadStatsScreen() {
        const res = await fetch('../api.php?action=get_players'); 
        const players = await res.json();
        const ul = document.getElementById('registeredPlayersUl');
        ul.innerHTML = '';
        if (players.length === 0) {
            ul.innerHTML = '<li>No registered players found.</li>';
            return;
        }
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

    function handlePlayerStatSelection(playerName, allPlayers) {
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
        const detailsContainer = document.getElementById('playerStatsDetails');
        detailsContainer.innerHTML = `<p class="player-stats-details__message">Loading Head-to-Head stats...</p>`;

        const res = await fetch(`index.php?action=get_h2h_stats&player1=${encodeURIComponent(player1Name)}&player2=${encodeURIComponent(player2Name)}`);
        const result = await res.json();

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

    async function loadMatchHistory() {
        const container = document.getElementById('matchHistoryContainer');
        container.innerHTML = '<p>Loading match history...</p>';
        const res = await fetch('index.php?action=get_matches'); 
        const matches = await res.json();
        if (matches.length === 0) {
            container.innerHTML = '<p>No completed matches found.</p>';
            return;
        }
        container.innerHTML = matches.map((match, index) => {
            const winner = match.standings[0];
            const opponent = match.standings[1];
            const score = `${winner.legsWon} - ${opponent ? opponent.legsWon : 0}`;
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
                                ${match.standings.map(p => `<tr><td>${p.name}</td><td>${p.legsWon}</td><td>${p.matchAverage}</td></tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        }).join('');
    }

    window.toggleMatchDetails = function(index) {
        const details = document.getElementById(`match-details-${index}`);
        if (details) {
            details.style.display = details.style.display === 'block' ? 'none' : 'block';
        }
    }

    function getCheckoutGuide(score) {
        if (score > 170 || score < 2) return null;
        const checkouts = {
            170: "T20 T20 Bull", 167: "T20 T19 Bull", 164: "T20 T18 Bull", 161: "T20 T17 Bull", 160: "T20 T20 D20", 158: "T20 T20 D19", 157: "T20 T19 D20", 156: "T20 T20 D18", 154: "T20 T18 D20", 153: "T20 T19 D18", 152: "T20 T20 D16", 151: "T20 T17 D20", 150: "T20 T18 D18", 149: "T20 T19 D16", 148: "T20 T16 D20", 147: "T20 T17 D18", 146: "T20 T18 D16", 145: "T20 T15 D20", 144: "T20 T20 D12", 143: "T20 T17 D16", 142: "T20 T14 D20", 141: "T20 T19 D12", 140: "T20 T16 D16", 139: "T20 T13 D20", 138: "T20 T18 D12", 137: "T19 T16 D16", 136: "T20 T20 D8", 135: "T20 T17 D12", 134: "T20 T14 D16", 133: "T20 T19 D8", 132: "T20 T16 D12", 131: "T20 T13 D16", 130: "T20 T18 D8", 129: "T19 T20 D6", 128: "T18 T14 D16", 127: "T20 T17 D8", 126: "T19 T19 D6", 125: "Bull T20 D7", 124: "T20 D16 D16", 123: "T19 T16 D9", 122: "T18 T20 D4", 121: "T20 T15 D8", 120: "T20 20 D20", 119: "T19 T10 D16", 118: "T20 18 D20", 117: "T20 17 D20", 116: "T20 16 D20", 115: "T20 15 D20", 114: "T20 14 D20", 113: "T20 13 D20", 112: "T20 12 D20", 111: "T20 19 D16", 110: "T20 10 D20", 109: "T20 9 D20", 108: "T20 16 D16", 107: "T19 10 D20", 106: "T20 14 D16", 105: "T20 13 D16", 104: "T18 10 D20", 103: "T20 3 D20", 102: "T20 10 D16", 101: "T17 10 D20", 100: "T20 D20", 99: "T19 10 D16", 98: "T20 D19", 97: "T19 D20", 96: "T20 D18", 95: "T19 D19", 94: "T18 D20", 93: "T19 D18", 92: "T20 D16", 91: "T17 D20", 90: "T20 D15", 89: "T19 D16", 88: "T16 D20", 87: "T17 D18", 86: "T18 D16", 85: "T15 D20", 84: "T20 D12", 83: "T17 D16", 82: "T14 D20", 81: "T19 D12", 80: "T20 D10", 79: "T13 D20", 78: "T18 D12", 77: "T19 D10", 76: "T20 D8", 75: "T17 D12", 74: "T14 D16", 73: "T19 D8", 72: "T16 D12", 71: "T13 D16", 70: "T18 D8", 69: "T15 D12", 68: "T20 D4", 67: "T17 D8", 66: "T10 D18", 65: "T19 D4", 64: "T16 D8", 63: "T13 D12", 62: "T10 D16", 61: "T15 D8", 60: "20 D20", 59: "19 D20", 58: "18 D20", 57: "17 D20", 56: "16 D20", 55: "15 D20", 54: "14 D20", 53: "13 D20", 52: "12 D20", 51: "11 D20", 50: "10 D20", 49: "9 D20", 48: "8 D20", 47: "7 D20", 46: "6 D20", 45: "5 D20", 44: "4 D20", 43: "3 D20", 42: "2 D20", 41: "1 D20", 40: "D20", 39: "7 D16", 38: "D19", 37: "5 D16", 36: "D18", 35: "3 D16", 34: "D17", 33: "1 D16", 32: "D16", 31: "15 D8", 30: "D15", 29: "13 D8", 28: "D14", 27: "11 D8", 26: "D13", 25: "9 D8", 24: "D12", 23: "7 D8", 22: "D11", 21: "5 D8", 20: "D10", 19: "3 D8", 18: "D9", 17: "1 D8", 16: "D8", 15: "7 D4", 14: "D7", 13: "5 D4", 12: "D6", 11: "3 D4", 10: "D5", 9: "1 D4", 8: "D4", 7: "3 D2", 6: "D3", 5: "1 D2", 4: "D2", 3: "1 D1", 2: "D1"
        };
        return checkouts[score];
    }

    window.showScreen = showScreen;

    // Handle initial render for summary screen
    if (document.getElementById('matchSummaryScreen').classList.contains('active') && initialMatchState) {
        showMatchSummary(initialMatchState);
    }
});