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
  user: { name: "Guilherme Machado" },
  requests: [],
  alerts: [],
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
  const opts = { weekday: "long", day: "2-digit", month: "long" };
  const label = now.toLocaleDateString("pt-BR", opts);
  return label
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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
    listEl.innerHTML = `
      <div class="upcoming-empty">
        <div class="empty-state">
          <div class="empty-state-icon">🗓️</div>
          <p>Nenhum compromisso agendado</p>
          <p class="muted">Registre sua disponibilidade acima</p>
        </div>
      </div>
    `;
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
  const bellButton = $("#btnBell");
  if (!bellButton) return;

  bellButton.addEventListener("click", () => {
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
  setupBell();
  setupScrollTop();

  renderRequests();
  renderAgendaStrip();
  updateBell();
}

// Inicia a aplicação quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", init);

