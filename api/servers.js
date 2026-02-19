export default async function handler(req, res) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Panel id required"
      });
    }

    const url = process.env[`PANEL_${id}_URL`];
    const key = process.env[`PANEL_${id}_KEY`];

    if (!url || !key) {
      return res.status(404).json({
        success: false,
        message: "Panel not found"
      });
    }

    const response = await fetch(`${url}/api/application/servers`, {
      headers: {
        "Authorization": `Bearer ${key}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    });

    const data = await response.json();

    const servers = data.data.map(s => ({
      id: s.attributes.identifier,
      name: s.attributes.name,
      status: s.attributes.status ?? "unknown"
    }));

    res.status(200).json({
      success: true,
      servers
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch servers"
    });
  }
}
