// FILE: web/src/ui/Settings.ts

import { CONFIG } from '../config';
import { Toasts } from './Toasts';

export interface SettingsCallbacks {
  onApiKeyUpdated: (key: string) => Promise<boolean>;
  onVoiceChanged: (voice: string) => void;
  onWakePhraseChanged: (phrase: string) => void;
  onWakeServiceToggled: (enabled: boolean) => void;
  onVrmFileSelected: (file: File) => Promise<boolean>;
  onResetToHologram: () => void;
  onOpenWizard: () => void;
}

export class SettingsModal {
  private container: HTMLElement | null = null;
  private currentTab = 'GENERAL';
  private callbacks: SettingsCallbacks;
  private isWakeServiceEnabled = false;

  constructor(callbacks: SettingsCallbacks) {
    this.callbacks = callbacks;
  }

  public show(tab: string = 'GENERAL') {
    this.currentTab = tab;
    let el = document.getElementById('settings-modal-backdrop');
    if (!el) {
      el = document.createElement('div');
      el.id = 'settings-modal-backdrop';
      el.className = 'modal-backdrop';
      document.body.appendChild(el);
    }
    this.container = el;
    this.render();
    this.container.classList.add('modal-visible');
  }

  public hide() {
    if (this.container) {
      this.container.classList.remove('modal-visible');
    }
  }

  public isOpen(): boolean {
    return !!this.container && this.container.classList.contains('modal-visible');
  }

  private render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="modal-card settings-card">
        <!-- Settings Header -->
        <div class="settings-header">
          <div class="settings-title-group">
            <h2 class="settings-title">${CONFIG.appName} CONTROL DECK</h2>
            <div class="settings-subtitle">Neural Engine & Platform Diagnostics</div>
          </div>
          <button id="settings-close-btn" class="hud-circle-btn" aria-label="Close Settings">
            <svg class="hud-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- 5 Tabs Navigation -->
        <div class="settings-tabs">
          <button class="tab-btn ${this.currentTab === 'GENERAL' ? 'tab-active' : ''}" data-tab="GENERAL">GENERAL</button>
          <button class="tab-btn ${this.currentTab === 'CHARACTER' ? 'tab-active' : ''}" data-tab="CHARACTER">CHARACTER</button>
          <button class="tab-btn ${this.currentTab === 'VOICE' ? 'tab-active' : ''}" data-tab="VOICE">VOICE</button>
          <button class="tab-btn ${this.currentTab === 'SYSTEM' ? 'tab-active' : ''}" data-tab="SYSTEM">SYSTEM</button>
          <button class="tab-btn ${this.currentTab === 'ABOUT' ? 'tab-active' : ''}" data-tab="ABOUT">ABOUT</button>
        </div>

        <!-- Tab Content Area -->
        <div class="settings-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderTabContent(): string {
    const savedKey = localStorage.getItem('myraa_gemini_api_key') || '';
    const maskedKey = savedKey ? `${savedKey.slice(0, 6)}••••••••${savedKey.slice(-4)}` : 'Not Configured';

    switch (this.currentTab) {
      case 'GENERAL':
        return `
          <div class="tab-pane">
            <div class="settings-section">
              <label class="section-label">MEMORY CORE (GEMINI API KEY)</label>
              <div class="input-row">
                <input type="password" id="settings-key-input" class="cyber-input" placeholder="AIzaSy..." value="${savedKey}" />
                <button id="settings-save-key-btn" class="cyber-btn btn-primary">UPDATE</button>
              </div>
              <div class="field-hint">Current Vault Status: <span class="chip-success">${maskedKey}</span></div>
            </div>

            <div class="settings-section">
              <label class="section-label">PARTNER NICKNAME</label>
              <input type="text" id="settings-nickname-input" class="cyber-input" value="${CONFIG.nickname}" />
              <div class="field-hint">Name ${CONFIG.appName} will use when addressing you.</div>
            </div>

            <div class="settings-section">
              <label class="section-label">FIRST-RUN WIZARD</label>
              <button id="settings-open-wizard-btn" class="cyber-btn btn-secondary">
                RE-RUN SETUP WIZARD
              </button>
            </div>
          </div>
        `;

      case 'CHARACTER':
        const hasCustomVrm = !!localStorage.getItem('myraa_custom_vrm_url');
        return `
          <div class="tab-pane">
            <div class="settings-section">
              <label class="section-label">ACTIVE 3D AVATAR CORE</label>
              <div class="vrm-status-box">
                <div class="vrm-status-label">${hasCustomVrm ? 'Custom User VRM Loaded' : 'Procedural Hologram Silhouette'}</div>
                <div class="vrm-status-actions">
                  <input type="file" id="settings-vrm-input" accept=".vrm" style="display:none;" />
                  <button id="settings-import-vrm-btn" class="cyber-btn btn-primary">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    IMPORT .VRM
                  </button>
                  <button id="settings-reset-hologram-btn" class="cyber-btn btn-secondary">USE HOLOGRAM</button>
                </div>
              </div>
            </div>

            <div class="settings-section">
              <label class="section-label">RENDERING PRESETS</label>
              <div class="toggle-row">
                <span>Particle Starfield Glow</span>
                <input type="checkbox" id="settings-starfield-chk" checked />
              </div>
              <div class="toggle-row">
                <span>Cyberpunk Dual Rim Lights</span>
                <input type="checkbox" id="settings-rimlights-chk" checked />
              </div>
            </div>
          </div>
        `;

      case 'VOICE':
        return `
          <div class="tab-pane">
            <div class="settings-section">
              <label class="section-label">SYNTHETIC VOICE PROFILE</label>
              <select id="settings-voice-select" class="cyber-select">
                <option value="Leda" ${CONFIG.voice === 'Leda' ? 'selected' : ''}>Leda (Affectionate & Youthful - Recommended)</option>
                <option value="Aoede" ${CONFIG.voice === 'Aoede' ? 'selected' : ''}>Aoede (Confident & Clear)</option>
                <option value="Kore" ${CONFIG.voice === 'Kore' ? 'selected' : ''}>Kore (Soft & Melodic)</option>
                <option value="Puck" ${CONFIG.voice === 'Puck' ? 'selected' : ''}>Puck (Playful & Energetic)</option>
                <option value="Fenrir" ${CONFIG.voice === 'Fenrir' ? 'selected' : ''}>Fenrir (Deeper Tone)</option>
              </select>
            </div>

            <div class="settings-section">
              <label class="section-label">WAKE PHRASE ACTIVATION</label>
              <input type="text" id="settings-wake-phrase-input" class="cyber-input" value="${CONFIG.wakePhrase}" />
              <div class="toggle-row" style="margin-top: 10px;">
                <span>Background Wake Word Service</span>
                <input type="checkbox" id="settings-wake-service-chk" ${this.isWakeServiceEnabled ? 'checked' : ''} />
              </div>
            </div>
          </div>
        `;

      case 'SYSTEM':
        let capListHtml = `
          <ul class="cap-list">
            <li>open_app — Launch any Android application</li>
            <li>set_alarm — Schedule Android alarm clock</li>
            <li>set_timer — Configure device countdown timers</li>
            <li>set_torch — Toggle device LED flashlight</li>
            <li>set_volume — Manage audio stream volume</li>
            <li>prepare_sms — Draft SMS messages to phone numbers</li>
            <li>open_whatsapp_to — Direct WhatsApp message trigger</li>
            <li>open_maps — Geographic maps & navigation search</li>
            <li>web_search — System Google/browser search queries</li>
            <li>take_photo — Camera capture trigger</li>
            <li>open_settings — Open Android system settings</li>
          </ul>
        `;
        return `
          <div class="tab-pane">
            <div class="settings-section">
              <label class="section-label">ACTION BRIDGE CAPABILITIES (11 / 11 ONLINE)</label>
              <div class="cap-box">${capListHtml}</div>
            </div>
            <div class="settings-section">
              <label class="section-label">NATIVE HARDWARE ACCESS</label>
              <div class="status-chip chip-success">HARDWARE ACCELERATION: ACTIVE</div>
              <div class="status-chip chip-success">WEBSOCKET DUPLEX: 16k PCM</div>
            </div>
          </div>
        `;

      case 'ABOUT':
      default:
        const logs = Toasts.getLogs();
        const logItemsHtml = logs.length > 0
          ? logs.map(l => `<div class="log-line log-${l.level}">[${l.timestamp}] ${l.message}</div>`).join('')
          : '<div class="log-line log-info">No recent diagnostic events recorded.</div>';

        return `
          <div class="tab-pane">
            <div class="about-card">
              <div class="about-logo">${CONFIG.appName}</div>
              <div class="about-version">VERSION ${CONFIG.version} (RELEASE)</div>
              <p class="about-desc">Autonomous 3D Anime AI Companion with Real-time Multimodal Live Audio Duplex.</p>
            </div>

            <!-- Debug Console (D9: Last 30 log lines + copy button) -->
            <div class="settings-section debug-console-section">
              <div class="debug-header">
                <label class="section-label">DIAGNOSTIC DEBUG CONSOLE</label>
                <button id="settings-copy-logs-btn" class="cyber-btn btn-xs btn-secondary">
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  COPY LOGS
                </button>
              </div>
              <div class="debug-terminal" id="debug-log-terminal">
                ${logItemsHtml}
              </div>
            </div>
          </div>
        `;
    }
  }

  private attachEventListeners() {
    if (!this.container) return;

    // Close button
    const closeBtn = this.container.querySelector('#settings-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hide());
    }

    // Tabs switching
    const tabButtons = this.container.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
      btn.addEventListener('click', (e: any) => {
        const tab = e.target.getAttribute('data-tab');
        if (tab) {
          this.currentTab = tab;
          this.render();
        }
      });
    });

    // GENERAL Tab
    const saveKeyBtn = this.container.querySelector('#settings-save-key-btn');
    const keyInput = this.container.querySelector('#settings-key-input') as HTMLInputElement;
    if (saveKeyBtn && keyInput) {
      saveKeyBtn.addEventListener('click', async () => {
        const val = keyInput.value.trim();
        if (val) {
          localStorage.setItem('myraa_gemini_api_key', val);
          await this.callbacks.onApiKeyUpdated(val);
          Toasts.success('API Key updated in KeyStore.');
          this.render();
        }
      });
    }

    const openWizardBtn = this.container.querySelector('#settings-open-wizard-btn');
    if (openWizardBtn) {
      openWizardBtn.addEventListener('click', () => {
        this.hide();
        this.callbacks.onOpenWizard();
      });
    }

    // CHARACTER Tab
    const importVrmBtn = this.container.querySelector('#settings-import-vrm-btn');
    const vrmInput = this.container.querySelector('#settings-vrm-input') as HTMLInputElement;
    const resetHologramBtn = this.container.querySelector('#settings-reset-hologram-btn');

    if (importVrmBtn && vrmInput) {
      importVrmBtn.addEventListener('click', () => vrmInput.click());
      vrmInput.addEventListener('change', async (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          await this.callbacks.onVrmFileSelected(file);
          this.render();
        }
      });
    }

    if (resetHologramBtn) {
      resetHologramBtn.addEventListener('click', () => {
        localStorage.removeItem('myraa_custom_vrm_url');
        this.callbacks.onResetToHologram();
        Toasts.info('Avatar set to Procedural Hologram Core.');
        this.render();
      });
    }

    // VOICE Tab
    const voiceSelect = this.container.querySelector('#settings-voice-select') as HTMLSelectElement;
    if (voiceSelect) {
      voiceSelect.addEventListener('change', () => {
        CONFIG.voice = voiceSelect.value;
        this.callbacks.onVoiceChanged(voiceSelect.value);
        Toasts.info(`Voice profile set to ${voiceSelect.value}`);
      });
    }

    const wakePhraseInput = this.container.querySelector('#settings-wake-phrase-input') as HTMLInputElement;
    if (wakePhraseInput) {
      wakePhraseInput.addEventListener('change', () => {
        CONFIG.wakePhrase = wakePhraseInput.value.trim();
        this.callbacks.onWakePhraseChanged(CONFIG.wakePhrase);
      });
    }

    const wakeServiceChk = this.container.querySelector('#settings-wake-service-chk') as HTMLInputElement;
    if (wakeServiceChk) {
      wakeServiceChk.addEventListener('change', () => {
        this.isWakeServiceEnabled = wakeServiceChk.checked;
        this.callbacks.onWakeServiceToggled(this.isWakeServiceEnabled);
        Toasts.info(`Wake Word service ${this.isWakeServiceEnabled ? 'Activated' : 'Deactivated'}`);
      });
    }

    // ABOUT Tab - Copy Logs
    const copyLogsBtn = this.container.querySelector('#settings-copy-logs-btn');
    if (copyLogsBtn) {
      copyLogsBtn.addEventListener('click', () => {
        const logsText = Toasts.getLogs().map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
        navigator.clipboard.writeText(logsText);
        Toasts.success('Diagnostic logs copied to clipboard.');
      });
    }
  }
}
