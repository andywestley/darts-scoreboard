document.addEventListener('DOMContentLoaded', () => {
    // --- Tab Functionality ---
    const tabs = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = document.getElementById(tab.dataset.tab);

            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            tabContents.forEach(c => c.classList.remove('active'));
            target.classList.add('active');
        });
    });

    // --- Interactive Testbed Form Handling ---
    const interactiveTab = document.getElementById('interactiveTab');
    if (!interactiveTab) return;

    const logTextArea = document.getElementById('logTextArea');
    const responseTextArea = document.getElementById('responseTextArea');
    const clearLogBtn = document.getElementById('clearLogBtn');
    const clearResponseBtn = document.getElementById('clearResponseBtn');
    const copyReportBtn = document.getElementById('copyBtn');

    // Map actions to their HTTP methods. Default to GET.
    const actionMethods = {
        'add_player': 'POST',
        'start_game': 'POST',
        'submit_score': 'POST',
        'reset': 'POST' // Resetting session state is a modification, so POST is appropriate.
    };

    const log = (message) => {
        logTextArea.value += `[${new Date().toLocaleTimeString()}] ${message}\n`;
        logTextArea.scrollTop = logTextArea.scrollHeight;
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const form = event.target;
        const submitter = event.submitter;
        if (!submitter || !submitter.name === 'action') return;

        const action = submitter.value;
        const method = actionMethods[action] || 'GET';
        const formData = new FormData(form);
        formData.append('action', action);

        // Add CSRF token for POST requests
        if (method === 'POST') {
            const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
            formData.append('csrf_token', csrfToken);
        }

        const url = 'index.php';
        const options = {
            method: method,
        };

        let fullUrl = url;
        if (method === 'GET') {
            fullUrl += '?' + new URLSearchParams(formData).toString();
            log(`Sending GET request to: ${fullUrl}`);
        } else { // POST
            options.body = new URLSearchParams(formData);
            log(`Sending POST request to: ${url} with action: ${action}`);
        }

        try {
            const response = await fetch(fullUrl, options);
            const responseText = await response.text();
            log(`Received response with status: ${response.status}`);

            try {
                // Try to format it nicely as JSON
                const jsonResponse = JSON.parse(responseText);
                responseTextArea.value = JSON.stringify(jsonResponse, null, 2);
            } catch (e) {
                // If not JSON, just show the raw text
                responseTextArea.value = responseText;
            }

        } catch (error) {
            log(`Network or fetch error: ${error.message}`);
            responseTextArea.value = `Fetch Error: ${error.message}\n\nIs the server running?`;
        }
    };

    // Attach event listener to all forms within the testbed
    interactiveTab.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', handleFormSubmit);
    });

    // --- Button Actions ---
    clearLogBtn.addEventListener('click', () => logTextArea.value = '');
    clearResponseBtn.addEventListener('click', () => responseTextArea.value = '');

    if (copyReportBtn) {
        copyReportBtn.addEventListener('click', () => {
            const reportContainer = document.getElementById('report-container');
            navigator.clipboard.writeText(reportContainer.innerText).then(() => {
                const originalText = copyReportBtn.innerText;
                copyReportBtn.innerText = 'Copied!';
                setTimeout(() => copyReportBtn.innerText = originalText, 2000);
            });
        });
    }
});