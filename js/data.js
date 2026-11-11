/* ═══════════════════════════════════════════════════════════════
   HelpDesk ITSM v3.0 — Data Layer & Business Rules
   Seeded data, enums, and business rule constants.
   ═══════════════════════════════════════════════════════════════ */

// ── Enums & Constants ──
const ESTADOS = {
  ABIERTO:           'Abierto',
  EN_PROGRESO:       'En_Progreso',
  ESCALADO:          'Escalado',
  RESUELTO:          'Resuelto',
  CERRADO_DEFINITIVO:'Cerrado_Definitivo'
};

const CATEGORIAS = [
  { id: 'SW', label: 'Software / Aplicaciones', icon: '💻' },
  { id: 'HW', label: 'Hardware / Equipos',      icon: '🖥️' },
  { id: 'RED', label: 'Redes / Conectividad',   icon: '🌐' },
  { id: 'SEG', label: 'Seguridad / Accesos',    icon: '🔒' },
  { id: 'MAIL', label: 'Correo / Mensajería',   icon: '📧' },
  { id: 'ERP', label: 'ERP / Sistemas Core',    icon: '⚙️' },
  { id: 'OTRO', label: 'Otro / General',        icon: '📋' }
];

const IMPACTO_MATRIX = {
  // [userType][categoryId] → severity
  Interno: {
    SW: 'Medio', HW: 'Medio', RED: 'Alto', SEG: 'Crítico',
    MAIL: 'Medio', ERP: 'Crítico', OTRO: 'Bajo'
  },
  Externo: {
    SW: 'Alto', HW: 'Medio', RED: 'Alto', SEG: 'Crítico',
    MAIL: 'Alto', ERP: 'Crítico', OTRO: 'Medio'
  }
};

const SEVERIDAD_NIVELES = ['Bajo', 'Medio', 'Alto', 'Crítico'];

// RN002: Max tickets per agent
const MAX_TICKETS_POR_AGENTE = 6;

// RN003: SLA first response time (minutes)
const SLA_PRIMERA_RESPUESTA_MIN = 120; // 2 hours
const SLA_AMBER_THRESHOLD = 0.75; // 75% → 90 min

// RN005: Business hours window
const HORARIO_HABIL = { inicio: 7, fin: 18 }; // 07:00 – 18:00
const DIAS_HABILES = [1, 2, 3, 4, 5]; // Mon–Fri

// RN006: Auto-escalation time (minutes)
const TIEMPO_ESCALAMIENTO_MIN = 240; // 4 hours

// RN007: Auto-closure after resolved (business hours)
const HORAS_CIERRE_DEFINITIVO = 72;

// ── Roles ──
const ROLES = {
  USUARIO:      'Usuario',
  AGENTE_N1:    'Agente Nivel 1',
  AGENTE_N2:    'Agente Nivel 2',
  COORDINADOR:  'Coordinador',
  SUPERVISOR:   'Supervisor'
};

// ── Seeded Users (auth simulation) ──
const USERS_DB = [
  { id: 'U001', name: 'Carlos Martínez',  email: 'carlos@empresa.co',   password: 'admin123', role: ROLES.SUPERVISOR,   avatar: 'CM', level: 2 },
  { id: 'U002', name: 'Ana Rodríguez',    email: 'ana@empresa.co',      password: 'admin123', role: ROLES.COORDINADOR,  avatar: 'AR', level: 2 },
  { id: 'U003', name: 'Luis Gómez',       email: 'luis@empresa.co',     password: 'admin123', role: ROLES.AGENTE_N1,    avatar: 'LG', level: 1 },
  { id: 'U004', name: 'María Torres',     email: 'maria@empresa.co',    password: 'admin123', role: ROLES.AGENTE_N1,    avatar: 'MT', level: 1 },
  { id: 'U005', name: 'Pedro Sánchez',    email: 'pedro@empresa.co',    password: 'admin123', role: ROLES.AGENTE_N1,    avatar: 'PS', level: 1 },
  { id: 'U006', name: 'Laura Díaz',       email: 'laura@empresa.co',    password: 'admin123', role: ROLES.AGENTE_N2,    avatar: 'LD', level: 2 },
  { id: 'U007', name: 'Diego Herrera',    email: 'diego@empresa.co',    password: 'admin123', role: ROLES.AGENTE_N2,    avatar: 'DH', level: 2 },
  { id: 'U008', name: 'Valentina Ruiz',   email: 'valentina@corp.co',   password: 'user123',  role: ROLES.USUARIO,      avatar: 'VR', type: 'Interno' },
  { id: 'U009', name: 'Andrés Ospina',    email: 'andres@externo.co',   password: 'user123',  role: ROLES.USUARIO,      avatar: 'AO', type: 'Externo' },
  { id: 'U010', name: 'Camila Vega',      email: 'camila@externo.co',   password: 'user123',  role: ROLES.USUARIO,      avatar: 'CV', type: 'Externo' }
];

// ── Seeded Tickets ──
let ticketCounter = 12;
const now = new Date();

function hoursAgo(h) {
  return new Date(now.getTime() - h * 3600000);
}

let TICKETS_DB = [
  {
    id: 'TCK-0001', category: 'SW', userType: 'Interno', severity: 'Medio',
    estado: ESTADOS.EN_PROGRESO, reportedBy: 'U008', assignedTo: 'U003',
    subject: 'Error en módulo de facturación al generar PDF',
    description: 'Al intentar exportar facturas a PDF, el sistema arroja un error 500.',
    createdAt: hoursAgo(5), firstResponseAt: hoursAgo(4.5), resolvedAt: null,
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(5), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(4.5), action: 'Primera respuesta registrada', by: 'Luis Gómez' },
      { time: hoursAgo(3), action: 'Estado → En_Progreso', by: 'Luis Gómez' }
    ]
  },
  {
    id: 'TCK-0002', category: 'RED', userType: 'Interno', severity: 'Alto',
    estado: ESTADOS.ABIERTO, reportedBy: 'U008', assignedTo: 'U004',
    subject: 'Sin acceso a la VPN corporativa desde oficina Medellín',
    description: 'Los usuarios de la sede Medellín no pueden conectarse a la VPN.',
    createdAt: hoursAgo(1.5), firstResponseAt: null, resolvedAt: null,
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(1.5), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(1.5), action: 'Asignado a María Torres (Round-Robin)', by: 'Motor Asignación' }
    ]
  },
  {
    id: 'TCK-0003', category: 'SEG', userType: 'Externo', severity: 'Crítico',
    estado: ESTADOS.ESCALADO, reportedBy: 'U009', assignedTo: 'U006',
    subject: 'Brecha de seguridad detectada en portal de clientes',
    description: 'Se detectó acceso no autorizado al portal de autoservicio de clientes.',
    createdAt: hoursAgo(8), firstResponseAt: hoursAgo(7.8), resolvedAt: null,
    consentimiento: true, requiresAdvancedPerms: true,
    history: [
      { time: hoursAgo(8), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(8), action: 'Severidad CRÍTICA → Asignado directamente a Nivel 2', by: 'Motor Asignación' },
      { time: hoursAgo(7.8), action: 'Primera respuesta registrada', by: 'Laura Díaz' },
      { time: hoursAgo(6), action: 'Estado → Escalado (Requiere permisos avanzados)', by: 'Laura Díaz' }
    ]
  },
  {
    id: 'TCK-0004', category: 'MAIL', userType: 'Interno', severity: 'Medio',
    estado: ESTADOS.RESUELTO, reportedBy: 'U008', assignedTo: 'U005',
    subject: 'Outlook no sincroniza calendario compartido',
    description: 'El calendario compartido del equipo de ventas no se sincroniza.',
    createdAt: hoursAgo(50), firstResponseAt: hoursAgo(49), resolvedAt: hoursAgo(46),
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(50), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(49), action: 'Primera respuesta', by: 'Pedro Sánchez' },
      { time: hoursAgo(47), action: 'Estado → En_Progreso', by: 'Pedro Sánchez' },
      { time: hoursAgo(46), action: 'Estado → Resuelto', by: 'Pedro Sánchez', note: 'Se reconfiguró el perfil de Exchange y se forzó resincronización completa del mailbox.' }
    ]
  },
  {
    id: 'TCK-0005', category: 'HW', userType: 'Interno', severity: 'Medio',
    estado: ESTADOS.ABIERTO, reportedBy: 'U008', assignedTo: 'U003',
    subject: 'Impresora de piso 3 no responde a trabajos de impresión',
    description: 'La impresora HP LaserJet del piso 3 muestra estado offline.',
    createdAt: hoursAgo(0.5), firstResponseAt: null, resolvedAt: null,
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(0.5), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(0.5), action: 'Asignado a Luis Gómez (Round-Robin)', by: 'Motor Asignación' }
    ]
  },
  {
    id: 'TCK-0006', category: 'ERP', userType: 'Externo', severity: 'Crítico',
    estado: ESTADOS.EN_PROGRESO, reportedBy: 'U010', assignedTo: 'U007',
    subject: 'Error crítico en módulo de inventario del ERP',
    description: 'El módulo de inventario muestra cantidades negativas en productos activos.',
    createdAt: hoursAgo(3), firstResponseAt: hoursAgo(2.8), resolvedAt: null,
    consentimiento: true, requiresAdvancedPerms: true,
    history: [
      { time: hoursAgo(3), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(3), action: 'Severidad CRÍTICA → Asignado a Nivel 2', by: 'Motor Asignación' },
      { time: hoursAgo(2.8), action: 'Primera respuesta', by: 'Diego Herrera' },
      { time: hoursAgo(2), action: 'Estado → En_Progreso', by: 'Diego Herrera' }
    ]
  },
  {
    id: 'TCK-0007', category: 'SW', userType: 'Interno', severity: 'Bajo',
    estado: ESTADOS.CERRADO_DEFINITIVO, reportedBy: 'U008', assignedTo: 'U004',
    subject: 'Actualización de Adobe Reader a última versión',
    description: 'Se requiere actualizar Adobe Reader en los equipos del área contable.',
    createdAt: hoursAgo(200), firstResponseAt: hoursAgo(199), resolvedAt: hoursAgo(196),
    closedAt: hoursAgo(120),
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(200), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(199), action: 'Primera respuesta', by: 'María Torres' },
      { time: hoursAgo(196), action: 'Estado → Resuelto', by: 'María Torres', note: 'Se actualizó Adobe Reader en 12 equipos del área contable mediante GPO.' },
      { time: hoursAgo(120), action: 'Estado → Cerrado_Definitivo (Batch Job 72h)', by: 'Sistema Automático' }
    ]
  },
  {
    id: 'TCK-0008', category: 'RED', userType: 'Externo', severity: 'Alto',
    estado: ESTADOS.EN_PROGRESO, reportedBy: 'U009', assignedTo: 'U003',
    subject: 'Latencia extrema en portal de proveedores',
    description: 'Los proveedores reportan tiempos de carga superiores a 30 segundos.',
    createdAt: hoursAgo(2), firstResponseAt: hoursAgo(1.5), resolvedAt: null,
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(2), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(1.5), action: 'Primera respuesta', by: 'Luis Gómez' },
      { time: hoursAgo(1), action: 'Estado → En_Progreso', by: 'Luis Gómez' }
    ]
  },
  {
    id: 'TCK-0009', category: 'SW', userType: 'Interno', severity: 'Medio',
    estado: ESTADOS.ABIERTO, reportedBy: 'U008', assignedTo: 'U005',
    subject: 'Error 403 al acceder al módulo de RRHH',
    description: 'Varios usuarios del área de recursos humanos no pueden acceder al módulo.',
    createdAt: hoursAgo(0.8), firstResponseAt: null, resolvedAt: null,
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(0.8), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(0.8), action: 'Asignado a Pedro Sánchez (Round-Robin)', by: 'Motor Asignación' }
    ]
  },
  {
    id: 'TCK-0010', category: 'HW', userType: 'Interno', severity: 'Medio',
    estado: ESTADOS.EN_PROGRESO, reportedBy: 'U008', assignedTo: 'U004',
    subject: 'Monitor secundario no detectado en estación de trabajo',
    description: 'El monitor secundario del puesto 14B no es reconocido por Windows.',
    createdAt: hoursAgo(4), firstResponseAt: hoursAgo(3.5), resolvedAt: null,
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(4), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(3.5), action: 'Primera respuesta', by: 'María Torres' },
      { time: hoursAgo(3), action: 'Estado → En_Progreso', by: 'María Torres' }
    ]
  },
  {
    id: 'TCK-0011', category: 'SEG', userType: 'Interno', severity: 'Alto',
    estado: ESTADOS.ABIERTO, reportedBy: 'U008', assignedTo: 'U005',
    subject: 'Solicitud de restablecimiento de contraseña masivo',
    description: 'Se requiere restablecer contraseñas de 50 cuentas tras alerta de seguridad.',
    createdAt: hoursAgo(0.3), firstResponseAt: null, resolvedAt: null,
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(0.3), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(0.3), action: 'Asignado a Pedro Sánchez (Round-Robin)', by: 'Motor Asignación' }
    ]
  },
  {
    id: 'TCK-0012', category: 'MAIL', userType: 'Externo', severity: 'Alto',
    estado: ESTADOS.RESUELTO, reportedBy: 'U010', assignedTo: 'U004',
    subject: 'Correos de notificación no llegan a clientes externos',
    description: 'Los correos transaccionales no se entregan a dominios externos.',
    createdAt: hoursAgo(90), firstResponseAt: hoursAgo(89), resolvedAt: hoursAgo(80),
    consentimiento: true, requiresAdvancedPerms: false,
    history: [
      { time: hoursAgo(90), action: 'Ticket creado', by: 'Sistema' },
      { time: hoursAgo(89), action: 'Primera respuesta', by: 'María Torres' },
      { time: hoursAgo(85), action: 'Estado → En_Progreso', by: 'María Torres' },
      { time: hoursAgo(80), action: 'Estado → Resuelto', by: 'María Torres', note: 'Se corrigió configuración SPF/DKIM y se liberaron correos en cola del servidor SMTP.' }
    ]
  }
];

// ── Round-Robin Pointer ──
let roundRobinPointer = 0;

// ── Helper Functions ──
function generateTicketId() {
  ticketCounter++;
  return `TCK-${String(ticketCounter).padStart(4, '0')}`;
}

function getUserById(id) {
  return USERS_DB.find(u => u.id === id);
}

function getUsersByRole(role) {
  return USERS_DB.filter(u => u.role === role);
}

function getAgentsLevel(level) {
  return USERS_DB.filter(u => u.level === level && (u.role === ROLES.AGENTE_N1 || u.role === ROLES.AGENTE_N2));
}

function getAgentTicketCount(agentId) {
  return TICKETS_DB.filter(t =>
    t.assignedTo === agentId &&
    (t.estado === ESTADOS.ABIERTO || t.estado === ESTADOS.EN_PROGRESO)
  ).length;
}

function getCategoryLabel(catId) {
  const cat = CATEGORIAS.find(c => c.id === catId);
  return cat ? cat.label : catId;
}

function getCategoryIcon(catId) {
  const cat = CATEGORIAS.find(c => c.id === catId);
  return cat ? cat.icon : '📋';
}

function isBusinessHours(date = new Date()) {
  const day = date.getDay();
  const hours = date.getHours();
  return DIAS_HABILES.includes(day) && hours >= HORARIO_HABIL.inicio && hours < HORARIO_HABIL.fin;
}

function formatDate(date) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date);
}

function formatTimeAgo(date) {
  if (!date) return '—';
  const diff = (Date.now() - date.getTime()) / 60000; // minutes
  if (diff < 1) return 'Hace un momento';
  if (diff < 60) return `Hace ${Math.floor(diff)} min`;
  if (diff < 1440) return `Hace ${Math.floor(diff / 60)}h ${Math.floor(diff % 60)}m`;
  return `Hace ${Math.floor(diff / 1440)}d`;
}

function getElapsedBusinessMinutes(startDate, endDate = new Date()) {
  let minutes = 0;
  let current = new Date(startDate);
  while (current < endDate) {
    if (isBusinessHours(current)) {
      minutes++;
    }
    current = new Date(current.getTime() + 60000);
  }
  return minutes;
}

function getSLAStatus(ticket) {
  if (ticket.estado === ESTADOS.CERRADO_DEFINITIVO || ticket.estado === ESTADOS.RESUELTO) {
    return { status: 'green', label: 'OK', minutes: 0 };
  }

  const elapsed = getElapsedBusinessMinutes(ticket.createdAt);

  if (!ticket.firstResponseAt) {
    if (elapsed >= SLA_PRIMERA_RESPUESTA_MIN) {
      return { status: 'red', label: 'SLA Vencido', minutes: elapsed };
    } else if (elapsed >= SLA_PRIMERA_RESPUESTA_MIN * SLA_AMBER_THRESHOLD) {
      return { status: 'amber', label: 'Alerta 75%', minutes: elapsed };
    }
    return { status: 'green', label: 'En tiempo', minutes: elapsed };
  }

  if (elapsed >= TIEMPO_ESCALAMIENTO_MIN && ticket.estado !== ESTADOS.ESCALADO) {
    return { status: 'red', label: 'Escalar', minutes: elapsed };
  }

  return { status: 'green', label: 'En tiempo', minutes: elapsed };
}

function inferSeverity(userType, categoryId) {
  return IMPACTO_MATRIX[userType]?.[categoryId] || 'Medio';
}

// ── Export for modules ──
window.HelpDeskData = {
  ESTADOS, CATEGORIAS, IMPACTO_MATRIX, SEVERIDAD_NIVELES,
  MAX_TICKETS_POR_AGENTE, SLA_PRIMERA_RESPUESTA_MIN, SLA_AMBER_THRESHOLD,
  HORARIO_HABIL, DIAS_HABILES, TIEMPO_ESCALAMIENTO_MIN, HORAS_CIERRE_DEFINITIVO,
  ROLES, USERS_DB, TICKETS_DB,
  generateTicketId, getUserById, getUsersByRole, getAgentsLevel,
  getAgentTicketCount, getCategoryLabel, getCategoryIcon,
  isBusinessHours, formatDate, formatTimeAgo, getElapsedBusinessMinutes,
  getSLAStatus, inferSeverity,
  get roundRobinPointer() { return roundRobinPointer; },
  set roundRobinPointer(v) { roundRobinPointer = v; }
};
