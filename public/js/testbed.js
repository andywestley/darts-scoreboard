document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const tabs = document.querySelector('.tabs');
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    const responseContainer = document.querySelector('.response-container');

    if (tabs) {
        tabs.addEventListener('click', (e) => {
            if (e.target.matches('.tab-link')) {
                const tabId = e.target.dataset.tab;

                tabLinks.forEach(link => link.classList.remove('active'));
                e.target.classList.add('active');

                tabContents.forEach(content => content.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');

                // Show/hide the interactive response footer
                if (responseContainer) {
                    responseContainer.style.display = (tabId === 'interactiveTab') ? 'flex' : 'none';
                }
            }
        });
    }

    // Initially hide the response container if diagnostics tab is active by default (it's not, but good practice)
    if (responseContainer && !document.querySelector('#interactiveTab')?.classList.contains('active')) {
        responseContainer.style.display = 'none';
    }

    // Interactive Testbed Logic
    const responseTextArea = document.getElementById('responseTextArea');
    const logTextArea = document.getElementById('logTextArea');
    const clearResponseBtn = document.getElementById('clearResponseBtn');
    const clearLogBtn = document.getElementById('clearLogBtn');
    const interactiveContent = document.querySelector('#interactiveTab .scrollable-content');

    if (clearResponseBtn) {
        clearResponseBtn.addEventListener('click', () => { responseTextArea.value = ''; });
    }
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => { logTextArea.value = ''; });
    }

    if (interactiveContent) {
        interactiveContent.addEventListener('submit', async (e) => {
            e.preventDefault();
            const form = e.target;
            const submitter = e.submitter;
            const action = submitter.value;

            responseTextArea.value = '';
            logTextArea.value = `Making request for action: ${action}...\n`;

            let url = 'index.php';
            const options = { method: 'POST' };
            const getActions = ['get_setup_players', 'get_players', 'get_matches', 'reset'];
            const getWithParamsActions = ['get_h2h_stats'];

            if (getActions.includes(action)) {
                options.method = 'GET';
                url += `?action=${action}`;
            } else if (getWithParamsActions.includes(action)) {
                options.method = 'GET';
                const params = new URLSearchParams(new FormData(form));
                url += `?action=${action}&${params.toString()}`;
            } else {
                const formData = new FormData(form);
                formData.append('action', action);
                if (action === 'start_game') {
                    logTextArea.value += 'Pre-loading players for start_game test...\n';
                    const p1Data = new FormData();
                    p1Data.append('action', 'add_player');
                    p1Data.append('playerName', 'Player 1');
                    await fetch(url, { method: 'POST', body: p1Data });
                    const p2Data = new FormData();
                    p2Data.append('action', 'add_player');
                    p2Data.append('playerName', 'Player 2');
                    await fetch(url, { method: 'POST', body: p2Data });
                    logTextArea.value += 'Players loaded. Starting game...\n';
                }
                options.body = formData;
            }

            try {
                const response = await fetch(url, options);
                const rawText = await response.text();
                logTextArea.value += `Received response from server (status: ${response.status}).\n`;
                responseTextArea.value = rawText;
                if (action === 'reset') {
                    logTextArea.value += "NOTE: Session destroyed. Subsequent requests will be in a new session.\n";
                }
            } catch (error) {
                logTextArea.value += `Network or fetch error:\n${error.toString()}`;
            }
        });
    }

    // Diagnostics Report Logic
    const copyBtn = document.getElementById('copyBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const reportContainer = document.getElementById('report-container');
            const reportText = reportContainer ? reportContainer.innerText : '';
            navigator.clipboard.writeText(reportText).then(() => {
                alert('Report copied to clipboard!');
            }, (err) => {
                alert('Failed to copy report.');
                console.error('Could not copy text: ', err);
            });
        });
    }
});