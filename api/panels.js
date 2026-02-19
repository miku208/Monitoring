const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // Only allow GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    try {
        const panelIndex = parseInt(req.query.panel);
        
        if (isNaN(panelIndex)) {
            return res.status(400).json({ error: 'Panel index required' });
        }
        
        // Get panel configuration from environment variables
        const panelNumber = panelIndex + 1;
        const panelUrl = process.env[`PANEL_${panelNumber}_URL`];
        const apiKey = process.env[`PANEL_${panelNumber}_CLIENT_KEY`];
        const panelName = process.env[`PANEL_${panelNumber}_NAME`] || `Panel ${panelNumber}`;
        
        if (!panelUrl || !apiKey) {
            return res.status(404).json({ 
                error: 'Panel not found',
                message: `Panel ${panelNumber} (${panelName}) tidak ditemukan atau konfigurasi tidak lengkap`
            });
        }
        
        // Clean URL (remove trailing slash)
        const baseUrl = panelUrl.replace(/\/$/, '');
        
        // Fetch servers from panel
        const response = await fetch(`${baseUrl}/api/client`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'User-Agent': 'Pterodactyl-Monitor/1.0'
            },
            timeout: 10000 // 10 second timeout
        });
        
        // Check if response is OK
        if (!response.ok) {
            // Try to get error message from response
            let errorMessage = `HTTP Error ${response.status}`;
            try {
                const errorData = await response.text();
                if (errorData) {
                    errorMessage += `: ${errorData.substring(0, 200)}`;
                }
            } catch (e) {
                // Ignore if can't read error body
            }
            
            throw new Error(errorMessage);
        }
        
        // Get response text first
        const responseText = await response.text();
        
        // Check if response is empty
        if (!responseText || responseText.trim() === '') {
            throw new Error('Empty response from server');
        }
        
        // Try to parse JSON
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON Parse Error:', parseError);
            console.error('Response text:', responseText.substring(0, 500));
            throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
        }
        
        // Validate response structure
        if (!data || !data.data || !Array.isArray(data.data)) {
            console.error('Invalid API response structure:', data);
            throw new Error('Invalid API response structure');
        }
        
        // Format servers data
        const servers = data.data.map(server => {
            const attrs = server.attributes || {};
            return {
                identifier: attrs.identifier || 'unknown',
                name: attrs.name || 'Unnamed Server',
                description: attrs.description || '',
                status: attrs.status || 'offline',
                node: attrs.node || 'unknown',
                sftp_details: attrs.sftp_details || {}
            };
        });
        
        // Return successful response
        res.status(200).json({
            panel: {
                index: panelIndex,
                name: panelName,
                url: panelUrl
            },
            total: servers.length,
            servers: servers
        });
        
    } catch (error) {
        console.error('Server fetch error details:', {
            message: error.message,
            stack: error.stack,
            panel: req.query.panel
        });
        
        // Return error with appropriate status
        res.status(500).json({ 
            error: 'Failed to load servers',
            message: error.message,
            panel: req.query.panel
        });
    }
};