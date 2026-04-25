const SYSTEM_CONFIG = {
  "system_name": "Autonomous Digital Product Engine - SCALE V2",
  "agents": [
    { "name": "TrendHunter", "icon": "🔍", "role": "Trend Detection" },
    { "name": "OpportunityRouter", "icon": "🔀", "role": "Routing" },
    { "name": "ProductFactory", "icon": "🏭", "role": "Production" },
    { "name": "ContentMultiplier", "icon": "🎥", "role": "Content Creation" },
    { "name": "DistributionEngine", "icon": "📡", "role": "Publishing" },
    { "name": "SalesAgent", "icon": "💰", "role": "Conversion" },
    { "name": "WinnerDetector", "icon": "🏆", "role": "Validation" },
    { "name": "AdsScaler", "icon": "🚀", "role": "Ad Scaling" },
    { "name": "UpsellAgent", "icon": "📈", "role": "Upselling" },
    { "name": "SystemOptimizer", "icon": "🧠", "role": "Optimization" }
  ],
  "kpis": {
    "target_daily_sales": 20,
    "target_revenue_mxn": 3000,
    "ctr_threshold": 0.02,
    "conversion_rate_target": 0.01
  }
};

const state = {
    revenue: 0,
    sales: 0,
    ctr: 0.018,
    roas: 2.4,
    uptime: 0,
    activeProducts: [],
    testingProducts: [],
    scalingProducts: [],
    logs: [],
    agentStates: {}
};

// Initialize Agents
function initAgents() {
    const container = document.getElementById('agents-container');
    SYSTEM_CONFIG.agents.forEach(agent => {
        state.agentStates[agent.name] = {
            status: 'idle',
            progress: 0,
            currentTask: 'Standby'
        };

        const card = document.createElement('div');
        card.className = 'agent-card glass';
        card.id = `agent-${agent.name}`;
        card.innerHTML = `
            <div class="agent-icon">${agent.icon}</div>
            <div class="agent-name">${agent.name}</div>
            <div class="agent-status status-idle">IDLE</div>
            <div class="agent-task">System Standby</div>
            <div class="agent-progress">
                <div class="progress-bar" id="progress-${agent.name}"></div>
            </div>
        `;
        container.appendChild(card);
    });
}

// UI Updates
function updateUI() {
    document.getElementById('total-revenue').innerText = `$${state.revenue.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;
    document.getElementById('daily-sales').innerText = state.sales;
    document.getElementById('avg-ctr').innerText = `${(state.ctr * 100).toFixed(2)}%`;
    document.getElementById('avg-roas').innerText = `${state.roas.toFixed(1)}x`;
    
    // Update Counters
    document.getElementById('count-active').innerText = state.activeProducts.length + state.testingProducts.length + state.scalingProducts.length;
    document.getElementById('count-testing').innerText = state.testingProducts.length;
    document.getElementById('count-scaling').innerText = state.scalingProducts.length;

    // Update Uptime
    const hours = Math.floor(state.uptime / 3600).toString().padStart(2, '0');
    const mins = Math.floor((state.uptime % 3600) / 60).toString().padStart(2, '0');
    const secs = (state.uptime % 60).toString().padStart(2, '0');
    document.getElementById('uptime').innerText = `${hours}:${mins}:${secs}`;
}

function log(message, type = 'system') {
    const terminal = document.getElementById('terminal-logs');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerText = `[${new Date().toLocaleTimeString()}] ${message}`;
    terminal.prepend(entry);
    if (terminal.childNodes.length > 50) terminal.lastChild.remove();
}

function updateAgentUI(name) {
    const agentData = state.agentStates[name];
    const card = document.getElementById(`agent-${name}`);
    const statusLabel = card.querySelector('.agent-status');
    const taskLabel = card.querySelector('.agent-task');
    const progressBar = document.getElementById(`progress-${name}`);

    statusLabel.innerText = agentData.status.toUpperCase();
    statusLabel.className = `agent-status status-${agentData.status}`;
    taskLabel.innerText = agentData.currentTask;
    progressBar.style.width = `${agentData.progress}%`;

    if (agentData.status === 'working') {
        card.classList.add('active');
    } else {
        card.classList.remove('active');
    }
}

// Simulation Engine
async function runAgentTask(name, task, duration, callback) {
    state.agentStates[name].status = 'working';
    state.agentStates[name].currentTask = task;
    state.agentStates[name].progress = 0;
    updateAgentUI(name);
    log(`${name}: ${task}`);

    const steps = 20;
    const interval = duration / steps;
    
    for (let i = 1; i <= steps; i++) {
        await new Promise(r => setTimeout(r, interval));
        state.agentStates[name].progress = (i / steps) * 100;
        updateAgentUI(name);
    }

    state.agentStates[name].status = 'idle';
    state.agentStates[name].progress = 0;
    updateAgentUI(name);
    if (callback) callback();
}

const PRODUCTS = [
    "Ebook: Keto Mastery MX", "Curso: Trading 101", "Plan: Glúteos 30 días", 
    "Guía: Inversiones Real Estate", "Pack: Meditación Guiada", "Masterclass: eCommerce"
];

async function simulationLoop() {
    while (true) {
        // 1. TrendHunter
        await runAgentTask('TrendHunter', 'Scanning TikTok & IG for viral niches...', 3000);
        
        // 2. OpportunityRouter
        await runAgentTask('OpportunityRouter', 'Selecting top opportunities...', 2000);
        
        // 3. ProductFactory
        const newProduct = PRODUCTS[Math.floor(Math.random() * PRODUCTS.length)];
        await runAgentTask('ProductFactory', `Generating digital product: ${newProduct}`, 4000, () => {
            state.testingProducts.push(newProduct);
            updatePipelineUI('lane-testing', state.testingProducts);
        });

        // 4. ContentMultiplier
        await runAgentTask('ContentMultiplier', 'Creating viral video variations...', 5000);

        // 5. DistributionEngine
        await runAgentTask('DistributionEngine', 'Publishing content to social platforms...', 3000);

        // 6. SalesAgent (Random Sales)
        await runAgentTask('SalesAgent', 'Handling DMs and checkout flows...', 4000, () => {
            const salesCount = Math.floor(Math.random() * 3);
            if (salesCount > 0) {
                state.sales += salesCount;
                state.revenue += salesCount * (99 + Math.random() * 200);
                log(`SALE RECORDED: +${salesCount} units.`, 'success');
            }
        });

        // 7. WinnerDetector
        await runAgentTask('WinnerDetector', 'Analyzing performance data...', 2000, () => {
            if (state.testingProducts.length > 0 && Math.random() > 0.6) {
                const winner = state.testingProducts.shift();
                state.scalingProducts.push(winner);
                updatePipelineUI('lane-testing', state.testingProducts);
                updatePipelineUI('lane-scaling', state.scalingProducts);
                log(`WINNER DETECTED: Scaling ${winner}`, 'success');
            }
        });

        // 8. AdsScaler
        if (state.scalingProducts.length > 0) {
            await runAgentTask('AdsScaler', 'Scaling winners with Meta Ads...', 4000, () => {
                state.revenue += state.scalingProducts.length * (Math.random() * 500);
                state.ctr = 0.02 + Math.random() * 0.015;
                state.roas = 3.1 + Math.random() * 1.5;
            });
        }

        // 9. UpsellAgent
        await runAgentTask('UpsellAgent', 'Optimizing AOV with bundles...', 2000);

        // 10. SystemOptimizer
        await runAgentTask('SystemOptimizer', 'Adjusting entire cycle strategy...', 3000);
        
        updateUI();
    }
}

function updatePipelineUI(laneId, list) {
    const container = document.querySelector(`#${laneId} .product-list`);
    container.innerHTML = '';
    list.forEach(p => {
        const item = document.createElement('div');
        item.className = 'product-item';
        item.innerText = p;
        container.appendChild(item);
    });
}

// Uptime Counter
setInterval(() => {
    state.uptime++;
    updateUI();
}, 1000);

// Initialize
window.onload = () => {
    initAgents();
    updateUI();
    simulationLoop();
    log("SCALE V2 CORE ENGINE STARTED", "success");
};
