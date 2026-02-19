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
        const panels = [];
        let index = 1;
        
        // Loop through environment variables to find panels
        while (process.env[`PANEL_${index}_NAME`]) {
            panels.push({
                name: process.env[`PANEL_${index}_NAME`],
                url: process.env[`PANEL_${index}_URL`],
                key: process.env[`PANEL_${index}_CLIENT_KEY`],
                index: index - 1
            });
            index++;
        }
        
        res.status(200).json(panels);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};