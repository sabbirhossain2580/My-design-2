// src/components/three/proceduralModels.ts
import * as THREE from 'three';
import { ProceduralTextureSet } from './sceneTextures.ts';

export type ArchitecturalFinish = 'brass' | 'titanium' | 'obsidian';

export interface FinishPalette {
  accentColor: number;
  metalColor: number;
  stoneColor: number;
  glassTint: number;
  beaconColor: number;
}

export const FINISH_PALETTES: Record<ArchitecturalFinish, FinishPalette> = {
  brass: {
    accentColor: 0xd4a348,
    metalColor: 0xc2953e,
    stoneColor: 0x3a4659,
    glassTint: 0x72b5e8,
    beaconColor: 0xf59e0b,
  },
  titanium: {
    accentColor: 0x38bdf8,
    metalColor: 0x94a3b8,
    stoneColor: 0x334155,
    glassTint: 0x93c5fd,
    beaconColor: 0x38bdf8,
  },
  obsidian: {
    accentColor: 0xa78bfa,
    metalColor: 0x1e293b,
    stoneColor: 0x1f2937,
    glassTint: 0x818cf8,
    beaconColor: 0xa78bfa,
  },
};

export interface CampusEntityInfo {
  id: string;
  label: string;
  subtitle: string;
  totalReqs: number;
  joinedReqs: number;
  ongoingReqs: number;
  focusPoint: THREE.Vector3;
  cameraOffset: THREE.Vector3;
}

export interface HeadquartersRig {
  group: THREE.Group;
  tiers: {
    baseTier: THREE.Group;
    coreTier: THREE.Group;
    terraceTier: THREE.Group;
    crownTier: THREE.Group;
  };
  orbitalRings: THREE.Mesh[];
  materialsToUpdate: {
    accentMetal: THREE.MeshPhysicalMaterial;
    exoskeleton: THREE.MeshStandardMaterial;
    stonePodium: THREE.MeshStandardMaterial;
    atriumGlass: THREE.MeshPhysicalMaterial;
    beacon: THREE.MeshStandardMaterial;
  };
  hitbox: THREE.Mesh;
}

function createPolygonShape(sides: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2 + Math.PI / sides;
    const x = Math.cos(a) * radius;
    const y = Math.sin(a) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function createHeadquartersTower(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean,
  finish: ArchitecturalFinish,
  disposables: Array<{ dispose: () => void }>
): HeadquartersRig {
  const palette = FINISH_PALETTES[finish];
  const group = new THREE.Group();
  group.name = 'RG_Headquarters';

  const baseTier = new THREE.Group();
  const coreTier = new THREE.Group();
  const terraceTier = new THREE.Group();
  const crownTier = new THREE.Group();

  // Shared PBR Materials with >= 0.25 roughness contrast across adjacent parts
  const stonePodium = new THREE.MeshStandardMaterial({
    color: palette.stoneColor,
    roughness: 0.78,
    metalness: 0.06,
    roughnessMap: textures.plazaRoughness,
  });

  const exoskeleton = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.34,
    metalness: 0.78,
    roughnessMap: textures.brushedMetalRoughness,
  });

  const accentMetal = new THREE.MeshPhysicalMaterial({
    color: palette.accentColor,
    roughness: 0.16,
    metalness: 0.94,
    anisotropy: 0.8,
    anisotropyRotation: Math.PI / 4,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
  });

  const curtainCoreMat = new THREE.MeshStandardMaterial({
    map: textures.curtainWallAlbedo,
    roughness: 0.25,
    metalness: 0.45,
  });

  const atriumGlass = new THREE.MeshPhysicalMaterial({
    color: palette.glassTint,
    roughness: 0.06,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.72,
    transparent: true,
    opacity: isSoftwareGl ? 0.38 : 1,
    ior: 1.52,
    thickness: 1.4,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    depthWrite: false,
  });

  const beacon = new THREE.MeshStandardMaterial({
    color: palette.beaconColor,
    emissive: palette.beaconColor,
    emissiveIntensity: 1.45,
    roughness: 0.2,
    metalness: 0.4,
  });

  disposables.push(stonePodium, exoskeleton, accentMetal, curtainCoreMat, atriumGlass, beacon);

  // Soft radial contact shadow flush at y = 0.02
  const shadowGeo = new THREE.PlaneGeometry(14, 14);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.58,
  });
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.02;
  group.add(shadowPlane);
  disposables.push(shadowGeo, shadowMat);

  // Part 1: Stepped Octagonal Travertine Plinth Base (ExtrudeGeometry with bevels, bottom at y = 0)
  const plinthGeo = new THREE.ExtrudeGeometry(createPolygonShape(8, 4.6), {
    depth: 0.65,
    bevelEnabled: true,
    bevelThickness: 0.14,
    bevelSize: 0.18,
    bevelSegments: 3,
  });
  plinthGeo.rotateX(-Math.PI / 2);
  plinthGeo.translate(0, 0.14, 0);
  const plinthMesh = new THREE.Mesh(plinthGeo, stonePodium);
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  baseTier.add(plinthMesh);
  disposables.push(plinthGeo);

  // Part 2: Colonnade Lobby Podium (ExtrudeGeometry)
  const lobbyGeo = new THREE.ExtrudeGeometry(createPolygonShape(8, 3.65), {
    depth: 1.45,
    bevelEnabled: true,
    bevelThickness: 0.1,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  lobbyGeo.rotateX(-Math.PI / 2);
  lobbyGeo.translate(0, 0.9, 0);
  const lobbyMesh = new THREE.Mesh(lobbyGeo, exoskeleton);
  lobbyMesh.castShadow = true;
  lobbyMesh.receiveShadow = true;
  baseTier.add(lobbyMesh);
  disposables.push(lobbyGeo);

  // Part 3: Brushed Entrance Canopy Arch (ExtrudeGeometry bevelled cantilevered wing)
  const canopyShape = new THREE.Shape();
  canopyShape.moveTo(-2.4, -0.35);
  canopyShape.lineTo(2.4, -0.35);
  canopyShape.lineTo(2.0, 0.35);
  canopyShape.lineTo(-2.0, 0.35);
  canopyShape.closePath();
  const canopyGeo = new THREE.ExtrudeGeometry(canopyShape, {
    depth: 1.6,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.08,
    bevelSegments: 2,
  });
  const canopyMesh = new THREE.Mesh(canopyGeo, accentMetal);
  canopyMesh.position.set(0, 2.05, 3.15);
  canopyMesh.castShadow = true;
  baseTier.add(canopyMesh);
  disposables.push(canopyGeo);

  // Part 4: Inner Curtain-Wall Structural Core
  const innerCoreGeo = new THREE.CylinderGeometry(2.15, 2.55, 8.2, 8);
  const innerCoreMesh = new THREE.Mesh(innerCoreGeo, curtainCoreMat);
  innerCoreMesh.position.y = 6.5;
  innerCoreMesh.castShadow = true;
  innerCoreMesh.receiveShadow = true;
  coreTier.add(innerCoreMesh);
  disposables.push(innerCoreGeo);

  // Part 5: Outer Optical Glass Atrium Envelope
  const outerGlassGeo = new THREE.CylinderGeometry(2.52, 2.95, 8.4, 8);
  const outerGlassMesh = new THREE.Mesh(outerGlassGeo, atriumGlass);
  outerGlassMesh.position.y = 6.55;
  outerGlassMesh.renderOrder = 3;
  coreTier.add(outerGlassMesh);
  disposables.push(outerGlassGeo);

  // Part 6: Vertical Exoskeleton Structural Fins (8 beveled radial ribs around core)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0);
  finShape.lineTo(0.32, 0);
  finShape.lineTo(0.18, 9.2);
  finShape.lineTo(-0.08, 9.2);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.18,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  finGeo.translate(0, 0, -0.09);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const fin = new THREE.Mesh(finGeo, exoskeleton);
    fin.position.set(Math.cos(angle) * 2.85, 2.35, Math.sin(angle) * 2.85);
    fin.rotation.y = -angle;
    fin.castShadow = true;
    coreTier.add(fin);
  }
  disposables.push(finGeo);

  // Part 7: Mid-Rise Sky Terrace Deck (LatheGeometry stepped collar)
  const terracePoints = [
    new THREE.Vector2(1.4, 0),
    new THREE.Vector2(3.1, 0),
    new THREE.Vector2(3.25, 0.25),
    new THREE.Vector2(2.85, 0.55),
    new THREE.Vector2(1.9, 0.55),
  ];
  const terraceGeo = new THREE.LatheGeometry(terracePoints, 32);
  terraceGeo.translate(0, 10.75, 0);
  const terraceMesh = new THREE.Mesh(terraceGeo, stonePodium);
  terraceMesh.castShadow = true;
  terraceMesh.receiveShadow = true;
  terraceTier.add(terraceMesh);
  disposables.push(terraceGeo);

  // Part 8: Upper Executive Setback Tower + Brass Collar
  const upperBodyGeo = new THREE.CylinderGeometry(1.55, 2.05, 4.4, 8);
  const upperBodyMesh = new THREE.Mesh(upperBodyGeo, curtainCoreMat);
  upperBodyMesh.position.y = 13.45;
  upperBodyMesh.castShadow = true;
  terraceTier.add(upperBodyMesh);

  const collarGeo = new THREE.TorusGeometry(2.1, 0.14, 14, 32);
  collarGeo.rotateX(Math.PI / 2);
  const collarMesh = new THREE.Mesh(collarGeo, accentMetal);
  collarMesh.position.y = 11.45;
  collarMesh.castShadow = true;
  terraceTier.add(collarMesh);
  disposables.push(upperBodyGeo, collarGeo);

  // Part 9: Executive Crown & Helipad Louver Assembly (LatheGeometry + Brushed Brass Spire)
  const crownPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(1.95, 0.0),
    new THREE.Vector2(2.15, 0.35),
    new THREE.Vector2(1.5, 0.85),
    new THREE.Vector2(0.95, 1.3),
    new THREE.Vector2(0.28, 2.1),
    new THREE.Vector2(0.06, 5.2),
    new THREE.Vector2(0.0, 5.3),
  ];
  const crownGeo = new THREE.LatheGeometry(crownPoints, 32);
  crownGeo.translate(0, 15.6, 0);
  const crownMesh = new THREE.Mesh(crownGeo, accentMetal);
  crownMesh.castShadow = true;
  crownTier.add(crownMesh);
  disposables.push(crownGeo);

  // Part 10: Glowing Telemetry Beacon Ring
  const beaconGeo = new THREE.TorusGeometry(1.45, 0.09, 12, 36);
  beaconGeo.rotateX(Math.PI / 2);
  const beaconMesh = new THREE.Mesh(beaconGeo, beacon);
  beaconMesh.position.y = 16.45;
  crownTier.add(beaconMesh);
  disposables.push(beaconGeo);

  // Kinetic Orbital Pipeline Rings (TubeGeometry)
  const orbitalRings: THREE.Mesh[] = [];
  for (let r = 0; r < 2; r++) {
    const rad = r === 0 ? 4.3 : 5.4;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 48; s++) {
      const a = (s / 48) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(a) * rad, Math.sin(a * 2) * 0.25, Math.sin(a) * rad));
    }
    const curve = new THREE.CatmullRomCurve3(pts, true);
    const ringGeo = new THREE.TubeGeometry(curve, 64, 0.045, 8, true);
    const ringMesh = new THREE.Mesh(ringGeo, r === 0 ? accentMetal : beacon);
    ringMesh.position.y = 13.8 + r * 1.4;
    ringMesh.rotation.z = r === 0 ? 0.14 : -0.18;
    crownTier.add(ringMesh);
    orbitalRings.push(ringMesh);
    disposables.push(ringGeo);
  }

  group.add(baseTier, coreTier, terraceTier, crownTier);

  // Layer 1 proxy hitbox for fast raycasting
  const hitboxGeo = new THREE.CylinderGeometry(4.2, 4.8, 21.5, 10);
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
  hitbox.position.y = 10.75;
  hitbox.layers.set(1);
  hitbox.userData.entityId = 'HQ';
  group.add(hitbox);
  disposables.push(hitboxGeo, hitboxMat);

  return {
    group,
    tiers: { baseTier, coreTier, terraceTier, crownTier },
    orbitalRings,
    materialsToUpdate: {
      accentMetal,
      exoskeleton,
      stonePodium,
      atriumGlass,
      beacon,
    },
    hitbox,
  };
}

export function createSubsidiaryPavilion(
  code: string,
  totalReqs: number,
  joinedReqs: number,
  textures: ProceduralTextureSet,
  sharedMaterials: {
    stone: THREE.MeshStandardMaterial;
    metal: THREE.MeshStandardMaterial;
    glass: THREE.MeshPhysicalMaterial;
    accent: THREE.MeshPhysicalMaterial;
  },
  colorHex: number,
  disposables: Array<{ dispose: () => void }>
): { group: THREE.Group; hitbox: THREE.Mesh; indicatorMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  group.name = `Pavilion_${code}`;

  // Contact shadow at y = 0.02
  const shadowGeo = new THREE.PlaneGeometry(6.6, 6.6);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    depthWrite: false,
    opacity: 0.5,
  });
  const shadow = new THREE.Mesh(shadowGeo, shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.02;
  group.add(shadow);
  disposables.push(shadowGeo, shadowMat);

  // Part 1: Hexagonal Stone Dais (ExtrudeGeometry with bevels, bottom flush at y = 0)
  const daisGeo = new THREE.ExtrudeGeometry(createPolygonShape(6, 2.35), {
    depth: 0.38,
    bevelEnabled: true,
    bevelThickness: 0.08,
    bevelSize: 0.1,
    bevelSegments: 2,
  });
  daisGeo.rotateX(-Math.PI / 2);
  daisGeo.translate(0, 0.08, 0);
  const dais = new THREE.Mesh(daisGeo, sharedMaterials.stone);
  dais.castShadow = true;
  dais.receiveShadow = true;
  group.add(dais);
  disposables.push(daisGeo);

  // Part 2: Glass Atrium Core
  const atriumH = 1.65 + Math.min(totalReqs, 12) * 0.22;
  const glassGeo = new THREE.CylinderGeometry(1.38, 1.55, atriumH, 6);
  const glassMesh = new THREE.Mesh(glassGeo, sharedMaterials.glass);
  glassMesh.position.y = 0.48 + atriumH / 2;
  glassMesh.renderOrder = 2;
  group.add(glassMesh);
  disposables.push(glassGeo);

  // Part 3: Sculpted Metal Roof Cowl (LatheGeometry)
  const roofPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(2.05, 0.0),
    new THREE.Vector2(2.15, 0.18),
    new THREE.Vector2(1.45, 0.55),
    new THREE.Vector2(0.55, 0.65),
    new THREE.Vector2(0.0, 0.65),
  ];
  const roofGeo = new THREE.LatheGeometry(roofPts, 18);
  roofGeo.translate(0, 0.48 + atriumH, 0);
  const roofMesh = new THREE.Mesh(roofGeo, sharedMaterials.metal);
  roofMesh.castShadow = true;
  group.add(roofMesh);
  disposables.push(roofGeo);

  // Part 4: Curved Steel Tension Struts (TubeGeometry ribs)
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const strutCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.cos(a) * 1.9, 0.38, Math.sin(a) * 1.9),
      new THREE.Vector3(Math.cos(a) * 1.65, 0.48 + atriumH * 0.5, Math.sin(a) * 1.65),
      new THREE.Vector3(Math.cos(a) * 1.85, 0.5 + atriumH, Math.sin(a) * 1.85),
    ]);
    const strutGeo = new THREE.TubeGeometry(strutCurve, 12, 0.06, 6, false);
    const strut = new THREE.Mesh(strutGeo, sharedMaterials.accent);
    strut.castShadow = true;
    group.add(strut);
    disposables.push(strutGeo);
  }

  // Part 5 & 6: Live Telemetry Indicator Spire + Glowing Cap
  const indicatorMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 1.1,
    roughness: 0.25,
    metalness: 0.3,
  });
  const spireHeight = 0.65 + Math.min(joinedReqs + 1, 10) * 0.24;
  const spireGeo = new THREE.CylinderGeometry(0.18, 0.34, spireHeight, 12);
  const spireMesh = new THREE.Mesh(spireGeo, indicatorMat);
  spireMesh.position.y = 1.13 + atriumH + spireHeight / 2;
  group.add(spireMesh);

  const haloGeo = new THREE.TorusGeometry(0.92, 0.06, 10, 24);
  haloGeo.rotateX(Math.PI / 2);
  const halo = new THREE.Mesh(haloGeo, indicatorMat);
  halo.position.y = 1.2 + atriumH;
  group.add(halo);
  disposables.push(indicatorMat, spireGeo, haloGeo);

  // Layer 1 raycasting proxy
  const hitboxGeo = new THREE.CylinderGeometry(2.35, 2.45, atriumH + spireHeight + 1.8, 8);
  const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitbox = new THREE.Mesh(hitboxGeo, hitboxMat);
  hitbox.position.y = (atriumH + spireHeight + 1.8) / 2;
  hitbox.layers.set(1);
  hitbox.userData.entityId = code;
  group.add(hitbox);
  disposables.push(hitboxGeo, hitboxMat);

  return { group, hitbox, indicatorMat };
}

export function createInstancedPerimeterCypresses(
  positions: Array<{ x: number; z: number; scale: number }>,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();
  const count = positions.length;

  // Tapered LatheGeometry trunks (InstancedMesh)
  const trunkPts = [
    new THREE.Vector2(0.18, 0),
    new THREE.Vector2(0.13, 0.8),
    new THREE.Vector2(0.08, 1.5),
  ];
  const trunkGeo = new THREE.LatheGeometry(trunkPts, 8);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.9, metalness: 0.0 });
  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
  trunkInst.castShadow = true;

  // Sculpted foliage canopy cones (InstancedMesh with per-instance ±15% scale & tint variation)
  const canopyGeo = new THREE.IcosahedronGeometry(0.85, 1);
  canopyGeo.scale(0.85, 1.85, 0.85);
  canopyGeo.translate(0, 2.35, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0.0 });
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
  canopyInst.castShadow = true;
  canopyInst.receiveShadow = true;

  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const p = positions[i];
    dummy.position.set(p.x, 0, p.z);
    dummy.rotation.set(0, (i * 1.1) % (Math.PI * 2), 0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    canopyInst.setMatrixAt(i, dummy.matrix);

    const tintShift = ((i % 7) - 3) * 0.025;
    color.setRGB(0.14 + tintShift * 0.5, 0.34 + tintShift, 0.22 + tintShift * 0.5);
    canopyInst.setColorAt(i, color);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();

  group.add(trunkInst, canopyInst);
  disposables.push(trunkGeo, trunkMat, canopyGeo, canopyMat);
  return group;
}

export function createInstancedPlazaBollards(
  positions: Array<{ x: number; z: number }>,
  disposables: Array<{ dispose: () => void }>
): THREE.Group {
  const group = new THREE.Group();
  const count = positions.length;

  const postGeo = new THREE.CylinderGeometry(0.11, 0.14, 0.95, 10);
  postGeo.translate(0, 0.475, 0);
  const postMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.35, metalness: 0.8 });
  const postInst = new THREE.InstancedMesh(postGeo, postMat, count);
  postInst.castShadow = true;

  const capGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.14, 10);
  capGeo.translate(0, 0.98, 0);
  const capMat = new THREE.MeshStandardMaterial({
    color: 0xfde68a,
    emissive: 0xf59e0b,
    emissiveIntensity: 1.35,
    roughness: 0.2,
  });
  const capInst = new THREE.InstancedMesh(capGeo, capMat, count);

  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    dummy.position.set(positions[i].x, 0, positions[i].z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.setScalar(1);
    dummy.updateMatrix();
    postInst.setMatrixAt(i, dummy.matrix);
    capInst.setMatrixAt(i, dummy.matrix);
  }
  postInst.instanceMatrix.needsUpdate = true;
  capInst.instanceMatrix.needsUpdate = true;
  postInst.computeBoundingSphere();
  capInst.computeBoundingSphere();

  group.add(postInst, capInst);
  disposables.push(postGeo, postMat, capGeo, capMat);
  return group;
}
