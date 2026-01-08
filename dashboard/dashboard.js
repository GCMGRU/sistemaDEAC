// ============================================================================
// Helpers de DOM
// ============================================================================

/**
 * Atalho para document.querySelector.
 * Uso: $('#meuId'), $('.minha-classe')
 */
const $ = (sel) => document.querySelector(sel);

/**
 * Atalho para document.querySelectorAll retornando array.
 * Uso: $$('.minha-classe').forEach(...)
 */
const $$ = (sel) => Array.from(document.querySelectorAll(sel));


// ============================================================================
// Estado global da aplicação (camada de apresentação)
// ============================================================================

/**
 * Estado mantido apenas no front-end.
 * Em produção, os dados viriam do backend (PHP + banco).
 */
const state = {
  filter: "all",
  user: { name: "GCM • 3ªCL Pelegrino" },
  requests: [],
  alerts: [],
  agendaCursor: null,
  requestsPage: 1,
};

const REQUESTS_PER_PAGE = 3;


// ============================================================================
// Utilitários de data
// ============================================================================

/**
 * Converte um objeto Date ou string em formato ISO (YYYY-MM-DD).
 */
function toISODate(date) {
  if (typeof date === "string") return date;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Formata uma data ISO (YYYY-MM-DD) para o padrão brasileiro (DD/MM/YYYY).
 */
function fmtDateBR(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Gera o rótulo de data exibido no cabeçalho (hoje).
 */
function fmtTodayLabel() {
  const now = new Date();
  const opts = { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" };
  return now.toLocaleDateString("pt-BR", opts).replace(",", "");
}

function fmtMonthYear(date) {
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function addMonths(date, diff) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1);
}

// ============================================================================
// Comportamentos de UI
// ============================================================================

function setupScrollTop() {
  const scrollTopBtn = $("#scrollTop");
  if (!scrollTopBtn) return;

  const updateVisibility = () => {
    scrollTopBtn.classList.toggle("is-visible", window.scrollY > 240);
  };

  window.addEventListener("scroll", updateVisibility, { passive: true });
  updateVisibility();

  scrollTopBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

// ============================================================================
// Persistência local (storage) – hoje localStorage, amanhã backend
// ============================================================================

/**
 * Chave utilizada no localStorage para armazenar as disponibilidades.
 */
const STORAGE_KEY = "deac-dashboard-requests-v1";

/**
 * Lê o array de disponibilidades a partir do localStorage.
 * Em caso de erro, retorna um array vazio.
 */
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("Erro ao carregar storage:", err);
    return [];
  }
}

/**
 * Persiste o estado atual de `state.requests` no localStorage.
 */
function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.requests));
  } catch (err) {
    console.warn("Erro ao salvar storage:", err);
  }
}


// ============================================================================
// Camada de dados / API (pronto para integrar com PHP)
// ============================================================================

/**
 * Camada de acesso a dados.
 *
 * Atual:
 *  - usa `state.requests` + localStorage para simular o backend.
 *
 * Pós (PHP):
 *  - basta trocar a implementação das funções por chamadas `fetch`
 *    para endpoints PHP, ex:
 *      listarDisponibilidades()  -> GET  /api/disponibilidades.php
 *      criarDisponibilidade()    -> POST /api/disponibilidades.php
 *      atualizarStatus()         -> PATCH/POST /api/disponibilidades.php?id=...
 *      removerDisponibilidade()  -> DELETE /api/disponibilidades.php?id=...
 */
const api = {
  /**
   * Retorna a lista de disponibilidades.
   * No futuro, aqui será o GET para o backend PHP.
   */
  async listarDisponibilidades() {
    const stored = loadFromStorage();
    if (stored.length) {
      state.requests = stored;
    }
    return state.requests;
  },

  /**
   * Cria uma nova disponibilidade.
   * @param {Object} payload - Dados da nova disponibilidade.
   */
  async criarDisponibilidade(payload) {
    state.requests.push(payload);
    saveToStorage();
    return payload;

    // Exemplo para futuro PHP:
    // const resp = await fetch('/api/disponibilidades.php', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(payload),
    // });
    // const data = await resp.json();
    // state.requests.push(data);
    // return data;
  },

  /**
   * Atualiza o status de uma disponibilidade (ex.: cancelar).
   * @param {string} id - ID da disponibilidade.
   * @param {string} status - Novo status (pending, approved, canceled, etc).
   * @param {string} [feedback] - Mensagem opcional de feedback da chefia.
   */
  async atualizarStatus(id, status, feedback = "") {
    const req = state.requests.find((r) => r.id === id);
    if (!req) return null;

    req.status = status;
    if (typeof feedback === "string" && feedback !== "") {
      req.feedback = feedback;
    }
    saveToStorage();
    return req;
  },

  /**
   * Remove definitivamente um registro de disponibilidade.
   * @param {string} id - ID da disponibilidade a ser removida.
   */
  async removerDisponibilidade(id) {
    state.requests = state.requests.filter((r) => r.id !== id);
    saveToStorage();
  },

  /**
   * Remove todas as disponibilidades (apenas ambiente local).
   */
  async limparTodas() {
    state.requests = [];
    saveToStorage();
  },
};


// ============================================================================
// Toast de feedback visual
// ============================================================================

let toastTimer = null;

/**
 * Exibe uma mensagem temporária no componente de toast.
 */
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


// ============================================================================
// Modal genérico
// ============================================================================

/**
 * Abre o modal padrão com título e conteúdo HTML.
 */
function openModal(title, html) {
  const backdrop = $("#modalBackdrop");
  if (!backdrop) return;
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = html;
  backdrop.hidden = false;
}

/**
 * Fecha o modal padrão.
 */
function closeModal() {
  const backdrop = $("#modalBackdrop");
  if (!backdrop) return;
  backdrop.hidden = true;
  const modal = document.querySelector(".modal");
  if (modal) modal.classList.remove("modal-agenda");
}

/**
 * Registra eventos de fechamento do modal (botões e clique no backdrop).
 */
function setupModalEvents() {
  $("#modalClose").addEventListener("click", closeModal);
  $("#modalOk").addEventListener("click", closeModal);
  $("#modalBackdrop").addEventListener("click", (e) => {
    if (e.target.id === "modalBackdrop") closeModal();
  });
}


// ============================================================================
// Listagem de disponibilidades (lista principal)
// ============================================================================

/**
 * Retorna as disponibilidades filtradas pelo status selecionado.
 */
function getFilteredRequests() {
  if (state.filter === "all") return state.requests.slice().sort(sortByDate);
  return state.requests
    .filter((r) => r.status === state.filter)
    .sort(sortByDate);
}

/**
 * Ordenação padrão: data, depois período.
 */
function sortByDate(a, b) {
  if (a.date === b.date) return a.period.localeCompare(b.period);
  return a.date.localeCompare(b.date);
}

/**
 * Converte o código de status em um rótulo amigável.
 */
function statusLabel(status) {
  switch (status) {
    case "pending":
      return "Pendente";
    case "approved":
      return "Agendada";
    case "rejected":
      return "Recusada";
    case "canceled":
      return "Cancelada";
    default:
      return status;
  }
}

/**
 * Renderiza a lista de disponibilidades na coluna da direita.
 */
function renderRequests() {
  const listEl = $("#requestList");
  const emptyEl = $("#listEmpty");
  const paginationEl = $("#requestPagination");
  if (!listEl || !emptyEl) return;

  const data = getFilteredRequests();

  if (!data.length) {
    emptyEl.style.display = "block";
    listEl.innerHTML = "";
    if (paginationEl) {
      paginationEl.innerHTML = "";
      paginationEl.style.display = "none";
    }
    return;
  }

  emptyEl.style.display = "none";

  const totalPages = Math.max(1, Math.ceil(data.length / REQUESTS_PER_PAGE));
  state.requestsPage = Math.min(Math.max(state.requestsPage, 1), totalPages);

  const startIndex = (state.requestsPage - 1) * REQUESTS_PER_PAGE;
  const pageItems = data.slice(startIndex, startIndex + REQUESTS_PER_PAGE);

  const html = pageItems
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

  if (paginationEl) {
    paginationEl.style.display = totalPages > 1 ? "flex" : "none";
    paginationEl.innerHTML = `
      <span class="pagination-info">Página ${state.requestsPage} de ${totalPages}</span>
      <div class="pagination-actions">
        <button type="button" class="btn-ghost btn-sm" data-page="prev" ${
          state.requestsPage === 1 ? "disabled" : ""
        }>Anterior</button>
        <button type="button" class="btn-ghost btn-sm" data-page="next" ${
          state.requestsPage === totalPages ? "disabled" : ""
        }>Próxima</button>
      </div>
    `;
  }

  // Liga eventos de ação de cada card
  $$("#requestList .request-card").forEach((card) => {
    const id = card.getAttribute("data-id");
    const req = state.requests.find((r) => r.id === id);
    if (!req) return;

    const btnView = card.querySelector(".js-view");
    const btnCancel = card.querySelector(".js-cancel");
    const btnRemove = card.querySelector(".js-remove");

    // Detalhes
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

    // Cancelar (apenas pendente)
    if (btnCancel) {
      btnCancel.addEventListener("click", async () => {
        if (!confirm("Confirmar cancelamento desta disponibilidade?")) return;

        const updated = await api.atualizarStatus(
          id,
          "canceled",
          "Cancelado pelo próprio servidor."
        );
        if (!updated) {
          showToast("Não foi possível atualizar o registro.");
          return;
        }

        state.alerts.unshift({
          id: `alert-${Date.now()}`,
          title: "Disponibilidade cancelada",
          description: `${fmtDateBR(updated.date)} • ${updated.period} • ${updated.prefer}`,
          createdAt: new Date().toISOString(),
        });

        updateBell();
        renderRequests();
        renderAgendaStrip();
        showToast("Disponibilidade cancelada.");
      });
    }

    // Remover (apenas cancelada ou recusada)
    if (btnRemove) {
      btnRemove.addEventListener("click", async () => {
        if (!confirm("Remover definitivamente esta disponibilidade da lista?")) return;

        await api.removerDisponibilidade(id);
        renderRequests();
        renderAgendaStrip();
        showToast("Registro removido.");
      });
    }
  });

  renderUpcomingAppointments();
}


// ============================================================================
// Agenda rápida (resumo por data no rodapé da coluna direita)
// ============================================================================

/**
 * Renderiza o resumo de agenda por data no strip inferior.
 */
function renderAgendaStrip() {
  const wrapper = $("#agendaStrip");
  if (!wrapper) return;

  const approvedItems = state.requests
    .filter((req) => req.status === "approved")
    .sort(sortByDate);

  if (!approvedItems.length) {
    wrapper.innerHTML = '<div class="agenda-empty">Nenhuma disponibilidade agendada no momento.</div>';
    return;
  }

  const html = approvedItems
    .slice(0, 6)
    .map((req) => {
      return `
      <article class="agenda-card">
        <div class="agenda-card-header">
          <span class="agenda-date">${fmtDateBR(req.date)}</span>
          <span class="agenda-badge">Agendada</span>
        </div>
        <div class="agenda-info">
          <span>${req.period}</span>
          <span>•</span>
          <span>${req.prefer}</span>
        </div>
        <div class="agenda-meta">Carga horária: ${req.workload || "—"}</div>
      </article>
    `;
    })
    .join("");

  wrapper.innerHTML = html;
}

// ============================================================================
// Próximos compromissos (somente agendadas)
// ============================================================================

function getUpcomingAppointments() {
  const todayIso = toISODate(new Date());
  return state.requests
    .filter((req) => req.status === "approved" && req.date >= todayIso)
    .sort(sortByDate)
    .slice(0, 3);
}

function renderUpcomingAppointments() {
  const listEl = $("#upcomingList");
  if (!listEl) return;

  const items = getUpcomingAppointments();

  if (!items.length) {
    listEl.innerHTML = '<div class="upcoming-empty">Nenhum compromisso agendado no momento.</div>';
    return;
  }

  listEl.innerHTML = items
    .map(
      (req) => `
      <article class="upcoming-item">
        <span class="upcoming-icon">📅</span>
        <div class="upcoming-info">
          <div class="upcoming-title">${fmtDateBR(req.date)} • ${req.period} • ${req.prefer}</div>
          <div class="upcoming-meta">Carga: ${req.workload || "—"}</div>
        </div>
        <span class="upcoming-badge">Agendada</span>
      </article>
    `
    )
    .join("");
}


// ============================================================================
// Alertas / sino
// ============================================================================

/**
 * Atualiza o badge numérico do sino de alertas.
 */
function updateBell() {
  const bell = $("#bellCount");
  if (!bell) return;
  const total = state.alerts.length;
  bell.textContent = total;
}

/**
 * Registra o clique no sino para exibir a lista de alertas recentes.
 */
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


// ============================================================================
// Formulário de nova disponibilidade
// ============================================================================

/**
 * Gera um ID simples e único baseado em timestamp + random.
 */
function generateId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Configura submissão e limpeza do formulário principal.
 */
function setupForm() {
  const form = $("#requestForm");
  const btnClear = $("#btnClear");
  if (!form) return;

  // Botão "Limpar"
  btnClear.addEventListener("click", () => {
    form.reset();
  });

  // Submissão do formulário
  form.addEventListener("submit", async (e) => {
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

    await api.criarDisponibilidade(req);
    state.requestsPage = 1;
    renderRequests();
    renderAgendaStrip();
    form.reset();
    showToast("Disponibilidade enviada para análise.");
  });
}


// ============================================================================
// Filtro por status (pills no topo da lista)
// ============================================================================

/**
 * Habilita o filtro de status (Todas, Pendentes, etc.).
 */
function setupFilter() {
  const container = $("#statusFilter");
  if (!container) return;

  container.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;

    const filter = btn.dataset.filter;
    state.filter = filter;
    state.requestsPage = 1;

    $$("#statusFilter .pill").forEach((el) => el.classList.remove("active"));
    btn.classList.add("active");

    renderRequests();
  });
}

// ============================================================================
// Paginação de disponibilidades
// ============================================================================

function setupRequestPagination() {
  const paginationEl = $("#requestPagination");
  if (!paginationEl) return;

  paginationEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-page]");
    if (!btn || btn.disabled) return;

    const action = btn.dataset.page;
    if (action === "prev") {
      state.requestsPage = Math.max(1, state.requestsPage - 1);
    } else if (action === "next") {
      state.requestsPage += 1;
    }

    renderRequests();
  });
}


// ============================================================================
// Navegação lateral (sidebar)
// ============================================================================

/**
 * Configura a navegação do menu lateral (Painel, Agenda, Configurações).
 */
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
  const modal = document.querySelector(".modal");
  if (modal) modal.classList.add("modal-agenda");

  if (!state.agendaCursor) {
    state.agendaCursor = new Date();
  }

  renderAgendaCalendarModal();
}

function getAgendaStatusMap() {
  const statusPriority = {
    canceled: 3,
    pending: 2,
    approved: 1,
  };

  return state.requests.reduce((acc, req) => {
    const priority = statusPriority[req.status];
    if (!priority) return acc;
    const current = acc[req.date];
    if (!current || statusPriority[current] < priority) {
      acc[req.date] = req.status;
    }
    return acc;
  }, {});
}

function buildAgendaTooltip(records) {
  if (!records.length) return "";

  const sections = records
    .map((record) => {
      const status = record.status;
      const title = statusLabel(status);
      const dateLine = `<div class="tooltip-line"><strong>Data:</strong> ${fmtDateBR(
        record.date
      )}</div>`;
      const periodLine = `<div class="tooltip-line"><strong>Período:</strong> ${record.period}</div>`;
      const workloadLine = `<div class="tooltip-line"><strong>Carga horária:</strong> ${record.workload}</div>`;

      if (status === "pending") {
        const preferLine = `<div class="tooltip-line"><strong>Região de preferência:</strong> ${record.prefer}</div>`;
        const obsValue = record.obs ? record.obs : "Sem observações";
        const obsLine = `<div class="tooltip-line"><strong>Observações:</strong> ${obsValue}</div>`;
        return `
          <div class="calendar-tooltip-section">
            <div class="tooltip-title">${title}</div>
            ${dateLine}
            ${periodLine}
            ${preferLine}
            ${workloadLine}
            ${obsLine}
          </div>
        `;
      }

      if (status === "approved") {
        const localLine = `<div class="tooltip-line"><strong>Local:</strong> —</div>`;
        const timeLine = `<div class="tooltip-line"><strong>Horário:</strong> —</div>`;
        return `
          <div class="calendar-tooltip-section">
            <div class="tooltip-title">${title}</div>
            ${dateLine}
            ${periodLine}
            ${localLine}
            ${workloadLine}
            ${timeLine}
          </div>
        `;
      }

      return `
        <div class="calendar-tooltip-section">
          <div class="tooltip-title">${title}</div>
          ${dateLine}
          ${periodLine}
          ${workloadLine}
        </div>
      `;
    })
    .join('<div class="tooltip-divider"></div>');

  return `<div class="calendar-tooltip">${sections}</div>`;
}

function renderAgendaCalendarModal() {
  const viewDate = state.agendaCursor || new Date();
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const monthLabel = fmtMonthYear(viewDate);

  const firstDay = new Date(year, month, 1);
  const totalDays = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  const statusMap = getAgendaStatusMap();
  const recordsByDate = state.requests.reduce((acc, req) => {
    if (!acc[req.date]) acc[req.date] = [];
    acc[req.date].push(req);
    return acc;
  }, {});
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const hasMonthRecords = state.requests.some((req) => req.date.startsWith(monthPrefix));

  const weekdays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const cells = [];

  for (let i = 0; i < startWeekday; i += 1) {
    cells.push('<div class="calendar-cell is-empty"></div>');
  }

  for (let day = 1; day <= totalDays; day += 1) {
  const iso = toISODate(new Date(year, month, day));
  const status = statusMap[iso];
  const statusClass = status ? `status-${status}` : "";
  const title = status ? statusLabel(status) : "Sem registro";
  const tooltip = status ? buildAgendaTooltip(recordsByDate[iso] || []) : "";

  // índice da coluna (0 = domingo, 6 = sábado)
  const colIndex = (startWeekday + (day - 1)) % 7;

  // marca sexta (5) e sábado (6) como "borda direita"
  const edgeClass = colIndex >= 5 ? " calendar-day--edge-right" : "";

  cells.push(
    `<button type="button" class="calendar-day ${statusClass}${edgeClass}" data-date="${iso}" title="${title}">
      <span>${day}</span>
      ${tooltip}
    </button>`
  );
}


  const html = `
    <div class="agenda-calendar">
      <div class="agenda-calendar-header">
        <button type="button" class="calendar-nav" id="agendaPrev" aria-label="Mês anterior">◀</button>
        <div class="calendar-title">${monthLabel}</div>
        <button type="button" class="calendar-nav" id="agendaNext" aria-label="Próximo mês">▶</button>
      </div>
      <div class="calendar-weekdays">
        ${weekdays.map((day) => `<span>${day}</span>`).join("")}
      </div>
      <div class="calendar-grid">
        ${cells.join("")}
      </div>
      <div class="calendar-legend">
        <span class="legend-item"><span class="legend-dot status-pending"></span>Pendente</span>
        <span class="legend-item"><span class="legend-dot status-canceled"></span>Cancelada</span>
        <span class="legend-item"><span class="legend-dot status-approved"></span>Agendada</span>
      </div>
      ${hasMonthRecords ? "" : '<div class="calendar-empty">Sem registros para este mês.</div>'}
    </div>
  `;

  openModal("Agenda mensal DEAC", html);
  setupAgendaCalendarEvents();
}

function setupAgendaCalendarEvents() {
  const prevBtn = $("#agendaPrev");
  const nextBtn = $("#agendaNext");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      state.agendaCursor = addMonths(state.agendaCursor || new Date(), -1);
      renderAgendaCalendarModal();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      state.agendaCursor = addMonths(state.agendaCursor || new Date(), 1);
      renderAgendaCalendarModal();
    });
  }
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

  // Registra o clique do botão após o conteúdo ser inserido no DOM do modal
  setTimeout(() => {
    const btn = $("#btnWipeData");
    if (btn) {
      btn.addEventListener("click", async () => {
        if (!confirm("Tem certeza que deseja limpar todos os registros locais?")) return;
        await api.limparTodas();
        renderRequests();
        renderAgendaStrip();
        showToast("Todos os dados locais foram apagados.");
        closeModal();
      });
    }
  }, 30);
}


// ============================================================================
// Inicialização
// ============================================================================

/**
 * Cria registros de exemplo caso não haja nada salvo.
 * Útil apenas em ambiente de teste/local.
 */
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
      prefer: "Sul",
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

  saveToStorage();
}

/**
 * Ponto de entrada da aplicação.
 * Responsável por carregar dados, configurar eventos e renderizar a UI inicial.
 */
async function init() {
  // Nome do usuário
  const userNameEl = $("#userName");
  if (userNameEl) userNameEl.textContent = state.user.name;

  // Data de hoje no cabeçalho
  const todayEl = $("#todayLabel");
  if (todayEl) todayEl.textContent = fmtTodayLabel();

  // Carrega registros (localStorage / "backend" local)
  const registros = await api.listarDisponibilidades();
  if (!registros.length) {
    // Se não houver nada salvo, gera dados de exemplo
    seedIfEmpty();
  }

  // Configurações de UI
  setupModalEvents();
  setupForm();
  setupFilter();
  setupRequestPagination();
  setupSidebarNav();
  setupBell();
  setupScrollTop();

  const btnOpenAgenda = $("#btnOpenAgenda");
  if (btnOpenAgenda) {
    btnOpenAgenda.addEventListener("click", openAgendaModal);
  }

  renderRequests();
  renderAgendaStrip();
  updateBell();
}

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", init);

