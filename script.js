// Konfigurasi
const REFRESH_INTERVAL = 5000; // 5 detik
const CHARTS = new Map(); // Menyimpan instance chart per server

// State management
let panels = [];
let currentPanelIndex = 0;

// Inisialisasi
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Pterodactyl Monitor starting...');
    await loadPanels();
    setupSwipeNavigation();
    startAutoRefresh();
});

// Load semua panel dari environment variables
async function loadPanels() {
    try {
        console.log('📡 Loading panels...');
        const response = await fetch('/api/panels.js');
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const text = await response.text();
        console.log('Raw response:', text.substring(0, 200));
        
        try {
            panels = JSON.parse(text);
        } catch (e) {
            console.error('JSON Parse error:', e);
            throw new Error('Invalid JSON response from server');
        }
        
        console.log('✅ Panels loaded:', panels);
        
        if (!panels || panels.length === 0) {
            showError('Tidak ada panel yang dikonfigurasi. Pastikan environment variables sudah diisi.');
            return;
        }
        
        renderPanels();
        updatePanelIndicator();
        loadAllServers();
    } catch (error) {
        console.error('❌ Failed to load panels:', error);
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
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span class="panel-name">${panel.name || `Panel ${index + 1}`}</span>
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
    
    container.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
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
    
    const countEl = document.querySelector('.panel-count');
    if (countEl) {
        countEl.textContent = `${currentPanelIndex + 1}/${panels.length}`;
    }
    
    // Update active dot di panel indicator header
    const panelDot = document.querySelector('.panel-dot');
    if (panelDot) {
        panelDot.classList.add('active');
    }
}

// Load semua server dari semua panel
async function loadAllServers() {
    for (let i = 0; i < panels.length; i++) {
        await loadPanelServers(i);
    }
}

// Load servers untuk panel tertentu
async function loadPanelServers(panelIndex) {
    const panel = panels[panelIndex];
    const serversGrid = document.getElementById(`panel-servers-${panelIndex}`);
    const statusEl = document.getElementById(`panel-status-${panelIndex}`);
    
    if (!serversGrid || !statusEl) {
        console.error(`Panel elements not found for index ${panelIndex}`);
        return;
    }
    
    try {
        statusEl.textContent = 'Mengambil data...';
        statusEl.style.color = '#a0aec0';
        
        console.log(`📡 Loading servers for panel ${panelIndex} (${panel.name})...`);
        
        const response = await fetch(`/api/servers.js?panel=${panelIndex}`);
        
        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }
        
        const text = await response.text();
        console.log(`Panel ${panelIndex} response:`, text.substring(0, 300));
        
        let result;
        try {
            result = JSON.parse(text);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Raw response:', text);
            throw new Error(`Invalid JSON response: ${text.substring(0, 100)}...`);
        }
        
        // Check if response has error
        if (result.error) {
            throw new Error(result.message || result.error);
        }
        
        // Check if servers array exists
        if (!result.servers || !Array.isArray(result.servers)) {
            console.error('Invalid servers data:', result);
            
            // Jika ada panel info, tampilkan
            if (result.panel) {
                statusEl.textContent = `Panel: ${result.panel.name}`;
            }
            
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
            if (server && server.identifier) {
                const card = createServerCard(server, panelIndex);
                serversGrid.appendChild(card);
            } else {
                console.warn('Invalid server data:', server);
            }
        });
        
        // Load resources for each server
        servers.forEach(server => {
            if (server.identifier && server.identifier !== 'unknown') {
                loadServerResources(panelIndex, server.identifier);
            }
        });
        
    } catch (error) {
        console.error(`❌ Error loading panel ${panelIndex}:`, error);
        
        statusEl.textContent = 'Error';
        statusEl.style.color = '#fc8181';
        
        serversGrid.innerHTML = `
            <div class="error">
                <strong>Gagal memuat server:</strong><br>
                ${error.message}
                <br><br>
                <small>Panel: ${panel.name} (${panel.url})</small>
                <br>
                <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; justify-content: center;">
                    <button onclick="retryLoadPanel(${panelIndex})" class="power-btn" style="background: #63b3ed; color: white;">
                        🔄 Coba Lagi
                    </button>
                    <button onclick="testPanelConnection(${panelIndex})" class="power-btn">
                        🔌 Test Koneksi
                    </button>
                </div>
            </div>
        `;
    }
}

// Retry loading panel
window.retryLoadPanel = function(panelIndex) {
    const serversGrid = document.getElementById(`panel-servers-${panelIndex}`);
    if (serversGrid) {
        serversGrid.innerHTML = '<div class="loading">Mencoba lagi...</div>';
        loadPanelServers(panelIndex);
    }
};

// Test koneksi panel
window.testPanelConnection = async function(panelIndex) {
    const panel = panels[panelIndex];
    
    try {
        const response = await fetch(`/api/servers.js?panel=${panelIndex}`);
        const text = await response.text();
        
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            console.error('Parse error:', e);
            alert(`❌ Response bukan JSON:\n${text.substring(0, 200)}`);
            return;
        }
        
        if (data.error) {
            alert(`❌ Error: ${data.message || data.error}`);
        } else {
            alert(`✅ Panel ${panel.name} terhubung!\n` +
                  `URL: ${panel.url}\n` +
                  `Jumlah server: ${data.total || 0}\n` +
                  `Status: OK`);
        }
    } catch (error) {
        alert(`❌ Gagal terhubung: ${error.message}`);
    }
};

// Create server card element
function createServerCard(server, panelIndex) {
    const card = document.createElement('div');
    card.className = `server-card ${server.status || 'offline'}`;
    card.id = `server-${panelIndex}-${server.identifier}`;
    
    card.innerHTML = `
        <div class="server-header">
            <span class="server-name">${escapeHtml(server.name || 'Unnamed Server')}</span>
            <span class="server-status ${server.status || 'offline'}">${server.status || 'offline'}</span>
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

// Escape HTML untuk keamanan
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Load resources untuk server tertentu
async function loadServerResources(panelIndex, serverId) {
    try {
        const response = await fetch(`/api/power.js?panel=${panelIndex}&server=${serverId}&action=resources`);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const text = await response.text();
        
        // Handle empty response
        if (!text || text.trim() === '') {
            throw new Error('Empty response');
        }
        
        let result;
        try {
            result = JSON.parse(text);
        } catch (parseError) {
            console.warn(`JSON parse error for ${serverId}:`, parseError);
            return;
        }
        
        // Check for error in response
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
        console.error(`Error loading resources for ${serverId}:`, error.message);
        
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
    
    // Disk usage (optional)
    const diskBytes = resourcesData.disk_bytes || 0;
    const diskMB = (diskBytes / 1024 / 1024).toFixed(0);
    
    // Uptime (optional)
    const uptime = resourcesData.uptime || 0;
    if (uptime > 0) {
        const uptimeSeconds = Math.floor(uptime / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        
        // Bisa ditambahkan ke card jika mau
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
    updateChart(chart.ram, chart.ramData, 0, Math.max(...chart.ramData, 100, 1));
}

// Create chart instance
function createChart(canvas, color) {
    const ctx = canvas.getContext('2d');
    // Set canvas size based on display size
    const container = canvas.parentElement;
    if (container) {
        const width = container.clientWidth;
        canvas.width = width;
        canvas.height = 60;
    }
    return { ctx, color, width: canvas.width, height: canvas.height };
}

// Update chart dengan data baru
function updateChart(chart, data, minY, maxY) {
    const { ctx, color, width, height } = chart;
    
    ctx.clearRect(0, 0, width, height);
    
    if (data.length < 2) return;
    
    // Draw grid lines (optional)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
        const y = (height / 4) * i;
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }
    
    // Draw line
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    const stepX = width / (data.length - 1);
    const rangeY = maxY - minY || 1;
    
    data.forEach((value, index) => {
        const x = index * stepX;
        const y = height - (((value - minY) / rangeY) * height);
        
        // Clamp y to canvas bounds
        const clampedY = Math.max(0, Math.min(height, y));
        
        if (index === 0) {
            ctx.moveTo(x, clampedY);
        } else {
            ctx.lineTo(x, clampedY);
        }
    });
    
    ctx.stroke();
    
    // Fill area under line (gradient)
    ctx.lineTo(data.length * stepX, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    
    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color + '80'); // 50% opacity
    gradient.addColorStop(1, color + '10'); // 6% opacity
    
    ctx.fillStyle = gradient;
    ctx.fill();
}

// Control server power
async function controlServer(panelIndex, serverId, action) {
    // Confirmation for stop/restart
    if (action === 'stop' || action === 'restart') {
        if (!confirm(`Apakah Anda yakin ingin ${action} server ini?`)) {
            return;
        }
    }
    
    const button = event.target;
    const originalText = button.textContent;
    
    try {
        // Disable button and show loading
        button.disabled = true;
        button.textContent = '...';
        button.style.opacity = '0.5';
        
        const response = await fetch(`/api/power.js?panel=${panelIndex}&server=${serverId}&action=${action}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const text = await response.text();
            let errorMsg = `HTTP ${response.status}`;
            try {
                const errorData = JSON.parse(text);
                errorMsg = errorData.message || errorData.error || errorMsg;
            } catch (e) {
                errorMsg = text || errorMsg;
            }
            throw new Error(errorMsg);
        }
        
        // Show success feedback
        const card = document.getElementById(`server-${panelIndex}-${serverId}`);
        if (card) {
            card.style.transform = 'scale(0.98)';
            card.style.transition = 'transform 0.2s';
            setTimeout(() => {
                card.style.transform = 'scale(1)';
            }, 200);
        }
        
        // Show success message
        button.textContent = '✓';
        button.style.background = 'rgba(72, 187, 120, 0.2)';
        
        // Refresh resources after action
        setTimeout(() => {
            loadServerResources(panelIndex, serverId);
            button.disabled = false;
            button.textContent = originalText;
            button.style.opacity = '1';
            button.style.background = '';
        }, 2000);
        
    } catch (error) {
        console.error(`Power action error:`, error);
        alert(`❌ Gagal ${action} server: ${error.message}`);
        
        // Reset button
        button.disabled = false;
        button.textContent = originalText;
        button.style.opacity = '1';
    }
}

// Auto refresh semua data
function startAutoRefresh() {
    setInterval(() => {
        if (panels.length > 0) {
            console.log('🔄 Auto-refreshing resources...');
            panels.forEach((_, panelIndex) => {
                const serversGrid = document.getElementById(`panel-servers-${panelIndex}`);
                if (serversGrid) {
                    const serverCards = serversGrid.querySelectorAll('.server-card');
                    serverCards.forEach(card => {
                        const serverId = card.id.split('-').pop();
                        if (serverId && serverId !== 'unknown') {
                            loadServerResources(panelIndex, serverId);
                        }
                    });
                }
            });
        }
    }, REFRESH_INTERVAL);
}

// Show error message di container utama
function showError(message) {
    const container = document.getElementById('panelsContainer');
    if (container) {
        container.innerHTML = `
            <div class="error" style="margin: 2rem; text-align: center;">
                <strong>❌ Error</strong><br>
                ${message}
                <br><br>
                <button onclick="location.reload()" class="power-btn" style="background: #63b3ed; color: white;">
                    🔄 Refresh Halaman
                </button>
            </div>
        `;
    }
}

// Handle window resize untuk update charts
window.addEventListener('resize', () => {
    // Re-initialize charts on resize
    CHARTS.clear();
});

// Export untuk digunakan di HTML
window.controlServer = controlServer;
window.testPanelConnection = testPanelConnection;
window.retryLoadPanel = retryLoadPanel;

console.log('✅ Script loaded successfully!');
