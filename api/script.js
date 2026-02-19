// Konfigurasi
const REFRESH_INTERVAL = 5000; // 5 detik
const CHARTS = new Map(); // Menyimpan instance chart per server

// State management
let panels = [];
let currentPanelIndex = 0;

// Inisialisasi
document.addEventListener('DOMContentLoaded', async () => {
    await loadPanels();
    setupSwipeNavigation();
    startAutoRefresh();
});

// Load semua panel dari environment variables
async function loadPanels() {
    try {
        const response = await fetch('/api/panels.js');
        panels = await response.json();
        
        if (panels.length === 0) {
            showError('Tidak ada panel yang dikonfigurasi');
            return;
        }
        
        renderPanels();
        updatePanelIndicator();
        loadAllServers();
    } catch (error) {
        showError('Gagal memuat panel: ' + error.message);
    }
}

// Render semua panel sebagai section
function renderPanels() {
    const container = document.getElementById('panelsContainer');
    container.innerHTML = '';
    
    panels.forEach((panel, index) => {
        const section = document.createElement('div');
        section.className = 'panel-section';
        section.dataset.panelIndex = index;
        section.innerHTML = `
            <div class="panel-header">
                <span class="panel-name">${panel.name}</span>
                <span class="panel-status" id="panel-status-${index}">Loading...</span>
            </div>
            <div class="servers-grid" id="panel-servers-${index}">
                <div class="loading">Memuat server...</div>
            </div>
        `;
        container.appendChild(section);
    });
    
    // Render navigation dots
    renderNavDots();
}

// Render navigation dots untuk panel
function renderNavDots() {
    const navDots = document.getElementById('navDots');
    navDots.innerHTML = '';
    
    panels.forEach((_, index) => {
        const dot = document.createElement('span');
        dot.className = `nav-dot ${index === 0 ? 'active' : ''}`;
        dot.addEventListener('click', () => scrollToPanel(index));
        navDots.appendChild(dot);
    });
}

// Scroll ke panel tertentu
function scrollToPanel(index) {
    const container = document.getElementById('panelsContainer');
    const panelWidth = container.clientWidth;
    container.scrollTo({
        left: index * panelWidth,
        behavior: 'smooth'
    });
}

// Setup navigasi swipe
function setupSwipeNavigation() {
    const container = document.getElementById('panelsContainer');
    let startX, isDragging = false;
    
    container.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isDragging = true;
    });
    
    container.addEventListener('touchend', (e) => {
        if (!isDragging) return;
        
        const endX = e.changedTouches[0].clientX;
        const diffX = startX - endX;
        
        if (Math.abs(diffX) > 50) { // Threshold swipe
            if (diffX > 0 && currentPanelIndex < panels.length - 1) {
                // Swipe kiri
                currentPanelIndex++;
            } else if (diffX < 0 && currentPanelIndex > 0) {
                // Swipe kanan
                currentPanelIndex--;
            }
            scrollToPanel(currentPanelIndex);
        }
        
        isDragging = false;
    });
    
    // Update active dot saat scroll
    container.addEventListener('scroll', () => {
        const scrollPosition = container.scrollLeft;
        const panelWidth = container.clientWidth;
        const newIndex = Math.round(scrollPosition / panelWidth);
        
        if (newIndex !== currentPanelIndex && newIndex >= 0 && newIndex < panels.length) {
            currentPanelIndex = newIndex;
            updatePanelIndicator();
        }
    });
}

// Update panel indicator
function updatePanelIndicator() {
    const dots = document.querySelectorAll('.nav-dot');
    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === currentPanelIndex);
    });
    
    document.querySelector('.panel-count').textContent = 
        `${currentPanelIndex + 1}/${panels.length}`;
}

// Load semua server dari semua panel
async function loadAllServers() {
    for (let i = 0; i < panels.length; i++) {
        await loadPanelServers(i);
    }
}

// Load servers untuk panel tertentu
// Load servers untuk panel tertentu
async function loadPanelServers(panelIndex) {
    const panel = panels[panelIndex];
    const serversGrid = document.getElementById(`panel-servers-${panelIndex}`);
    const statusEl = document.getElementById(`panel-status-${panelIndex}`);
    
    try {
        statusEl.textContent = 'Mengambil data...';
        statusEl.style.color = '#a0aec0';
        
        console.log(`Loading servers for panel ${panelIndex}...`);
        
        const response = await fetch(`/api/servers.js?panel=${panelIndex}`);
        const result = await response.json();
        
        console.log(`Panel ${panelIndex} response:`, result);
        
        // Check if response has error
        if (result.error) {
            throw new Error(result.message || result.error);
        }
        
        // Check if servers array exists
        if (!result.servers || !Array.isArray(result.servers)) {
            console.error('Invalid servers data:', result);
            throw new Error('Invalid response format from server');
        }
        
        const servers = result.servers;
        statusEl.textContent = `${servers.length} server${servers.length !== 1 ? 's' : ''}`;
        statusEl.style.color = '#9ae6b4';
        
        if (servers.length === 0) {
            serversGrid.innerHTML = '<div class="loading">✨ Tidak ada server</div>';
            return;
        }
        
        // Clear loading state
        serversGrid.innerHTML = '';
        
        // Create server cards
        servers.forEach(server => {
            const card = createServerCard(server, panelIndex);
            serversGrid.appendChild(card);
        });
        
        // Load resources for each server
        servers.forEach(server => {
            if (server.identifier && server.identifier !== 'unknown') {
                loadServerResources(panelIndex, server.identifier);
            }
        });
        
    } catch (error) {
        console.error(`Error loading panel ${panelIndex}:`, error);
        
        statusEl.textContent = 'Error';
        statusEl.style.color = '#fc8181';
        
        serversGrid.innerHTML = `
            <div class="error">
                <strong>Gagal memuat server:</strong><br>
                ${error.message}
                <br><br>
                <small>Panel: ${panel.name} (${panel.url})</small>
                <br>
                <button onclick="retryLoadPanel(${panelIndex})" class="power-btn" style="margin-top: 0.5rem;">
                    🔄 Coba Lagi
                </button>
            </div>
        `;
    }
}

// Retry loading panel
window.retryLoadPanel = function(panelIndex) {
    const serversGrid = document.getElementById(`panel-servers-${panelIndex}`);
    serversGrid.innerHTML = '<div class="loading">Mencoba lagi...</div>';
    loadPanelServers(panelIndex);
};

// Load server resources dengan error handling lebih baik
async function loadServerResources(panelIndex, serverId) {
    try {
        const response = await fetch(`/api/power.js?panel=${panelIndex}&server=${serverId}&action=resources`);
        const result = await response.json();
        
        // Check for error
        if (result.error) {
            console.warn(`Resource error for ${serverId}:`, result.message);
            return;
        }
        
        updateServerMetrics(panelIndex, serverId, result);
        updateServerCharts(panelIndex, serverId, result);
        
        // Update status based on resources
        const currentState = result.attributes?.current_state || 'offline';
        const card = document.getElementById(`server-${panelIndex}-${serverId}`);
        
        if (card) {
            // Update card class
            card.className = `server-card ${currentState}`;
            
            // Update status badge
            const statusBadge = card.querySelector('.server-status');
            if (statusBadge) {
                statusBadge.className = `server-status ${currentState}`;
                statusBadge.textContent = currentState;
            }
        }
        
    } catch (error) {
        console.error(`Error loading resources for ${serverId}:`, error);
        
        // Show offline status in charts
        const cpuElement = document.getElementById(`cpu-value-${panelIndex}-${serverId}`);
        const ramElement = document.getElementById(`ram-value-${panelIndex}-${serverId}`);
        
        if (cpuElement) cpuElement.textContent = 'Offline';
        if (ramElement) ramElement.textContent = 'Offline';
        
        // Update card to offline
        const card = document.getElementById(`server-${panelIndex}-${serverId}`);
        if (card) {
            card.className = 'server-card offline';
            const statusBadge = card.querySelector('.server-status');
            if (statusBadge) {
                statusBadge.className = 'server-status offline';
                statusBadge.textContent = 'offline';
            }
        }
    }
}

// Fungsi untuk test koneksi panel
window.testPanelConnection = async function(panelIndex) {
    const panel = panels[panelIndex];
    
    try {
        const response = await fetch(`/api/servers.js?panel=${panelIndex}`);
        const data = await response.json();
        
        if (data.error) {
            alert(`Error: ${data.message || data.error}`);
        } else {
            alert(`✅ Panel ${panel.name} terhubung!\nJumlah server: ${data.total || 0}`);
        }
    } catch (error) {
        alert(`❌ Gagal terhubung: ${error.message}`);
    }
};

// Tambahkan tombol test di panel header
function renderPanels() {
    const container = document.getElementById('panelsContainer');
    container.innerHTML = '';
    
    panels.forEach((panel, index) => {
        const section = document.createElement('div');
        section.className = 'panel-section';
        section.dataset.panelIndex = index;
        section.innerHTML = `
            <div class="panel-header">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="panel-name">${panel.name}</span>
                    <button onclick="testPanelConnection(${index})" class="power-btn" style="padding: 0.25rem 0.5rem; font-size: 0.7rem;" title="Test Koneksi">
                        🔌
                    </button>
                </div>
                <span class="panel-status" id="panel-status-${index}">Loading...</span>
            </div>
            <div class="servers-grid" id="panel-servers-${index}">
                <div class="loading">Memuat server...</div>
            </div>
        `;
        container.appendChild(section);
    });
    
    renderNavDots();
}
        // Load resources untuk setiap server
        servers.forEach(server => {
            loadServerResources(panelIndex, server.identifier);
        });
        
    } catch (error) {
        statusEl.textContent = 'Error';
        serversGrid.innerHTML = `<div class="error">Gagal memuat server: ${error.message}</div>`;
    }
}

// Create server card element
function createServerCard(server, panelIndex) {
    const card = document.createElement('div');
    card.className = `server-card ${server.status}`;
    card.id = `server-${panelIndex}-${server.identifier}`;
    
    card.innerHTML = `
        <div class="server-header">
            <span class="server-name">${server.name}</span>
            <span class="server-status ${server.status}">${server.status}</span>
        </div>
        
        <div class="charts-container">
            <div class="chart-wrapper">
                <div class="chart-title">CPU Usage</div>
                <canvas id="cpu-chart-${panelIndex}-${server.identifier}" width="200" height="60"></canvas>
                <div class="metrics">
                    <span>Usage</span>
                    <span class="metric-value" id="cpu-value-${panelIndex}-${server.identifier}">0%</span>
                </div>
            </div>
            
            <div class="chart-wrapper">
                <div class="chart-title">Memory Usage</div>
                <canvas id="ram-chart-${panelIndex}-${server.identifier}" width="200" height="60"></canvas>
                <div class="metrics">
                    <span>Usage</span>
                    <span class="metric-value" id="ram-value-${panelIndex}-${server.identifier}">0 MB</span>
                </div>
            </div>
        </div>
        
        <div class="server-actions">
            <button class="power-btn start" onclick="controlServer('${panelIndex}', '${server.identifier}', 'start')">Start</button>
            <button class="power-btn stop" onclick="controlServer('${panelIndex}', '${server.identifier}', 'stop')">Stop</button>
            <button class="power-btn restart" onclick="controlServer('${panelIndex}', '${server.identifier}', 'restart')">Restart</button>
        </div>
    `;
    
    return card;
}

// Load resources untuk server tertentu
async function loadServerResources(panelIndex, serverId) {
    try {
        const response = await fetch(`/api/power.js?panel=${panelIndex}&server=${serverId}&action=resources`);
        const resources = await response.json();
        
        updateServerMetrics(panelIndex, serverId, resources);
        updateServerCharts(panelIndex, serverId, resources);
        
        // Update status card berdasarkan resources
        const card = document.getElementById(`server-${panelIndex}-${serverId}`);
        if (card) {
            const status = resources.attributes?.current_state || 'offline';
            card.className = `server-card ${status}`;
            
            const statusBadge = card.querySelector('.server-status');
            if (statusBadge) {
                statusBadge.className = `server-status ${status}`;
                statusBadge.textContent = status;
            }
        }
        
    } catch (error) {
        console.error(`Error loading resources for ${serverId}:`, error);
    }
}

// Update metrics display
function updateServerMetrics(panelIndex, serverId, resources) {
    const resourcesData = resources.attributes?.resources || {};
    
    // CPU usage
    const cpuUsage = resourcesData.cpu_absolute || 0;
    const cpuElement = document.getElementById(`cpu-value-${panelIndex}-${serverId}`);
    if (cpuElement) {
        cpuElement.textContent = `${cpuUsage.toFixed(1)}%`;
    }
    
    // Memory usage
    const memoryBytes = resourcesData.memory_bytes || 0;
    const memoryMB = (memoryBytes / 1024 / 1024).toFixed(0);
    const ramElement = document.getElementById(`ram-value-${panelIndex}-${serverId}`);
    if (ramElement) {
        ramElement.textContent = `${memoryMB} MB`;
    }
}

// Update charts dengan data baru
function updateServerCharts(panelIndex, serverId, resources) {
    const resourcesData = resources.attributes?.resources || {};
    const cpuCanvas = document.getElementById(`cpu-chart-${panelIndex}-${serverId}`);
    const ramCanvas = document.getElementById(`ram-chart-${panelIndex}-${serverId}`);
    
    if (!cpuCanvas || !ramCanvas) return;
    
    // Initialize charts jika belum ada
    const chartKey = `${panelIndex}-${serverId}`;
    if (!CHARTS.has(chartKey)) {
        CHARTS.set(chartKey, {
            cpu: createChart(cpuCanvas, '#63b3ed'),
            ram: createChart(ramCanvas, '#9f7aea'),
            cpuData: [],
            ramData: []
        });
    }
    
    const chart = CHARTS.get(chartKey);
    
    // Update data
    const cpuUsage = resourcesData.cpu_absolute || 0;
    const memoryBytes = resourcesData.memory_bytes || 0;
    const memoryMB = memoryBytes / 1024 / 1024;
    
    chart.cpuData.push(cpuUsage);
    chart.ramData.push(memoryMB);
    
    // Keep only last 20 data points
    if (chart.cpuData.length > 20) chart.cpuData.shift();
    if (chart.ramData.length > 20) chart.ramData.shift();
    
    // Update charts
    updateChart(chart.cpu, chart.cpuData, 0, 100);
    updateChart(chart.ram, chart.ramData, 0, Math.max(...chart.ramData, 100));
}

// Create chart instance
function createChart(canvas, color) {
    const ctx = canvas.getContext('2d');
    return { ctx, color, width: canvas.width, height: canvas.height };
}

// Update chart dengan data baru
function updateChart(chart, data, minY, maxY) {
    const { ctx, color, width, height } = chart;
    
    ctx.clearRect(0, 0, width, height);
    
    if (data.length < 2) return;
    
    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    const stepX = width / (data.length - 1);
    const rangeY = maxY - minY || 1;
    
    data.forEach((value, index) => {
        const x = index * stepX;
        const y = height - ((value - minY) / rangeY) * height;
        
        if (index === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });
    
    ctx.stroke();
    
    // Fill area under line
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fillStyle = color + '20'; // Add transparency
    ctx.fill();
}

// Control server power
async function controlServer(panelIndex, serverId, action) {
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
            
            // Refresh resources after action
            setTimeout(() => {
                loadServerResources(panelIndex, serverId);
            }, 2000);
        }
    } catch (error) {
        alert(`Gagal ${action} server: ${error.message}`);
    }
}

// Auto refresh semua data
function startAutoRefresh() {
    setInterval(() => {
        panels.forEach((_, panelIndex) => {
            const serversGrid = document.getElementById(`panel-servers-${panelIndex}`);
            if (serversGrid) {
                const serverCards = serversGrid.querySelectorAll('.server-card');
                serverCards.forEach(card => {
                    const serverId = card.id.split('-').pop();
                    loadServerResources(panelIndex, serverId);
                });
            }
        });
    }, REFRESH_INTERVAL);
}

// Show error message
function showError(message) {
    const container = document.getElementById('panelsContainer');
    container.innerHTML = `<div class="error">${message}</div>`;
}

// Export untuk digunakan di HTML
window.controlServer = controlServer;