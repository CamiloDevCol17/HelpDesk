/* ═══════════════════════════════════════════════════════════════
   HelpDesk ITSM v3.0 — Toast Notification System
   ═══════════════════════════════════════════════════════════════ */

const Toast = (() => {
  const container = document.getElementById('toast-container');

  function show({ type = 'info', title, message, duration = 5000 }) {
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type]}</span>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        <div class="toast-msg">${message}</div>
      </div>
      <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
    `;

    container.appendChild(toast);

    // Play sound for SLA alerts
    if (type === 'error' || type === 'warning') {
      playAlertSound(type);
    }

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  function playAlertSound(type) {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = type === 'error' ? 'square' : 'sine';
      osc.frequency.value = type === 'error' ? 440 : 520;
      gain.gain.value = 0.08;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) { /* ignore audio errors */ }
  }

  return { show };
})();

window.Toast = Toast;
