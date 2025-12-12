window.DartsApp = window.DartsApp || {};

window.DartsApp.initGameScreen = function(match) {
    const { postAction, playSound, showScreen, showMatchSummary, getCheckoutGuide } = window.DartsApp;
    let previousMatchState = null;
    let currentThrow = { base: null, multiplier: 1 };

    const gameScreen = document.getElementById('gameScreen');
    const keypad = gameScreen.querySelector('.dartboard-keypad');
    const modDouble = document.getElementById('modDouble');
    const modTreble = document.getElementById('modTreble');
    const inputDisplay = document.getElementById('inputDisplay');
    const undoBtn = document.getElementById('undoBtn');
    const nextLegBtn = document.getElementById('nextLegBtn');

    function drawBurnDownChart(matchState = null) {
        console.log('[drawBurnDownChart] Drawing chart with state:', matchState);
        const container = document.getElementById('burnDownChartContainer');
        if (!container || !google.visualization || !matchState) return;

        try {
            const history = matchState.history;
            const players = matchState.players;

            const dataTable = new google.visualization.DataTable();
            dataTable.addColumn('number', 'Turn');
            players.forEach(p => dataTable.addColumn('number', p.name));

            const initialRow = [0, ...players.map(() => matchState.gameType)];
            dataTable.addRow(initialRow);

            const turnScores = players.map(() => matchState.gameType);
            let turnCount = 0;
            history.forEach((turnState) => {
                turnCount++;
                turnScores[turnState.playerIndex] = turnState.previousScore;
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

    function updateGameUI(match) {
        console.log('%c[updateGameUI] Entry Point', 'color: green; font-weight: bold;', 'Rendering with match object:', match);

        if (!match || !match.players || !match.players.length) {
            console.error('[updateGameUI] ABORTING RENDER: Match object is invalid or has no players.', match);
            alert("Debug: updateGameUI was called with invalid data. See console for details.");
            return;
        }

        const player = match.players[match.currentPlayerIndex] || {};
        const scoreControls = document.querySelector('.controls');
        const winModal = document.getElementById('winModal');

        const matchScore = match.players.map(p => `${p.name.split(' ')[0]} (${p.legsWon})`).join(' - ');
        document.getElementById('legDisplay').innerText = `Leg ${match.currentLeg} | ${matchScore}`;

        document.getElementById('activeName').innerText = player.name;
        document.getElementById('activeScore').innerText = player.score;
        const totalPointsScored = (match.gameType - player.score);
        const legAvg = player.dartsThrown > 0 ? (totalPointsScored / player.dartsThrown * 3).toFixed(2) : '0.00';
        document.getElementById('activeAvg').innerText = `Avg: ${legAvg}`;

        try {
            if (match.checkoutAssistant) {
                document.getElementById('checkoutHint').innerText = getCheckoutGuide(player.score);
            } else {
                document.getElementById('checkoutHint').innerText = "";
            }
        } catch (e) {
            console.error("Failed to render checkout hint. Continuing UI update.", e);
            document.getElementById('checkoutHint').innerText = "";
        }

        document.getElementById('dartsThrownDisplay').innerHTML = '';

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

        window.DartsApp.soundSettings.useSoundEffects = match.soundEffects;
        drawBurnDownChart(match);
        previousMatchState = JSON.parse(JSON.stringify(match));

        if (winModal) winModal.style.display = 'none';
        if (scoreControls) {
            scoreControls.style.display = 'block';
        }
    }

    function updateMultiplierButtons() {
        modDouble.classList.toggle('active', currentThrow.multiplier === 2);
        modTreble.classList.toggle('active', currentThrow.multiplier === 3);
    }

    function updateInputDisplay() {
        const score = currentThrow.base ? (currentThrow.base * currentThrow.multiplier) : 0;
        inputDisplay.innerText = score;
    }

    if (!gameScreen.dataset.initialized) {
        console.log('[initGameScreen] Attaching event listeners for the first time.');

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

        document.getElementById('resetGameBtn').addEventListener('click', window.DartsApp.handleReset);

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

            const isBust = (remainingScore - score) < 0 || (remainingScore - score) === 1;
            const isCheckout = (remainingScore - score) === 0 && (currentThrow.multiplier === 2 || isBull);

            const res = await postAction('game:score', { score, isBust, isCheckout, matchState: JSON.stringify(previousMatchState) });

            if (res.success) {
                const newMatchState = res.match;
                const currentPlayerIndex = previousMatchState.currentPlayerIndex;
                const newPlayerState = newMatchState.players[currentPlayerIndex];
                const oldPlayerState = previousMatchState.players.find(p => p.name === newPlayerState.name);

                if (newMatchState.isOver) {
                    playSound('winSound');
                    showMatchSummary(newMatchState);
                    return;
                }

                if (newPlayerState && oldPlayerState && newPlayerState.legsWon > oldPlayerState.legsWon) {
                    playSound('winSound');
                    showWinModal(newPlayerState, newMatchState);
                } else {
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
            const res = await postAction('game:undo', { matchState: JSON.stringify(previousMatchState) });
            if (res.success) {
                updateGameUI(res.match);
            }
        });

        if (nextLegBtn) {
            nextLegBtn.addEventListener('click', async () => {
                const res = await postAction('game:nextLeg', { matchState: JSON.stringify(previousMatchState) });
                if (res.success) {
                    document.getElementById('winModal').style.display = 'none';
                    updateGameUI(res.match);
                }
            });
        }

        gameScreen.dataset.initialized = 'true';
    }

    google.charts.load('current', { 'packages': ['corechart'] });
    google.charts.setOnLoadCallback(function () {
        console.log('[Google Charts] Library loaded. UI will now draw charts when updated.');
    });

    updateGameUI(match);
};