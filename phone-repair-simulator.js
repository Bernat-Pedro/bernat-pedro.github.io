// PHONE REPAIR SIMULATOR - Main Game Logic

// ============================================
// GAME STATE
// ============================================

const gameState = {
    money: 0,
    level: 1,
    reputation: 0,
    phonesRepaired: 0,
    totalEarnings: 0,
    
    // Current job
    currentJob: null,
    
    // Repairs
    activeRepairs: [],
    completedRepairs: [],
    retiredJobIds: [],
    
    // Inventory
    inventory: {
        screens: 0,
        batteries: 0,
        ports: 0,
        screws: 20,
        tools: ['Phillips screwdriver', 'Flat screwdriver', 'Tweezers', 'Suction cup']
    },
    
    // Upgrades purchased
    upgrades: {}
};

// ============================================
// DIAGNOSTIC DATABASE - 1000+ Scenarios
// ============================================

let diagnosticDatabase = [];

function generateDiagnosticDatabase() {
    const brands = ['Apple iPhone', 'Samsung Galaxy', 'Google Pixel', 'OnePlus', 'Xiaomi', 'Motorola', 'LG', 'Nokia', 'Sony Xperia', 'HTC'];
    const models = ['12', '13', '14', '15', 'Pro', 'Pro Max', 'Ultra', 'Plus', 'Mini', 'SE'];
    const generations = ['2020', '2021', '2022', '2023', '2024'];
    
    const problems = [
        // Screen issues
        {cat: 'screen', name: 'Cracked screen', proc: 'display', symptoms: ['Display cracks visible'], difficulty: 'hard', parts: ['screen'], pay: 150},
        {cat: 'screen', name: 'Black screen', proc: 'display', symptoms: ['No display'], difficulty: 'medium', parts: ['screen'], pay: 120},
        {cat: 'screen', name: 'Flickering display', proc: 'display', symptoms: ['Screen flickers'], difficulty: 'medium', parts: ['screen'], pay: 110},
        {cat: 'screen', name: 'Dead pixels', proc: 'display', symptoms: ['Dark spots'], difficulty: 'easy', parts: ['screen'], pay: 80},
        {cat: 'screen', name: 'Ghost touches', proc: 'display', symptoms: ['Touch unresponsive'], difficulty: 'hard', parts: ['screen'], pay: 140},
        {cat: 'screen', name: 'Green lines', proc: 'display', symptoms: ['Vertical lines'], difficulty: 'medium', parts: ['screen'], pay: 100},
        {cat: 'screen', name: 'Screen separation', proc: 'adhesive', symptoms: ['Screen loose'], difficulty: 'easy', parts: ['adhesive'], pay: 60},
        
        // Battery issues
        {cat: 'battery', name: 'Battery draining fast', proc: 'battery', symptoms: ['Low battery quickly'], difficulty: 'easy', parts: ['battery'], pay: 85},
        {cat: 'battery', name: 'Battery not charging', proc: 'battery', symptoms: ['Wont charge'], difficulty: 'medium', parts: ['battery'], pay: 95},
        {cat: 'battery', name: 'Swollen battery', proc: 'battery', symptoms: ['Battery bulging'], difficulty: 'easy', parts: ['battery'], pay: 75},
        {cat: 'battery', name: 'Random shutdowns', proc: 'battery', symptoms: ['Phone turns off'], difficulty: 'hard', parts: ['battery'], pay: 130},
        {cat: 'battery', name: 'Battery percentage stuck', proc: 'battery', symptoms: ['Percent not updating'], difficulty: 'medium', parts: ['battery'], pay: 90},
        {cat: 'battery', name: 'Battery overheating', proc: 'battery', symptoms: ['Phone hot'], difficulty: 'medium', parts: ['battery'], pay: 100},
        
        // Charging issues
        {cat: 'charge', name: 'Broken charging port', symptoms: ['Cant charge'], difficulty: 'hard', parts: ['port'], pay: 140},
        {cat: 'charge', name: 'Loose charging connection', symptoms: ['Intermittent charge'], difficulty: 'easy', parts: ['port'], pay: 50},
        {cat: 'charge', name: 'Only charges at angle', symptoms: ['Specific angle needed'], difficulty: 'medium', parts: ['port'], pay: 110},
        {cat: 'charge', name: 'Wireless charging broken', symptoms: ['No wireless charge'], difficulty: 'medium', parts: ['coil'], pay: 120},
        {cat: 'charge', name: 'Charging IC failure', proc: 'board', symptoms: ['Wont charge'], difficulty: 'hard', parts: ['ic'], pay: 160},
        
        // Camera issues
        {cat: 'camera', name: 'Blurry camera', symptoms: ['Photos blurry'], difficulty: 'medium', parts: ['camera'], pay: 95},
        {cat: 'camera', name: 'Camera not opening', symptoms: ['App wont start'], difficulty: 'medium', parts: ['camera'], pay: 100},
        {cat: 'camera', name: 'Broken camera glass', symptoms: ['Lens damaged'], difficulty: 'easy', parts: ['lens'], pay: 70},
        {cat: 'camera', name: 'Autofocus failure', symptoms: ['Cant focus'], difficulty: 'hard', parts: ['camera'], pay: 130},
        {cat: 'camera', name: 'Front camera broken', symptoms: ['Selfie camera dead'], difficulty: 'medium', parts: ['camera'], pay: 105},
        
        // Audio issues
        {cat: 'audio', name: 'Broken speaker', symptoms: ['No sound'], difficulty: 'medium', parts: ['speaker'], pay: 80},
        {cat: 'audio', name: 'Microphone broken', symptoms: ['Cant hear caller'], difficulty: 'easy', parts: ['mic'], pay: 60},
        {cat: 'audio', name: 'Distorted audio', symptoms: ['Sound crackling'], difficulty: 'hard', parts: ['audio'], pay: 115},
        {cat: 'audio', name: 'Silent mode stuck', symptoms: ['Vibrate only'], difficulty: 'easy', parts: ['button'], pay: 55},
        
        // Other issues
        {cat: 'other', name: 'Water damage', proc: 'water', symptoms: ['Liquid inside'], difficulty: 'hard', parts: ['components'], pay: 180},
        {cat: 'other', name: 'Broken power button', symptoms: ['Cant turn on'], difficulty: 'medium', parts: ['button'], pay: 100},
        {cat: 'other', name: 'Face ID broken', symptoms: ['Recognition fails'], difficulty: 'hard', parts: ['sensor'], pay: 150},
        {cat: 'other', name: 'Wi-Fi not working', symptoms: ['No networks'], difficulty: 'medium', parts: ['antenna'], pay: 105},
        {cat: 'other', name: 'Bluetooth issues', symptoms: ['Cant connect'], difficulty: 'medium', parts: ['antenna'], pay: 95},
        {cat: 'other', name: 'Damaged motherboard', proc: 'board', symptoms: ['Multiple issues'], difficulty: 'hard', parts: ['board'], pay: 200},

        // Additional repairs
        {cat: 'screen', name: 'Touchscreen unresponsive', proc: 'display', symptoms: ['Taps ignored', 'Display image normal'], difficulty: 'medium', parts: ['digitizer'], pay: 125},
        {cat: 'screen', name: 'OLED burn-in', proc: 'display', symptoms: ['Keyboard shadow on screen'], difficulty: 'easy', parts: ['screen'], pay: 115},
        {cat: 'screen', name: 'Back glass shattered', proc: 'backglass', symptoms: ['Rear glass cracked', 'Sharp edges'], difficulty: 'medium', parts: ['back glass'], pay: 120},
        {cat: 'battery', name: 'Corroded battery connector', proc: 'clean', symptoms: ['Phone dies when moved', 'Green residue on connector'], difficulty: 'medium', parts: [], pay: 105},
        {cat: 'charge', name: 'Lint in charging port', proc: 'clean', symptoms: ['Cable will not click in', 'Charges intermittently'], difficulty: 'easy', parts: [], pay: 55},
        {cat: 'camera', name: 'Flash LED not working', proc: 'standard', symptoms: ['Torch does not light'], difficulty: 'medium', parts: ['flash flex'], pay: 90},
        {cat: 'camera', name: 'Camera module rattling', proc: 'standard', symptoms: ['Buzzing in camera app', 'Shaky video'], difficulty: 'hard', parts: ['camera'], pay: 145},
        {cat: 'camera', name: 'Fogged camera lens', proc: 'clean', symptoms: ['Hazy photos', 'Condensation behind lens'], difficulty: 'medium', parts: [], pay: 85},
        {cat: 'audio', name: 'Clogged speaker grille', proc: 'clean', symptoms: ['Quiet loudspeaker', 'Dust in grille'], difficulty: 'easy', parts: [], pay: 50},
        {cat: 'audio', name: 'No sound during calls', proc: 'standard', symptoms: ['Caller inaudible', 'Speakerphone works'], difficulty: 'medium', parts: ['earpiece'], pay: 85},
        {cat: 'other', name: 'Proximity sensor failure', proc: 'standard', symptoms: ['Screen stays on during calls', 'Cheek presses buttons'], difficulty: 'hard', parts: ['proximity sensor'], pay: 140},
        {cat: 'other', name: 'Vibration motor dead', proc: 'standard', symptoms: ['No haptics', 'Silent alerts'], difficulty: 'easy', parts: ['taptic motor'], pay: 70},
        {cat: 'other', name: 'Sticky volume buttons', proc: 'clean', symptoms: ['Buttons stick down', 'Volume changes randomly'], difficulty: 'easy', parts: [], pay: 60},
        {cat: 'other', name: 'SIM card not detected', proc: 'standard', symptoms: ['No SIM message', 'Calls fail'], difficulty: 'medium', parts: ['SIM reader'], pay: 110},
        {cat: 'other', name: 'Fingerprint sensor failure', proc: 'standard', symptoms: ['Fingerprint not recognised'], difficulty: 'hard', parts: ['fingerprint sensor'], pay: 135},
        {cat: 'other', name: 'Short circuit on board', proc: 'board', symptoms: ['Dead phone', 'Hot spot near CPU'], difficulty: 'hard', parts: ['capacitor'], pay: 220},
    ];

    for (let i = 0; i < 50; i++) {
        for (const problem of problems) {
            diagnosticDatabase.push({
                id: `diag_${diagnosticDatabase.length}`,
                brand: brands[Math.floor(Math.random() * brands.length)],
                model: models[Math.floor(Math.random() * models.length)],
                generation: generations[Math.floor(Math.random() * generations.length)],
                problem: problem.name,
                category: problem.cat,
                procedureType: problem.proc || 'standard',
                symptoms: problem.symptoms,
                difficulty: problem.difficulty,
                requiredParts: problem.parts,
                payment: problem.pay + Math.floor(Math.random() * 30)
            });
        }
    }

    return diagnosticDatabase;
}

// ============================================
// UPGRADES CATALOG
// ============================================

const upgradeCatalog = [
    {id: 'better_tools', name: 'Professional Tools', price: 200, effect: 'Faster repairs', icon: '🔧'},
    {id: 'extra_space', name: 'Larger Workspace', price: 500, effect: 'More efficiency', icon: '📏'},
    {id: 'fast_computer', name: 'Faster Computer', price: 300, effect: 'Quick diagnostics', icon: '⚡'},
    {id: 'parts_storage', name: 'Better Storage', price: 250, effect: 'Hold more parts', icon: '📦'},
    {id: 'reputation_boost', name: 'Marketing', price: 400, effect: 'Better jobs', icon: '📢'},
    {id: 'second_station', name: 'Second Repair Station', price: 1000, effect: 'Parallel repairs', icon: '🛠️'},
    {id: 'diagnostic_kit', name: 'Advanced Diagnostics', price: 600, effect: 'Better accuracy', icon: '🔬'},
    {id: 'screen_station', name: 'Screen Replacement Station', price: 750, effect: 'Screen repairs faster', icon: '🖥️'},
];

// ============================================
// UI FUNCTIONS
// ============================================

function switchView(viewName) {
    window.cancelRepairGesture?.();
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewName).classList.add('active');
    window.renderGameCanvases?.();
}

function openComputer() {
    switchView('computerScreen');
    updateComputerUI();
}

function closeComputer() {
    switchView('workshopView');
}

function updateComputerUI() {
    updateJobsTab();
    updateUpgradesTab();
    updateInventoryTab();
    updateStatsTab();
    updateRepairsTab();
}

function getJobOfferOrder() {
    const groups = new Map(
        ['display', 'clean', 'battery', 'board', 'backglass', 'standard', 'water', 'adhesive']
            .map(type => [type, new Map()])
    );
    diagnosticDatabase.forEach((job, index) => {
        const type = job.procedureType || 'standard';
        if (!groups.has(type)) groups.set(type, new Map());
        const problems = groups.get(type);
        if (!problems.has(job.problem)) problems.set(job.problem, []);
        problems.get(job.problem).push({ job, index });
    });

    const ordered = [];
    const problemGroups = Array.from(groups.values(), group => Array.from(group.values()));
    const longestGroup = Math.max(0, ...problemGroups.map(group => group.length));
    const mostVariants = Math.max(0, ...problemGroups.flat().map(problem => problem.length));
    for (let variant = 0; variant < mostVariants; variant++) {
        for (let i = 0; i < longestGroup; i++) {
            for (const group of problemGroups) {
                if (group[i]?.[variant]) ordered.push(group[i][variant]);
            }
        }
    }
    return ordered;
}

function updateJobsTab() {
    const jobsGrid = document.getElementById('jobsGrid');
    jobsGrid.innerHTML = '';
    const retiredIds = new Set(gameState.retiredJobIds);
    const activeIds = new Set(gameState.activeRepairs.map(job => job.id));
    const serviceNames = {
        display: 'Screen repair',
        clean: 'Cleaning',
        battery: 'Battery replacement',
        board: 'Board repair',
        backglass: 'Back glass replacement',
        standard: 'Component replacement',
        water: 'Water damage repair',
        adhesive: 'Screen re-adhesion'
    };
    
    const availableJobs = getJobOfferOrder()
        .filter(({ job }) => !retiredIds.has(job.id) && !activeIds.has(job.id))
        .slice(0, 6);

    if (!availableJobs.length) {
        jobsGrid.textContent = 'No jobs available while all remaining jobs are active.';
    }

    availableJobs.forEach(({ job, index: idx }) => {
        const card = document.createElement('div');
        card.className = 'job-card';
        card.dataset.jobId = job.id;
        card.innerHTML = `
            <div class="job-header">
                <div class="job-title">${job.brand} ${job.model}</div>
                <div class="job-difficulty ${job.difficulty}">${job.difficulty.toUpperCase()}</div>
            </div>
            <div class="job-description">
                <strong>Problem:</strong> ${job.problem}<br>
                <strong>Service:</strong> ${serviceNames[job.procedureType] || 'Component replacement'}<br>
                <strong>Symptoms:</strong> ${job.symptoms.join(', ')}<br>
                <strong>Gen:</strong> ${job.generation}
            </div>
            <div class="job-reward">💰 $${job.payment}</div>
            <div class="job-buttons">
                <button class="job-btn" onclick="acceptJob(${idx})">ACCEPT</button>
                <button class="job-btn reject" onclick="rejectJob(${idx})">REJECT</button>
            </div>
        `;
        jobsGrid.appendChild(card);
    });
}

function retireJob(jobId) {
    if (!gameState.retiredJobIds.includes(jobId)) {
        gameState.retiredJobIds.push(jobId);
    }
    const retiredIds = new Set(gameState.retiredJobIds);
    const activeIds = new Set(gameState.activeRepairs.map(job => job.id));
    if (!diagnosticDatabase.some(job => !retiredIds.has(job.id) && !activeIds.has(job.id))) {
        gameState.retiredJobIds = [];
    }
}

function updateRepairsTab() {
    const repairsList = document.getElementById('repairsList');
    repairsList.replaceChildren();
    if (!gameState.activeRepairs.length) {
        const empty = document.createElement('p');
        empty.textContent = 'No active repairs';
        repairsList.appendChild(empty);
        return;
    }
    gameState.activeRepairs.forEach(job => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'job-card active-repair-card';
        card.dataset.jobId = job.id;
        card.setAttribute('aria-label', `Continue job: ${job.brand} ${job.model} - ${job.problem}`);
        card.addEventListener('click', () => resumeJob(job.id));
        const title = document.createElement('strong');
        title.textContent = `${job.brand} ${job.model} - ${job.problem}`;
        const progress = document.createElement('span');
        progress.className = 'job-description';
        progress.textContent = `${job.repairProgress} / ${getRepairProcedure(job).length} repair steps completed`;
        const action = document.createElement('span');
        action.className = 'job-btn';
        action.textContent = 'Continue job';
        card.append(title, progress, action);
        repairsList.appendChild(card);
    });
}

function updateUpgradesTab() {
    const upgradesGrid = document.getElementById('upgradesGrid');
    upgradesGrid.innerHTML = '';
    
    upgradeCatalog.forEach(upgrade => {
        const purchased = gameState.upgrades[upgrade.id];
        const card = document.createElement('div');
        card.className = `upgrade-card ${purchased ? 'purchased' : ''}`;
        card.innerHTML = `
            <div class="upgrade-icon">${upgrade.icon}</div>
            <div class="upgrade-name">${upgrade.name}</div>
            <div class="upgrade-description">${upgrade.effect}</div>
            <div class="upgrade-price">$${upgrade.price}</div>
            <button class="upgrade-btn ${purchased ? 'purchased' : ''}" 
                onclick="buyUpgrade('${upgrade.id}')" ${purchased ? 'disabled' : ''}>
                ${purchased ? '✓ OWNED' : 'BUY'}
            </button>
        `;
        upgradesGrid.appendChild(card);
    });
}

function updateInventoryTab() {
    const inventoryGrid = document.getElementById('inventoryGrid');
    inventoryGrid.innerHTML = '';
    
    const items = [
        {name: 'Screens', qty: gameState.inventory.screens, icon: '🖥️'},
        {name: 'Batteries', qty: gameState.inventory.batteries, icon: '🔋'},
        {name: 'Charging Ports', qty: gameState.inventory.ports, icon: '🔌'},
        {name: 'Screws', qty: gameState.inventory.screws, icon: '🔩'},
    ];
    
    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inventory-item';
        div.innerHTML = `
            <div class="item-icon">${item.icon}</div>
            <div class="item-name">${item.name}</div>
            <div class="item-quantity">x${item.qty}</div>
        `;
        inventoryGrid.appendChild(div);
    });
}

function updateStatsTab() {
    const statsContent = document.getElementById('statisticsContent');
    statsContent.innerHTML = `
        <div class="stat-card">
            <div class="stat-label">TOTAL EARNED</div>
            <div class="stat-value">$${gameState.money}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">PHONES REPAIRED</div>
            <div class="stat-value">${gameState.phonesRepaired}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">CURRENT LEVEL</div>
            <div class="stat-value">${gameState.level}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">REPUTATION</div>
            <div class="stat-value">${gameState.reputation}</div>
        </div>
        <div class="stat-card">
            <div class="stat-label">COMPLETED JOBS</div>
            <div class="stat-value">${gameState.completedRepairs.length}</div>
        </div>
    `;
}

function updateMoneyDisplay() {
    document.getElementById('moneyDisplay').textContent = '$' + gameState.money;
    document.getElementById('levelDisplay').textContent = gameState.level;
    document.getElementById('reputationDisplay').textContent = gameState.reputation;
    document.getElementById('phonesRepairedDisplay').textContent = gameState.phonesRepaired;
}

function acceptJob(jobIndex) {
    const existing = gameState.activeRepairs.find(job => job.id === diagnosticDatabase[jobIndex].id);
    if (existing) {
        resumeJob(existing.id);
        return;
    }
    gameState.currentJob = {
        ...diagnosticDatabase[jobIndex], diagnosticResults: {},
        repairProgress: 0, selectedTool: null, tested: false, repairLog: []
    };
    gameState.activeRepairs.push(gameState.currentJob);
    document.getElementById('repairLog').replaceChildren();
    showNotification(`Job accepted: ${gameState.currentJob.brand} ${gameState.currentJob.model}`, 'success');
    switchView('repairTableView');
    renderRepairTable();
    saveGame();
}

function resumeJob(jobId) {
    const job = gameState.activeRepairs.find(job => job.id === jobId);
    if (!job) {
        showNotification('This repair is no longer active.', 'warning');
        return;
    }
    gameState.currentJob = job;
    const log = document.getElementById('repairLog');
    log.replaceChildren();
    job.repairLog.forEach(message => {
        const entry = document.createElement('div');
        entry.className = 'log-entry success';
        entry.textContent = message;
        log.appendChild(entry);
    });
    switchView('repairTableView');
    document.getElementById('repairTableView').scrollTop = 0;
    renderRepairTable();
    showNotification(`Continuing repair: ${job.brand} ${job.model}`, 'info');
}

function rejectJob(jobIndex) {
    const job = diagnosticDatabase[jobIndex];
    if (!job || gameState.retiredJobIds.includes(job.id) ||
        gameState.activeRepairs.some(active => active.id === job.id)) {
        showNotification('This job is no longer available.', 'warning');
        return;
    }
    retireJob(job.id);
    updateJobsTab();
    saveGame();
    showNotification('Job rejected', 'warning');
}

function buyUpgrade(upgradeId) {
    const upgrade = upgradeCatalog.find(u => u.id === upgradeId);
    if (gameState.money >= upgrade.price) {
        gameState.money -= upgrade.price;
        gameState.upgrades[upgradeId] = true;
        updateMoneyDisplay();
        updateUpgradesTab();
        showNotification(`Purchased: ${upgrade.name}`, 'success');
        saveGame();
    } else {
        showNotification('Not enough money', 'error');
    }
}

function showNotification(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    setTimeout(() => toast.className = 'toast', 3000);
}

// ============================================
// REPAIR GAMEPLAY
// ============================================

const repairToolAreas = [
    { tool: 'Precision screwdriver', x: 108, y: 170, width: 70, height: 135 },
    { tool: 'Precision screwdriver', x: 198, y: 170, width: 70, height: 135 },
    { tool: 'Tweezers', x: 104, y: 350, width: 80, height: 140 },
    { tool: 'Opening pick', x: 192, y: 365, width: 90, height: 125 },
    { tool: 'Cleaning brush', x: 288, y: 170, width: 76, height: 135 },
    { tool: 'Multimeter', x: 288, y: 355, width: 76, height: 135 },
    { tool: 'Heat gun', x: 742, y: 170, width: 132, height: 165 },
    { tool: 'Suction cup', x: 694, y: 355, width: 100, height: 135 },
    { tool: 'Replacement part', x: 810, y: 355, width: 100, height: 120 }
];

function getRepairProcedure(job) {
    const part = job.requiredParts.join(' / ') || 'component';
    const step = {
        screws: { id: 'screws', text: 'Power off the phone and remove the external screws', tool: 'Precision screwdriver' },
        heat: { id: 'heat', text: 'Warm the adhesive with controlled heat', tool: 'Heat gun' },
        lift: { id: 'lift', text: 'Lift the damaged display with the suction cup', tool: 'Suction cup' },
        open: { id: 'open', text: 'Release the cover clips with an opening pick', tool: 'Opening pick' },
        disconnect: { id: 'disconnect', text: 'Disconnect the battery connector', tool: 'Tweezers' },
        pulltab: { id: 'pulltab', text: 'Pull the battery adhesive tab slowly', tool: 'Tweezers' },
        shield: { id: 'shield', text: 'Lift the metal EMI shield off the logic board', tool: 'Tweezers' },
        clean: { id: 'clean', text: 'Scrub the corrosion and debris with the IPA brush', tool: 'Cleaning brush' },
        measure: { id: 'measure', text: 'Probe the test pads with the multimeter (red, then black)', tool: 'Multimeter' },
        remove: { id: 'remove', text: `Remove the faulty ${part}`, tool: 'Tweezers' },
        replace: { id: 'replace', text: `Install the supplied replacement ${part}`, tool: 'Replacement part' },
        connect: { id: 'connect', text: 'Reconnect the component cables and battery', tool: 'Tweezers' },
        seat: { id: 'seat', text: 'Move the cover back onto the phone', tool: 'Suction cup' },
        close: { id: 'close', text: 'Seat the cover and secure the screws', tool: 'Precision screwdriver' }
    };
    const custom = (id, text) => ({ ...step[id], text });
    const procedures = {
        standard: ['screws', 'open', 'disconnect', 'remove', 'replace', 'connect', 'seat', 'close'],
        display: ['screws', 'heat', 'lift', 'open', 'disconnect', 'remove', 'replace', 'connect', 'seat', 'close'],
        battery: ['screws', 'open', 'disconnect', 'pulltab', 'remove', 'replace',
            custom('measure', 'Check the new battery voltage with the multimeter (red, then black)'),
            'connect', 'seat', 'close'],
        clean: ['screws', 'open', 'disconnect',
            custom('clean', `Scrub the ${job.problem.toLowerCase()} area clean with the IPA brush`),
            custom('measure', 'Verify continuity across the cleaned contacts (red, then black)'),
            'connect', 'seat', 'close'],
        water: ['screws', 'open', 'disconnect', 'shield', 'clean', 'measure',
            'remove', 'replace', 'connect', 'seat', 'close'],
        board: ['screws', 'open', 'disconnect', 'shield',
            custom('measure', 'Find the shorted rail with the multimeter (red, then black)'),
            'remove', 'replace', 'connect', 'seat', 'close'],
        backglass: ['heat', custom('lift', 'Lift the shattered back glass with the suction cup'),
            custom('clean', 'Scrub the old adhesive and glass shards off the frame'),
            custom('seat', 'Press the new back glass into the frame')],
        adhesive: ['screws', custom('heat', 'Soften the failed screen adhesive'),
            custom('lift', 'Lift the loose screen with the suction cup'),
            custom('clean', 'Scrub away the old adhesive residue'),
            custom('seat', 'Lay the screen back on fresh adhesive'),
            'close']
    };
    // Saved repairs from earlier versions have no procedureType; keep their original step order.
    const type = job.procedureType ||
        (job.category === 'screen' && job.problem !== 'Screen separation' ? 'display' : 'standard');
    return (procedures[type] || procedures.standard).map(item => typeof item === 'string' ? step[item] : item);
}

function diagnosticsAreComplete(job) {
    return diagnosticTests.every(test => job.diagnosticResults?.[test.id]);
}

function appendRepairLog(message) {
    gameState.currentJob.repairLog.push(message);
    const entry = document.createElement('div');
    entry.className = 'log-entry success';
    entry.textContent = message;
    const log = document.getElementById('repairLog');
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function renderRepairTable() {
    if (!gameState.currentJob) return;
    
    const job = gameState.currentJob;
    document.getElementById('repairPhoneModel').textContent = `${job.brand} ${job.model}`;
    document.getElementById('repairProblem').textContent = `Problem: ${job.problem}`;
    
    const stepsDiv = document.getElementById('repairSteps');
    const diagnosticsComplete = diagnosticsAreComplete(job);
    const procedure = getRepairProcedure(job);
    const progress = job.repairProgress;
    const step = procedure[progress];
    document.getElementById('repairToolHint').textContent = !diagnosticsComplete
        ? 'Complete all four diagnostics before using tools.'
        : step
            ? `${step.text}. ${getManualRepairHint(step.id)}`
            : job.tested ? 'Test passed. Press Complete to collect payment.' : 'Reassembly complete. Press Test.';
    const items = [
        { text: 'Diagnostics', complete: diagnosticsComplete, current: !diagnosticsComplete },
        ...procedure.map((step, index) => ({
            text: step.text, complete: index < progress,
            current: diagnosticsComplete && index === progress
        })),
        { text: 'Test the repaired phone', complete: job.tested, current: progress === procedure.length && !job.tested }
    ];
    stepsDiv.replaceChildren();
    const title = document.createElement('div');
    title.className = 'diagnostic-name';
    title.textContent = `REPAIR STEPS (${progress} / ${procedure.length})`;
    stepsDiv.appendChild(title);
    items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = `step-item${item.complete ? ' completed' : ''}${item.current ? ' current' : ''}`;
        row.textContent = `${index + 1}. ${item.text}`;
        stepsDiv.appendChild(row);
    });
    window.renderGameCanvases?.();
}

function openRepairInstructions() {
    const job = gameState.currentJob;
    if (!job) {
        showNotification('Accept a repair job first.', 'warning');
        return;
    }
    if (!diagnosticsAreComplete(job)) {
        showNotification('Complete all four diagnostic checks before repairing.', 'warning');
        return;
    }
    renderRepairInstructions();
    window.cancelRepairGesture?.();
    document.getElementById('repairInstructionsModal').classList.add('active');
}

function renderRepairInstructions() {
    const job = gameState.currentJob;
    const procedure = getRepairProcedure(job);
    const step = procedure[job.repairProgress];
    const panel = document.getElementById('instructionsContent');
    panel.replaceChildren();
    const description = document.createElement('p');
    description.className = 'repair-next-step';
    description.setAttribute('role', 'status');
    description.textContent = step
        ? `Step ${job.repairProgress + 1} / ${procedure.length}: ${step.text}. ${getManualRepairHint(step.id)} Close this panel to work on the mat.`
        : 'Reassembly complete. Close this panel and press Test to check the phone.';
    panel.appendChild(description);
    if (!step) return;
    const tools = document.createElement('div');
    tools.className = 'repair-tool-options';
    [...new Set(repairToolAreas.map(area => area.tool))].forEach(tool => {
        const button = document.createElement('button');
        button.className = 'action-btn';
        button.textContent = tool;
        button.setAttribute('aria-pressed', String(job.selectedTool === tool));
        button.addEventListener('click', () => selectRepairTool(tool));
        tools.appendChild(button);
    });
    panel.appendChild(tools);
}

function selectRepairTool(tool) {
    const job = gameState.currentJob;
    if (!job || !diagnosticsAreComplete(job)) {
        showNotification('Complete all four diagnostic checks before using tools.', 'warning');
        return;
    }
    if (!repairToolAreas.some(area => area.tool === tool)) {
        showNotification('Unknown repair tool.', 'error');
        return;
    }
    if (job.repairProgress === getRepairProcedure(job).length) {
        showNotification('Reassembly is complete. Test the phone next.', 'warning');
        return;
    }
    job.selectedTool = tool;
    renderRepairTable();
    if (document.getElementById('repairInstructionsModal').classList.contains('active')) {
        renderRepairInstructions();
    }
    showNotification(`${tool} selected. Drag it on the mat and follow the highlighted guides.`, 'info');
}

function finishManualRepairStep() {
    const job = gameState.currentJob;
    if (!job || !diagnosticsAreComplete(job)) {
        showNotification('Complete diagnostics on an active repair first.', 'warning');
        return;
    }
    const step = getRepairProcedure(job)[job.repairProgress];
    if (!step) {
        showNotification('Reassembly is complete. Test the phone next.', 'warning');
        return;
    }
    if (job.selectedTool !== step.tool) {
        showNotification(`Select ${step.tool} for this step.`, 'warning');
        return;
    }
    job.repairProgress++;
    job.manualWork = null;
    job.selectedTool = null;
    appendRepairLog(`Completed: ${step.text}.`);
    renderRepairTable();
    renderRepairInstructions();
    showNotification('Repair step completed.', 'success');
}

function testRepair() {
    const job = gameState.currentJob;
    if (!job || !diagnosticsAreComplete(job) || job.repairProgress !== getRepairProcedure(job).length) {
        showNotification('Finish the repair and reassemble the phone before testing.', 'warning');
        return;
    }
    if (job.tested) {
        showNotification('The phone has already passed testing. Press Complete.', 'warning');
        return;
    }
    job.tested = true;
    appendRepairLog(`Final test passed: ${job.problem} resolved. Phone ready for the customer.`);
    renderRepairTable();
    showNotification('Phone passed testing! Press Complete to collect payment.', 'success');
}

function completeRepair() {
    if (!gameState.currentJob) return;
    
    const job = gameState.currentJob;
    if (!diagnosticsAreComplete(job) || job.tested !== true || job.repairProgress !== getRepairProcedure(job).length) {
        showNotification('Repair and test the phone before completing the job.', 'warning');
        return;
    }
    gameState.money += job.payment;
    gameState.phonesRepaired++;
    gameState.reputation += 5;
    gameState.totalEarnings += job.payment;
    
    if (gameState.phonesRepaired % 10 === 0) {
        gameState.level++;
    }
    
    gameState.completedRepairs.push(job);
    gameState.activeRepairs = gameState.activeRepairs.filter(r => r.id !== job.id);
    retireJob(job.id);
    
    updateMoneyDisplay();
    showNotification(`Repair complete! +$${job.payment}`, 'success');
    saveGame();
    
    switchView('workshopView');
    gameState.currentJob = null;
}

// ============================================
// SAVE SYSTEM
// ============================================

function saveGame() {
    localStorage.setItem('phoneRepairSave', JSON.stringify({
        money: gameState.money,
        level: gameState.level,
        reputation: gameState.reputation,
        phonesRepaired: gameState.phonesRepaired,
        totalEarnings: gameState.totalEarnings,
        upgrades: gameState.upgrades,
        inventory: gameState.inventory,
        activeRepairs: gameState.activeRepairs,
        retiredJobIds: gameState.retiredJobIds,
        completedRepairs: gameState.completedRepairs.length
    }));
}

function loadGame() {
    const save = localStorage.getItem('phoneRepairSave');
    if (save) {
        const data = JSON.parse(save);
        gameState.money = data.money || 0;
        gameState.level = data.level || 1;
        gameState.reputation = data.reputation || 0;
        gameState.phonesRepaired = data.phonesRepaired || 0;
        gameState.totalEarnings = data.totalEarnings || 0;
        gameState.upgrades = data.upgrades || {};
        gameState.inventory = data.inventory || gameState.inventory;
        gameState.activeRepairs = data.activeRepairs || [];
        gameState.retiredJobIds = Array.isArray(data.retiredJobIds) ? data.retiredJobIds : [];
    }
}

// ============================================
// WORKSHOP RENDERING
// ============================================

const workshopCanvas = document.getElementById('workshopCanvas');
const ctx = workshopCanvas.getContext('2d');

function drawWorkshop() {
    ctx.fillStyle = '#0a1a2a';
    ctx.fillRect(0, 0, workshopCanvas.width, workshopCanvas.height);
    
    // Desk
    ctx.fillStyle = '#4a3f35';
    ctx.fillRect(50, 100, 300, 150);
    
    // Computer on desk
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(120, 120, 160, 100);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 3;
    ctx.strokeRect(120, 120, 160, 100);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(125, 125, 150, 90);
    ctx.fillStyle = '#00d4ff';
    ctx.font = '20px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('💻', 200, 175);
    
    // Repair mat
    ctx.fillStyle = '#3a5a6a';
    ctx.fillRect(450, 150, 300, 250);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(450, 150, 300, 250);
    ctx.fillStyle = '#b0b0b0';
    ctx.font = '14px Arial';
    ctx.fillText('Repair Workstation', 600, 280);
    
    // Shelves
    ctx.fillStyle = '#5a4f4a';
    ctx.fillRect(800, 150, 350, 300);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(800, 150, 350, 300);
    
    for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#6a5f5a';
        ctx.fillRect(810, 170 + i * 70, 330, 8);
    }
    
    ctx.fillStyle = '#b0b0b0';
    ctx.font = '14px Arial';
    ctx.fillText('Storage & Parts', 975, 460);
    
    // Customer area
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(50, 400, 300, 200);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 400, 300, 200);
    ctx.fillStyle = '#b0b0b0';
    ctx.font = '14px Arial';
    ctx.fillText('Customer Waiting', 200, 500);
    
    // Tools display
    ctx.fillStyle = '#2a2a3a';
    ctx.fillRect(450, 450, 300, 150);
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(450, 450, 300, 150);
    
    ctx.fillStyle = '#b0b0b0';
    ctx.font = '13px Arial';
    ctx.fillText('🔧 Screwdrivers', 460, 475);
    ctx.fillText('🔍 Magnifier', 460, 500);
    ctx.fillText('💧 Suction Cup', 460, 525);
    ctx.fillText('🌡️ Heat Gun', 610, 475);
    ctx.fillText('📱 Screen Kit', 610, 500);
    ctx.fillText('🧰 Toolkit', 610, 525);
    
    // Instruction text
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Click Computer to access jobs', 50, 30);
}

function getCanvasScenePoint(e, canvas, width, height) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / width, rect.height / height);
    return {
        x: (e.clientX - rect.left - (rect.width - width * scale) / 2) / scale,
        y: (e.clientY - rect.top - (rect.height - height * scale) / 2) / scale
    };
}

function handleCanvasClick(e) {
    const { x, y } = getCanvasScenePoint(e, workshopCanvas, 1200, 700);
    
    // Computer click
    if (x > 100 && x < 260 && y > 120 && y < 220) {
        openComputer();
    }
}

workshopCanvas.addEventListener('click', handleCanvasClick);

// ============================================
// TAB SWITCHING
// ============================================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`${tab}-tab`).classList.add('active');
    });
});

// ============================================
// REPAIR ACTIONS
// ============================================

document.getElementById('completeBtn').addEventListener('click', completeRepair);
document.getElementById('repairBtn').addEventListener('click', openRepairInstructions);
document.getElementById('testBtn').addEventListener('click', testRepair);
document.getElementById('cancelRepairBtn').addEventListener('click', () => {
    switchView('workshopView');
    gameState.currentJob = null;
    saveGame();
});

const diagnosticTests = [
    {
        id: 'visual', name: 'Visual Inspection', action: 'INSPECT',
        getResult(job) {
            if (job.problem === 'Swollen battery') {
                return 'Battery swelling detected. Do not power on or charge this device.';
            }
            if (['Cracked screen', 'Screen separation', 'Broken camera glass', 'Water damage', 'Broken charging port', 'Broken power button', 'Back glass shattered', 'Lint in charging port', 'Corroded battery connector', 'Fogged camera lens', 'Clogged speaker grille'].includes(job.problem)) {
                return `Visible damage: ${job.symptoms.join(', ')}.`;
            }
            return 'No obvious external damage. Use the other tests to investigate the fault.';
        }
    },
    {
        id: 'symptoms', name: 'Symptom Check', action: 'CHECK',
        getResult: job => `Reported behavior confirmed: ${job.symptoms.join(', ')}.`
    },
    {
        id: 'power', name: 'Power Test', action: 'TEST',
        getResult(job) {
            if (['Swollen battery', 'Battery overheating', 'Water damage'].includes(job.problem)) {
                return 'Power test stopped for safety: battery or liquid damage detected. Isolate the battery before further work.';
            }
            if (job.problem === 'Black screen') {
                return 'Device draws power, but the display remains black. Investigate the screen assembly.';
            }
            if (job.problem === 'Broken power button') {
                return 'Power-button input does not register. Inspect the button and its flex cable.';
            }
            if (job.problem === 'Damaged motherboard') {
                return 'Boot sequence fails with an abnormal power draw. Board-level inspection required.';
            }
            if (['Battery not charging', 'Broken charging port', 'Charging IC failure'].includes(job.problem)) {
                return 'Charging test failed: the battery does not gain charge. Analyze the battery and charging circuit.';
            }
            if (['Loose charging connection', 'Only charges at angle'].includes(job.problem)) {
                return 'Charging connection is intermittent. Inspect the charging connector.';
            }
            if (['Battery draining fast', 'Random shutdowns', 'Battery percentage stuck'].includes(job.problem)) {
                return 'Device powers on, but battery monitoring is abnormal. Battery analysis required.';
            }
            return 'Device powers on normally. The reported fault is not preventing startup.';
        }
    },
    {
        id: 'component', name: 'Component Analysis', action: 'ANALYZE',
        getResult: job => `Fault confirmed: ${job.problem}. ${job.requiredParts.length ? `Required replacement: ${job.requiredParts.join(', ')}.` : 'No replacement part needed: clean the contacts and verify them with the multimeter.'}`
    }
];

function renderDiagnosticsPanel() {
    const job = gameState.currentJob;
    const panel = document.getElementById('diagnosticsPanel');
    panel.replaceChildren();
    const summary = document.createElement('p');
    summary.className = 'diagnostic-summary';
    summary.setAttribute('role', 'status');
    const completed = diagnosticTests.filter(test => job.diagnosticResults?.[test.id]).length;
    summary.textContent = `${completed} / ${diagnosticTests.length} checks completed`;
    panel.appendChild(summary);
    diagnosticTests.forEach(test => {
        const card = document.createElement('div');
        card.className = 'diagnostic-test';
        card.dataset.diagnostic = test.id;
        const name = document.createElement('div');
        name.className = 'diagnostic-name';
        name.textContent = test.name;
        const result = document.createElement('div');
        const finding = job.diagnosticResults?.[test.id];
        result.className = `diagnostic-result${finding ? ' pass' : ''}`;
        result.textContent = finding || 'Not checked yet. Run this test to see the findings.';
        const button = document.createElement('button');
        button.className = 'diagnostic-btn';
        button.textContent = finding ? 'COMPLETED' : test.action;
        button.disabled = Boolean(finding);
        button.addEventListener('click', () => runDiagnosticTest(test.id));
        card.append(name, result, button);
        panel.appendChild(card);
    });
}

document.getElementById('diagnosticsBtn').addEventListener('click', () => {
    if (!gameState.currentJob) {
        showNotification('Accept a repair job before running diagnostics.', 'warning');
        return;
    }
    renderDiagnosticsPanel();
    document.getElementById('diagnosticsModal').classList.add('active');
});

function runDiagnosticTest(testType) {
    const job = gameState.currentJob;
    if (!job) {
        showNotification('Accept a repair job before running diagnostics.', 'warning');
        return;
    }
    const test = diagnosticTests.find(test => test.id === testType);
    if (!test) {
        showNotification('Unknown diagnostic test.', 'error');
        return;
    }
    if (job.diagnosticResults?.[testType]) {
        showNotification(`${test.name} is already completed.`, 'warning');
        return;
    }
    job.diagnosticResults ??= {};
    const finding = test.getResult(job);
    job.diagnosticResults[testType] = finding;
    renderDiagnosticsPanel();
    renderRepairTable();
    appendRepairLog(`${test.name}: ${finding}`);
    showNotification(`${test.name} completed`, 'success');
}

function closeDiagnostics() {
    document.getElementById('diagnosticsModal').classList.remove('active');
}

function closeInstructions() {
    document.getElementById('repairInstructionsModal').classList.remove('active');
}

// ============================================
// INITIALIZATION
// ============================================

function initGame() {
    generateDiagnosticDatabase();
    loadGame();
    updateMoneyDisplay();
    drawWorkshop();
    
    // Give starting money
    if (gameState.money === 0) {
        gameState.money = 500;
        gameState.inventory.screens = 2;
        gameState.inventory.batteries = 3;
        gameState.inventory.ports = 2;
    }
    
    // Auto-save every 30 seconds
    setInterval(saveGame, 30000);
}

// Save game button
document.getElementById('saveGameBtn').addEventListener('click', () => {
    saveGame();
    showNotification('Game saved!', 'success');
});

// Start game when page loads
window.addEventListener('load', initGame);

// ============================================
// SOUND SYSTEM
// ============================================

const soundSystem = {
    enabled: true,
    volume: 0.5,
    
    // Create audio context for sound synthesis
    audioContext: null,
    
    init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
    },
    
    // Click/button sound
    playClick() {
        if (!this.enabled) return;
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.value = 800;
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.1);
    },
    
    // Success sound
    playSuccess() {
        if (!this.enabled) return;
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(800, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    },
    
    // Error sound
    playError() {
        if (!this.enabled) return;
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(200, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.2);
    },
    
    // Money sound
    playMoney() {
        if (!this.enabled) return;
        const ctx = this.audioContext;
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.frequency.value = 600 + (i * 200);
            gain.gain.setValueAtTime(0.15, ctx.currentTime + (i * 0.1));
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + (i * 0.1) + 0.15);
            
            osc.start(ctx.currentTime + (i * 0.1));
            osc.stop(ctx.currentTime + (i * 0.1) + 0.15);
        }
    },
    
    // Screwdriver sound
    playScrewdriver() {
        if (!this.enabled) return;
        const ctx = this.audioContext;
        const noise = ctx.createBufferSource();
        const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        
        for (let i = 0; i < buffer.length; i++) {
            data[i] = Math.random() * 0.2;
        }
        
        noise.buffer = buffer;
        const gain = ctx.createGain();
        noise.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        
        noise.start(ctx.currentTime);
        noise.stop(ctx.currentTime + 0.1);
    },
    
    // Tool pickup sound
    playToolPickup() {
        if (!this.enabled) return;
        const ctx = this.audioContext;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(600, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    }
};

// Initialize sound system
soundSystem.init();

// Add sound to existing functions
const originalAcceptJob = window.acceptJob || function() {};
window.acceptJob = function(jobIndex) {
    soundSystem.playClick();
    return originalAcceptJob(jobIndex);
};

const originalBuyUpgrade = window.buyUpgrade || function() {};
window.buyUpgrade = function(upgradeId) {
    const upgrade = upgradeCatalog.find(u => u.id === upgradeId);
    if (gameState.money >= upgrade.price) {
        soundSystem.playSuccess();
        soundSystem.playMoney();
    } else {
        soundSystem.playError();
    }
    return originalBuyUpgrade(upgradeId);
};

// Enhance notification with sound
const originalShowNotification = window.showNotification || function() {};
window.showNotification = function(message, type) {
    if (type === 'success') soundSystem.playSuccess();
    else if (type === 'error') soundSystem.playError();
    else if (type === 'warning') soundSystem.playClick();
    return originalShowNotification(message, type);
};

