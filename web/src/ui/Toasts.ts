// FILE: web/src/ui/Toasts.ts

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface LogEntry {
  timestamp: string;
  level: ToastType;
  message: string;
  source?: string;
}

class ToastManager {
  private container: HTMLElement | null = null;
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 30;

  constructor() {
    this.ensureContainer();
    this.hookGlobalErrors();
  }

  private ensureContainer() {
    if (this.container) return;
    let el = document.getElementById('toast-container');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast-container';
      el.className = 'toast-container';
      document.body.appendChild(el);
    }
    this.container = el;
  }

  private hookGlobalErrors() {
    window.addEventListener('error', (e) => {
      this.error(`Runtime Error: ${e.message || 'Unknown error'}`);
    });

    window.addEventListener('unhandledrejection', (e) => {
      const msg = e.reason?.message || String(e.reason || 'Unhandled Promise Rejection');
      this.error(`Promise Error: ${msg}`);
    });
  }

  public show(message: string, type: ToastType = 'info', durationMs: number = 4000) {
    this.ensureContainer();
    this.appendLog(type, message);

    if (!this.container) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    // Inline SVG Icons (Zero emojis)
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (type === 'error') {
      iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else if (type === 'warning') {
      iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    } else {
      iconSvg = `<svg class="toast-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }

    toast.innerHTML = `
      <div class="toast-icon-wrapper">${iconSvg}</div>
      <div class="toast-text">${message}</div>
      <button class="toast-close-btn" aria-label="Dismiss">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        this.dismissToast(toast);
      });
    }

    this.container.appendChild(toast);

    // Auto dismiss
    setTimeout(() => {
      this.dismissToast(toast);
    }, durationMs);
  }

  private dismissToast(toast: HTMLElement) {
    toast.classList.add('toast-dismissing');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 300);
  }

  private appendLog(level: ToastType, message: string) {
    const time = new Date().toLocaleTimeString();
    this.logs.unshift({ timestamp: time, level, message });
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }
  }

  public info(message: string, duration?: number) { this.show(message, 'info', duration); }
  public success(message: string, duration?: number) { this.show(message, 'success', duration); }
  public warning(message: string, duration?: number) { this.show(message, 'warning', duration); }
  public error(message: string, duration?: number) { this.show(message, 'error', duration || 6000); }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs() {
    this.logs = [];
  }
}

export const Toasts = new ToastManager();
