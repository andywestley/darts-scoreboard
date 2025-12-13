window.DartsApp = window.DartsApp || {};

window.DartsApp.initGameScreen = function(match) {
    const { postAction, playSound, showScreen, showMatchSummary, getCheckoutGuide } = window.DartsApp;
    let previousMatchState = null;
    let currentTurnScores = [];
    let currentThrow = { base: null, multiplier: 1 };

    const gameScreen = document.getElementById('gameScreen');
    const keypad = gameScreen.querySelector('.dartboard-keypad');
    const modDouble = document.getElementById('modDouble');
    const modTreble = document.getElementById('modTreble');
    const inputDisplay = document.getElementById('inputDisplay');
    const undoBtn = document.getElementById('undoBtn');
    const nextLegBtn = document.getElementById('nextLegBtn');
    const submitTurnBtn = document.getElementById('submitTurnBtn');

    function drawBurnDownChart(matchState = null) {
        console.log('[drawBurnDownChart] Drawing chart with state:', matchState);
        const container = document.getElementById('burnDownChartContainer');
        if (!container || !google.visualization || !matchState) return;

        try {
            const players = matchState.players;
            const dataTable = new google.visualization.DataTable();
            dataTable.addColumn('number', 'Turn');
            players.forEach(p => dataTable.addColumn('number', p.name));

            // Find the maximum number of turns any player has taken
            const maxTurns = Math.max(...players.map(p => p.scores.length));

            for (let i = 0; i < maxTurns; i++) {
                const row = [i + 1];
                players.forEach(p => row.push(p.scores[i] ?? null)); // Use null for players with fewer turns
                dataTable.addRow(row);
            }

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

        // Update the display of darts thrown in the current turn
        const dartsDisplay = document.getElementById('dartsThrownDisplay');
        dartsDisplay.innerText = currentTurnScores.length > 0 ? `Darts: ${currentTurnScores.map(d => d.score).join(', ')}` : '';

        try {
            const leaderboardElement = document.getElementById('leaderboard');
            leaderboardElement.innerHTML = match.players.map((p, index) => {
                const pTotalPoints = (match.gameType - p.score);
                const pLegAvg = p.dartsThrown > 0 ? (pTotalPoints / p.dartsThrown * 3).toFixed(2) : '0.00';
                
                // Generate the score history table for each player
                const scoreHistoryHtml = p.scores && p.scores.length > 0
                    ? `<table class="player-card__score-history">
                        ${p.scores.map((score, i) => `<tr><td>Turn ${i + 1}</td><td>${score}</td></tr>`).join('')}
                       </table>`
                    : '';

                return `
                    <div class="player-card ${index === match.currentPlayerIndex ? 'player-card--active' : ''}">
                        <div class="player-card__header">
                            <div>
                                <div class="player-card__name">${p.name}</div>
                                <div class="player-card__avg">Avg: ${pLegAvg}</div>
                            </div>
                            <div class="player-card__score">${p.score}</div>
                        </div>
                        ${scoreHistoryHtml}
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

    async function submitTurn() {
        if (currentTurnScores.length === 0) return; // Don't submit an empty turn

        const res = await postAction('game:score', {
            darts: JSON.stringify(currentTurnScores),
            matchState: JSON.stringify(previousMatchState)
        });

        // Reset turn state regardless of success/failure
        currentTurnScores = [];
        currentThrow = { base: null, multiplier: 1 };
        updateMultiplierButtons();
        updateInputDisplay();

        if (res.success) {
            const newMatchState = res.match;
            const currentPlayerIndex = previousMatchState.currentPlayerIndex;
            const newPlayerState = newMatchState.players[currentPlayerIndex];
            const oldPlayerState = previousMatchState.players.find(p => p.name === newPlayerState.name);

            if (newMatchState.isOver) {
                playSound('winSound');
                showMatchSummary(newMatchState);
            } else if (newPlayerState && oldPlayerState && newPlayerState.legsWon > oldPlayerState.legsWon) {
                playSound('winSound');
                showWinModal(newPlayerState, newMatchState);
            } else {
                playSound('dartHitSound');
                updateGameUI(newMatchState);
            }
        }
    }

    if (!gameScreen.dataset.initialized) {
        console.log('[initGameScreen] Attaching event listeners for the first time.');

        const numbersContainer = gameScreen.querySelector('.numbers');
        if (numbersContainer.children.length === 0) {
            for (let i = 20; i >= 1; i--) {
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

        keypad.addEventListener('click', (e) => {
            if (!e.target.matches('.key[data-score]')) return;
            if (currentTurnScores.length >= 3) return; // Max 3 darts per turn

            const baseScore = parseInt(e.target.dataset.score, 10);
            currentThrow.base = baseScore;

            const dart = {
                score: currentThrow.base * currentThrow.multiplier,
                multiplier: currentThrow.multiplier,
                base: currentThrow.base
            };

            currentTurnScores.push(dart);
            playSound('dartHitSound');

            // Reset for next dart entry
            currentThrow = { base: null, multiplier: 1 };
            updateMultiplierButtons();
            updateInputDisplay();
            updateGameUI(previousMatchState); // Re-render to show darts thrown

            if (currentTurnScores.length === 3) {
                setTimeout(() => submitTurn(), 200); // Short delay to show the 3rd dart
            }
        });

        submitTurnBtn.addEventListener('click', submitTurn);

        undoBtn.addEventListener('click', () => {
            if (currentTurnScores.length > 0) {
                currentTurnScores.pop(); // Remove the last dart
                updateGameUI(previousMatchState); // Re-render to update display
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