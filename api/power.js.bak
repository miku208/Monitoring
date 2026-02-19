export default async function handler(req, res) {
  try {
    const { id, server, action } = req.body;

    const url = process.env[`PANEL_${id}_URL`];
    const key = process.env[`PANEL_${id}_CLIENT_KEY`];

    if (!url || !key) {
      return res.status(400).json({ success: false });
    }

    await fetch(`${url}/api/client/servers/${server}/power`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ signal: action })
    });

    res.status(200).json({ success: true });

  } catch {
    res.status(500).json({ success: false });
  }
}