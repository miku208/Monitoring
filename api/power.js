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
    
    try {
        const panelIndex = parseInt(req.query.panel);
        const serverId = req.query.server;
        const action = req.query.action;
        
        // Validate required parameters
        if (isNaN(panelIndex)) {
            return res.status(400).json({ error: 'Panel index required' });
        }
        
        if (!serverId) {
            return res.status(400).json({ error: 'Server ID required' });
        }
        
        // Get panel configuration
        const panelNumber = panelIndex + 1;
        const panelUrl = process.env[`PANEL_${panelNumber}_URL`];
        const apiKey = process.env[`PANEL_${panelNumber}_CLIENT_KEY`];
        
        if (!panelUrl || !apiKey) {
            return res.status(404).json({ 
                error: 'Panel not found',
                message: `Panel ${panelNumber} tidak ditemukan`
            });
        }
        
        // Clean URL
        const baseUrl = panelUrl.replace(/\/$/, '');
        
        // Handle different actions
        if (action === 'resources' || (req.method === 'GET' && !action)) {
            // Fetch server resources
            const response = await fetch(`${baseUrl}/api/client/servers/${serverId}/resources`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Pterodactyl-Monitor/1.0'
                },
                timeout: 10000
            });
            
            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}`;
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        errorMsg += `: ${errorText.substring(0, 200)}`;
                    }
                } catch (e) {}
                throw new Error(errorMsg);
            }
            
            const responseText = await response.text();
            
            if (!responseText || responseText.trim() === '') {
                throw new Error('Empty response from server');
            }
            
            let data;
            try {
                data = JSON.parse(responseText);
            } catch (parseError) {
                console.error('JSON Parse Error:', parseError);
                console.error('Response text:', responseText.substring(0, 500));
                throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}...`);
            }
            
            // Validate resources data structure
            if (!data || !data.attributes) {
                throw new Error('Invalid resources response structure');
            }
            
            res.status(200).json(data);
            
        } else if (['start', 'stop', 'restart'].includes(action) && req.method === 'POST') {
            // Send power action
            const response = await fetch(`${baseUrl}/api/client/servers/${serverId}/power`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Pterodactyl-Monitor/1.0'
                },
                body: JSON.stringify({ signal: action })
            });
            
            if (!response.ok) {
                let errorMsg = `HTTP ${response.status}`;
                try {
                    const errorText = await response.text();
                    if (errorText) {
                        errorMsg += `: ${errorText.substring(0, 200)}`;
                    }
                } catch (e) {}
                throw new Error(errorMsg);
            }
            
            // Success - no content
            res.status(204).end();
            
        } else if (action) {
            // Invalid action
            res.status(400).json({ 
                error: 'Invalid action',
                message: `Action '${action}' not recognized. Use: start, stop, restart, or resources`
            });
        } else {
            // No action specified for GET
            res.status(400).json({ 
                error: 'Action required',
                message: 'Please specify an action (resources, start, stop, restart)'
            });
        }
        
    } catch (error) {
        console.error('Power action error:', {
            message: error.message,
            stack: error.stack,
            params: req.query
        });
        
        res.status(500).json({ 
            error: 'Failed to process request',
            message: error.message
        });
    }
};