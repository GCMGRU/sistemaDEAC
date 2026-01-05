const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

const state = {
  filter: "all",
  user: { name: "GCM • Guilherme" },
  requests: [],
  alerts: [],
};

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth(); // 0-11

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

function addAlert(title, subtitle) {
  state.alerts.unshift({ id: crypto.randomUUID(), title, subtitle });
  renderAlerts();
  updateBell();
}

function updateBell() {
  $("#bellCount").textContent = String(state.alerts.length);
}

function statusLabel(s) {
  return { pending:"Pendente", approved:"Aprovada", rejected:"Recusada", canceled:"Cancelada" }[s] || s;
}

function renderKPIs() {
  const pending = state.requests.filter(r => r.status === "pending").length;
  const approved = state.requests.filter(r => r.status === "approved").length;
  const rejected = state.requests.filter(r => r.status === "rejected").length;

  // próximos 7 dias (front-only: usa data 00:00)
  const now = new Date();
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);
  const upcoming = state.requests.filter(r => {
    if (r.status !== "approved") return false;
    const dt = new Date(r.date + "T00:00:00");
    return dt >= now && dt <= in7;
  }).length;

  $("#kpiPending").textContent = pending;
  $("#kpiApproved").textContent = approved;
  $("#kpiRejected").textContent = rejected;
  $("#kpiUpcoming").textContent = upcoming;
}

function renderRequests() {
  const tbody = $("#requestsTbody");
  tbody.innerHTML = "";

  const rows = state.requests.filter(r => state.filter === "all" ? true : r.status === state.filter);

  $("#requestsEmpty").style.display = rows.length ? "none" : "block";

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDateBR(r.date)}</td>
      <td>${r.period}</td>
      <td>${r.place ? r.place : "<span style='opacity:.75'>A definir</span>"}</td>
      <td><span class="badge ${r.status}">${statusLabel(r.status)}</span></td>
      <td>
        <div class="cell-actions">
          <button class="btn-ghost" data-action="details" data-id="${r.id}">Detalhes</button>
          <button class="btn-secondary" data-action="cancel" data-id="${r.id}" ${r.status === "pending" ? "" : "disabled"}>Cancelar</button>
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

      if (action === "details") {
        openModal("Detalhes", `
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div><b>Data:</b> ${fmtDateBR(req.date)}</div>
            <div><b>Período:</b> ${req.period}</div>
            <div><b>Carga Horária:</b> ${req.workload}</div>
            <div><b>Local:</b> ${req.place}</div>
            <div><b>Status:</b> ${statusLabel(req.status)}</div>
            <div><b>Observação:</b> ${req.note ? req.note : "<span style='opacity:.75'>—</span>"}</div>
            <div><b>Feedback:</b> ${req.feedback ? req.feedback : "<span style='opacity:.75'>—</span>"}</div>
          </div>
        `);
      }

      if (action === "cancel") {
        if (req.status !== "pending") return;
        req.status = "canceled";
        req.feedback = "Cancelado pelo usuário (mock).";
        toast("Disponibilidade cancelada.");
        addAlert("Disponibilidade cancelada", `${fmtDateBR(req.date)} • ${req.period} • ${req.place}`);
        rerenderAll();
      }
    });
  });
}

function renderAgenda() {
  const list = $("#agendaList");
  list.innerHTML = "";

  const now = new Date();
  const in7 = new Date(); in7.setDate(in7.getDate() + 7);

  const items = state.requests
    .filter(r => r.status === "approved" && r.place)
    .filter(r => {
      const dt = new Date(r.date + "T00:00:00");
      return dt >= now && dt <= in7;
    })
    .sort((a,b) => a.date.localeCompare(b.date));

  $("#agendaEmpty").style.display = items.length ? "none" : "block";

  for (const r of items) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="item-title">${fmtDateBR(r.date)} • ${r.period}</div>
      <div class="item-sub">${r.place}</div>
    `;
    list.appendChild(div);
  }
}

function renderAlerts() {
  const list = $("#alertsList");
  list.innerHTML = "";

  $("#alertsEmpty").style.display = state.alerts.length ? "none" : "block";

  for (const a of state.alerts.slice(0, 8)) {
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
  renderAgenda();
  renderCalendar();
}

function openModal(title, html) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  $("#modalBackdrop").style.display = "flex";
  $("#modalBackdrop").setAttribute("aria-hidden", "false");
}

function closeModal() {
  $("#modalBackdrop").style.display = "none";
  $("#modalBackdrop").setAttribute("aria-hidden", "true");
}

function pickFirstPending() {
  return state.requests.find(r => r.status === "pending");
}

function init() {
  $("#userName").textContent = state.user.name;

  // filtros
  $$(".chip").forEach(chip => chip.addEventListener("click", () => setFilter(chip.dataset.filter)));

  // cadastrar disponibilidade
  $("#availabilityForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const date = $("#date").value;
    const period = $("#period").value;
    const workload = $("#workload").value;
    const note = $("#note").value.trim();


    if (!date || !period || !workload) {
      toast("Preencha data, período e carga horária.");
      return;
    }

    state.requests.unshift({    
  id: crypto.randomUUID(),
  date,
  period,
  workload,
  place: "",                 // local será definido pelo admin
  placeDefined: false,        // marca que ainda não foi definido
  note,
  status: "pending",
  feedback: ""
    });

    $("#availabilityForm").reset();
    toast("Disponibilidade registrada (pendente).");
    addAlert("Disponibilidade enviada", `${fmtDateBR(date)} • ${period} • Local: a definir`);
    
    rerenderAll();

  });

  // 🔁 CONTROLES DO CALENDÁRIO (CORRETO)
$("#calPrev").addEventListener("click", () => {
  calMonth--;
  if (calMonth < 0) {
    calMonth = 11;
    calYear--;
  }
  renderCalendar();
});

$("#calNext").addEventListener("click", () => {
  calMonth++;
  if (calMonth > 11) {
    calMonth = 0;
    calYear++;
  }
  renderCalendar();
});


  // exemplo
  $("#btnFillExample").addEventListener("click", () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    $("#date").value = d.toISOString().slice(0,10);
    $("#period").value = "Noite";
    $("#note").value = "Disponível após 18h.";
    toast("Exemplo preenchido.");
  });

  // simular aprovação
  $("#btnSimApprove").addEventListener("click", () => {
    const r = pickFirstPending();
    if (!r) return toast("Não há pendentes para aprovar.");
    r.status = "approved";
    r.feedback = "Aprovado pelo administrador (mock).";
    toast("Aprovado (mock).");
    addAlert("DEAC aprovado", `${fmtDateBR(r.date)} • ${r.period} • ${r.place}`);
    rerenderAll();
  });

  // simular recusa
  $("#btnSimReject").addEventListener("click", () => {
    const r = pickFirstPending();
    if (!r) return toast("Não há pendentes para recusar.");
    r.status = "rejected";
    r.feedback = "Recusado pelo administrador (mock).";
    toast("Recusado (mock).");
    addAlert("DEAC recusado", `${fmtDateBR(r.date)} • ${r.period} • ${r.place}`);
    rerenderAll();
  });

  // limpar alertas
  $("#btnClearAlerts").addEventListener("click", () => {
    state.alerts = [];
    renderAlerts();
    updateBell();
    toast("Alertas limpos.");
  });

  // sino (modal)
  $("#btnBell").addEventListener("click", () => {
    if (!state.alerts.length) return toast("Sem alertas.");
    const html = state.alerts.slice(0, 12).map(a => `
      <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.10);">
        <div style="font-weight:900;">${a.title}</div>
        <div style="opacity:.78;margin-top:4px;">${a.subtitle}</div>
      </div>
    `).join("");
    openModal("Alertas", html);
  });

  // modal close
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalOk").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (e) => {
    if (e.target === $("#modalBackdrop")) closeModal();
  });

  // logout (front-only)
  $("#btnLogout").addEventListener("click", () => {
    toast("Saindo (front-only)…");
    setTimeout(() => (window.location.href = "login.html"), 600);
  });

  // tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => setView(btn.dataset.target));
});

// view inicial
setView("register");


  rerenderAll();
  renderAlerts();
  updateBell();
  renderCalendar();
}

init();

function setView(viewName) {
  // ativa botão
  document.querySelectorAll(".tab").forEach(b => {
    b.classList.toggle("active", b.dataset.target === viewName);
  });

  // mostra seção certa
  document.querySelectorAll(".view").forEach(v => {
    v.classList.toggle("active", v.dataset.view === viewName);
  });

  if (viewName === "agenda") {
    renderCalendar();
  }
}

function toISODate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthTitle(year, month) {
  const dt = new Date(year, month, 1);
  return dt.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

function getApprovedDatesSet() {
  const set = new Set();
  state.requests
    .filter(r => r.status === "approved" && r.place) // só os confirmados
    .forEach(r => set.add(r.date));                  // r.date já é YYYY-MM-DD
  return set;
}

function renderCalendar() {
  const grid = $("#calGrid");
  if (!grid) return; // se não existir no HTML, não quebra

  $("#calTitle").textContent = monthTitle(calYear, calMonth);
  grid.innerHTML = "";

  const firstDay = new Date(calYear, calMonth, 1);
  const startWeekday = firstDay.getDay(); // 0=Dom
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  const approvedSet = getApprovedDatesSet();

  // espaços vazios antes do 1º dia
  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-day muted";
    empty.style.visibility = "hidden";
    grid.appendChild(empty);
  }

  // dias do mês
  for (let day = 1; day <= daysInMonth; day++) {
    const dt = new Date(calYear, calMonth, day);
    const iso = toISODate(dt);

    const cell = document.createElement("div");
    cell.className = "cal-day";
    if (approvedSet.has(iso)) cell.classList.add("has-event");

    cell.innerHTML = `<div class="n">${day}</div>`;

    cell.addEventListener("click", () => {
      const items = state.requests.filter(r =>
        r.status === "approved" && r.place && r.date === iso
      );

      if (!items.length) {
        toast("Sem DEAC nesse dia.");
        return;
      }

      const html = items.map(r => `
        <div style="padding:10px 0;border-bottom:1px solid rgba(255,255,255,.10);">
          <div style="font-weight:900;">${fmtDateBR(r.date)} • ${r.period}</div>
          <div style="opacity:.80;margin-top:4px;">Carga: ${r.workload || "—"} • Local: ${r.place}</div>
        </div>
      `).join("");

      openModal("Agenda DEAC", html);
    });

    grid.appendChild(cell);
  }
}
