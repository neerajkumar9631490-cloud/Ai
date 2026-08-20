// FILE: web/src/main.ts

import './styles.css';
import { CONFIG } from './config';
import { AvatarController } from './avatar/Avatar';
import { GeminiLiveSession } from './ai/GeminiLive';
import { HUD } from './ui/HUD';
import { SetupWizard } from './ui/SetupWizard';
import { SettingsModal } from './ui/Settings';
import { Toasts } from './ui/Toasts';

class MyraaApp {
  private avatar!: AvatarController;
  private liveSession!: GeminiLiveSession;
  private hud!: HUD;
  private wizard!: SetupWizard;
  private settingsModal!: SettingsModal;

  private micStream: MediaStream | null = null;
  private audioProcessor: ScriptProcessorNode | null = null;
  private audioInputContext: AudioContext | null = null;

  constructor() {
    this.init();
  }

  private async init() {
    // 1. Initialize Avatar 3D Scene
    this.avatar = new AvatarController('avatar-container');
    this.avatar.setStateListener((state) => {
      this.hud.setVrmMissingCardVisible(state.isHologram);
    });

    // 2. Initialize Gemini Live Session
    this.liveSession = new GeminiLiveSession({
      onAudioData: (pcm) => {
        // LipSync amplitude
        let sum = 0;
        for (let i = 0; i < pcm.length; i += 4) {
          sum += Math.abs(pcm[i]);
        }
        const avg = sum / (pcm.length / 4);
        this.avatar.setMouthOpen(avg * 4.5);
      },
      onTextDelta: (delta) => {
        // Subtitle rendering
        this.hud.setSubtitle(delta);
      },
      onTurnComplete: (fullText) => {
        this.hud.setSubtitle(fullText);
        setTimeout(() => {
          this.hud.setSubtitle('');
        }, 5000);
      },
      onStatusChange: (status, msg) => {
        const isConn = status === 'connected' || status === 'speaking';
        this.hud.setConnectionState(isConn, msg || status);
      },
      onError: (err) => {
        Toasts.error(err.message);
      }
    });

    // 3. Initialize HUD
    this.hud = new HUD('hud-overlay', {
      onPowerToggle: () => {
        if (this.liveSession.getIsConnected()) {
          this.liveSession.disconnect();
          Toasts.info('Neural Core Disconnected.');
        } else {
          this.connectOrOpenWizard();
        }
      },
      onStatusClick: () => {
        if (!this.liveSession.getIsConnected()) {
          this.wizard.show(1);
        } else {
          this.settingsModal.show('SYSTEM');
        }
      },
      onMuteToggle: (muted) => {
        this.liveSession.setMuted(muted);
        Toasts.info(muted ? 'Voice synthesis muted' : 'Voice synthesis active');
      },
      onSettingsClick: () => {
        this.settingsModal.show('GENERAL');
      },
      onSendMessage: (text) => {
        this.handleUserTextSend(text);
      },
      onPttPressStart: () => {
        this.startMicStreaming();
      },
      onPttPressEnd: () => {
        this.stopMicStreaming();
      },
      onImportVrmClick: () => {
        this.settingsModal.show('CHARACTER');
      }
    });

    // 4. Initialize Setup Wizard
    this.wizard = new SetupWizard({
      onApiKeySaved: async (key) => {
        return this.liveSession.connect(key);
      },
      onVrmUploaded: async (file) => {
        return this.avatar.loadVrmFromFile(file);
      },
      onRequestAudioPermission: async () => {
        return this.requestMicrophoneAccess();
      },
      onTestTurn: (text) => {
        this.handleUserTextSend(text);
      },
      onComplete: () => {
        Toasts.success(`${CONFIG.appName} is ready to converse!`);
      }
    });

    // 5. Initialize Settings Modal
    this.settingsModal = new SettingsModal({
      onApiKeyUpdated: async (key) => {
        return this.liveSession.connect(key);
      },
      onVoiceChanged: (_voice) => {
        if (this.liveSession.getIsConnected()) {
          const key = localStorage.getItem('myraa_gemini_api_key') || '';
          this.liveSession.connect(key);
        }
      },
      onWakePhraseChanged: (phrase) => {
        Toasts.info(`Wake phrase set to "${phrase}"`);
      },
      onWakeServiceToggled: (enabled) => {
        const native = (window as any).WakeWordNative;
        if (native) {
          if (enabled) {
            native.startWakeService(CONFIG.wakePhrase);
          } else {
            native.stopWakeService();
          }
        }
      },
      onVrmFileSelected: async (file) => {
        return this.avatar.loadVrmFromFile(file);
      },
      onResetToHologram: () => {
        this.avatar.resetPose();
      },
      onOpenWizard: () => {
        this.wizard.show(1);
      }
    });

    // 6. Check Initial Onboarding
    const savedApiKey = localStorage.getItem('myraa_gemini_api_key') || '';
    if (!savedApiKey) {
      // D6: Auto-show Setup Wizard on boot
      this.wizard.show(1);
    } else {
      this.liveSession.connect(savedApiKey);
    }

    // 7. Global Bridge Event Hooks
    (window as any).onWakeWordTriggered = () => {
      Toasts.info('Wake phrase detected: Hey MYRAA!');
      this.startMicStreaming();
    };

    (window as any).onNativePermissionsResult = (perm: string, granted: boolean) => {
      if (granted) {
        Toasts.success(`Permission granted for ${perm}`);
      } else {
        Toasts.warning(`Permission not granted for ${perm}`);
      }
    };
  }

  private connectOrOpenWizard() {
    const savedApiKey = localStorage.getItem('myraa_gemini_api_key') || '';
    if (!savedApiKey) {
      this.wizard.show(1);
    } else {
      this.liveSession.connect(savedApiKey);
    }
  }

  private async handleUserTextSend(text: string) {
    const savedApiKey = localStorage.getItem('myraa_gemini_api_key') || '';
    if (!savedApiKey) {
      Toasts.warning('Please configure your Gemini API Key in Setup Wizard.');
      this.wizard.show(1);
      return;
    }

    if (!this.liveSession.getIsConnected()) {
      Toasts.info('Connecting to Gemini Live…');
      const ok = await this.liveSession.connect(savedApiKey);
      if (!ok) {
        Toasts.error('Failed to link Neural Core. Please verify your API key.');
        return;
      }
    }

    this.hud.setSubtitle(`You: ${text}`);
    this.liveSession.sendTextMessage(text);
  }

  private async requestMicrophoneAccess(): Promise<boolean> {
    try {
      const native = (window as any).SystemBridgeNative;
      if (native && native.requestAudioPermission) {
        native.requestAudioPermission();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      Toasts.success('Microphone access granted.');
      return true;
    } catch (e: any) {
      Toasts.error(`Microphone permission error: ${e.message}`);
      return false;
    }
  }

  private async startMicStreaming() {
    try {
      if (!this.liveSession.getIsConnected()) {
        const key = localStorage.getItem('myraa_gemini_api_key') || '';
        if (!key) {
          this.wizard.show(1);
          return;
        }
        await this.liveSession.connect(key);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });

      this.micStream = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioInputContext = new AudioCtx({ sampleRate: 16000 });
      const source = this.audioInputContext.createMediaStreamSource(stream);

      this.audioProcessor = this.audioInputContext.createScriptProcessor(4096, 1, 1);
      source.connect(this.audioProcessor);
      this.audioProcessor.connect(this.audioInputContext.destination);

      this.audioProcessor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32Array to 16-bit PCM Base64
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const uint8 = new Uint8Array(pcm16.buffer);
        let binary = '';
        for (let i = 0; i < uint8.byteLength; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const b64 = btoa(binary);
        this.liveSession.sendRealtimeAudioChunk(b64);
      };

      this.hud.setStatus('Streaming Mic (16kHz)…');
    } catch (e: any) {
      Toasts.error(`Failed to capture audio: ${e.message}`);
    }
  }

  private stopMicStreaming() {
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }
    if (this.audioInputContext) {
      try { this.audioInputContext.close(); } catch (_e) {}
      this.audioInputContext = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    this.hud.setStatus('Core Synchronized');
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  new MyraaApp();
});
