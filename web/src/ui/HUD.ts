// FILE: web/src/ui/HUD.ts

import { CONFIG } from '../config';

export interface HUDCallbacks {
  onPowerToggle: () => void;
  onStatusClick: () => void;
  onMuteToggle: (muted: boolean) => void;
  onSettingsClick: () => void;
  onSendMessage: (text: string) => void;
  onPttPressStart: () => void;
  onPttPressEnd: () => void;
  onImportVrmClick: () => void;
}

export class HUD {
  private container: HTMLElement;
  private callbacks: HUDCallbacks;
  private isMuted = false;
  private isConnected = false;
  private statusText = 'Neural Core Ready';
  private currentSubtitle = '';

  constructor(containerId: string, callbacks: HUDCallbacks) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;
    this.callbacks = callbacks;
    this.render();
  }

  public setConnectionState(connected: boolean, status: string = '') {
    this.isConnected = connected;
    if (status) this.statusText = status;
    this.updateStatusPill();
    this.updatePowerButton();
  }

  public setStatus(text: string) {
    this.statusText = text;
    this.updateStatusPill();
  }

  public setSubtitle(text: string) {
    this.currentSubtitle = text;
    const subCard = this.container.querySelector('#hud-subtitle-card');
    const subText = this.container.querySelector('#hud-subtitle-text');
    if (subCard && subText) {
      if (text) {
        subText.textContent = text;
        subCard.classList.add('subtitle-visible');
      } else {
        subCard.classList.remove('subtitle-visible');
      }
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.updateSpeakerButton();
  }

  public setVrmMissingCardVisible(visible: boolean) {
    const card = this.container.querySelector('#hud-vrm-missing-card');
    if (card) {
      if (visible) {
        card.classList.add('card-visible');
      } else {
        card.classList.remove('card-visible');
      }
    }
  }

  private render() {
    this.container.innerHTML = `
      <!-- Top HUD Header -->
      <div class="hud-top-bar">
        <!-- Power Button (Inline SVG) -->
        <button id="hud-power-btn" class="hud-circle-btn ${this.isConnected ? 'btn-connected' : ''}" aria-label="Toggle Power">
          <svg class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
        </button>

        <!-- Status Pill (D4: Contained CSS Marquee & Pure SVG Status Dot) -->
        <div id="hud-status-pill" class="hud-status-pill" role="button" tabindex="0">
          <div class="status-dot ${this.isConnected ? 'dot-online' : 'dot-offline'}"></div>
          <div class="status-marquee-container">
            <span id="hud-status-text" class="status-marquee-text">${this.statusText}</span>
          </div>
        </div>

        <div class="hud-top-right">
          <!-- Speaker Mute Button (Inline SVG) -->
          <button id="hud-speaker-btn" class="hud-circle-btn" aria-label="Toggle Mute">
            <svg id="hud-speaker-icon" class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
            </svg>
          </button>

          <!-- Settings Gear Button (Inline SVG) -->
          <button id="hud-settings-btn" class="hud-circle-btn" aria-label="Open Settings">
            <svg class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Missing VRM Card Overlay (D2c: Runtime VRM file import) -->
      <div id="hud-vrm-missing-card" class="hud-vrm-banner">
        <div class="vrm-banner-left">
          <div class="vrm-banner-title">CHARACTER CORE MISSING</div>
          <div class="vrm-banner-subtitle">Rendering Procedural Hologram. Import a custom .vrm model anytime.</div>
        </div>
        <button id="hud-import-vrm-btn" class="cyber-btn btn-sm btn-primary">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          IMPORT .VRM
        </button>
      </div>

      <!-- Middle Subtitle / Dialogue Card -->
      <div id="hud-subtitle-card" class="hud-subtitle-card">
        <div class="subtitle-header">
          <span class="companion-tag">${CONFIG.appName}</span>
          <span class="voice-tag">${CONFIG.voice}</span>
        </div>
        <p id="hud-subtitle-text" class="subtitle-text"></p>
      </div>

      <!-- Bottom Interaction Controls -->
      <div class="hud-bottom-bar">
        <!-- Text Input & Send (D3: Interpolates CONFIG, no brackets) -->
        <div class="hud-input-row">
          <input
            type="text"
            id="hud-text-input"
            class="hud-text-input"
            placeholder="Type a message to ${CONFIG.appName}…"
            autocomplete="off"
          />
          <button id="hud-send-btn" class="hud-send-btn" aria-label="Send Message">
            <svg class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>

        <!-- Push-to-Talk Button (D7: Tactile pressed states and glowing ring) -->
        <div class="hud-ptt-wrapper">
          <button id="hud-ptt-btn" class="hud-ptt-btn" aria-label="Push to Talk">
            <div class="ptt-glow-ring"></div>
            <svg class="ptt-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>
          <div class="ptt-label">HOLD TO TALK</div>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private updateStatusPill() {
    const textEl = this.container.querySelector('#hud-status-text');
    const dotEl = this.container.querySelector('.status-dot');
    if (textEl) textEl.textContent = this.statusText;
    if (dotEl) {
      dotEl.className = `status-dot ${this.isConnected ? 'dot-online' : 'dot-offline'}`;
    }
  }

  private updatePowerButton() {
    const btn = this.container.querySelector('#hud-power-btn');
    if (btn) {
      if (this.isConnected) {
        btn.classList.add('btn-connected');
      } else {
        btn.classList.remove('btn-connected');
      }
    }
  }

  private updateSpeakerButton() {
    const icon = this.container.querySelector('#hud-speaker-icon');
    if (icon) {
      if (this.isMuted) {
        icon.innerHTML = `
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <line x1="23" y1="9" x2="17" y2="15"/>
          <line x1="17" y1="9" x2="23" y2="15"/>
        `;
      } else {
        icon.innerHTML = `
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
        `;
      }
    }
  }

  private attachEventListeners() {
    // Power button
    const powerBtn = this.container.querySelector('#hud-power-btn');
    if (powerBtn) {
      powerBtn.addEventListener('click', () => this.callbacks.onPowerToggle());
    }

    // Status pill
    const statusPill = this.container.querySelector('#hud-status-pill');
    if (statusPill) {
      statusPill.addEventListener('click', () => this.callbacks.onStatusClick());
    }

    // Speaker mute button
    const speakerBtn = this.container.querySelector('#hud-speaker-btn');
    if (speakerBtn) {
      speakerBtn.addEventListener('click', () => {
        this.isMuted = !this.isMuted;
        this.updateSpeakerButton();
        this.callbacks.onMuteToggle(this.isMuted);
      });
    }

    // Settings button
    const settingsBtn = this.container.querySelector('#hud-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.callbacks.onSettingsClick());
    }

    // Import VRM button
    const importVrmBtn = this.container.querySelector('#hud-import-vrm-btn');
    if (importVrmBtn) {
      importVrmBtn.addEventListener('click', () => this.callbacks.onImportVrmClick());
    }

    // Chat text input & send
    const textInput = this.container.querySelector('#hud-text-input') as HTMLInputElement;
    const sendBtn = this.container.querySelector('#hud-send-btn');

    const handleSend = () => {
      if (!textInput) return;
      const text = textInput.value.trim();
      if (text) {
        textInput.value = '';
        this.callbacks.onSendMessage(text);
      }
    };

    if (sendBtn) {
      sendBtn.addEventListener('click', handleSend);
    }
    if (textInput) {
      textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSend();
        }
      });
    }

    // Push-to-Talk button (Pointer events for mobile & desktop)
    const pttBtn = this.container.querySelector('#hud-ptt-btn') as HTMLElement;
    if (pttBtn) {
      const handlePressStart = (e: Event) => {
        e.preventDefault();
        pttBtn.classList.add('ptt-active');
        this.callbacks.onPttPressStart();
      };

      const handlePressEnd = (e: Event) => {
        e.preventDefault();
        pttBtn.classList.remove('ptt-active');
        this.callbacks.onPttPressEnd();
      };

      pttBtn.addEventListener('pointerdown', handlePressStart);
      window.addEventListener('pointerup', handlePressEnd);
      window.addEventListener('pointercancel', handlePressEnd);
    }
  }
}
