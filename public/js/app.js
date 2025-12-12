document.addEventListener('DOMContentLoaded', async function () {
    // --- Global Namespace & State ---
    const DartsApp = window.DartsApp || {};
    let jwtToken = null;
    DartsApp.soundSettings = { useSoundEffects: true };

    // --- JWT Management ---
    async function initializeAuth() {
        jwtToken = localStorage.getItem('darts_jwt');
        if (!jwtToken) {
            try {
                const response = await fetch('index.php', { // No JWT needed for this specific call
                    method: 'POST',
                    headers: { 'X-Action': 'auth:getToken' }
                });
                const data = await response.json();
                if (data.success && data.token) {
                    jwtToken = data.token;
                    localStorage.setItem('darts_jwt', jwtToken);
                }
            } catch (e) {
                console.error("Could not fetch auth token.", e);
                alert("Authentication failed. Please refresh.");
            }
        }
    }

    await initializeAuth(); // Ensure we have a token before doing anything else.

    // --- App Initialization ---
    DartsApp.postAction = async function(action, data = {}) {
        if (!jwtToken) throw new Error("Authentication token is missing.");
        const formData = new FormData();
        for (const key in data) {
            formData.append(key, data[key]);
        }
        try {
            const response = await fetch('index.php', {
                method: 'POST',
                headers: { 'X-Action': action, 'Authorization': `Bearer ${jwtToken}` },
                body: formData,
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Error posting action:', error);
            alert('An error occurred. Please check the console and refresh the page.');
            return { success: false };
        }
    };

    DartsApp.showScreen = function(screenId) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        const screen = document.getElementById(screenId);
        if (screen) {
            screen.classList.add('active');
            if (screenId === 'setupScreen') DartsApp.initSetupScreen();
            if (screenId === 'statsScreen') DartsApp.initStatsScreen();
            if (screenId === 'matchHistoryScreen') DartsApp.initMatchHistoryScreen();
        }
    };

    DartsApp.playSound = function(soundId) {
        if (!DartsApp.soundSettings.useSoundEffects) return;
        const sound = document.getElementById(soundId);
        if (sound && sound.dataset.failed !== 'true') {
            sound.currentTime = 0;
            sound.play().catch(error => {
                console.error(`Could not play sound '${soundId}'. It will be disabled.`, error);
                sound.dataset.failed = 'true';
            });
        }
    };

    DartsApp.handleReset = async function() {
        if (confirm('Are you sure you want to start a new game? All progress will be lost.')) {
            const res = await DartsApp.postAction('session:reset');
            if (res.success) window.location.reload();
        }
    };

    DartsApp.showMatchSummary = function(match) {
        const winner = match.standings[0];
        document.getElementById('matchWinnerName').innerText = `${winner.name} is the winner!`;
        const startNewMatchBtn = document.getElementById('startNewMatchBtn');
        if (startNewMatchBtn) startNewMatchBtn.addEventListener('click', DartsApp.handleReset);
        DartsApp.showScreen('matchSummaryScreen');
    };

    DartsApp.getCheckoutGuide = function(score) {
        if (score > 170 || score < 2) return '';
        const checkouts = { 170:"T20 T20 Bull",167:"T20 T19 Bull",164:"T20 T18 Bull",161:"T20 T17 Bull",160:"T20 T20 D20",158:"T20 T20 D19",157:"T20 T19 D20",156:"T20 T20 D18",154:"T20 T18 D20",153:"T20 T19 D18",152:"T20 T20 D16",151:"T20 T17 D20",150:"T20 T18 D18",149:"T20 T19 D16",148:"T20 T16 D20",147:"T20 T17 D18",146:"T20 T18 D16",145:"T20 T15 D20",144:"T20 T20 D12",143:"T20 T17 D16",142:"T20 T14 D20",141:"T20 T19 D12",140:"T20 T16 D16",139:"T20 T13 D20",138:"T20 T18 D12",137:"T19 T16 D16",136:"T20 T20 D8",135:"T20 T17 D12",134:"T20 T14 D16",133:"T20 T19 D8",132:"T20 T16 D12",131:"T20 T13 D16",130:"T20 T18 D8",129:"T19 T20 D6",128:"T18 T14 D16",127:"T20 T17 D8",126:"T19 T19 D6",125:"Bull T20 D7",124:"T20 D16 D16",123:"T19 T16 D9",122:"T18 T20 D4",121:"T20 T15 D8",120:"T20 20 D20",119:"T19 T10 D16",118:"T20 18 D20",117:"T20 17 D20",116:"T20 16 D20",115:"T20 15 D20",114:"T20 14 D20",113:"T20 13 D20",112:"T20 12 D20",111:"T20 19 D16",110:"T20 10 D20",109:"T20 9 D20",108:"T20 16 D16",107:"T19 10 D20",106:"T20 14 D16",105:"T20 13 D16",104:"T18 10 D20",103:"T20 3 D20",102:"T20 10 D16",101:"T17 10 D20",100:"T20 D20",99:"T19 10 D16",98:"T20 D19",97:"T19 D20",96:"T20 D18",95:"T19 D19",94:"T18 D20",93:"T19 D18",92:"T20 D16",91:"T17 D20",90:"T20 D15",89:"T19 D16",88:"T16 D20",87:"T17 D18",86:"T18 D16",85:"T15 D20",84:"T20 D12",83:"T17 D16",82:"T14 D20",81:"T19 D12",80:"T20 D10",79:"T13 D20",78:"T18 D12",77:"T19 D10",76:"T20 D8",75:"T17 D12",74:"T14 D16",73:"T19 D8",72:"T16 D12",71:"T13 D16",70:"T18 D8",69:"T15 D12",68:"T20 D4",67:"T17 D8",66:"T10 D18",65:"T19 D4",64:"T16 D8",63:"T13 D12",62:"T10 D16",61:"T15 D8",60:"20 D20",59:"19 D20",58:"18 D20",57:"17 D20",56:"16 D20",55:"15 D20",54:"14 D20",53:"13 D20",52:"12 D20",51:"11 D20",50:"10 D20",49:"9 D20",48:"8 D20",47:"7 D20",46:"6 D20",45:"5 D20",44:"4 D20",43:"3 D20",42:"2 D20",41:"1 D20",40:"D20",39:"7 D16",38:"D19",37:"5 D16",36:"D18",35:"3 D16",34:"D17",33:"1 D16",32:"D16",31:"15 D8",30:"D15",29:"13 D8",28:"D14",27:"11 D8",26:"D13",25:"9 D8",24:"D12",23:"7 D8",22:"D11",21:"5D8",20:"D10",19:"3 D8",18:"D9",17:"1 D8",16:"D8",15:"7 D4",14:"D7",13:"5 D4",12:"D6",11:"3 D4",10:"D5",9:"1 D4",8:"D4",7:"3 D2",6:"D3",5:"1 D2",4:"D2",3:"1 D1",2:"D1"};
        return checkouts[score] || '';
    };

    DartsApp.escapeHTML = function(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[&<>"']/g, (match) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[match]));
    };

    window.showScreen = DartsApp.showScreen; // Make it available globally for inline onclick attributes

    // Start the application
    DartsApp.showScreen('setupScreen');

}); // This is the closing brace for the main DOMContentLoaded listener