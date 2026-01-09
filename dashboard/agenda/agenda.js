// ============================================================================
// Helpers de DOM
// ============================================================================

const $ = (sel) => document.querySelector(sel);

// ============================================================================
// Estado da agenda
// ============================================================================

const state = {
  user: { name: "Guilherme Machado" },
  requests: [],
  agendaCursor: new Date(),
};

const STORAGE_KEY = "deac-dashboard-requests-v1";

// ============================================================================
// Utilitários de data
// ============================================================================

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
  const opts = { weekday: "long", day: "2-digit", month: "long" };
  const label = now.toLocaleDateString("pt-BR", opts);
  return label
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function fmtMonthYear(date) {
  const label = date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function addMonths(date, diff) {
  return new Date(date.getFullYear(), date.getMonth() + diff, 1);
}

// ============================================================================
// Persistência local
// ============================================================================

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

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.requests));
  } catch (err) {
    console.warn("Erro ao salvar storage:", err);
  }
}

// ============================================================================
// Dados de exemplo
// ============================================================================

function generateId() {
  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

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

// ============================================================================
// Agenda mensal
// ============================================================================

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

function renderAgendaCalendar() {
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

    const colIndex = (startWeekday + (day - 1)) % 7;
    const edgeClass = colIndex >= 5 ? " calendar-day--edge-right" : "";

    cells.push(
      `<button type="button" class="calendar-day ${statusClass}${edgeClass}" data-date="${iso}" title="${title}">
        <span>${day}</span>
        ${tooltip}
      </button>`
    );
  }

  const html = `
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
  `;

  const calendarEl = $("#agendaCalendar");
  if (calendarEl) {
    calendarEl.innerHTML = html;
  }

  setupAgendaCalendarEvents();
}

function setupAgendaCalendarEvents() {
  const prevBtn = $("#agendaPrev");
  const nextBtn = $("#agendaNext");

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      state.agendaCursor = addMonths(state.agendaCursor || new Date(), -1);
      renderAgendaCalendar();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      state.agendaCursor = addMonths(state.agendaCursor || new Date(), 1);
      renderAgendaCalendar();
    });
  }
}

// ============================================================================
// Inicialização
// ============================================================================

function init() {
  const userNameEl = $("#userName");
  if (userNameEl) userNameEl.textContent = state.user.name;

  const todayEl = $("#todayLabel");
  if (todayEl) todayEl.textContent = fmtTodayLabel();

  state.requests = loadFromStorage();
  if (!state.requests.length) {
    seedIfEmpty();
    state.requests = loadFromStorage();
  }

  renderAgendaCalendar();
}

document.addEventListener("DOMContentLoaded", init);
