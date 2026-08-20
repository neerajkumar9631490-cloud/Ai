// FILE: web/src/avatar/Avatar.ts

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRM, VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { Toasts } from '../ui/Toasts';

export interface AvatarState {
  isVrmLoaded: boolean;
  isHologram: boolean;
  modelName: string;
}

export class AvatarController {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock: THREE.Clock;

  // VRM Character
  private currentVrm: VRM | null = null;

  // Hologram Fallback
  private hologramGroup: THREE.Group | null = null;
  private hologramPoints: THREE.Points | null = null;
  private hologramWireframe: THREE.LineSegments | null = null;
  private starfield: THREE.Points | null = null;

  // Gesture Controls
  private isDragging = false;
  private prevTouch = { x: 0, y: 0 };
  private targetRotY = 0;
  private currentRotY = 0;
  private zoomLevel = 1.0;
  private defaultCamPos = new THREE.Vector3(0, 1.35, 1.15);

  // Blendshapes & LipSync
  private mouthOpenTarget = 0;
  private currentMouthOpen = 0;
  private currentEmotion: string = 'neutral';
  private blinkTimer = 0;
  private isBlinking = false;

  private onStateChangeCb: ((state: AvatarState) => void) | null = null;

  constructor(containerId: string) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    this.container = el;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0f14);

    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 50);
    this.camera.position.copy(this.defaultCamPos);
    this.camera.lookAt(0, 1.3, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2.0));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    this.clock = new THREE.Clock();

    this.setupLighting();
    this.setupStarfield();
    this.setupFallbackHologram();
    this.setupGestures();

    // Try to load saved VRM model or fallback
    this.loadSavedOrDefaultModel();

    this.animate();
  }

  public setStateListener(cb: (state: AvatarState) => void) {
    this.onStateChangeCb = cb;
    this.notifyState();
  }

  private notifyState() {
    if (this.onStateChangeCb) {
      this.onStateChangeCb({
        isVrmLoaded: !!this.currentVrm,
        isHologram: !this.currentVrm,
        modelName: this.currentVrm ? 'VRM Character' : 'Procedural Hologram Core'
      });
    }
  }

  private setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambient);

    // Key Light
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.4);
    keyLight.position.set(1.5, 3.0, 2.0);
    this.scene.add(keyLight);

    // Dark-Cinematic Neon Rim Lights (Cyan #22d3ee & Violet #7c3aed)
    const cyanRim = new THREE.DirectionalLight(0x22d3ee, 1.8);
    cyanRim.position.set(-2.5, 1.5, -1.5);
    this.scene.add(cyanRim);

    const violetRim = new THREE.DirectionalLight(0x7c3aed, 1.6);
    violetRim.position.set(2.5, 1.0, -1.5);
    this.scene.add(violetRim);
  }

  private setupStarfield() {
    const count = 300;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const colorA = new THREE.Color(0x22d3ee);
    const colorB = new THREE.Color(0x7c3aed);
    const colorC = new THREE.Color(0xffffff);

    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1.5;

      const pick = Math.random();
      const c = pick < 0.45 ? colorA : pick < 0.85 ? colorB : colorC;
      col[i * 3 + 0] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.04,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending
    });

    this.starfield = new THREE.Points(geo, mat);
    this.scene.add(this.starfield);
  }

  /**
   * Procedural Fallback Hologram (D2: Screen is NEVER empty)
   */
  private setupFallbackHologram() {
    this.hologramGroup = new THREE.Group();

    // 1. Hologram Particle Silhouette
    const particleCount = 600;
    const pos = new Float32Array(particleCount * 3);
    const col = new Float32Array(particleCount * 3);
    const cyan = new THREE.Color(0x22d3ee);
    const violet = new THREE.Color(0x7c3aed);

    for (let i = 0; i < particleCount; i++) {
      // Humanoid point distribution
      let x = 0, y = 0, z = 0;
      if (i < 200) {
        // Head sphere
        const u = Math.random();
        const v = Math.random();
        const theta = u * 2.0 * Math.PI;
        const phi = Math.acos(2.0 * v - 1.0);
        const r = 0.22 * Math.cbrt(Math.random());
        x = r * Math.sin(phi) * Math.cos(theta);
        y = 1.38 + r * Math.sin(phi) * Math.sin(theta);
        z = r * Math.cos(phi);
      } else if (i < 450) {
        // Torso / shoulders
        const t = Math.random();
        y = 0.85 + t * 0.45;
        const width = 0.18 * (1.0 - t * 0.35);
        x = (Math.random() - 0.5) * width * 2;
        z = (Math.random() - 0.5) * 0.15;
      } else {
        // Anime energy ring / halo
        const angle = Math.random() * Math.PI * 2;
        const radius = 0.35 + Math.random() * 0.05;
        x = Math.cos(angle) * radius;
        y = 1.25 + Math.sin(angle) * 0.05;
        z = Math.sin(angle) * radius * 0.5;
      }

      pos[i * 3 + 0] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      const c = Math.random() > 0.5 ? cyan : violet;
      col[i * 3 + 0] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const pMat = new THREE.PointsMaterial({
      size: 0.035,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending
    });

    this.hologramPoints = new THREE.Points(pGeo, pMat);
    this.hologramGroup.add(this.hologramPoints);

    // 2. Wireframe Torso Core
    const coreGeo = new THREE.IcosahedronGeometry(0.18, 2);
    const wireGeo = new THREE.WireframeGeometry(coreGeo);
    const wireMat = new THREE.LineBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    this.hologramWireframe = new THREE.LineSegments(wireGeo, wireMat);
    this.hologramWireframe.position.set(0, 1.38, 0);
    this.hologramGroup.add(this.hologramWireframe);

    this.scene.add(this.hologramGroup);
  }

  private async loadSavedOrDefaultModel() {
    const savedVrmUrl = localStorage.getItem('myraa_custom_vrm_url');
    if (savedVrmUrl) {
      const success = await this.loadVrmFromUrl(savedVrmUrl);
      if (success) return;
    }

    // Attempt to load standard bundled model path in public assets
    const defaultPath = 'https://appassets.androidplatform.net/assets/public/models/character.vrm';
    try {
      await this.loadVrmFromUrl(defaultPath, true);
    } catch (_e) {
      // Expected fallback to hologram
    }
  }

  public async loadVrmFromUrl(url: string, silent: boolean = false): Promise<boolean> {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMLoaderPlugin(parser));

    try {
      if (!silent) Toasts.info('Materializing VRM Character Core…');

      const gltf = await new Promise<any>((resolve, reject) => {
        loader.load(
          url,
          (gltf) => resolve(gltf),
          undefined,
          (err) => reject(err)
        );
      });

      const vrm: VRM = gltf.userData.vrm;
      if (!vrm) throw new Error('GLTF data does not contain a valid VRM instance');

      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.removeUnnecessaryJoints(gltf.scene);
      vrm.scene.rotation.y = Math.PI;

      // Remove existing VRM
      if (this.currentVrm) {
        this.scene.remove(this.currentVrm.scene);
        VRMUtils.deepDispose(this.currentVrm.scene);
        this.currentVrm = null;
      }

      this.currentVrm = vrm;
      this.scene.add(vrm.scene);

      // Hide hologram
      if (this.hologramGroup) {
        this.hologramGroup.visible = false;
      }

      this.notifyState();
      Toasts.success('VRM Character loaded successfully!');
      return true;
    } catch (err: any) {
      console.warn('VRM load notice:', err.message || err);
      if (!silent) {
        Toasts.warning(`VRM model not found. Hologram Core active.`);
      }
      // Ensure Hologram remains visible
      if (this.hologramGroup) {
        this.hologramGroup.visible = true;
      }
      this.notifyState();
      return false;
    }
  }

  public async loadVrmFromFile(file: File): Promise<boolean> {
    const blobUrl = URL.createObjectURL(file);
    const ok = await this.loadVrmFromUrl(blobUrl);
    if (ok) {
      // Save data URI or blob reference
      try {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            if (typeof reader.result === 'string') {
              localStorage.setItem('myraa_custom_vrm_url', reader.result);
            }
          } catch (_e) {
            // Storage quota exceeded fallback
          }
        };
        reader.readAsDataURL(file);
      } catch (_e) {}
    }
    return ok;
  }

  private setupGestures() {
    this.container.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.prevTouch = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointermove', (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevTouch.x;
      this.targetRotY += dx * 0.008;
      this.prevTouch = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('pointerup', () => { this.isDragging = false; });
    window.addEventListener('pointercancel', () => { this.isDragging = false; });

    // Wheel / Pinch Zoom
    this.container.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY * 0.001;
      this.setZoom(this.zoomLevel + delta);
    }, { passive: false });

    // Double tap reset
    let lastTap = 0;
    this.container.addEventListener('pointerdown', () => {
      const now = Date.now();
      if (now - lastTap < 300) {
        this.resetPose();
      }
      lastTap = now;
    });

    window.addEventListener('resize', () => {
      const nw = this.container.clientWidth || window.innerWidth;
      const nh = this.container.clientHeight || window.innerHeight;
      this.camera.aspect = nw / nh;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(nw, nh);
    });
  }

  public setZoom(level: number) {
    this.zoomLevel = THREE.MathUtils.clamp(level, 0.6, 2.5);
    this.camera.position.z = this.defaultCamPos.z / this.zoomLevel;
    this.camera.position.y = this.defaultCamPos.y + (1.0 - this.zoomLevel) * 0.15;
  }

  public resetPose() {
    this.targetRotY = 0;
    this.currentRotY = 0;
    this.setZoom(1.0);
    Toasts.info('Camera view reset.');
  }

  public setMouthOpen(target: number) {
    this.mouthOpenTarget = THREE.MathUtils.clamp(target, 0, 1.0);
  }

  public setEmotion(emotion: string) {
    this.currentEmotion = emotion.toLowerCase();
  }

  private animate = () => {
    requestAnimationFrame(this.animate);
    const delta = Math.min(0.1, this.clock.getDelta());
    const elapsed = this.clock.getElapsedTime();

    // Smooth rotation lerp
    this.currentRotY += (this.targetRotY - this.currentRotY) * Math.min(1.0, delta * 12.0);

    // 1. VRM Character Updates
    if (this.currentVrm) {
      this.currentVrm.scene.rotation.y = Math.PI + this.currentRotY;
      this.currentVrm.scene.position.y = Math.sin(elapsed * 2.0) * 0.006;

      // LipSync Lerp
      this.currentMouthOpen += (this.mouthOpenTarget - this.currentMouthOpen) * Math.min(1.0, delta * 24.0);
      this.mouthOpenTarget = Math.max(0, this.mouthOpenTarget - delta * 3.0);

      const em = this.currentVrm.expressionManager;
      if (em) {
        em.setValue('aa', this.currentMouthOpen * 0.85);
        em.setValue('ih', this.currentMouthOpen * 0.3);
        em.setValue('ou', this.currentMouthOpen * 0.4);

        // Blinking
        this.blinkTimer += delta;
        if (this.blinkTimer > 3.2) {
          this.isBlinking = true;
          if (this.blinkTimer > 3.35) {
            this.isBlinking = false;
            this.blinkTimer = 0;
          }
        }
        em.setValue('blink', this.isBlinking ? 1.0 : 0.0);

        // Emotion blendshapes
        em.setValue('happy', this.currentEmotion === 'joy' ? 0.9 : 0.0);
        em.setValue('sad', this.currentEmotion === 'sad' ? 0.9 : 0.0);
        em.setValue('angry', this.currentEmotion === 'angry' ? 0.9 : 0.0);
        em.setValue('surprised', this.currentEmotion === 'surprised' ? 0.9 : 0.0);
        em.update();
      }

      this.currentVrm.update(delta);
    }

    // 2. Hologram Fallback Updates
    if (this.hologramGroup && this.hologramGroup.visible) {
      this.hologramGroup.rotation.y = this.currentRotY;
      this.hologramGroup.position.y = Math.sin(elapsed * 2.0) * 0.008;

      if (this.hologramWireframe) {
        this.hologramWireframe.rotation.x = elapsed * 0.3;
        this.hologramWireframe.rotation.y = elapsed * 0.5;
        const scale = 1.0 + Math.sin(elapsed * 3.0) * 0.06 + this.currentMouthOpen * 0.3;
        this.hologramWireframe.scale.set(scale, scale, scale);
      }
    }

    // 3. Starfield Drift
    if (this.starfield) {
      const positions = this.starfield.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < 300; i++) {
        positions[i * 3 + 1] += delta * 0.08;
        if (positions[i * 3 + 1] > 4.0) positions[i * 3 + 1] = -4.0;
      }
      this.starfield.geometry.attributes.position.needsUpdate = true;
      this.starfield.rotation.y = elapsed * 0.02;
    }

    this.renderer.render(this.scene, this.camera);
  };
}
