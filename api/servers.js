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
        
        if (isNaN(panelIndex)) {
            return res.status(400).json({ error: 'Panel index required' });
        }
        
        const panelUrl = process.env[`PANEL_${panelIndex + 1}_URL`];
        const apiKey = process.env[`PANEL_${panelIndex + 1}_CLIENT_KEY`];
        
        if (!panelUrl || !apiKey) {
            return res.status(404).json({ error: 'Panel not found' });
        }
        
        // Fetch servers from panel
        const response = await fetch(`${panelUrl}/api/client`, {
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
        
        // Format servers data
        const servers = data.data.map(server => ({
            identifier: server.attributes.identifier,
            name: server.attributes.name,
            description: server.attributes.description,
            status: server.attributes.status || 'offline'
        }));
        
        res.status(200).json(servers);
        
    } catch (error) {
        console.error('Server fetch error:', error);
        res.status(500).json({ error: error.message });
    }
};