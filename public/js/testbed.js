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

    // --- Markdown Report Generation ---
    const setupMarkdownReportGenerator = () => {
        if (!copyReportBtn) return;

        const generateMarkdownReport = (reportData) => {
            let md = '## 🎯 Darts Scoreboard - Diagnostics Report\n\n';

            // Section 0: Environment
            md += '### 0. PHP Environment\n';
            md += '| Status | Check |\n|---|---|\n';
            reportData.environment.forEach(result => {
                md += `| ${result[0]} | ${result[1]} |\n`;
            });
            md += '\n';

            // Section 1: Permissions
            md += '### 1. File System Permissions\n';
            md += '| Status | Check | Path |\n|---|---|---|\n';
            reportData.permissions.forEach(result => {
                md += `| ${result[0]} | ${result[1]} | \`${result[2] || ''}\` |\n`;
            });
            md += '\n';

            // Section 2: API Tests
            md += '### 2. API Endpoint Tests\n';
            reportData.api.forEach((result, index) => {
                const { test, status_code, players_before, players_after, response_body, request_url, post_data_sent, response_headers, curl_error_num, curl_error_msg } = result;
                const isPass = status_code >= 200 && status_code < 300;
                md += `\n---\n\n**Test ${index + 1}: \`${test.action}\`** (${test.method})\n\n`;
                md += `- **Status:** ${isPass ? 'PASS' : 'FAIL'} (\`HTTP Code: ${status_code}\`)\n`;
                if (curl_error_num > 0) {
                    md += `- **cURL Error:** \`${curl_error_msg}\` (Code: ${curl_error_num})\n`;
                }
                md += '\n';

                md += '#### Request Details\n';
                md += '```\n' + `URL: ${request_url}` + '\n```\n';
                
                // Separate matchState from other POST data for clarity
                const { matchState, ...otherPostData } = post_data_sent;
                if (matchState) {
                    md += '```json\n// Match State (Input)\n' + JSON.stringify(JSON.parse(matchState), null, 2) + '\n```\n';
                }
                md += '```json\n// Other POST Data Sent\n' + JSON.stringify(otherPostData, null, 2) + '\n```\n\n';

                md += '#### Response Details\n';
                md += '```http\n// Response Headers\n' + (response_headers.trim() || '(No headers received)') + '\n```\n';
                const responseJson = JSON.parse(response_body.trim() || '{}');
                if (responseJson.match) {
                    md += '```json\n// Match State (Output)\n' + JSON.stringify(responseJson.match, null, 2) + '\n```\n';
                }
                md += '```json\n// Full Response Body\n' + JSON.stringify(responseJson, null, 2) + '\n```\n\n';

                md += '#### State Changes\n';
                md += '```json\n// players.json (before)\n' + (players_before.trim() || '{}') + '\n```\n';
                md += '```json\n// players.json (after)\n' + (players_after.trim() || '{}') + '\n```\n';
            });

            return md;
        };

        copyReportBtn.addEventListener('click', () => {
            const reportJsonElement = document.getElementById('report-data-json');
            if (!reportJsonElement) {
                log('Error: Could not find report data element.');
                return;
            }

            try {
                const reportData = JSON.parse(reportJsonElement.textContent);
                const markdownReport = generateMarkdownReport(reportData);
                navigator.clipboard.writeText(markdownReport).then(() => {
                    const originalText = copyReportBtn.innerText;
                    copyReportBtn.innerText = 'Copied!';
                    setTimeout(() => copyReportBtn.innerText = originalText, 2000);
                });
            } catch (e) {
                log(`Error generating report: ${e.message}`);
                console.error("Report Generation Error:", e);
            }
        });
    };

    setupMarkdownReportGenerator();
});