/* ═══════════════════════════════════════════════════════════════
   HelpDesk ITSM v3.0 — Main Application Controller
   Orchestrates views, auth, navigation, and user interactions.
   ═══════════════════════════════════════════════════════════════ */

const App = (() => {
  let currentUser = null;
  let currentView = 'dashboard';
  let selectedTicket = null;

  // ── Shortcut ──
  const D = () => window.HelpDeskData;
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ────────────────────────────────────────────────────────────
     INIT
  ──────────────────────────────────────────────────────────── */
  function init() {
    setupClock();
    setupNavigation();
    setupLoginForm();

    // Default: show login
    showLoginView();
  }

  /* ────────────────────────────────────────────────────────────
     CLOCK & SLA Window (REQ-08)
  ──────────────────────────────────────────────────────────── */
  function setupClock() {
    function tick() {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const dateStr = now.toLocaleDateString('es-CO', { weekday: 'short', day: '2-digit', month: 'short' });
      const clockEl = $('#header-clock-time');
      if (clockEl) clockEl.textContent = `${dateStr} ${timeStr}`;

      const inBH = D().isBusinessHours();
      const dotEl = $('#sla-window-dot');
      const labelEl = $('#sla-window-label');
      if (dotEl) dotEl.className = `sla-dot ${inBH ? 'active' : 'inactive'}`;
      if (labelEl) labelEl.textContent = inBH ? 'Ventana Hábil' : 'Fuera de Horario';
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ────────────────────────────────────────────────────────────
     AUTH (Simulated JWT/RBAC — RNF-03)
  ──────────────────────────────────────────────────────────── */
  function setupLoginForm() {
    const form = $('#login-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      const user = D().USERS_DB.find(u => u.email === email && u.password === password);

      if (!user) {
        $('#login-error').classList.add('visible');
        return;
      }

      $('#login-error').classList.remove('visible');
      currentUser = user;

      // Simulate JWT generation
      const token = btoa(JSON.stringify({
        sub: user.id, role: user.role, exp: Date.now() + 1800000, alg: 'RS256'
      }));
      sessionStorage.setItem('jwt_token', token);

      showAppShell();
      navigateTo('dashboard');
      startEngines();

      Toast.show({
        type: 'success',
        title: 'Sesión iniciada',
        message: `Bienvenido(a), ${user.name} — ${user.role}`
      });
    });
  }

  function showLoginView() {
    $('#login-view').style.display = 'flex';
    $('#app-shell').style.display = 'none';
  }

  function showAppShell() {
    $('#login-view').style.display = 'none';
    $('#app-shell').style.display = 'flex';
    updateUserInfo();
    updateNavBadges();
  }

  function logout() {
    currentUser = null;
    sessionStorage.removeItem('jwt_token');
    SLAEngine.stopSLAMonitor();
    SLAEngine.stopBatchJob();
    showLoginView();
  }

  function updateUserInfo() {
    if (!currentUser) return;
    $('#current-user-avatar').textContent = currentUser.avatar;
    $('#current-user-name').textContent = currentUser.name;
    $('#current-user-role').textContent = currentUser.role;

    // Hide/show nav items based on role
    const isAgent = currentUser.role.includes('Agente');
    const isUser = currentUser.role === D().ROLES.USUARIO;
    const isSupervisor = currentUser.role === D().ROLES.SUPERVISOR;
    const isCoordinator = currentUser.role === D().ROLES.COORDINADOR;
    const isAdmin = isSupervisor || isCoordinator;

    // Show/hide based on role
    $$('[data-role-required]').forEach(el => {
      const required = el.dataset.roleRequired.split(',');
      const visible = required.some(r => {
        if (r === 'agent') return isAgent;
        if (r === 'admin') return isAdmin;
        if (r === 'user') return isUser;
        if (r === 'all') return true;
        return currentUser.role === r;
      });
      el.style.display = visible ? '' : 'none';
    });
  }

  /* ────────────────────────────────────────────────────────────
     NAVIGATION
  ──────────────────────────────────────────────────────────── */
  function setupNavigation() {
    $$('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        navigateTo(item.dataset.view);
      });
    });
  }

  function navigateTo(view) {
    currentView = view;

    // Update nav
    $$('.nav-item').forEach(n => n.classList.remove('active'));
    $(`.nav-item[data-view="${view}"]`)?.classList.add('active');

    // Update views
    $$('.view-container').forEach(v => v.classList.remove('active'));
    $(`#view-${view}`)?.classList.add('active');

    // Update header
    const titles = {
      dashboard: 'Panel de Control',
      'new-ticket': 'Nuevo Ticket',
      tickets: 'Gestión de Tickets',
      assignment: 'Motor de Asignación',
      sla: 'Monitor SLA',
      batch: 'Depuración Automática'
    };
    $('#page-title').textContent = titles[view] || 'HelpDesk';

    // Render view
    switch (view) {
      case 'dashboard':   renderDashboard(); break;
      case 'new-ticket':  renderNewTicketForm(); break;
      case 'tickets':     renderTicketsGrid(); break;
      case 'assignment':  renderAssignmentView(); break;
      case 'sla':         renderSLAMonitor(); break;
      case 'batch':       renderBatchView(); break;
    }

    updateNavBadges();
  }

  function updateNavBadges() {
    const data = D();
    const openCount = data.TICKETS_DB.filter(t =>
      t.estado === data.ESTADOS.ABIERTO || t.estado === data.ESTADOS.EN_PROGRESO
    ).length;
    const escalatedCount = data.TICKETS_DB.filter(t => t.estado === data.ESTADOS.ESCALADO).length;

    const ticketBadge = $('#nav-badge-tickets');
    if (ticketBadge) ticketBadge.textContent = openCount;

    const slaBadge = $('#nav-badge-sla');
    if (slaBadge) {
      const breaches = data.TICKETS_DB.filter(t => {
        const sla = SLAEngine.evaluateFirstResponse(t);
        return sla.color === 'red';
      }).length;
      slaBadge.textContent = breaches;
      slaBadge.style.display = breaches > 0 ? '' : 'none';
    }
  }

  /* ────────────────────────────────────────────────────────────
     START ENGINES
  ──────────────────────────────────────────────────────────── */
  function startEngines() {
    SLAEngine.startSLAMonitor((alerts) => {
      alerts.forEach(alert => {
        const type = alert.type === 'sla_breach' ? 'error' :
                     alert.type === 'sla_warning' ? 'warning' : 'info';
        Toast.show({ type, title: 'Alerta SLA', message: alert.message });
      });
      // Refresh current view
      if (currentView === 'tickets') renderTicketsGrid();
      if (currentView === 'sla') renderSLAMonitor();
      if (currentView === 'dashboard') renderDashboard();
      updateNavBadges();
    });

    SLAEngine.startBatchJob((results) => {
      Toast.show({
        type: 'info',
        title: 'Batch Job Ejecutado',
        message: `${results.closed} ticket(s) cerrado(s) definitivamente: ${results.tickets.join(', ')}`
      });
      if (currentView === 'batch') renderBatchView();
      if (currentView === 'dashboard') renderDashboard();
      updateNavBadges();
    });

    // Initial batch run
    const initialBatch = SLAEngine.runBatchClosureJob();
    if (initialBatch.closed > 0) {
      Toast.show({
        type: 'info',
        title: 'Depuración Automática',
        message: `${initialBatch.closed} ticket(s) transitaron a Cerrado_Definitivo al iniciar sesión.`
      });
    }
  }

  /* ════════════════════════════════════════════════════════════
     VIEW: DASHBOARD
  ════════════════════════════════════════════════════════════ */
  function renderDashboard() {
    const metrics = SLAEngine.getMetrics();
    const data = D();

    // Stats
    $('#stat-total').textContent = metrics.total;
    $('#stat-open').textContent = metrics.open;
    $('#stat-progress').textContent = metrics.inProgress;
    $('#stat-escalated').textContent = metrics.escalated;
    $('#stat-resolved').textContent = metrics.resolved + metrics.closed;
    $('#stat-fcr').textContent = `${metrics.fcr}%`;
    $('#stat-mttr').textContent = `${metrics.mttr}h`;
    $('#stat-sla').textContent = `${metrics.slaCompliance}%`;

    // Recent activity
    const activityEl = $('#dashboard-activity');
    const recentTickets = [...data.TICKETS_DB]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);

    activityEl.innerHTML = recentTickets.map(t => {
      const sla = data.getSLAStatus(t);
      const agent = data.getUserById(t.assignedTo);
      return `
        <div class="activity-item">
          <div class="activity-dot sla-dot-indicator ${sla.status}"></div>
          <div>
            <div class="activity-text">
              <strong>${t.id}</strong> — ${t.subject.substring(0, 50)}${t.subject.length > 50 ? '...' : ''}
              <span class="badge badge-${getEstadoClass(t.estado)}" style="margin-left:6px">${t.estado}</span>
            </div>
            <div class="activity-time">${data.formatTimeAgo(t.createdAt)} · ${agent ? agent.name : '—'}</div>
          </div>
        </div>
      `;
    }).join('');

    // Chart
    renderDashboardChart(metrics);
  }

  function renderDashboardChart(metrics) {
    const chartEl = $('#dashboard-chart');
    const bars = [
      { label: 'Abiertos', value: metrics.open, max: metrics.total },
      { label: 'En Prog.', value: metrics.inProgress, max: metrics.total },
      { label: 'Escalados', value: metrics.escalated, max: metrics.total },
      { label: 'Resueltos', value: metrics.resolved, max: metrics.total },
      { label: 'Cerrados', value: metrics.closed, max: metrics.total }
    ];

    chartEl.innerHTML = bars.map(b => {
      const h = Math.max(8, (b.value / Math.max(b.max, 1)) * 160);
      return `
        <div class="chart-bar" style="height:${h}px" title="${b.label}: ${b.value}">
          <span class="chart-label">${b.label}</span>
        </div>
      `;
    }).join('');
  }

  /* ════════════════════════════════════════════════════════════
     VIEW: NEW TICKET (HU-001, REQ-01, REQ-02, REQ-04)
  ════════════════════════════════════════════════════════════ */
  function renderNewTicketForm() {
    const container = $('#new-ticket-form-container');
    const data = D();

    container.innerHTML = `
      <form id="ticket-form" novalidate>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label" for="ticket-user-type">Tipo de Usuario <span class="required">*</span></label>
            <select class="form-control" id="ticket-user-type" required>
              <option value="">Seleccione...</option>
              <option value="Interno">Interno (Corporativo)</option>
              <option value="Externo">Externo (Cliente)</option>
            </select>
            <div class="form-error-msg" id="err-user-type">Seleccione el tipo de usuario</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="ticket-category">Categoría Tecnológica <span class="required">*</span></label>
            <select class="form-control" id="ticket-category" required>
              <option value="">Seleccione categoría...</option>
              ${data.CATEGORIAS.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join('')}
            </select>
            <div class="form-error-msg" id="err-category">Debe seleccionar una categoría (RN001)</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="ticket-subject">Asunto <span class="required">*</span></label>
          <input type="text" class="form-control" id="ticket-subject" placeholder="Describa brevemente el problema..." maxlength="120" required>
          <div class="form-error-msg" id="err-subject">El asunto es obligatorio</div>
        </div>

        <div class="form-group">
          <label class="form-label" for="ticket-description">Descripción Detallada</label>
          <textarea class="form-control" id="ticket-description" placeholder="Proporcione detalles adicionales del incidente..." rows="4"></textarea>
        </div>

        <div class="form-group" id="severity-preview" style="display:none">
          <label class="form-label">Impacto / Severidad Inferida (REQ-02)</label>
          <div id="severity-badge-container" style="padding: var(--space-3) 0;"></div>
        </div>

        <div class="form-group">
          <div class="form-check" id="consent-container">
            <input type="checkbox" id="ticket-consent">
            <label for="ticket-consent">
              <strong>Acepto Ley 1581 de 2012</strong> — Autorizo el tratamiento de mis datos personales conforme a las políticas de tratamiento de datos de la organización. Este consentimiento es obligatorio para el procesamiento de la solicitud (REQ-04).
            </label>
          </div>
          <div class="form-error-msg" id="err-consent">El consentimiento de tratamiento de datos es obligatorio</div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:var(--space-3); margin-top:var(--space-6)">
          <button type="button" class="btn btn-secondary" onclick="document.getElementById('ticket-form').reset(); document.getElementById('severity-preview').style.display='none';">Limpiar</button>
          <button type="submit" class="btn btn-primary btn-lg" id="btn-submit-ticket">
            <span>🚀</span> Enviar Ticket
          </button>
        </div>
      </form>
    `;

    // Infer severity on change (REQ-02)
    const userTypeEl = $('#ticket-user-type');
    const categoryEl = $('#ticket-category');

    function updateSeverityPreview() {
      const userType = userTypeEl.value;
      const category = categoryEl.value;
      const preview = $('#severity-preview');
      const badgeContainer = $('#severity-badge-container');

      if (userType && category) {
        const severity = data.inferSeverity(userType, category);
        const sevClass = severity.toLowerCase().replace('í', 'i');
        preview.style.display = 'block';
        badgeContainer.innerHTML = `<span class="badge badge-${getSeverityClass(severity)}" style="font-size:0.8rem; padding:6px 14px;">
          ${severity === 'Crítico' ? '🔴' : severity === 'Alto' ? '🟠' : severity === 'Medio' ? '🟡' : '🟢'} ${severity}
          ${severity === 'Crítico' ? ' — Se asignará directamente a Nivel 2 (REQ-06)' : ''}
        </span>`;
      } else {
        preview.style.display = 'none';
      }
    }

    userTypeEl.addEventListener('change', updateSeverityPreview);
    categoryEl.addEventListener('change', updateSeverityPreview);

    // Form submit
    $('#ticket-form').addEventListener('submit', handleTicketSubmit);
  }

  function handleTicketSubmit(e) {
    e.preventDefault();
    const data = D();

    const userType = $('#ticket-user-type').value;
    const category = $('#ticket-category').value;
    const subject = $('#ticket-subject').value.trim();
    const description = $('#ticket-description').value.trim();
    const consent = $('#ticket-consent').checked;

    // Reset errors
    $$('.form-error-msg').forEach(el => el.classList.remove('visible'));
    $$('.form-control').forEach(el => el.classList.remove('error'));
    $('#consent-container').classList.remove('error');

    let hasError = false;

    // Validate (REQ-01 & RNF-04)
    if (!userType) {
      $('#err-user-type').classList.add('visible');
      $('#ticket-user-type').classList.add('error');
      hasError = true;
    }
    if (!category) {
      $('#err-category').classList.add('visible');
      $('#ticket-category').classList.add('error');
      hasError = true;
    }
    if (!subject) {
      $('#err-subject').classList.add('visible');
      $('#ticket-subject').classList.add('error');
      hasError = true;
    }

    // REQ-04: Consent is mandatory (Ley 1581)
    if (!consent) {
      $('#err-consent').classList.add('visible');
      $('#consent-container').classList.add('error');
      hasError = true;
    }

    if (hasError) return;

    // Disable button to prevent double submit (HU-001 Escenario 1)
    const submitBtn = $('#btn-submit-ticket');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Procesando...';

    // Simulate network latency
    setTimeout(() => {
      // REQ-02: Infer severity
      const severity = data.inferSeverity(userType, category);

      // Generate ticket ID
      const ticketId = data.generateTicketId();

      // Create ticket
      const newTicket = {
        id: ticketId,
        category,
        userType,
        severity,
        estado: data.ESTADOS.ABIERTO,
        reportedBy: currentUser?.id || 'U008',
        assignedTo: null,
        subject,
        description,
        createdAt: new Date(),
        firstResponseAt: null,
        resolvedAt: null,
        consentimiento: true,
        requiresAdvancedPerms: false,
        history: [{ time: new Date(), action: 'Ticket creado', by: 'Sistema' }]
      };

      // REQ-05 & REQ-06: Assign via Round-Robin
      const assignment = RoundRobinEngine.assignTicket(newTicket);
      if (assignment.success) {
        newTicket.assignedTo = assignment.agentId;
        newTicket.history.push({
          time: new Date(),
          action: assignment.reason,
          by: 'Motor Asignación'
        });
      }

      // Persist
      data.TICKETS_DB.push(newTicket);

      // Show confirmation modal with radicado (HU-001 Escenario 1)
      showRadicadoModal(ticketId, assignment);

      // Reset form
      $('#ticket-form').reset();
      $('#severity-preview').style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🚀</span> Enviar Ticket';

      updateNavBadges();
    }, 800);
  }

  function showRadicadoModal(ticketId, assignment) {
    const backdrop = $('#modal-backdrop');
    const modal = $('#modal-content');

    modal.innerHTML = `
      <div class="modal-header">
        <h3>✅ Ticket Registrado Exitosamente</h3>
        <button class="icon-btn" onclick="document.getElementById('modal-backdrop').classList.remove('active')">✕</button>
      </div>
      <div class="modal-body">
        <div class="radicado-display">
          <div class="radicado-icon">✓</div>
          <div style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:var(--space-3);">Código de Radicado</div>
          <div class="radicado-code">${ticketId}</div>
          <div class="radicado-msg">
            ${assignment.success
              ? `Asignado a <strong>${assignment.agentName}</strong> (Nivel ${assignment.level})`
              : `⚠️ ${assignment.reason}`
            }
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('modal-backdrop').classList.remove('active')">Cerrar</button>
        <button class="btn btn-primary" onclick="App.navigateTo('tickets'); document.getElementById('modal-backdrop').classList.remove('active');">Ver Tickets</button>
      </div>
    `;

    backdrop.classList.add('active');
  }

  /* ════════════════════════════════════════════════════════════
     VIEW: TICKETS GRID (HU-006, REQ-03)
  ════════════════════════════════════════════════════════════ */
  function renderTicketsGrid() {
    const data = D();
    const container = $('#tickets-grid-body');
    const filterStatus = $('#filter-status')?.value || 'all';
    const filterSeverity = $('#filter-severity')?.value || 'all';
    const searchTerm = $('#search-tickets')?.value?.toLowerCase() || '';

    let tickets = [...data.TICKETS_DB].sort((a, b) => b.createdAt - a.createdAt);

    // Apply filters
    if (filterStatus !== 'all') {
      tickets = tickets.filter(t => t.estado === filterStatus);
    }
    if (filterSeverity !== 'all') {
      tickets = tickets.filter(t => t.severity === filterSeverity);
    }
    if (searchTerm) {
      tickets = tickets.filter(t =>
        t.id.toLowerCase().includes(searchTerm) ||
        t.subject.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by agent if user is an agent (RBAC)
    if (currentUser && currentUser.role.includes('Agente')) {
      tickets = tickets.filter(t => t.assignedTo === currentUser.id);
    }

    container.innerHTML = tickets.map(ticket => {
      const sla = data.getSLAStatus(ticket);
      const agent = data.getUserById(ticket.assignedTo);
      const reporter = data.getUserById(ticket.reportedBy);
      return `
        <tr onclick="App.openTicketDetail('${ticket.id}')">
          <td>
            <span class="text-mono" style="font-weight:600; color:var(--accent-hover)">${ticket.id}</span>
          </td>
          <td>
            <div style="max-width:280px">
              <div style="font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ticket.subject}</div>
              <div class="text-muted" style="font-size:var(--text-xs);">${data.getCategoryIcon(ticket.category)} ${data.getCategoryLabel(ticket.category)}</div>
            </div>
          </td>
          <td><span class="badge badge-${getEstadoClass(ticket.estado)}">${formatEstado(ticket.estado)}</span></td>
          <td><span class="badge badge-${getSeverityClass(ticket.severity)}">${ticket.severity}</span></td>
          <td>
            <span class="sla-badge sla-${sla.status}">
              <span class="sla-dot-indicator ${sla.status}"></span>
              ${sla.label}
            </span>
          </td>
          <td>
            <span class="badge badge-${ticket.userType === 'Interno' ? 'internal' : 'external'}">${ticket.userType}</span>
          </td>
          <td style="font-size:var(--text-xs); color:var(--text-secondary)">
            ${agent ? agent.name : '<span class="text-muted">Sin asignar</span>'}
          </td>
          <td class="text-muted" style="font-size:var(--text-xs)">${data.formatTimeAgo(ticket.createdAt)}</td>
        </tr>
      `;
    }).join('');

    if (tickets.length === 0) {
      container.innerHTML = `
        <tr><td colspan="8">
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <h3>No se encontraron tickets</h3>
            <p>Ajusta los filtros o crea un nuevo ticket</p>
          </div>
        </td></tr>
      `;
    }

    // Update counter
    const countEl = $('#tickets-count');
    if (countEl) countEl.textContent = `${tickets.length} ticket(s)`;
  }

  /* ════════════════════════════════════════════════════════════
     TICKET DETAIL PANEL (HU-006, REQ-03)
  ════════════════════════════════════════════════════════════ */
  function openTicketDetail(ticketId) {
    const data = D();
    const ticket = data.TICKETS_DB.find(t => t.id === ticketId);
    if (!ticket) return;

    selectedTicket = ticket;
    const panel = $('#ticket-detail-panel');
    const agent = data.getUserById(ticket.assignedTo);
    const reporter = data.getUserById(ticket.reportedBy);
    const sla = data.getSLAStatus(ticket);
    const fr = SLAEngine.evaluateFirstResponse(ticket);

    const canChangeState = currentUser &&
      (currentUser.role.includes('Agente') || currentUser.role === data.ROLES.COORDINADOR || currentUser.role === data.ROLES.SUPERVISOR) &&
      ticket.estado !== data.ESTADOS.CERRADO_DEFINITIVO;

    panel.innerHTML = `
      <div class="detail-header">
        <div>
          <span class="text-mono" style="font-size:var(--text-lg); font-weight:700; color:var(--accent-hover)">${ticket.id}</span>
          <span class="badge badge-${getEstadoClass(ticket.estado)}" style="margin-left:8px">${formatEstado(ticket.estado)}</span>
        </div>
        <button class="icon-btn" onclick="App.closeTicketDetail()">✕</button>
      </div>

      <div class="detail-section">
        <h4>Información del Ticket</h4>
        <div style="font-weight:600; margin-bottom:var(--space-3)">${ticket.subject}</div>
        <p style="font-size:var(--text-sm); color:var(--text-secondary); margin-bottom:var(--space-4)">${ticket.description || 'Sin descripción adicional.'}</p>
        <div class="detail-row"><span class="label">Categoría</span><span class="value">${data.getCategoryIcon(ticket.category)} ${data.getCategoryLabel(ticket.category)}</span></div>
        <div class="detail-row"><span class="label">Severidad</span><span class="value"><span class="badge badge-${getSeverityClass(ticket.severity)}">${ticket.severity}</span></span></div>
        <div class="detail-row"><span class="label">Tipo Usuario</span><span class="value"><span class="badge badge-${ticket.userType === 'Interno' ? 'internal' : 'external'}">${ticket.userType}</span></span></div>
        <div class="detail-row"><span class="label">Reportado por</span><span class="value">${reporter ? reporter.name : '—'}</span></div>
        <div class="detail-row"><span class="label">Asignado a</span><span class="value">${agent ? agent.name : 'Sin asignar'}</span></div>
        <div class="detail-row"><span class="label">Creado</span><span class="value">${data.formatDate(ticket.createdAt)}</span></div>
        <div class="detail-row"><span class="label">1ª Respuesta</span><span class="value">${ticket.firstResponseAt ? data.formatDate(ticket.firstResponseAt) : '<span class="text-muted">Pendiente</span>'}</span></div>
        <div class="detail-row"><span class="label">Resuelto</span><span class="value">${ticket.resolvedAt ? data.formatDate(ticket.resolvedAt) : '<span class="text-muted">—</span>'}</span></div>
      </div>

      <div class="detail-section">
        <h4>Estado SLA</h4>
        <div class="detail-row">
          <span class="label">Semáforo</span>
          <span class="sla-badge sla-${sla.status}"><span class="sla-dot-indicator ${sla.status}"></span> ${sla.label}</span>
        </div>
        <div class="detail-row">
          <span class="label">Tiempo transcurrido</span>
          <span class="value text-mono">${sla.minutes} min</span>
        </div>
        ${!ticket.firstResponseAt && ticket.estado !== data.ESTADOS.CERRADO_DEFINITIVO ? `
        <div class="detail-row">
          <span class="label">Tiempo restante (1ª Resp.)</span>
          <span class="value text-mono" style="color:${fr.color === 'red' ? 'var(--color-danger)' : fr.color === 'amber' ? 'var(--color-warning)' : 'var(--color-success)'}">
            ${fr.remaining > 0 ? fr.remaining + ' min' : 'VENCIDO'}
          </span>
        </div>` : ''}
        <div class="detail-row">
          <span class="label">Permisos Avanzados</span>
          <span class="value">${ticket.requiresAdvancedPerms ? '<span style="color:var(--color-warning)">⚠️ Sí</span>' : 'No'}</span>
        </div>
      </div>

      ${canChangeState ? `
      <div class="detail-section">
        <h4>Cambiar Estado (REQ-03)</h4>
        <div class="form-group">
          <select class="form-control" id="detail-new-status">
            <option value="">Seleccionar nuevo estado...</option>
            ${ticket.estado !== data.ESTADOS.ABIERTO ? '' : `<option value="${data.ESTADOS.EN_PROGRESO}">En_Progreso</option>`}
            ${ticket.estado === data.ESTADOS.CERRADO_DEFINITIVO ? '' : `
              <option value="${data.ESTADOS.ESCALADO}">Escalado</option>
              <option value="${data.ESTADOS.RESUELTO}">Resuelto</option>
            `}
          </select>
        </div>
        <div id="resolution-note-container" style="display:none">
          <div class="form-group">
            <label class="form-label">Nota de Solución Técnica <span class="required">*</span></label>
            <textarea class="form-control" id="detail-resolution-note" placeholder="Mínimo 30 caracteres. Describa la solución técnica aplicada..." rows="3"></textarea>
            <div class="form-error-msg" id="err-resolution-note">La nota debe tener mínimo 30 caracteres (HU-006)</div>
            <div style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:4px">
              <span id="note-char-count">0</span>/30 caracteres mínimos
            </div>
          </div>
        </div>
        <div id="advanced-perms-container" style="display:none; margin-bottom:var(--space-4)">
          <div class="form-check">
            <input type="checkbox" id="detail-advanced-perms">
            <label for="detail-advanced-perms"><strong>Requiere Permisos Avanzados</strong> — Marcará el ticket para escalamiento automático (REQ-09)</label>
          </div>
        </div>
        <button class="btn btn-primary" id="btn-change-status" disabled onclick="App.handleStatusChange()">
          Confirmar Cambio
        </button>
        ${!ticket.firstResponseAt ? `
        <button class="btn btn-success" style="margin-left:8px" onclick="App.registerFirstResponse('${ticket.id}')">
          📞 Registrar Primera Respuesta
        </button>` : ''}
      </div>` : ''}

      ${ticket.estado === data.ESTADOS.RESUELTO && currentUser?.role === data.ROLES.USUARIO ? `
      <div class="detail-section">
        <div class="tooltip-wrapper" style="width:100%">
          <button class="btn btn-danger" style="width:100%" ${ticket.closedAt ? 'disabled' : ''} onclick="App.objectResolution('${ticket.id}')">
            ${ticket.closedAt ? '🔒 Período de objeción expirado' : '⚠️ Objetar Solución'}
          </button>
          ${ticket.closedAt ? '<span class="tooltip">El período de 72 horas hábiles ha expirado. El ticket fue cerrado definitivamente.</span>' : ''}
        </div>
      </div>` : ''}

      <div class="detail-section">
        <h4>Historial de Auditoría</h4>
        <div class="timeline">
          ${ticket.history.slice().reverse().map(h => `
            <div class="timeline-item">
              <div class="timeline-time">${data.formatDate(h.time)}</div>
              <div class="timeline-text">${h.action}</div>
              <div class="timeline-time">por ${h.by}</div>
              ${h.note ? `<div style="margin-top:4px; font-size:var(--text-xs); color:var(--text-secondary); background:var(--bg-tertiary); padding:8px; border-radius:var(--radius-sm);">📝 ${h.note}</div>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;

    panel.classList.add('open');

    // Setup state change listeners
    if (canChangeState) {
      const statusSelect = $('#detail-new-status');
      const resContainer = $('#resolution-note-container');
      const advContainer = $('#advanced-perms-container');
      const btnChange = $('#btn-change-status');

      statusSelect?.addEventListener('change', () => {
        const val = statusSelect.value;
        resContainer.style.display = val === data.ESTADOS.RESUELTO ? 'block' : 'none';
        advContainer.style.display = (val === data.ESTADOS.ESCALADO || val === data.ESTADOS.EN_PROGRESO) ? 'block' : 'none';
        btnChange.disabled = !val;
      });

      const noteEl = $('#detail-resolution-note');
      noteEl?.addEventListener('input', () => {
        const count = noteEl.value.length;
        const countEl = $('#note-char-count');
        if (countEl) {
          countEl.textContent = count;
          countEl.style.color = count >= 30 ? 'var(--color-success)' : 'var(--color-danger)';
        }
      });
    }
  }

  function closeTicketDetail() {
    $('#ticket-detail-panel').classList.remove('open');
    selectedTicket = null;
  }

  function handleStatusChange() {
    const data = D();
    if (!selectedTicket) return;

    const newStatus = $('#detail-new-status').value;
    if (!newStatus) return;

    // HU-006: If resolving, require min 30-char note
    if (newStatus === data.ESTADOS.RESUELTO) {
      const note = $('#detail-resolution-note').value.trim();
      if (note.length < 30) {
        $('#err-resolution-note').classList.add('visible');
        $('#detail-resolution-note').classList.add('error');
        return;
      }

      selectedTicket.estado = data.ESTADOS.RESUELTO;
      selectedTicket.resolvedAt = new Date();
      selectedTicket.history.push({
        time: new Date(),
        action: `Estado → Resuelto`,
        by: currentUser.name,
        note: note
      });
    } else if (newStatus === data.ESTADOS.ESCALADO) {
      const advPerms = $('#detail-advanced-perms')?.checked;
      if (advPerms) selectedTicket.requiresAdvancedPerms = true;

      const result = RoundRobinEngine.escalateTicket(selectedTicket);
      if (!result.success) {
        Toast.show({ type: 'error', title: 'Error', message: result.reason });
        return;
      }
    } else {
      selectedTicket.estado = newStatus;
      const advPerms = $('#detail-advanced-perms')?.checked;
      if (advPerms) selectedTicket.requiresAdvancedPerms = true;
      selectedTicket.history.push({
        time: new Date(),
        action: `Estado → ${newStatus}`,
        by: currentUser.name
      });
    }

    Toast.show({
      type: 'success',
      title: 'Estado Actualizado',
      message: `${selectedTicket.id} → ${selectedTicket.estado}`
    });

    openTicketDetail(selectedTicket.id);
    renderTicketsGrid();
    updateNavBadges();
  }

  function registerFirstResponse(ticketId) {
    const data = D();
    const ticket = data.TICKETS_DB.find(t => t.id === ticketId);
    if (!ticket) return;

    ticket.firstResponseAt = new Date();
    ticket.history.push({
      time: new Date(),
      action: 'Primera respuesta registrada',
      by: currentUser.name
    });

    Toast.show({
      type: 'success',
      title: 'Primera Respuesta',
      message: `Registrada para ${ticketId}`
    });

    openTicketDetail(ticketId);
    updateNavBadges();
  }

  function objectResolution(ticketId) {
    const data = D();
    const ticket = data.TICKETS_DB.find(t => t.id === ticketId);
    if (!ticket || ticket.estado !== data.ESTADOS.RESUELTO) return;

    ticket.estado = data.ESTADOS.ABIERTO;
    ticket.resolvedAt = null;
    ticket.history.push({
      time: new Date(),
      action: 'Solución objetada por el usuario — Ticket reabierto',
      by: currentUser.name
    });

    Toast.show({
      type: 'warning',
      title: 'Solución Objetada',
      message: `${ticketId} ha sido reabierto`
    });

    openTicketDetail(ticketId);
    renderTicketsGrid();
    updateNavBadges();
  }

  /* ════════════════════════════════════════════════════════════
     VIEW: ASSIGNMENT / ROUND-ROBIN (HU-002)
  ════════════════════════════════════════════════════════════ */
  function renderAssignmentView() {
    const data = D();
    const agents = RoundRobinEngine.getAgentLoadMap();
    const container = $('#assignment-agents-grid');

    // Mark next RR agent
    const level1Agents = agents.filter(a => a.level === 1);
    const rrIdx = data.roundRobinPointer % Math.max(level1Agents.length, 1);

    container.innerHTML = `
      <div style="margin-bottom:var(--space-6)">
        <h4 style="font-size:var(--text-base); font-weight:600; margin-bottom:var(--space-2)">🔄 Agentes Nivel 1</h4>
        <p style="font-size:var(--text-sm); color:var(--text-tertiary)">Distribución por Round-Robin · Puntero actual: posición ${rrIdx + 1} · Máximo ${data.MAX_TICKETS_POR_AGENTE} tickets/agente (RN002)</p>
      </div>
      <div class="rr-agents-grid">
        ${agents.filter(a => a.level === 1).map((agent, idx) => renderAgentCard(agent, idx === rrIdx)).join('')}
      </div>

      <div style="margin:var(--space-8) 0 var(--space-6)">
        <h4 style="font-size:var(--text-base); font-weight:600; margin-bottom:var(--space-2)">⭐ Agentes Nivel 2 (Especialistas)</h4>
        <p style="font-size:var(--text-sm); color:var(--text-tertiary)">Reciben tickets críticos directamente (REQ-06) y escalamientos de Nivel 1</p>
      </div>
      <div class="rr-agents-grid">
        ${agents.filter(a => a.level === 2).map(agent => renderAgentCard(agent, false)).join('')}
      </div>
    `;
  }

  function renderAgentCard(agent, isNextRR) {
    const loadPct = (agent.load / agent.max) * 100;
    const loadColor = loadPct >= 100 ? 'red' : loadPct >= 67 ? 'amber' : 'green';
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#06b6d4', '#f59e0b'];
    const bgColor = colors[agent.name.length % colors.length];

    return `
      <div class="rr-agent-card ${agent.isSaturated ? 'saturated' : ''} ${isNextRR ? 'active-rr' : ''}">
        <div class="agent-header">
          <div class="agent-avatar" style="background:${bgColor}">${agent.avatar}</div>
          <div>
            <div class="agent-name">${agent.name}</div>
            <div class="agent-level">${agent.role} · Nivel ${agent.level}</div>
          </div>
        </div>
        <div class="agent-load-bar">
          <div class="load-track">
            <div class="load-fill ${loadColor}" style="width:${loadPct}%"></div>
          </div>
          <div class="load-count">${agent.load}/${agent.max}</div>
        </div>
        <div style="margin-top:var(--space-3); font-size:var(--text-xs); color:var(--text-tertiary)">
          ${agent.isSaturated ? '⛔ No recibe nuevos tickets' : `✅ Disponible (${agent.max - agent.load} slots libres)`}
        </div>
      </div>
    `;
  }

  /* ════════════════════════════════════════════════════════════
     VIEW: SLA MONITOR (HU-003)
  ════════════════════════════════════════════════════════════ */
  function renderSLAMonitor() {
    const data = D();
    const container = $('#sla-monitor-body');

    const activeTickets = data.TICKETS_DB.filter(t =>
      t.estado !== data.ESTADOS.CERRADO_DEFINITIVO
    ).sort((a, b) => {
      const slaA = data.getSLAStatus(a);
      const slaB = data.getSLAStatus(b);
      const order = { red: 0, amber: 1, green: 2 };
      return (order[slaA.status] || 2) - (order[slaB.status] || 2);
    });

    container.innerHTML = activeTickets.map(ticket => {
      const sla = data.getSLAStatus(ticket);
      const fr = SLAEngine.evaluateFirstResponse(ticket);
      const agent = data.getUserById(ticket.assignedTo);
      const pct = fr.met ? 100 : Math.min(100, Math.round((fr.percentage || 0) * 100));
      const circumference = 2 * Math.PI * 20;
      const offset = circumference - (pct / 100) * circumference;
      const ringColor = fr.color === 'red' ? '#ef4444' : fr.color === 'amber' ? '#f59e0b' : '#22c55e';

      return `
        <tr onclick="App.openTicketDetail('${ticket.id}')" style="cursor:pointer">
          <td><span class="text-mono" style="font-weight:600; color:var(--accent-hover)">${ticket.id}</span></td>
          <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap">${ticket.subject}</td>
          <td><span class="badge badge-${getEstadoClass(ticket.estado)}">${formatEstado(ticket.estado)}</span></td>
          <td>
            <div class="progress-ring">
              <svg width="48" height="48">
                <circle class="track" cx="24" cy="24" r="20"/>
                <circle class="fill" cx="24" cy="24" r="20" stroke="${ringColor}"
                  stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"/>
              </svg>
              <span class="percentage" style="color:${ringColor}">${pct}%</span>
            </div>
          </td>
          <td>
            <span class="sla-badge sla-${sla.status}">
              <span class="sla-dot-indicator ${sla.status}"></span> ${sla.label}
            </span>
          </td>
          <td class="text-mono" style="font-size:var(--text-xs)">${sla.minutes} min</td>
          <td style="font-size:var(--text-xs)">${agent ? agent.name : '—'}</td>
          <td style="font-size:var(--text-xs)">${ticket.firstResponseAt ? '✅' : '⏳ Pendiente'}</td>
        </tr>
      `;
    }).join('');

    if (activeTickets.length === 0) {
      container.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🎉</div><h3>Sin tickets activos</h3></div></td></tr>`;
    }
  }

  /* ════════════════════════════════════════════════════════════
     VIEW: BATCH CLOSURE (HU-005, REQ-10)
  ════════════════════════════════════════════════════════════ */
  function renderBatchView() {
    const data = D();
    const container = $('#batch-content');

    const resolvedTickets = data.TICKETS_DB.filter(t => t.estado === data.ESTADOS.RESUELTO);
    const closedTickets = data.TICKETS_DB.filter(t => t.estado === data.ESTADOS.CERRADO_DEFINITIVO);

    container.innerHTML = `
      <div class="grid-2" style="margin-bottom:var(--space-6)">
        <div class="stat-card warning">
          <div class="stat-header">
            <span class="stat-label">Tickets en Espera de Cierre</span>
            <div class="stat-icon">⏳</div>
          </div>
          <div class="stat-value">${resolvedTickets.length}</div>
          <div class="stat-trend">Estado "Resuelto" — Esperando 72h hábiles sin objeción</div>
        </div>
        <div class="stat-card success">
          <div class="stat-header">
            <span class="stat-label">Tickets Cerrados Definitivamente</span>
            <div class="stat-icon">✅</div>
          </div>
          <div class="stat-value">${closedTickets.length}</div>
          <div class="stat-trend">Transitados por Batch Job automático</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>📋 Tickets Resueltos Pendientes de Cierre</h3>
          <button class="btn btn-primary btn-sm" onclick="App.runManualBatch()">
            ▶️ Ejecutar Batch Manualmente
          </button>
        </div>
        <div class="card-body no-padding">
          <table class="data-grid">
            <thead>
              <tr>
                <th>ID</th>
                <th>Asunto</th>
                <th>Fecha Resolución</th>
                <th>Horas Hábiles Transcurridas</th>
                <th>Progreso hacia cierre</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${resolvedTickets.map(t => {
                const bhElapsed = Math.round(data.getElapsedBusinessMinutes(t.resolvedAt) / 60 * 10) / 10;
                const progress = Math.min(100, Math.round((bhElapsed / data.HORAS_CIERRE_DEFINITIVO) * 100));
                return `
                  <tr>
                    <td class="text-mono" style="font-weight:600; color:var(--accent-hover)">${t.id}</td>
                    <td>${t.subject.substring(0, 50)}...</td>
                    <td class="text-mono" style="font-size:var(--text-xs)">${data.formatDate(t.resolvedAt)}</td>
                    <td class="text-mono">${bhElapsed}h / ${data.HORAS_CIERRE_DEFINITIVO}h</td>
                    <td>
                      <div class="batch-progress" style="margin:0; padding:var(--space-2)">
                        <div class="progress-bar-track">
                          <div class="progress-bar-fill" style="width:${progress}%"></div>
                        </div>
                        <div style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:2px">${progress}%</div>
                      </div>
                    </td>
                    <td>${progress >= 100 ? '<span class="badge badge-closed">Listo para cierre</span>' : '<span class="badge badge-progress">En espera</span>'}</td>
                  </tr>
                `;
              }).join('')}
              ${resolvedTickets.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">✅</div><h3>No hay tickets pendientes</h3><p>Todos los tickets resueltos han sido procesados</p></div></td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card mt-6">
        <div class="card-header">
          <h3>📊 Historial de Cierres Definitivos</h3>
        </div>
        <div class="card-body no-padding">
          <table class="data-grid">
            <thead>
              <tr>
                <th>ID</th>
                <th>Asunto</th>
                <th>Cerrado</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              ${closedTickets.map(t => `
                <tr>
                  <td class="text-mono" style="font-weight:600">${t.id}</td>
                  <td>${t.subject.substring(0, 60)}...</td>
                  <td class="text-mono" style="font-size:var(--text-xs)">${data.formatDate(t.closedAt || t.resolvedAt)}</td>
                  <td><span class="badge badge-closed">Cerrado_Definitivo</span></td>
                </tr>
              `).join('')}
              ${closedTickets.length === 0 ? `<tr><td colspan="4"><div class="empty-state"><div class="empty-icon">📭</div><h3>Sin cierres definitivos</h3></div></td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function runManualBatch() {
    const results = SLAEngine.runBatchClosureJob();
    if (results.closed > 0) {
      Toast.show({
        type: 'success',
        title: 'Batch Job Completado',
        message: `${results.closed} ticket(s) cerrado(s): ${results.tickets.join(', ')}`
      });
    } else {
      Toast.show({
        type: 'info',
        title: 'Batch Job',
        message: `${results.processed} ticket(s) evaluado(s). Ninguno cumple las 72h hábiles para cierre.`
      });
    }
    renderBatchView();
    updateNavBadges();
  }

  /* ════════════════════════════════════════════════════════════
     HELPERS
  ════════════════════════════════════════════════════════════ */
  function getEstadoClass(estado) {
    const map = {
      'Abierto': 'open',
      'En_Progreso': 'progress',
      'Escalado': 'escalated',
      'Resuelto': 'resolved',
      'Cerrado_Definitivo': 'closed'
    };
    return map[estado] || 'open';
  }

  function formatEstado(estado) {
    return estado.replace('_', ' ');
  }

  function getSeverityClass(severity) {
    const map = {
      'Bajo': 'low', 'Medio': 'medium', 'Alto': 'high', 'Crítico': 'critical'
    };
    return map[severity] || 'medium';
  }

  // Expose to window for onclick handlers
  window.getEstadoClass = getEstadoClass;
  window.formatEstado = formatEstado;
  window.getSeverityClass = getSeverityClass;

  return {
    init, navigateTo, openTicketDetail, closeTicketDetail,
    handleStatusChange, registerFirstResponse, objectResolution,
    runManualBatch, logout
  };
})();

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;
