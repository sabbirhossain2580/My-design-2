// src/components/three/sceneTextures.ts
import * as THREE from 'three';

export interface ProceduralTextureSet {
  plazaAlbedo: THREE.CanvasTexture;
  plazaRoughness: THREE.CanvasTexture;
  curtainWallAlbedo: THREE.CanvasTexture;
  brushedMetalRoughness: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dispose: () => void;
}

export function createProceduralTextureSet(maxAnisotropy: number): ProceduralTextureSet {
  const safeAniso = Math.max(1, Math.min(maxAnisotropy, 16));

  // 1. Architectural Travertine Plaza Tile Albedo (SRGBColorSpace)
  const plazaCanvas = document.createElement('canvas');
  plazaCanvas.width = 512;
  plazaCanvas.height = 512;
  const pCtx = plazaCanvas.getContext('2d')!;
  pCtx.fillStyle = '#253042';
  pCtx.fillRect(0, 0, 512, 512);

  // Subtle stone grain + grid joints
  const grid = 64;
  for (let y = 0; y < 512; y += grid) {
    for (let x = 0; x < 512; x += grid) {
      const tone = 34 + ((x * 7 + y * 13) % 14);
      pCtx.fillStyle = `rgb(${tone}, ${tone + 10}, ${tone + 26})`;
      pCtx.fillRect(x + 2, y + 2, grid - 4, grid - 4);
    }
  }
  pCtx.strokeStyle = 'rgba(148, 163, 184, 0.22)';
  pCtx.lineWidth = 2;
  for (let i = 0; i <= 512; i += grid) {
    pCtx.beginPath();
    pCtx.moveTo(i, 0);
    pCtx.lineTo(i, 512);
    pCtx.stroke();
    pCtx.beginPath();
    pCtx.moveTo(0, i);
    pCtx.lineTo(512, i);
    pCtx.stroke();
  }
  // Fine micro-speckle
  for (let i = 0; i < 1800; i++) {
    const rx = (i * 73) % 512;
    const ry = (i * 137) % 512;
    pCtx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.08)';
    pCtx.fillRect(rx, ry, 2, 2);
  }

  const plazaAlbedo = new THREE.CanvasTexture(plazaCanvas);
  plazaAlbedo.colorSpace = THREE.SRGBColorSpace;
  plazaAlbedo.wrapS = THREE.RepeatWrapping;
  plazaAlbedo.wrapT = THREE.RepeatWrapping;
  plazaAlbedo.repeat.set(18, 18);
  plazaAlbedo.anisotropy = safeAniso;

  // 2. Plaza Roughness Map (Linear / NoColorSpace)
  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = 256;
  roughCanvas.height = 256;
  const rCtx = roughCanvas.getContext('2d')!;
  rCtx.fillStyle = 'rgb(165,165,165)';
  rCtx.fillRect(0, 0, 256, 256);
  rCtx.strokeStyle = 'rgb(225,225,225)';
  rCtx.lineWidth = 3;
  for (let i = 0; i <= 256; i += 32) {
    rCtx.beginPath();
    rCtx.moveTo(i, 0);
    rCtx.lineTo(i, 256);
    rCtx.stroke();
    rCtx.beginPath();
    rCtx.moveTo(0, i);
    rCtx.lineTo(256, i);
    rCtx.stroke();
  }
  const plazaRoughness = new THREE.CanvasTexture(roughCanvas);
  plazaRoughness.wrapS = THREE.RepeatWrapping;
  plazaRoughness.wrapT = THREE.RepeatWrapping;
  plazaRoughness.repeat.set(18, 18);
  plazaRoughness.anisotropy = safeAniso;

  // 3. Architectural Curtain-Wall Mullion Pattern (SRGBColorSpace)
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 512;
  wallCanvas.height = 512;
  const wCtx = wallCanvas.getContext('2d')!;
  const grad = wCtx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, '#1e3a5f');
  grad.addColorStop(0.5, '#132846');
  grad.addColorStop(1, '#0d1b31');
  wCtx.fillStyle = grad;
  wCtx.fillRect(0, 0, 512, 512);

  // Horizontal slab spandrels and vertical mullions
  for (let y = 0; y < 512; y += 32) {
    wCtx.fillStyle = 'rgba(203, 213, 225, 0.25)';
    wCtx.fillRect(0, y, 512, 4);
    // Warm interior window glow bands on selected floors
    if ((y / 32) % 3 === 1) {
      wCtx.fillStyle = 'rgba(251, 191, 36, 0.14)';
      wCtx.fillRect(0, y + 6, 512, 18);
    }
  }
  for (let x = 0; x < 512; x += 32) {
    wCtx.fillStyle = 'rgba(148, 163, 184, 0.3)';
    wCtx.fillRect(x, 0, 3, 512);
  }
  const curtainWallAlbedo = new THREE.CanvasTexture(wallCanvas);
  curtainWallAlbedo.colorSpace = THREE.SRGBColorSpace;
  curtainWallAlbedo.wrapS = THREE.RepeatWrapping;
  curtainWallAlbedo.wrapT = THREE.RepeatWrapping;
  curtainWallAlbedo.repeat.set(3, 5);
  curtainWallAlbedo.anisotropy = safeAniso;

  // 4. Brushed Anisotropic Metal Grain Map (Linear / NoColorSpace)
  const metalCanvas = document.createElement('canvas');
  metalCanvas.width = 256;
  metalCanvas.height = 256;
  const mCtx = metalCanvas.getContext('2d')!;
  mCtx.fillStyle = 'rgb(70,70,70)';
  mCtx.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y++) {
    const v = 52 + ((y * 19) % 42);
    mCtx.fillStyle = `rgb(${v},${v},${v})`;
    mCtx.fillRect(0, y, 256, 1);
  }
  const brushedMetalRoughness = new THREE.CanvasTexture(metalCanvas);
  brushedMetalRoughness.wrapS = THREE.RepeatWrapping;
  brushedMetalRoughness.wrapT = THREE.RepeatWrapping;
  brushedMetalRoughness.repeat.set(2, 2);
  brushedMetalRoughness.anisotropy = safeAniso;

  // 5. Soft Radial Contact Shadow Texture (SRGBColorSpace)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d')!;
  const radial = sCtx.createRadialGradient(128, 128, 18, 128, 128, 124);
  radial.addColorStop(0, 'rgba(3, 7, 18, 0.72)');
  radial.addColorStop(0.55, 'rgba(3, 7, 18, 0.34)');
  radial.addColorStop(1, 'rgba(3, 7, 18, 0.0)');
  sCtx.fillStyle = radial;
  sCtx.fillRect(0, 0, 256, 256);
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  return {
    plazaAlbedo,
    plazaRoughness,
    curtainWallAlbedo,
    brushedMetalRoughness,
    contactShadow,
    dispose: () => {
      plazaAlbedo.dispose();
      plazaRoughness.dispose();
      curtainWallAlbedo.dispose();
      brushedMetalRoughness.dispose();
      contactShadow.dispose();
    },
  };
}
