/* ═══════════════════════════════════════════════════════════════
   HelpDesk ITSM v3.0 — SLA Engine & Batch Job
   REQ-07, REQ-08, REQ-09, REQ-10
   ═══════════════════════════════════════════════════════════════ */

const SLAEngine = (() => {
  const D = () => window.HelpDeskData;
  let slaInterval = null;
  let batchInterval = null;

  /**
   * REQ-08: Check if current time is within business hours.
   */
  function isWithinBusinessWindow() {
    return D().isBusinessHours();
  }

  /**
   * REQ-07: Evaluate first response SLA for a ticket.
   * Returns time remaining and status color.
   */
  function evaluateFirstResponse(ticket) {
    const data = D();
    if (ticket.firstResponseAt || ticket.estado === data.ESTADOS.CERRADO_DEFINITIVO) {
      return { met: true, elapsed: 0, remaining: data.SLA_PRIMERA_RESPUESTA_MIN };
    }

    const elapsed = data.getElapsedBusinessMinutes(ticket.createdAt);
    const remaining = data.SLA_PRIMERA_RESPUESTA_MIN - elapsed;
    const percentage = elapsed / data.SLA_PRIMERA_RESPUESTA_MIN;

    let color = 'green';
    if (percentage >= 1) color = 'red';
    else if (percentage >= data.SLA_AMBER_THRESHOLD) color = 'amber';

    return { met: false, elapsed, remaining, percentage, color };
  }

  /**
   * REQ-09: Check auto-escalation conditions.
   * Escalate if 4h without solution OR agent flags "Requiere Permisos Avanzados".
   */
  function checkAutoEscalation(ticket) {
    const data = D();
    if (ticket.estado === data.ESTADOS.ESCALADO ||
        ticket.estado === data.ESTADOS.RESUELTO ||
        ticket.estado === data.ESTADOS.CERRADO_DEFINITIVO) {
      return false;
    }

    const elapsed = data.getElapsedBusinessMinutes(ticket.createdAt);
    const shouldEscalate = elapsed >= data.TIEMPO_ESCALAMIENTO_MIN || ticket.requiresAdvancedPerms;

    if (shouldEscalate && ticket.estado !== data.ESTADOS.ESCALADO) {
      const reason = ticket.requiresAdvancedPerms
        ? 'Requiere Permisos Avanzados'
        : `Tiempo sin solución ≥ ${data.TIEMPO_ESCALAMIENTO_MIN / 60}h`;
      return { shouldEscalate: true, reason };
    }

    return { shouldEscalate: false };
  }

  /**
   * REQ-10: Batch Job — Close tickets that have been resolved for ≥72 business hours.
   */
  function runBatchClosureJob() {
    const data = D();
    const results = { processed: 0, closed: 0, tickets: [] };

    data.TICKETS_DB.forEach(ticket => {
      if (ticket.estado === data.ESTADOS.RESUELTO && ticket.resolvedAt) {
        results.processed++;
        const businessHoursSinceResolved = data.getElapsedBusinessMinutes(ticket.resolvedAt) / 60;

        if (businessHoursSinceResolved >= data.HORAS_CIERRE_DEFINITIVO) {
          ticket.estado = data.ESTADOS.CERRADO_DEFINITIVO;
          ticket.closedAt = new Date();
          ticket.history.push({
            time: new Date(),
            action: `Estado → Cerrado_Definitivo (Batch Job: ${data.HORAS_CIERRE_DEFINITIVO}h hábiles sin objeción)`,
            by: 'Sistema Automático'
          });
          results.closed++;
          results.tickets.push(ticket.id);
        }
      }
    });

    return results;
  }

  /**
   * Start SLA monitoring loop (simulates real-time checks).
   */
  function startSLAMonitor(onUpdate) {
    if (slaInterval) clearInterval(slaInterval);
    slaInterval = setInterval(() => {
      if (!isWithinBusinessWindow()) return; // RNF-08: Only during business hours

      const data = D();
      const alerts = [];

      data.TICKETS_DB.forEach(ticket => {
        if (ticket.estado === data.ESTADOS.CERRADO_DEFINITIVO) return;

        // Check first response SLA
        const frStatus = evaluateFirstResponse(ticket);
        if (frStatus.color === 'red' && !ticket.firstResponseAt) {
          alerts.push({
            type: 'sla_breach',
            ticket: ticket.id,
            message: `${ticket.id}: SLA de primera respuesta VENCIDO (${frStatus.elapsed} min)`
          });
        } else if (frStatus.color === 'amber' && !ticket.firstResponseAt) {
          alerts.push({
            type: 'sla_warning',
            ticket: ticket.id,
            message: `${ticket.id}: SLA al 75% — ${frStatus.remaining} min restantes`
          });
        }

        // Check auto-escalation
        const escResult = checkAutoEscalation(ticket);
        if (escResult.shouldEscalate) {
          const assignResult = window.RoundRobinEngine.escalateTicket(ticket);
          if (assignResult.success) {
            alerts.push({
              type: 'escalation',
              ticket: ticket.id,
              message: `${ticket.id}: Escalado automáticamente a ${assignResult.agentName} (${escResult.reason})`
            });
          }
        }
      });

      if (onUpdate) onUpdate(alerts);
    }, 30000); // Check every 30 seconds
  }

  function stopSLAMonitor() {
    if (slaInterval) { clearInterval(slaInterval); slaInterval = null; }
  }

  /**
   * Start batch closure job (runs periodically).
   */
  function startBatchJob(onComplete) {
    if (batchInterval) clearInterval(batchInterval);
    batchInterval = setInterval(() => {
      const results = runBatchClosureJob();
      if (results.closed > 0 && onComplete) {
        onComplete(results);
      }
    }, 60000); // Check every minute
  }

  function stopBatchJob() {
    if (batchInterval) { clearInterval(batchInterval); batchInterval = null; }
  }

  /**
   * Get SLA dashboard metrics.
   */
  function getMetrics() {
    const data = D();
    const tickets = data.TICKETS_DB;

    const total = tickets.length;
    const open = tickets.filter(t => t.estado === data.ESTADOS.ABIERTO).length;
    const inProgress = tickets.filter(t => t.estado === data.ESTADOS.EN_PROGRESO).length;
    const escalated = tickets.filter(t => t.estado === data.ESTADOS.ESCALADO).length;
    const resolved = tickets.filter(t => t.estado === data.ESTADOS.RESUELTO).length;
    const closed = tickets.filter(t => t.estado === data.ESTADOS.CERRADO_DEFINITIVO).length;

    // FCR: tickets resolved on first response (simplified)
    const resolvedTickets = tickets.filter(t =>
      t.estado === data.ESTADOS.RESUELTO || t.estado === data.ESTADOS.CERRADO_DEFINITIVO
    );
    const fcrCount = resolvedTickets.filter(t => !t.history.some(h => h.action.includes('Escalado'))).length;
    const fcr = resolvedTickets.length > 0 ? Math.round((fcrCount / resolvedTickets.length) * 100) : 0;

    // MTTR: Average time to resolve in hours
    const resolvedWithTime = resolvedTickets.filter(t => t.resolvedAt && t.createdAt);
    const mttr = resolvedWithTime.length > 0
      ? Math.round(resolvedWithTime.reduce((sum, t) => sum + ((t.resolvedAt - t.createdAt) / 3600000), 0) / resolvedWithTime.length * 10) / 10
      : 0;

    // SLA compliance
    const activeTickets = tickets.filter(t =>
      t.estado !== data.ESTADOS.CERRADO_DEFINITIVO && t.estado !== data.ESTADOS.RESUELTO
    );
    const slaBreaches = activeTickets.filter(t => {
      const sla = evaluateFirstResponse(t);
      return sla.color === 'red';
    }).length;

    const slaCompliance = activeTickets.length > 0
      ? Math.round(((activeTickets.length - slaBreaches) / activeTickets.length) * 100)
      : 100;

    return {
      total, open, inProgress, escalated, resolved, closed,
      fcr, mttr, slaCompliance, slaBreaches,
      csat: 87 // Simulated CSAT score
    };
  }

  return {
    isWithinBusinessWindow, evaluateFirstResponse, checkAutoEscalation,
    runBatchClosureJob, startSLAMonitor, stopSLAMonitor,
    startBatchJob, stopBatchJob, getMetrics
  };
})();

window.SLAEngine = SLAEngine;
