const fetch = require('node-fetch');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    try {
        const panelIndex = parseInt(req.query.panel);
        const serverId = req.query.server;
        const action = req.query.action;
        
        if (isNaN(panelIndex) || !serverId) {
            return res.status(400).json({ error: 'Panel index and server ID required' });
        }
        
        const panelUrl = process.env[`PANEL_${panelIndex + 1}_URL`];
        const apiKey = process.env[`PANEL_${panelIndex + 1}_CLIENT_KEY`];
        
        if (!panelUrl || !apiKey) {
            return res.status(404).json({ error: 'Panel not found' });
        }
        
        // Handle different actions
        if (action === 'resources' || req.method === 'GET') {
            // Fetch server resources
            const response = await fetch(`${panelUrl}/api/client/servers/${serverId}/resources`, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }
            
            const data = await response.json();
            res.status(200).json(data);
            
        } else if (['start', 'stop', 'restart'].includes(action) && req.method === 'POST') {
            // Send power action
            const response = await fetch(`${panelUrl}/api/client/servers/${serverId}/power`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ signal: action })
            });
            
            if (!response.ok) {
                throw new Error(`API responded with status ${response.status}`);
            }
            
            res.status(204).end();
        } else {
            res.status(400).json({ error: 'Invalid action' });
        }
        
    } catch (error) {
        console.error('Power action error:', error);
        res.status(500).json({ error: error.message });
    }
};