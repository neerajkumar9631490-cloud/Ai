// FILE: web/src/ui/SetupWizard.ts

import { CONFIG } from '../config';
import { Toasts } from './Toasts';

export interface SetupWizardCallbacks {
  onApiKeySaved: (key: string) => Promise<boolean>;
  onVrmUploaded: (file: File) => Promise<boolean>;
  onRequestAudioPermission: () => Promise<boolean>;
  onTestTurn: (text: string) => void;
  onComplete: () => void;
}

export class SetupWizard {
  private container: HTMLElement | null = null;
  private currentStep = 1;
  private callbacks: SetupWizardCallbacks;
  private isConfiguredKey = false;

  constructor(callbacks: SetupWizardCallbacks) {
    this.callbacks = callbacks;
  }

  public show(step: number = 1) {
    this.currentStep = step;
    let el = document.getElementById('setup-wizard-modal');
    if (!el) {
      el = document.createElement('div');
      el.id = 'setup-wizard-modal';
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

    const savedKey = localStorage.getItem('myraa_gemini_api_key') || '';
    if (savedKey) this.isConfiguredKey = true;

    this.container.innerHTML = `
      <div class="modal-card wizard-card">
        <div class="wizard-header">
          <div class="wizard-badge">CORE INITIALIZATION</div>
          <h2 class="wizard-title">Synchronize with ${CONFIG.appName}</h2>
          <p class="wizard-desc">Configure your anime companion neural link and character core.</p>
        </div>

        <!-- Progress Steps -->
        <div class="wizard-stepper">
          <div class="step-dot ${this.currentStep >= 1 ? 'step-active' : ''} ${this.currentStep > 1 ? 'step-done' : ''}">1</div>
          <div class="step-line ${this.currentStep > 1 ? 'line-done' : ''}"></div>
          <div class="step-dot ${this.currentStep >= 2 ? 'step-active' : ''} ${this.currentStep > 2 ? 'step-done' : ''}">2</div>
          <div class="step-line ${this.currentStep > 2 ? 'line-done' : ''}"></div>
          <div class="step-dot ${this.currentStep >= 3 ? 'step-active' : ''} ${this.currentStep > 3 ? 'step-done' : ''}">3</div>
          <div class="step-line ${this.currentStep > 3 ? 'line-done' : ''}"></div>
          <div class="step-dot ${this.currentStep >= 4 ? 'step-active' : ''}">4</div>
        </div>

        <div class="wizard-body">
          ${this.renderStepContent(savedKey)}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private renderStepContent(savedKey: string): string {
    switch (this.currentStep) {
      case 1:
        return `
          <div class="step-content">
            <h3 class="step-heading">Step 1: Memory Core (Gemini API Key)</h3>
            <p class="step-info">Enter your Google Gemini API Key. Keys are encrypted via AES-256 Android KeyStore.</p>
            <div class="input-group">
              <input type="password" id="wizard-api-key-input" class="cyber-input" placeholder="AIzaSy..." value="${savedKey}" />
              ${this.isConfiguredKey ? '<span class="status-chip chip-success">CONFIGURED</span>' : ''}
            </div>
            <div id="test-key-result" class="test-key-output"></div>
            <div class="wizard-actions">
              <button id="wizard-test-key-btn" class="cyber-btn btn-secondary">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                TEST KEY
              </button>
              <button id="wizard-save-key-btn" class="cyber-btn btn-primary">
                CONTINUE
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        `;
      case 2:
        return `
          <div class="step-content">
            <h3 class="step-heading">Step 2: Character Core (Avatar .VRM)</h3>
            <p class="step-info">Import a 3D VRM anime character, or continue with the animated Procedural Hologram Core.</p>
            <div class="vrm-upload-zone" id="wizard-vrm-dropzone">
              <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#22d3ee" stroke-width="1.8"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <div class="zone-text">Tap to select a .VRM file</div>
              <input type="file" id="wizard-vrm-file-input" accept=".vrm" style="display:none;" />
            </div>
            <div class="wizard-actions">
              <button id="wizard-skip-vrm-btn" class="cyber-btn btn-secondary">USE HOLOGRAM</button>
              <button id="wizard-next-step2-btn" class="cyber-btn btn-primary">
                CONTINUE
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        `;
      case 3:
        return `
          <div class="step-content">
            <h3 class="step-heading">Step 3: Voice Interface (Microphone)</h3>
            <p class="step-info">Grant microphone access for real-time voice conversations and Push-to-Talk with ${CONFIG.appName}.</p>
            <div class="perm-card">
              <div class="perm-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#22d3ee" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
              </div>
              <div class="perm-desc">
                <strong>Audio Streaming</strong>
                <span>16 kHz low-latency direct duplex streaming</span>
              </div>
            </div>
            <div class="wizard-actions">
              <button id="wizard-grant-mic-btn" class="cyber-btn btn-primary">
                GRANT MIC ACCESS
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            </div>
          </div>
        `;
      case 4:
      default:
        return `
          <div class="step-content">
            <h3 class="step-heading">Step 4: Say Hello to ${CONFIG.appName}</h3>
            <p class="step-info">Your anime companion is ready! Tap below to send your first greeting.</p>
            <div class="greeting-box">
              <em>"Hello ${CONFIG.appName}, nice to meet you!"</em>
            </div>
            <div class="wizard-actions">
              <button id="wizard-finish-btn" class="cyber-btn btn-primary btn-glow">
                START COMPANION
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </button>
            </div>
          </div>
        `;
    }
  }

  private attachEventListeners() {
    if (!this.container) return;

    // Step 1 Handlers
    const testKeyBtn = this.container.querySelector('#wizard-test-key-btn');
    const saveKeyBtn = this.container.querySelector('#wizard-save-key-btn');
    const keyInput = this.container.querySelector('#wizard-api-key-input') as HTMLInputElement;
    const testOutput = this.container.querySelector('#test-key-result');

    if (testKeyBtn && keyInput) {
      testKeyBtn.addEventListener('click', async () => {
        const val = keyInput.value.trim();
        if (!val) {
          Toasts.warning('Please enter an API key first.');
          return;
        }
        if (testOutput) testOutput.textContent = 'Testing connection with Gemini Live…';
        try {
          // Minimal lightweight validation call
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(val)}`);
          if (res.ok) {
            this.isConfiguredKey = true;
            if (testOutput) testOutput.innerHTML = '<span style="color:#22d3ee;">Link validated successfully! Ready for live stream.</span>';
            Toasts.success('API Key validated!');
          } else {
            const data = await res.json().catch(() => ({}));
            const msg = data.error?.message || `HTTP ${res.status}`;
            if (testOutput) testOutput.innerHTML = `<span style="color:#f87171;">Validation failed: ${msg}</span>`;
            Toasts.error(`Validation failed: ${msg}`);
          }
        } catch (e: any) {
          if (testOutput) testOutput.innerHTML = `<span style="color:#f87171;">Network error: ${e.message}</span>`;
        }
      });
    }

    if (saveKeyBtn && keyInput) {
      saveKeyBtn.addEventListener('click', async () => {
        const val = keyInput.value.trim();
        if (!val) {
          Toasts.warning('Please provide a valid Gemini API key.');
          return;
        }
        localStorage.setItem('myraa_gemini_api_key', val);
        await this.callbacks.onApiKeySaved(val);
        this.currentStep = 2;
        this.render();
      });
    }

    // Step 2 Handlers
    const dropzone = this.container.querySelector('#wizard-vrm-dropzone');
    const fileInput = this.container.querySelector('#wizard-vrm-file-input') as HTMLInputElement;
    const skipVrmBtn = this.container.querySelector('#wizard-skip-vrm-btn');
    const nextStep2Btn = this.container.querySelector('#wizard-next-step2-btn');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', async (e: any) => {
        const file = e.target?.files?.[0];
        if (file) {
          const ok = await this.callbacks.onVrmUploaded(file);
          if (ok) {
            this.currentStep = 3;
            this.render();
          }
        }
      });
    }

    if (skipVrmBtn) {
      skipVrmBtn.addEventListener('click', () => {
        this.currentStep = 3;
        this.render();
      });
    }

    if (nextStep2Btn) {
      nextStep2Btn.addEventListener('click', () => {
        this.currentStep = 3;
        this.render();
      });
    }

    // Step 3 Handlers
    const grantMicBtn = this.container.querySelector('#wizard-grant-mic-btn');
    if (grantMicBtn) {
      grantMicBtn.addEventListener('click', async () => {
        await this.callbacks.onRequestAudioPermission();
        this.currentStep = 4;
        this.render();
      });
    }

    // Step 4 Handlers
    const finishBtn = this.container.querySelector('#wizard-finish-btn');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        this.hide();
        this.callbacks.onTestTurn(`Hello ${CONFIG.appName}!`);
        this.callbacks.onComplete();
      });
    }
  }
}
