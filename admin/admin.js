const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  filter: "all",
  logs: [],
  requests: [],
  windows: [],
  statsToday: { approved: 0, rejected: 0 },
  modal: { action: null, id: null },
};

function fmtDateBR(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.style.display = "block";
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.style.display = "none"), 2600);
}

function addLog(title, subtitle) {
  state.logs.unshift({ id: crypto.randomUUID(), title, subtitle });
  renderLogs();
  updateBell();
}

function updateBell() {
  $("#bellCount").textContent = String(state.logs.length);
}

function statusLabel(s) {
  return { pending:"Pendente", approved:"Aprovada", rejected:"Recusada" }[s] || s;
}

function renderKPIs() {
  const pending = state.requests.filter(r => r.status === "pending").length;
  const activeWindows = state.windows.filter(w => w.active).length;

  $("#kpiPending").textContent = pending;
  $("#kpiApprovedToday").textContent = state.statsToday.approved;
  $("#kpiRejectedToday").textContent = state.statsToday.rejected;
  $("#kpiWindowsActive").textContent = activeWindows;
}

function renderRequests() {
  const tbody = $("#pendingTbody");
  tbody.innerHTML = "";

  const rows = state.requests.filter(r => state.filter === "all" ? true : r.status === state.filter);

  $("#pendingEmpty").style.display = rows.length ? "none" : "block";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.guard}</td>
      <td>${fmtDateBR(r.date)}</td>
      <td>${r.period}</td>
      <td>${r.place ? r.place : "<span style='opacity:.75'>A definir</span>"}</td>
      <td><span class="badge ${r.status}">${statusLabel(r.status)}</span></td>
      <td>
        <div class="cell-actions">
          <button class="btn-ghost" data-action="details" data-id="${r.id}">Detalhes</button>
          <button class="btn-ghost" data-action="approve" data-id="${r.id}" ${r.status === "pending" ? "" : "disabled"}>Aprovar</button>
          <button class="btn-secondary" data-action="reject" data-id="${r.id}" ${r.status === "pending" ? "" : "disabled"}>Recusar</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const req = state.requests.find(x => x.id === id);
      if (!req) return;

      if (action === "approve") {
  openModal("Aprovar disponibilidade", `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div><b>Guarda:</b> ${req.guard}</div>
      <div><b>Data:</b> ${fmtDateBR(req.date)} • <b>${req.period}</b></div>

      <div style="margin-top:4px;"><b>Definir Local (obrigatório):</b></div>
      <input id="workPlace" type="text" placeholder="Ex.: Centro • Base Operacional" />

      <div style="margin-top:6px;"><b>Feedback (opcional):</b></div>
      <textarea id="feedback" placeholder="Ex.: Aprovado conforme escala..."></textarea>
    </div>
  `, "approve", id);
}

if (action === "reject") {
  openModal("Recusar disponibilidade", `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div><b>Guarda:</b> ${req.guard}</div>
      <div><b>Data:</b> ${fmtDateBR(req.date)} • <b>${req.period}</b></div>
      <div><b>Local:</b> <span style="opacity:.75">A definir</span></div>

      <div style="margin-top:6px;"><b>Feedback (opcional):</b></div>
      <textarea id="feedback" placeholder="Ex.: Recusado por falta de vaga..."></textarea>
    </div>
  `, "reject", id);
}

    });
  });
}

function renderWindows() {
  const tbody = $("#windowsTbody");
  tbody.innerHTML = "";

  $("#windowsEmpty").style.display = state.windows.length ? "none" : "block";

  for (const w of state.windows.sort((a,b) => a.date.localeCompare(b.date))) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDateBR(w.date)}</td>
      <td>${w.period}</td>
      <td>${w.place}</td>
      <td>${w.slots ?? "<span style='opacity:.75'>—</span>"}</td>
      <td><span class="badge ${w.active ? "approved" : "off"}">${w.active ? "Ativa" : "Inativa"}</span></td>
      <td>
        <div class="cell-actions">
          <button class="btn-ghost" data-action="toggle" data-id="${w.id}">${w.active ? "Desativar" : "Ativar"}</button>
          <button class="btn-secondary" data-action="remove" data-id="${w.id}">Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll("button[data-action]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const w = state.windows.find(x => x.id === id);
      if (!w) return;

      if (action === "toggle") {
        w.active = !w.active;
        toast(w.active ? "Janela ativada." : "Janela desativada.");
        addLog("Janela atualizada", `${fmtDateBR(w.date)} • ${w.period} • ${w.place} • ${w.active ? "Ativa" : "Inativa"}`);
        rerenderAll();
      }

      if (action === "remove") {
        state.windows = state.windows.filter(x => x.id !== id);
        toast("Janela removida.");
        addLog("Janela removida", `${fmtDateBR(w.date)} • ${w.period} • ${w.place}`);
        rerenderAll();
      }
    });
  });
}

function renderLogs() {
  const list = $("#logsList");
  list.innerHTML = "";

  $("#logsEmpty").style.display = state.logs.length ? "none" : "block";

  for (const a of state.logs.slice(0, 10)) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="item-title">${a.title}</div>
      <div class="item-sub">${a.subtitle}</div>
    `;
    list.appendChild(div);
  }
}

function setFilter(filter) {
  state.filter = filter;
  $$(".chip").forEach(c => c.classList.toggle("active", c.dataset.filter === filter));
  renderRequests();
}

function rerenderAll() {
  renderKPIs();
  renderRequests();
  renderWindows();
  renderLogs();
}

function openModal(title, html, action = null, id = null) {
  state.modal.action = action;
  state.modal.id = id;
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  $("#modalBackdrop").style.display = "flex";
  $("#modalBackdrop").setAttribute("aria-hidden", "false");
}

function closeModal() {
  $("#modalBackdrop").style.display = "none";
  $("#modalBackdrop").setAttribute("aria-hidden", "true");
  state.modal.action = null;
  state.modal.id = null;
}

function seedRequests() {
  const today = new Date();
  const d1 = new Date(today); d1.setDate(d1.getDate() + 1);
  const d2 = new Date(today); d2.setDate(d2.getDate() + 2);
  const d3 = new Date(today); d3.setDate(d3.getDate() + 3);

  const toISO = (d) => d.toISOString().slice(0,10);

  state.requests = [
    { id: crypto.randomUUID(), guard:"GCM • Silva", date: toISO(d1), period:"Noite", place:"Centro • Base Operacional", note:"Disponível após 18h", status:"pending", feedback:"" },
    { id: crypto.randomUUID(), guard:"GCM • Souza", date: toISO(d2), period:"Manhã", place:"Pimentas • Operação DEAC", note:"Preferência por apoio", status:"pending", feedback:"" },
    { id: crypto.randomUUID(), guard:"GCM • Lima",  date: toISO(d3), period:"Tarde", place:"Vila Galvão • Posto Avançado", note:"—", status:"pending", feedback:"" },
  ];

  addLog("Pendências geradas", "3 solicitações inseridas (mock).");
  rerenderAll();
}

function init() {
  $("#userName").textContent = "Admin • Guilherme";

  // filtros
  $$(".chip").forEach(chip => chip.addEventListener("click", () => setFilter(chip.dataset.filter)));

  // seed/limpar requests
  $("#btnSeed").addEventListener("click", () => {
    seedRequests();
    toast("Pendências geradas (mock).");
  });

  $("#btnClearRequests").addEventListener("click", () => {
    state.requests = [];
    toast("Pendências limpas (mock).");
    addLog("Pendências limpas", "Lista de solicitações esvaziada (mock).");
    rerenderAll();
  });

  // cadastrar janela
  $("#windowForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = $("#wDate").value;
    const period = $("#wPeriod").value;
    const place = $("#wPlace").value.trim();
    const slotsRaw = $("#wSlots").value;
    const slots = slotsRaw ? Number(slotsRaw) : null;

    if (!date || !period || !place) return toast("Preencha data, período e local.");

    state.windows.unshift({
      id: crypto.randomUUID(),
      date, period, place,
      slots,
      active: true
    });

    $("#windowForm").reset();
    toast("Janela cadastrada.");
    addLog("Janela cadastrada", `${fmtDateBR(date)} • ${period} • ${place}${slots ? ` • Vagas: ${slots}` : ""}`);
    rerenderAll();
  });

  $("#btnWindowExample").addEventListener("click", () => {
    const d = new Date(); d.setDate(d.getDate() + 5);
    $("#wDate").value = d.toISOString().slice(0,10);
    $("#wPeriod").value = "Noite";
    $("#wPlace").value = "Centro • Base Operacional";
    $("#wSlots").value = "10";
    toast("Exemplo preenchido.");
  });

  // logs
  $("#btnClearLogs").addEventListener("click", () => {
    state.logs = [];
    renderLogs();
    updateBell();
    toast("Logs limpos.");
  });

  // bell modal
  $("#btnBell").addEventListener("click", () => {
    if (!state.logs.length) return toast("Sem logs.");
    const html = state.logs.slice(0, 12).map(a => `
      <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.10);">
        <div style="font-weight:900;">${a.title}</div>
        <div style="opacity:.78;margin-top:4px;">${a.subtitle}</div>
      </div>
    `).join("");
    openModal("Logs", html);
  });

  // modal controls
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalCancel").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (e) => {
    if (e.target === $("#modalBackdrop")) closeModal();
  });

  $("#modalConfirm").addEventListener("click", () => {
    const action = state.modal.action;
    const id = state.modal.id;
    if (!action || !id) return closeModal();

    const req = state.requests.find(r => r.id === id);
    if (!req) return closeModal();

    const feedbackEl = $("#feedback");
    const feedback = feedbackEl ? feedbackEl.value.trim() : "";

    if (action === "approve") {
  if (req.status !== "pending") return toast("Já decidido.");

  const placeEl = $("#workPlace");
  const place = placeEl ? placeEl.value.trim() : "";

  if (!place) {
    toast("Defina o local para aprovar.");
    return;
  }

  req.status = "approved";
  req.place = place;                      // aqui o admin define o local
  req.feedback = feedback || "Aprovado (mock).";
  state.statsToday.approved += 1;

  toast("Aprovado.");
  addLog("Aprovação registrada", `${req.guard} • ${fmtDateBR(req.date)} • ${req.period} • ${place}`);
}


    if (action === "reject") {
      if (req.status !== "pending") return toast("Já decidido.");
      req.status = "rejected";
      req.feedback = feedback || "Recusado (mock).";
      state.statsToday.rejected += 1;
      toast("Recusado.");
      addLog("Recusa registrada", `${req.guard} • ${fmtDateBR(req.date)} • ${req.period} • ${req.place}`);
    }

    if (action === "details") {
      toast("Ok.");
    }

    closeModal();
    rerenderAll();
  });

  // navegação (front-only)
  $("#btnBack").addEventListener("click", () => (window.location.href = "dashboard.html"));
  $("#btnLogout").addEventListener("click", () => {
    toast("Saindo (front-only)…");
    setTimeout(() => (window.location.href = "login.html"), 600);
  });

  // estado inicial
  // adiciona algumas janelas exemplo
  const d = new Date(); d.setDate(d.getDate() + 2);
  state.windows = [
    { id: crypto.randomUUID(), date: d.toISOString().slice(0,10), period:"Noite", place:"Centro • Base Operacional", slots: 10, active:true },
  ];
  addLog("Sistema iniciado", "Painel admin carregado (front-only).");

  rerenderAll();
  updateBell();
}

init();
