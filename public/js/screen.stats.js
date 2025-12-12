window.DartsApp = window.DartsApp || {};

window.DartsApp.initStatsScreen = async function() {
    const { postAction } = window.DartsApp;
    let selectedH2HPlayers = [];

    console.log('[initStatsScreen] Loading stats screen data...');
    const res = await postAction('player:get_all');
    if (res.success) {
        const players = res.players;
        const ul = document.getElementById('registeredPlayersUl');
        if (!players || players.length === 0) {
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
        selectedH2HPlayers = [];
        updateStatsDisplay(players);
    }

    function handlePlayerStatSelection(playerName, allPlayers) {
        const index = selectedH2HPlayers.indexOf(playerName);
        if (index > -1) {
            selectedH2HPlayers.splice(index, 1);
        } else {
            if (selectedH2HPlayers.length < 2) {
                selectedH2HPlayers.push(playerName);
            }
        }
        updateStatsDisplay(allPlayers);
    }

    function updateStatsDisplay(allPlayers) {
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
                <div class="stat-card"><span class="stat-card__label">Overall 3-Dart Avg</span><span class="stat-card__value">${overallAvg}</span></div>
                <div class="stat-card"><span class="stat-card__label">Legs Won</span><span class="stat-card__value">${player.legsWon || 0}</span></div>
                <div class="stat-card"><span class="stat-card__label">Matches Played</span><span class="stat-card__value">${player.gamesPlayed || 0}</span></div>
            </div>
            <div id="avgHistoryChart" class="player-stats-details__avg-chart"></div>
        `;
        drawAverageHistoryChart(player);
    }

    async function displayH2HStats(player1Name, player2Name) {
        const detailsContainer = document.getElementById('playerStatsDetails');
        detailsContainer.innerHTML = `<p class="player-stats-details__message">Loading Head-to-Head stats...</p>`;

        const result = await postAction('stats:h2h', { player1: player1Name, player2: player2Name });

        if (result.success) {
            const h2h = result.data;
            detailsContainer.innerHTML = `
                <div class="h2h-stats">
                    <h2 class="h2h-stats__title">${player1Name} vs ${player2Name}</h2>
                    <div class="h2h-stats__record">
                        <div class="h2h-stats__player"><span class="h2h-stats__wins">${h2h.player1_wins}</span><span class="h2h-stats__name">${player1Name}</span></div>
                        <div class="h2h-stats__vs">vs</div>
                        <div class="h2h-stats__player"><span class="h2h-stats__wins">${h2h.player2_wins}</span><span class="h2h-stats__name">${player2Name}</span></div>
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
};

window.DartsApp.initMatchHistoryScreen = async function() {
    const { postAction } = window.DartsApp;
    const container = document.getElementById('matchHistoryContainer');
    container.innerHTML = '<p>Loading match history...</p>';
    const res = await postAction('stats:matches');
    const matches = res.matches || [];
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
                <div class="match-card__header" onclick="window.DartsApp.toggleMatchDetails(${index})">
                    <div><span class="match-card__winner">🏆 ${winner.name}</span><span>vs ${opponent ? opponent.name : '...'} (${score})</span></div>
                    <span class="match-card__date">${date}</span>
                </div>
                <div class="match-card__details" id="match-details-${index}">
                    <table class="match-card__summary-table summary-table">
                        <thead><tr><th>Player</th><th>Legs Won</th><th>Match Avg</th></tr></thead>
                        <tbody>${match.standings.map(p => `<tr><td>${p.name}</td><td>${p.legsWon}</td><td>${p.average}</td></tr>`).join('')}</tbody>
                    </table>
                </div>
            </div>
        `;
    }).join('');
};

window.DartsApp.toggleMatchDetails = function(index) {
    const details = document.getElementById(`match-details-${index}`);
    if (details) {
        details.style.display = details.style.display === 'block' ? 'none' : 'block';
    }
};