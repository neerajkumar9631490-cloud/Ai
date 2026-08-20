// FILE: web/src/avatar/Particles.ts
import * as THREE from 'three';

export class ParticleBackground {
  private scene: THREE.Scene;
  private particlesMesh: THREE.Points;
  private particleCount = 280;
  private starfieldMesh: THREE.Points;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // 1. Cyber Floating Particles
    const particleGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.particleCount * 3);
    const colors = new Float32Array(this.particleCount * 3);
    const scales = new Float32Array(this.particleCount);

    const colorChoices = [
      new THREE.Color(0x00f0ff), // Cyan
      new THREE.Color(0xa855f7), // Purple
      new THREE.Color(0xec4899), // Pink
      new THREE.Color(0x3b82f6), // Blue
    ];

    for (let i = 0; i < this.particleCount; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1.5;

      const chosen = colorChoices[Math.floor(Math.random() * colorChoices.length)];
      colors[i * 3 + 0] = chosen.r;
      colors[i * 3 + 1] = chosen.g;
      colors[i * 3 + 2] = chosen.b;

      scales[i] = Math.random() * 0.04 + 0.015;
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.05,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    this.particlesMesh = new THREE.Points(particleGeometry, particleMaterial);
    this.scene.add(this.particlesMesh);

    // 2. Starfield Deep Background
    const starCount = 600;
    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3 + 0] = (Math.random() - 0.5) * 20;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 5;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMaterial = new THREE.PointsMaterial({
      size: 0.02,
      color: 0x64748b,
      transparent: true,
      opacity: 0.4,
    });

    this.starfieldMesh = new THREE.Points(starGeometry, starMaterial);
    this.scene.add(this.starfieldMesh);
  }

  public update(delta: number, elapsed: number): void {
    if (this.particlesMesh) {
      const positions = this.particlesMesh.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < this.particleCount; i++) {
        // Slow float upwards
        positions[i * 3 + 1] += delta * 0.08;
        // Subtle drift in x
        positions[i * 3 + 0] += Math.sin(elapsed * 0.5 + i) * 0.001;

        // Wrap around vertically
        if (positions[i * 3 + 1] > 4.0) {
          positions[i * 3 + 1] = -4.0;
        }
      }
      this.particlesMesh.geometry.attributes.position.needsUpdate = true;
      this.particlesMesh.rotation.y = elapsed * 0.02;
    }

    if (this.starfieldMesh) {
      this.starfieldMesh.rotation.y = elapsed * 0.005;
      this.starfieldMesh.rotation.x = Math.sin(elapsed * 0.003) * 0.02;
    }
  }
}
