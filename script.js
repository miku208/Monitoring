const panelSelect = document.getElementById("panelSelect");
const serversDiv = document.getElementById("servers");

async function loadPanels() {
  const res = await fetch("/api/panels");
  const data = await res.json();

  data.panels.forEach(p => {
    const option = document.createElement("option");
    option.value = p.id;
    option.textContent = p.name;
    panelSelect.appendChild(option);
  });

  loadServers();
}

async function loadServers() {
  const id = panelSelect.value;
  const res = await fetch(`/api/servers?id=${id}`);
  const data = await res.json();

  serversDiv.innerHTML = "";

  data.servers.forEach(s => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h3>${s.name}</h3>
      <p class="status ${s.status}">
        ${s.status.toUpperCase()}
      </p>
      <div class="buttons">
        <button class="start" onclick="power('${s.id}','start')">Start</button>
        <button class="stop" onclick="power('${s.id}','stop')">Stop</button>
        <button class="restart" onclick="power('${s.id}','restart')">Restart</button>
      </div>
    `;

    serversDiv.appendChild(card);
  });
}

async function power(server, action) {
  await fetch("/api/power", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: panelSelect.value,
      server,
      action
    })
  });

  setTimeout(loadServers, 1500);
}

panelSelect.addEventListener("change", loadServers);

loadPanels();