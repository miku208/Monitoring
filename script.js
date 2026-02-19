// Konfigurasi
const REFRESH_INTERVAL = 5000;
const CHARTS = new Map();

// State
let panels = [];
let currentPanelIndex = 0;
let servers = [];
let stats = {
    total: 0,
    online: 0,
    offline: 0,
    totalCPU: 0,
    totalRAM: 0,
    totalDisk: 0
};

// Inisialisasi
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    console.log('🚀 Pterodactyl Monitor Pro starting...');
    
    // Load panels
    await loadPanels();
    
    // Setup UI
    setupSidebar();
    setupEventListeners();
    
    // Load initial data
    if (panels.length > 0) {
        await loadPanelServers(0);
        startAutoRefresh();
    }
}

// Load panels dari API
async function loadPanels() {
    try {
        const response = await fetch('/api/panels.js');
        const data = await response.json();
        
        panels = data;
        
        if (panels.length === 0) {
            showError('No panels configured');
            return;
        }
        
        renderPanelsList();
        updateCurrentPanelName();
        
    } catch (error) {
        console.error('Failed to load panels:', error);
        showError('Failed to load panels: ' + error.message);
    }
}

// Render daftar panel di sidebar
function renderPanelsList() {
    const panelsList = document.getElementById('panelsList');
    const panelDropdown = document.getElementById('panelDropdown');
    
    panelsList.innerHTML = '';
    panelDropdown.innerHTML = '';
    
    panels.forEach((panel, index) => {
        // Sidebar item
        const panelItem = document.createElement('div');
        panelItem.className = `panel-item ${index === 0 ? 'active' : ''}`;
        panelItem.dataset.index = index;
        panelItem.onclick = () => switchPanel(index);
        
        panelItem.innerHTML = `
            <div class="panel-icon">${panel.name.charAt(0)}</div>
            <div class="panel-info">
                <div class="panel-name">${panel.name}</div>
                <div class="panel-stats" id="panel-stats-${index}">Loading...</div>
            </div>
        `;
        
        panelsList.appendChild(panelItem);
        
        // Dropdown item
        const dropdownItem = document.createElement('div');
        dropdownItem.className = 'dropdown-item';
        dropdownItem.textContent = panel.name;
        dropdownItem.onclick = () => switchPanel(index);
        panelDropdown.appendChild(dropdownItem);
    });
}

// Setup sidebar
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = document.getElementById('sidebarToggle');
    const menuBtn = document.getElementById('menuBtn');
    
    toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
    
    menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
    });
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('refreshBtn').addEventListener('click', () => {
        refreshData();
    });
}

// Switch panel
async function switchPanel(index) {
    currentPanelIndex = index;
    
    // Update active state
    document.querySelectorAll('.panel-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
    
    updateCurrentPanelName();
    await loadPanelServers(index);
}

// Update current panel name di top bar
function updateCurrentPanelName() {
    const panel = panels[currentPanelIndex];
    if (panel) {
        document.getElementById('currentPanelName').textContent = panel.name;
    }
}

// Load servers untuk panel tertentu
async function loadPanelServers(panelIndex) {
    const panel = panels[panelIndex];
    const statsEl = document.getElementById(`panel-stats-${panelIndex}`);
    
    try {
        statsEl.textContent = 'Loading...';
        
        const response = await fetch(`/api/servers.js?panel=${panelIndex}`);
        const result = await response.json();
        
        if (result.error) {
            throw new Error(result.message);
        }
        
        servers = result.servers || [];
        
        // Update stats
        updateStats(servers);
        
        // Update panel stats
        const online = servers.filter(s => s.status === 'running').length;
        statsEl.textContent = `${online}/${servers.length} online`;
        
        // Render servers
        renderServers(servers, panelIndex);
        
        // Update stats cards
        renderStatsCards();
        
        // Load resources untuk setiap server
        servers.forEach(server => {
            if (server.identifier) {
                loadServerResources(panelIndex, server.identifier);
            }
        });
        
    } catch (error) {
        console.error('Failed to load servers:', error);
        statsEl.textContent = 'Error';
        
        document.getElementById('serversGrid').innerHTML = `
            <div class="error-state">
                <p>Failed to load servers: ${error.message}</p>
                <button class="power-btn" onclick="retryLoadPanel(${panelIndex})">Retry</button>
            </div>
        `;
    }
}

// Update statistics
function updateStats(serversList) {
    stats.total = serversList.length;
    stats.online = serversList.filter(s => s.status === 'running').length;
    stats.offline = stats.total - stats.online;
    
    document.getElementById('serverCount').textContent = 
        `${stats.online} online • ${stats.offline} offline`;
}

// Render stats cards
function renderStatsCards() {
    const statsGrid = document.getElementById('statsGrid');
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="2" y="2" width="20" height="20" rx="2.18"/>
                        <path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>
                    </svg>
                </div>
                <span>Total Servers</span>
            </div>
            <div class="stat-value">${stats.total}</div>
            <div class="stat-change">${stats.online} online</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 12H4M12 4v16M4.93 4.93l14.14 14.14M19.07 4.93L4.93 19.07"/>
                    </svg>
                </div>
                <span>CPU Usage</span>
            </div>
            <div class="stat-value" id="statCPU">0%</div>
            <div class="stat-change" id="statCPUChange">avg</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                        <path d="M9 9h6v6H9z"/>
                    </svg>
                </div>
                <span>Memory Usage</span>
            </div>
            <div class="stat-value" id="statRAM">0 MB</div>
            <div class="stat-change" id="statRAMChange">total</div>
        </div>
        
        <div class="stat-card">
            <div class="stat-header">
                <div class="stat-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 6v6l4 2"/>
                    </svg>
                </div>
                <span>Uptime</span>
            </div>
            <div class="stat-value" id="statUptime">0h</div>
            <div class="stat-change">avg per server</div>
        </div>
    `;
}

// Render servers
function renderServers(serversList, panelIndex) {
    const grid = document.getElementById('serversGrid');
    
    if (serversList.length === 0) {
        grid.innerHTML = '<div class="loading-state">No servers found</div>';
        return;
    }
    
    grid.innerHTML = '';
    
    serversList.forEach(server => {
        const card = createServerCard(server, panelIndex);
        grid.appendChild(card);
    });
}

// Create server card
function createServerCard(server, panelIndex) {
    const card = document.createElement('div');
    card.className = `server-card ${server.status || 'offline'}`;
    card.id = `server-${panelIndex}-${server.identifier}`;
    card.onclick = () => showServerDetails(server, panelIndex);
    
    card.innerHTML = `
        <div class="card-header">
            <span class="server-name">${escapeHtml(server.name)}</span>
            <span class="status-badge ${server.status || 'offline'}">${server.status || 'offline'}</span>
        </div>
        
        <div class="metrics-grid">
            <div class="metric-item">
                <div class="metric-label">CPU</div>
                <div class="metric-value" id="cpu-${panelIndex}-${server.identifier}">
                    0<span class="metric-unit">%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="cpu-progress-${panelIndex}-${server.identifier}" style="width: 0%"></div>
                </div>
            </div>
            
            <div class="metric-item">
                <div class="metric-label">RAM</div>
                <div class="metric-value" id="ram-${panelIndex}-${server.identifier}">
                    0<span class="metric-unit">MB</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="ram-progress-${panelIndex}-${server.identifier}" style="width: 0%"></div>
                </div>
            </div>
            
            <div class="metric-item">
                <div class="metric-label">DISK</div>
                <div class="metric-value" id="disk-${panelIndex}-${server.identifier}">
                    0<span class="metric-unit">MB</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="disk-progress-${panelIndex}-${server.identifier}" style="width: 0%"></div>
                </div>
            </div>
            
            <div class="metric-item">
                <div class="metric-label">UPTIME</div>
                <div class="metric-value" id="uptime-${panelIndex}-${server.identifier}">
                    0<span class="metric-unit">h</span>
                </div>
            </div>
        </div>
        
        <div class="mini-chart">
            <canvas id="chart-${panelIndex}-${server.identifier}" width="200" height="40"></canvas>
        </div>
        
        <div class="server-actions" onclick="event.stopPropagation()">
            <button class="power-btn start" onclick="controlServer('${panelIndex}', '${server.identifier}', 'start')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                Start
            </button>
            <button class="power-btn stop" onclick="controlServer('${panelIndex}', '${server.identifier}', 'stop')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="4" y="4" width="16" height="16"/>
                </svg>
                Stop
            </button>
            <button class="power-btn restart" onclick="controlServer('${panelIndex}', '${server.identifier}', 'restart')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                </svg>
                Restart
            </button>
        </div>
    `;
    
    return card;
}

// Load server resources
async function loadServerResources(panelIndex, serverId) {
    try {
        const response = await fetch(`/api/power.js?panel=${panelIndex}&server=${serverId}&action=resources`);
        const data = await response.json();
        
        if (data.error) return;
        
        const resources = data.attributes?.resources || {};
        const limits = data.attributes?.limits || {};
        
        // Update metrics
        updateServerMetrics(panelIndex, serverId, resources, limits);
        updateServerChart(panelIndex, serverId, resources);
        updateGlobalStats(resources);
        
    } catch (error) {
        console.error(`Failed to load resources for ${serverId}:`, error);
    }
}

// Update server metrics
function updateServerMetrics(panelIndex, serverId, resources, limits) {
    // CPU
    const cpuUsage = resources.cpu_absolute || 0;
    const cpuLimit = limits.cpu || 100;
    const cpuPercent = (cpuUsage / cpuLimit) * 100;
    
    updateMetric(`cpu-${panelIndex}-${serverId}`, cpuUsage.toFixed(1), '%');
    updateProgress(`cpu-progress-${panelIndex}-${serverId}`, cpuPercent);
    
    // RAM
    const memoryBytes = resources.memory_bytes || 0;
    const memoryMB = memoryBytes / 1024 / 1024;
    const memoryLimit = (limits.memory || 1024) * 1024 * 1024; // Convert MB to bytes
    const ramPercent = (memoryBytes / memoryLimit) * 100;
    
    updateMetric(`ram-${panelIndex}-${serverId}`, memoryMB.toFixed(0), 'MB');
    updateProgress(`ram-progress-${panelIndex}-${serverId}`, ramPercent);
    
    // Disk
    const diskBytes = resources.disk_bytes || 0;
    const diskMB = diskBytes / 1024 / 1024;
    const diskLimit = (limits.disk || 10240) * 1024 * 1024; // Convert MB to bytes
    const diskPercent = (diskBytes / diskLimit) * 100;
    
    updateMetric(`disk-${panelIndex}-${serverId}`, diskMB.toFixed(0), 'MB');
    updateProgress(`disk-progress-${panelIndex}-${serverId}`, diskPercent);
    
    // Uptime
    const uptime = resources.uptime || 0;
    const uptimeHours = (uptime / 1000 / 3600).toFixed(1);
    
    updateMetric(`uptime-${panelIndex}-${serverId}`, uptimeHours, 'h');
}

// Update metric element
function updateMetric(elementId, value, unit) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `${value}<span class="metric-unit">${unit}</span>`;
    }
}

// Update progress bar
function updateProgress(elementId, percent) {
    const element = document.getElementById(elementId);
    if (element) {
        element.style.width = `${Math.min(percent, 100)}%`;
    }
}

// Update server chart
function updateServerChart(panelIndex, serverId, resources) {
    const canvas = document.getElementById(`chart-${panelIndex}-${serverId}`);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const chartKey = `${panelIndex}-${serverId}`;
    
    if (!CHARTS.has(chartKey)) {
        CHARTS.set(chartKey, {
            data: [],
            ctx: ctx
        });
    }
    
    const chart = CHARTS.get(chartKey);
    const cpuUsage = resources.cpu_absolute || 0;
    
    chart.data.push(cpuUsage);
    if (chart.data.length > 20) chart.data.shift();
    
    // Draw chart
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (chart.data.length < 2) return;
    
    const stepX = canvas.width / (chart.data.length - 1);
    
    ctx.beginPath();
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    
    chart.data.forEach((value, index) => {
        const x = index * stepX;
        const y = canvas.height - (value / 100) * canvas.height;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Fill area
    ctx.lineTo(canvas.width, canvas.height);
    ctx.lineTo(0, canvas.height);
    ctx.closePath();
    ctx.fillStyle = 'rgba(99, 102, 241, 0.1)';
    ctx.fill();
}

// Update global statistics
function updateGlobalStats(resources) {
    // Aggregate CPU
    const cpuTotal = parseFloat(document.getElementById('statCPU').textContent) || 0;
    const newCPU = (cpuTotal + (resources.cpu_absolute || 0)) / 2;
    document.getElementById('statCPU').textContent = newCPU.toFixed(1) + '%';
    
    // Aggregate RAM
    const ramBytes = resources.memory_bytes || 0;
    const ramMB = ramBytes / 1024 / 1024;
    const ramTotal = parseFloat(document.getElementById('statRAM').textContent) || 0;
    document.getElementById('statRAM').textContent = (ramTotal + ramMB).toFixed(0) + ' MB';
}

// Show server details in modal
function showServerDetails(server, panelIndex) {
    const modal = document.getElementById('serverModal');
    const modalName = document.getElementById('modalServerName');
    const modalBody = document.getElementById('modalBody');
    
    modalName.textContent = server.name;
    
    modalBody.innerHTML = `
        <div class="detail-grid">
            <div class="detail-item">
                <div class="detail-label">Server ID</div>
                <div class="detail-value">${server.identifier}</div>
            </div>
            <div class="detail-item">
                <div class="detail-label">Status</div>
                <div class="detail-value" style="color: ${server.status === 'running' ? '#10b981' : '#ef4444'}">
                    ${server.status}
                </div>
            </div>
        </div>
        
        <div class="chart-container">
            <h4>CPU Usage History</h4>
            <canvas id="detail-chart" width="500" height="200"></canvas>
        </div>
        
        <div style="margin-top: 1.5rem; display: flex; gap: 0.5rem; justify-content: flex-end;">
            <button class="power-btn start" onclick="controlServer('${panelIndex}', '${server.identifier}', 'start')">Start</button>
            <button class="power-btn stop" onclick="controlServer('${panelIndex}', '${server.identifier}', 'stop')">Stop</button>
            <button class="power-btn restart" onclick="controlServer('${panelIndex}', '${server.identifier}', 'restart')">Restart</button>
        </div>
    `;
    
    modal.classList.add('active');
    
    // Draw detail chart
    setTimeout(() => {
        const chart = CHARTS.get(`${panelIndex}-${server.identifier}`);
        if (chart) {
            const canvas = document.getElementById('detail-chart');
            const ctx = canvas.getContext('2d');
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (chart.data.length < 2) return;
            
            const stepX = canvas.width / (chart.data.length - 1);
            
            ctx.beginPath();
            ctx.strokeStyle = '#6366f1';
            ctx.lineWidth = 2;
            
            chart.data.forEach((value, index) => {
                const x = index * stepX;
                const y = canvas.height - (value / 100) * canvas.height;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        }
    }, 100);
}

// Close modal
window.closeModal = function() {
    document.getElementById('serverModal').classList.remove('active');
};

// Control server power
window.controlServer = async function(panelIndex, serverId, action) {
    if (action !== 'start' && !confirm(`Are you sure you want to ${action} this server?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/power.js?panel=${panelIndex}&server=${serverId}&action=${action}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            // Show success feedback
            const card = document.getElementById(`server-${panelIndex}-${serverId}`);
            card.style.transform = 'scale(0.98)';
            setTimeout(() => {
                card.style.transform = 'scale(1)';
            }, 200);
            
            // Refresh after 2 seconds
            setTimeout(() => {
                loadServerResources(panelIndex, serverId);
            }, 2000);
        }
        
    } catch (error) {
        alert(`Failed to ${action} server: ${error.message}`);
    }
};

// Retry loading panel
window.retryLoadPanel = function(panelIndex) {
    loadPanelServers(panelIndex);
};

// Refresh all data
function refreshData() {
    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.style.transform = 'rotate(360deg)';
    
    setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0)';
    }, 500);
    
    loadPanelServers(currentPanelIndex);
    document.getElementById('refreshTime').querySelector('span').textContent = 'just now';
}

// Auto refresh
function startAutoRefresh() {
    setInterval(() => {
        if (servers.length > 0) {
            servers.forEach(server => {
                if (server.identifier) {
                    loadServerResources(currentPanelIndex, server.identifier);
                }
            });
            document.getElementById('refreshTime').querySelector('span').textContent = 
                new Date().toLocaleTimeString();
        }
    }, REFRESH_INTERVAL);
}

// Escape HTML
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Show error
function showError(message) {
    const mainContent = document.querySelector('.dashboard');
    mainContent.innerHTML = `
        <div class="error-state">
            <p>${message}</p>
            <button class="power-btn" onclick="location.reload()">Refresh Page</button>
        </div>
    `;
}

console.log('✅ Pterodactyl Monitor Pro initialized');