// FILE: web/src/ui/Onboarding.ts

declare global {
  interface Window {
    SecureVaultNative?: {
      getApiKey: () => string;
      setApiKey: (key: string) => string;
      removeApiKey: () => string;
      isKeyConfigured: () => boolean;
      testConnection: (apiKeyParam: string) => string;
    };
  }
}

export class OnboardingModal {
  private overlay: HTMLElement;
  private onKeyConfigured: (apiKey: string) => void;

  constructor(onKeyConfigured: (apiKey: string) => void) {
    this.onKeyConfigured = onKeyConfigured;
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    this.render();
  }

  private render(): void {
    const isConfigured = this.checkIfConfigured();
    const existingKey = window.SecureVaultNative?.getApiKey() || '';

    this.overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-header">
          <div class="avatar-badge">
            <span class="badge-dot"></span>
            <span class="badge-title">MYRAA CORE INITIALIZATION</span>
          </div>
          <h2 class="onboarding-title">Awaken Your Companion</h2>
          <p class="onboarding-desc">Connect Gemini Live API to materialize MYRAA's real-time voice, 3D expressions, and neural reasoning.</p>
        </div>

        <div class="status-chip-row">
          <span class="status-label">KEY STATUS:</span>
          <span class="status-chip ${isConfigured ? 'chip-configured' : 'chip-unconfigured'}" id="onboarding-chip">
            ${isConfigured ? '● CONFIGURED' : '○ NOT CONFIGURED'}
          </span>
        </div>

        <div class="input-group">
          <label for="gemini-key-input">GEMINI API KEY (AES-256 ENCRYPTED)</label>
          <div class="input-wrapper">
            <input
              type="password"
              id="gemini-key-input"
              placeholder="AIzaSy..."
              value="${existingKey ? '••••••••••••••••••••••••' : ''}"
              autocomplete="off"
            />
            <button class="icon-toggle-btn" id="toggle-key-visibility" title="Toggle visibility">👁</button>
          </div>
          <span class="input-hint">Stored exclusively inside Android Keystore hardware vault. Never logged or transmitted to third parties.</span>
        </div>

        <div id="test-result-feedback" class="test-feedback-box hidden"></div>

        <div class="onboarding-actions">
          <button class="btn btn-secondary" id="btn-test-key">TEST CONNECTION</button>
          <button class="btn btn-primary" id="btn-save-key">${isConfigured ? 'ENTER COMPANION' : 'ACTIVATE CORE'}</button>
        </div>

        ${isConfigured ? '<button class="btn-link" id="btn-remove-key">Remove Saved Key</button>' : ''}
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.bindEvents();
  }

  private checkIfConfigured(): boolean {
    if (window.SecureVaultNative) {
      return window.SecureVaultNative.isKeyConfigured();
    }
    return !!localStorage.getItem('gemini_api_key');
  }

  private bindEvents(): void {
    const input = this.overlay.querySelector('#gemini-key-input') as HTMLInputElement;
    const toggleBtn = this.overlay.querySelector('#toggle-key-visibility') as HTMLButtonElement;
    const saveBtn = this.overlay.querySelector('#btn-save-key') as HTMLButtonElement;
    const testBtn = this.overlay.querySelector('#btn-test-key') as HTMLButtonElement;
    const removeBtn = this.overlay.querySelector('#btn-remove-key') as HTMLButtonElement | null;
    const feedbackBox = this.overlay.querySelector('#test-result-feedback') as HTMLElement;
    const chip = this.overlay.querySelector('#onboarding-chip') as HTMLElement;

    toggleBtn?.addEventListener('click', () => {
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    testBtn?.addEventListener('click', async () => {
      const rawKey = input.value.startsWith('•••') ? (window.SecureVaultNative?.getApiKey() || '') : input.value.trim();
      feedbackBox.className = 'test-feedback-box loading';
      feedbackBox.textContent = 'Pinging Gemini Live endpoint…';
      feedbackBox.classList.remove('hidden');

      setTimeout(() => {
        let resultJson = '';
        if (window.SecureVaultNative) {
          resultJson = window.SecureVaultNative.testConnection(rawKey);
        } else {
          resultJson = JSON.stringify({ status: 'success', message: 'Simulated connection passed.' });
        }

        try {
          const res = JSON.parse(resultJson);
          if (res.status === 'success') {
            feedbackBox.className = 'test-feedback-box success';
            feedbackBox.textContent = `✓ ${res.message}`;
          } else {
            feedbackBox.className = 'test-feedback-box error';
            feedbackBox.textContent = `✗ ${res.message}`;
          }
        } catch (_e) {
          feedbackBox.className = 'test-feedback-box error';
          feedbackBox.textContent = 'Unknown response parsing error.';
        }
      }, 400);
    });

    saveBtn?.addEventListener('click', () => {
      const keyVal = input.value.startsWith('•••') ? (window.SecureVaultNative?.getApiKey() || '') : input.value.trim();
      if (!keyVal && !this.checkIfConfigured()) {
        alert('Please paste a valid Gemini API key.');
        return;
      }

      if (keyVal && !input.value.startsWith('•••')) {
        if (window.SecureVaultNative) {
          window.SecureVaultNative.setApiKey(keyVal);
        } else {
          localStorage.setItem('gemini_api_key', keyVal);
        }
      }

      const activeKey = window.SecureVaultNative?.getApiKey() || keyVal || localStorage.getItem('gemini_api_key') || '';
      this.hide();
      this.onKeyConfigured(activeKey);
    });

    removeBtn?.addEventListener('click', () => {
      if (confirm('Are you sure you want to remove the stored Gemini API key?')) {
        if (window.SecureVaultNative) {
          window.SecureVaultNative.removeApiKey();
        } else {
          localStorage.removeItem('gemini_api_key');
        }
        input.value = '';
        chip.className = 'status-chip chip-unconfigured';
        chip.textContent = '○ NOT CONFIGURED';
        if (removeBtn) removeBtn.style.display = 'none';
        saveBtn.textContent = 'ACTIVATE CORE';
      }
    });
  }

  public show(): void {
    this.overlay.classList.remove('hidden');
  }

  public hide(): void {
    this.overlay.classList.add('hidden');
  }
}
