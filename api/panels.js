module.exports = async function handler(req, res) {
    // ===== CORS =====
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // ===== Preflight =====
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // ===== Only GET =====
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const panelIndex = parseInt(req.query.panel);

        if (isNaN(panelIndex)) {
            return res.status(400).json({ error: 'Panel index required' });
        }

        const panelNumber = panelIndex + 1;

        const panelUrl = process.env[`PANEL_${panelNumber}_URL`];
        const apiKey = process.env[`PANEL_${panelNumber}_CLIENT_KEY`];
        const panelName =
            process.env[`PANEL_${panelNumber}_NAME`] || `Panel ${panelNumber}`;

        if (!panelUrl || !apiKey) {
            return res.status(404).json({
                error: 'Panel not found',
                message: `Panel ${panelNumber} (${panelName}) tidak lengkap`
            });
        }

        const baseUrl = panelUrl.replace(/\/$/, '');

        // ===== Timeout fetch =====
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let response;
        try {
            response = await fetch(`${baseUrl}/api/client/servers`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Pterodactyl-Monitor/1.0'
                },
                signal: controller.signal
            });
        } finally {
            clearTimeout(timeout);
        }

        // ===== HTTP error =====
        if (!response.ok) {
            let text = '';
            try {
                text = await response.text();
            } catch {}

            throw new Error(`HTTP ${response.status} - ${text.substring(0, 120)}`);
        }

        // ===== Parse JSON aman =====
        const text = await response.text();

        if (!text) throw new Error('Empty response from panel');

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error('Invalid JSON from panel');
        }

        if (!data?.data || !Array.isArray(data.data)) {
            throw new Error('Unexpected API structure');
        }

        // ===== Format server =====
        const servers = data.data.map((srv) => {
            const a = srv.attributes || {};

            return {
                identifier: a.identifier || 'unknown',
                name: a.name || 'Unnamed Server',
                description: a.description || '',
                status: a.status || 'offline',
                node: a.node || 'unknown'
            };
        });

        return res.status(200).json({
            panel: {
                index: panelIndex,
                name: panelName,
                url: panelUrl
            },
            total: servers.length,
            servers
        });
    } catch (err) {
        console.error('FETCH PANEL ERROR:', err);

        return res.status(500).json({
            error: 'Failed to load servers',
            message: err.message
        });
    }
};
