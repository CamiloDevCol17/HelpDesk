/* ═══════════════════════════════════════════════════════════════
   HelpDesk ITSM v3.0 — Round-Robin Assignment Engine
   REQ-05 & REQ-06: Load balancing with cap of 6 tickets/agent
   ═══════════════════════════════════════════════════════════════ */

const RoundRobinEngine = (() => {
  const D = () => window.HelpDeskData;

  /**
   * REQ-05: Find the next available agent using Round-Robin.
   * An agent is available if their open + in-progress count < MAX_TICKETS_POR_AGENTE (6).
   * If severity is "Crítico", REQ-06 routes directly to Nivel 2.
   */
  function assignTicket(ticket) {
    const data = D();
    const severity = ticket.severity;

    // REQ-06: Critical → Nivel 2 directly
    if (severity === 'Crítico') {
      return assignToLevel2(ticket);
    }

    // REQ-05: Standard → Round-Robin among Nivel 1
    return assignRoundRobin(ticket, 1);
  }

  function assignToLevel2(ticket) {
    const data = D();
    const agents = data.getAgentsLevel(2);

    // Try Round-Robin among Nivel 2 agents
    for (let i = 0; i < agents.length; i++) {
      const idx = (data.roundRobinPointer + i) % agents.length;
      const agent = agents[idx];
      const count = data.getAgentTicketCount(agent.id);

      if (count < data.MAX_TICKETS_POR_AGENTE) {
        data.roundRobinPointer = (idx + 1) % agents.length;
        return {
          success: true,
          agentId: agent.id,
          agentName: agent.name,
          reason: `Severidad CRÍTICA → Asignado directamente a Nivel 2 (${agent.name})`,
          level: 2
        };
      }
    }

    return {
      success: false,
      reason: 'Todos los agentes de Nivel 2 están saturados (≥6 tickets activos)',
      level: 2
    };
  }

  function assignRoundRobin(ticket, level) {
    const data = D();
    const agents = data.getAgentsLevel(level);

    if (agents.length === 0) {
      return { success: false, reason: `No hay agentes de Nivel ${level} registrados.` };
    }

    // Find agents sorted by load, then apply RR for tie-breaking
    const availableAgents = agents
      .map(a => ({ ...a, load: data.getAgentTicketCount(a.id) }))
      .filter(a => a.load < data.MAX_TICKETS_POR_AGENTE);

    if (availableAgents.length === 0) {
      return {
        success: false,
        reason: `Todos los agentes de Nivel ${level} están saturados (≥${data.MAX_TICKETS_POR_AGENTE} tickets activos).`,
        level
      };
    }

    // Find minimum load
    const minLoad = Math.min(...availableAgents.map(a => a.load));
    const candidates = availableAgents.filter(a => a.load === minLoad);

    // Round-Robin pointer to break ties
    const pointer = data.roundRobinPointer % candidates.length;
    const selected = candidates[pointer];
    data.roundRobinPointer = (data.roundRobinPointer + 1);

    return {
      success: true,
      agentId: selected.id,
      agentName: selected.name,
      reason: `Asignado a ${selected.name} vía Round-Robin (carga: ${selected.load}/${data.MAX_TICKETS_POR_AGENTE})`,
      level,
      currentLoad: selected.load
    };
  }

  /**
   * REQ-09: Escalate to Nivel 2 when conditions are met.
   */
  function escalateTicket(ticket) {
    const data = D();
    const result = assignToLevel2(ticket);
    if (result.success) {
      ticket.estado = data.ESTADOS.ESCALADO;
      ticket.assignedTo = result.agentId;
      ticket.history.push({
        time: new Date(),
        action: `Escalado automático a Nivel 2 → ${result.agentName}`,
        by: 'Motor de Escalamiento'
      });
    }
    return result;
  }

  /**
   * Get agent load visualization data.
   */
  function getAgentLoadMap() {
    const data = D();
    const agents = [...data.getAgentsLevel(1), ...data.getAgentsLevel(2)];
    return agents.map(a => ({
      id: a.id,
      name: a.name,
      avatar: a.avatar,
      level: a.level,
      role: a.role,
      load: data.getAgentTicketCount(a.id),
      max: data.MAX_TICKETS_POR_AGENTE,
      isSaturated: data.getAgentTicketCount(a.id) >= data.MAX_TICKETS_POR_AGENTE,
      isNextRR: false // will be set by UI
    }));
  }

  return { assignTicket, escalateTicket, getAgentLoadMap, assignRoundRobin, assignToLevel2 };
})();

window.RoundRobinEngine = RoundRobinEngine;
