// Utilitários rápidos
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Estado principal da aplicação
const state = {
  filter: "all",
  user: { name: "GCM • Guilherme" },
  requests: [],
  alerts: [],
};

// --- Helpers de data -------------------------------------------------------

function toISODate(date) {
  if (typeof date === "string") return date;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function fmtDateBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function fmtTodayLabel() {
  const now = new Date();
  const opts = { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" };
  return now.toLocaleDateString("pt-BR", opts).replace(",", "");
}

// --- Persistência simples ---------------------------------------------------

const STORAGE_KEY = "deac-dashboard-requests-v1";

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.requests = parsed;
    }
  } catch (err) {
    console.warn("Erro ao carregar storage:", err);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.requests));
  } catch (err) {
    console.warn("Erro ao salvar storage:", err);
  }
}

// --- Toast ------------------------------------------------------------------

let toastTimer = null;

function showToast(message) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("show");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 2800);
}

// --- Modal ------------------------------------------------------------------

function openModal(title, html) {
  const backdrop = $("#modalBackdrop");
  if (!backdrop) return;
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  backdrop.hidden = false;
}

function closeModal() {
  const backdrop = $("#modalBackdrop");
  if (!backdrop) return;
  backdrop.hidden = true;
}

function setupModalEvents() {
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalOk").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
}

// --- Listagem de disponibilidades ------------------------------------------

function getFilteredRequests() {
  if (state.filter === "all") return state.requests.slice().sort(sortByDate);
  return state.requests
    .filter((r) => r.status === state.filter)
    .sort(sortByDate);
}

function sortByDate(a, b) {
  if (a.date === b.date) return a.period.localeCompare(b.period);
  return a.date.localeCompare(b.date);
}

function statusLabel(status) {
  switch (status) {
    case "pending":
      return "Pendente";
    case "approved":
      return "Aprovada";
    case "rejected":
      return "Recusada";
    case "canceled":
      return "Cancelada";
    default:
      return status;
  }
}

function renderRequests() {
  const listEl = $("#requestList");
  const emptyEl = $("#listEmpty");
  if (!listEl || !emptyEl) return;

  const data = getFilteredRequests();

  if (!data.length) {
    emptyEl.style.display = "block";
    listEl.innerHTML = "";
    return;
  }

  emptyEl.style.display = "none";

  const html = data
    .map((req) => {
      const statusClass = `status-${req.status}`;
      const badgeHtml = `<span class="status-pill ${statusClass}">${statusLabel(req.status)}</span>`;
      const obs = req.obs ? `<div class="request-extra">${req.obs}</div>` : "";

      const canCancel = req.status === "pending";
      const canRemove = req.status === "canceled" || req.status === "rejected";

      return `
      <article class="request-card" data-id="${req.id}">
        <div class="request-main">
          <div class="request-title">${fmtDateBR(req.date)} • ${req.period} • ${req.prefer}</div>
          <div class="request-meta">Carga: ${req.workload || "—"}</div>
          ${obs}
        </div>
        <div class="request-status">
          ${badgeHtml}
        </div>
        <div class="request-actions">
          <button type="button" class="btn-ghost btn-sm js-view">Detalhes</button>
          ${
            canCancel
              ? '<button type="button" class="btn-ghost btn-sm js-cancel">Cancelar</button>'
              : ""
          }
          ${
            canRemove
              ? '<button type="button" class="btn-ghost btn-sm js-remove">Remover</button>'
              : ""
          }
        </div>
      </article>
    `;
    })
    .join("");

  listEl.innerHTML = html;

  // Ligações de eventos para cada card
  $$("#requestList .request-card").forEach((card) => {
    const id = card.getAttribute("data-id");
    const req = state.requests.find((r) => r.id === id);
    if (!req) return;

    const btnView = card.querySelector(".js-view");
    const btnCancel = card.querySelector(".js-cancel");
    const btnRemove = card.querySelector(".js-remove");

    if (btnView) {
      btnView.addEventListener("click", () => {
        const body = `
          <p><strong>Data:</strong> ${fmtDateBR(req.date)}</p>
          <p><strong>Período:</strong> ${req.period}</p>
          <p><strong>Região de Preferência:</strong> ${req.prefer}</p>
          <p><strong>Carga horária:</strong> ${req.workload}</p>
          <p><strong>Status:</strong> ${statusLabel(req.status)}</p>
          ${
            req.feedback
              ? `<p><strong>Feedback chefia:</strong> ${req.feedback}</p>`
              : ""
          }
          ${
            req.obs
              ? `<p><strong>Observações:</strong> ${req.obs}</p>`
              : ""
          }
        `;
        openModal("Detalhes da disponibilidade", body);
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener("click", () => {
        if (!confirm("Confirmar cancelamento desta disponibilidade?")) return;
        req.status = "canceled";
        req.feedback = "Cancelado pelo próprio servidor.";
        state.alerts.unshift({
          id: `alert-${Date.now()}`,
          title: "Disponibilidade cancelada",
          description: `${fmtDateBR(req.date)} • ${req.period} • ${req.prefer}`,
          createdAt: new Date().toISOString(),
        });
        updateBell();
        saveToStorage();
        renderRequests();
        renderAgendaStrip();
        showToast("Disponibilidade cancelada.");
      });
    }

    if (btnRemove) {
      btnRemove.addEventListener("click", () => {
        if (!confirm("Remover definitivamente esta disponibilidade da lista?")) return;
        state.requests = state.requests.filter((r) => r.id !== id);
        saveToStorage();
        renderRequests();
        renderAgendaStrip();
        showToast("Registro removido.");
      });
    }
  });
}

// --- Agenda strip (resumo por data) ----------------------------------------

function renderAgendaStrip() {
  const wrapper = $("#agendaStrip");
  if (!wrapper) return;

  if (!state.requests.length) {
    wrapper.innerHTML = '<span class="muted" style="font-size:12px;">Sem registros para exibir.</span>';
    return;
  }

  // Agrupa por data
  const grouped = {};
  state.requests.forEach((r) => {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  });

  const dates = Object.keys(grouped).sort();
  const html = dates
    .slice(0, 12)
    .map((date) => {
      const items = grouped[date];
      const total = items.length;
      const approved = items.filter((x) => x.status === "approved").length;
      const pending = items.filter((x) => x.status === "pending").length;

      return `
      <div class="agenda-chip">
        <strong>${fmtDateBR(date)}</strong>
        <span>${total} registro(s)</span><br/>
        <span>Pend: ${pending} • Aprov: ${approved}</span>
      </div>
    `;
    })
    .join("");

  wrapper.innerHTML = html;
}

// --- Alerts / Bell ---------------------------------------------------------

function updateBell() {
  const bell = $("#bellCount");
  if (!bell) return;
  const total = state.alerts.length;
  bell.textContent = total;
}

function setupBell() {
  $("#btnBell").addEventListener("click", () => {
    if (!state.alerts.length) {
      openModal("Alertas", "<p>Nenhum alerta recente.</p>");
      return;
    }

    const html = state.alerts
      .map(
        (a) => `
        <div style="padding:8px 0;border-bottom:1px solid rgba(148,163,184,.35);">
          <div style="font-weight:600;font-size:13px;">${a.title}</div>
          <div style="font-size:12px;opacity:.8;margin-top:3px;">${a.description}</div>
        </div>
      `
      )
      .join("");

    openModal("Alertas recentes", html);
  });
}

// --- Formulário -------------------------------------------------------------

function generateId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function setupForm() {
  const form = $("#requestForm");
  const btnClear = $("#btnClear");
  if (!form) return;

  btnClear.addEventListener("click", () => {
    form.reset();
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const date = $("#date").value;
    const period = $("#period").value;
    const prefer = $("#prefer").value;
    const workload = $("#workload").value;
    const obs = $("#obs").value.trim();

    if (!date || !period || !prefer || !workload) {
      showToast("Preencha todos os campos obrigatórios.");
      return;
    }

    const req = {
      id: generateId(),
      date,
      period,
      prefer,
      workload,
      obs,
      status: "pending",
      feedback: "",
      createdAt: new Date().toISOString(),
    };

    state.requests.push(req);
    saveToStorage();
    renderRequests();
    renderAgendaStrip();
    form.reset();
    showToast("Disponibilidade enviada para análise.");
  });
}

// --- Filtro por status ------------------------------------------------------

function setupFilter() {
  const container = $("#statusFilter");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;

    const filter = btn.dataset.filter;
    state.filter = filter;

    $$("#statusFilter .pill").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");

    renderRequests();
  });
}

// --- Navegação de abas (sidebar) -------------------------------------------

function setupSidebarNav() {
  $$(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".nav-item").forEach((b) => b.classList.remove("nav-item-active"));
      btn.classList.add("nav-item-active");

      const view = btn.dataset.view;
      if (view === "agenda") {
        openAgendaModal();
      } else if (view === "config") {
        openConfigModal();
      }
    });
  });
}

function openAgendaModal() {
  if (!state.requests.length) {
    openModal("Agenda mensal", "<p>Sem registros para montar a agenda.</p>");
    return;
  }

  // Organiza por data
  const grouped = {};
  state.requests.forEach((r) => {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  });

  const dates = Object.keys(grouped).sort();

  const html = dates
    .map((date) => {
      const items = grouped[date]
        .sort(sortByDate)
        .map(
          (r) => `
          <tr>
            <td>${r.period}</td>
            <td>${r.prefer}</td>
            <td>${r.workload}</td>
            <td>${statusLabel(r.status)}</td>
          </tr>
        `
        )
        .join("");

      return `
      <h3 style="margin:12px 0 6px;font-size:13px;">${fmtDateBR(date)}</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px;">
        <thead>
          <tr style="text-align:left;">
            <th style="padding:4px 0;">Período</th>
            <th style="padding:4px 0;">Carga</th>
            <th style="padding:4px 0;">Local</th>
            <th style="padding:4px 0;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${items}
        </tbody>
      </table>
      `;
    })
    .join("");

  openModal("Agenda mensal DEAC", html);
}

function openConfigModal() {
  const html = `
    <p style="margin-top:0;">Este painel é apenas uma simulação local para organização das suas disponibilidades.</p>
    <p style="font-size:12px;opacity:.8;">
      Os dados são salvos apenas neste navegador utilizando <code>localStorage</code>. 
      Você pode limpar tudo usando o botão abaixo.
    </p>
    <button id="btnWipeData" class="btn-primary" style="margin-top:8px;">Limpar dados salvos</button>
  `;

  openModal("Configurações do painel", html);

  setTimeout(() => {
    const btn = $("#btnWipeData");
    if (btn) {
      btn.addEventListener("click", () => {
        if (!confirm("Tem certeza que deseja limpar todos os registros locais?")) return;
        state.requests = [];
        saveToStorage();
        renderRequests();
        renderAgendaStrip();
        showToast("Todos os dados locais foram apagados.");
        closeModal();
      });
    }
  }, 30);
}

// --- Inicialização ----------------------------------------------------------

function seedIfEmpty() {
  if (state.requests.length) return;

  const today = new Date();
  const d1 = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  const d2 = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3));
  const d3 = toISODate(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7));

  state.requests = [
    {
      id: generateId(),
      date: d1,
      period: "Noite",
      prefer: "Centro",
      workload: "8h",
      obs: "Preferência por dupla com equipe da Base Centro.",
      status: "pending",
      feedback: "",
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      date: d2,
      period: "Tarde",
      prefer: "Zona Sul",
      workload: "6h",
      obs: "",
      status: "approved",
      feedback: "Escala confirmada pela chefia.",
      createdAt: new Date().toISOString(),
    },
    {
      id: generateId(),
      date: d3,
      period: "Manhã",
      prefer: "Norte",
      workload: "8h",
      obs: "Pode chegar 30 minutos antes.",
      status: "rejected",
      feedback: "Necessidade de efetivo em outra data.",
      createdAt: new Date().toISOString(),
    },
  ];
}

function init() {
  // Nome do usuário
  const userNameEl = $("#userName");
  if (userNameEl) userNameEl.textContent = state.user.name;

  // Hoje
  const todayEl = $("#todayLabel");
  if (todayEl) todayEl.textContent = fmtTodayLabel();

  // Storage
  loadFromStorage();
  if (!state.requests.length) seedIfEmpty();

  // Monta UI
  setupModalEvents();
  setupForm();
  setupFilter();
  setupSidebarNav();
  setupBell();

  renderRequests();
  renderAgendaStrip();
  updateBell();
}

document.addEventListener("DOMContentLoaded", init);
