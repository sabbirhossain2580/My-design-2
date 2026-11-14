// src/components/three/CorporateCampusScene.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import {
  ArrowLeft,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Compass,
  Layers,
  Palette,
  Plus,
  Sun,
  Moon,
  Trash2,
} from 'lucide-react';
import { RecruitmentRequisition } from '../../types/index.ts';
import { api } from '../../lib/api.ts';
import { createProceduralTextureSet } from './sceneTextures.ts';
import {
  ArchitecturalFinish,
  CampusEntityInfo,
  createHeadquartersTower,
  createInstancedPerimeterCypresses,
  createInstancedPlazaBollards,
  createSubsidiaryPavilion,
  FINISH_PALETTES,
} from './proceduralModels.ts';

export type CameraPresetId = 'overview' | 'spire' | 'subsidiaries' | 'aerial';
export type AtmosphereId = 'twilight' | 'daylight';

interface ScenePresetRecord {
  id: number;
  name: string;
  cameraPreset: string;
  atmosphere: string;
  finish: string;
  explodedRatio: number;
  createdBy: string;
}

interface CorporateCampusSceneProps {
  requisitions: RecruitmentRequisition[];
  onExit: () => void;
}

const COMPANY_META: Array<{ code: string; name: string; color: number }> = [
  { code: 'RAL', name: 'Renaissance Apparels Ltd.', color: 0x3b82f6 },
  { code: 'SGL', name: 'Synergy Garments Ltd.', color: 0x10b981 },
  { code: 'PSL', name: 'Premier Sourcing Ltd.', color: 0xf59e0b },
  { code: 'MTSL', name: 'Metro Textile Solutions', color: 0x8b5cf6 },
  { code: 'RDL', name: 'Renaissance Denim Ltd.', color: 0x06b6d4 },
  { code: 'RBL', name: 'Renaissance Basics Ltd.', color: 0xf43f5e },
];

const CAMERA_PRESETS: Record<CameraPresetId, { pos: [number, number, number]; look: [number, number, number]; label: string }> = {
  overview: { pos: [21, 14, 24], look: [0, 6.2, 0], label: 'Overview' },
  spire: { pos: [11, 15.5, 12], look: [0, 12.0, 0], label: 'HQ Spire' },
  subsidiaries: { pos: [17, 7.5, 22], look: [0, 2.2, 0], label: 'Subsidiaries' },
  aerial: { pos: [0.1, 34, 24], look: [0, 2.0, 0], label: 'Aerial' },
};

// Module-scope reusable scratch objects (zero allocations in render loop)
const _mouseVec = new THREE.Vector2();
const _targetCamPos = new THREE.Vector3();
const _targetCamLook = new THREE.Vector3();

export const CorporateCampusScene: React.FC<CorporateCampusSceneProps> = ({
  requisitions,
  onExit,
}) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Interactive Scene Controls State
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('overview');
  const [atmosphere, setAtmosphere] = useState<AtmosphereId>('twilight');
  const [finish, setFinish] = useState<ArchitecturalFinish>('brass');
  const [explodedRatio, setExplodedRatio] = useState<number>(0);
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);
  const [presetsOpen, setPresetsOpen] = useState<boolean>(false);

  // Raycasted Entity Selection
  const [selectedEntityId, setSelectedEntityId] = useState<string>('HQ');
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);

  // Cloud SQL Saved Scene Presets State
  const [savedPresets, setSavedPresets] = useState<ScenePresetRecord[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetMessage, setPresetMessage] = useState('');

  // Refs read inside stable WebGL loop without tearing down renderer
  const sceneParamsRef = useRef({
    atmosphere: 'twilight' as AtmosphereId,
    finish: 'brass' as ArchitecturalFinish,
    explodedRatio: 0,
    cameraFlightActive: false,
    desiredCamPos: new THREE.Vector3(...CAMERA_PRESETS.overview.pos),
    desiredCamLook: new THREE.Vector3(...CAMERA_PRESETS.overview.look),
  });

  // Compute live recruitment metrics per RG subsidiary
  const entitiesMap = useMemo(() => {
    const map = new Map<string, CampusEntityInfo>();
    const totalAll = requisitions.length;
    const joinedAll = requisitions.filter((r) => r.recruitmentStatus === 'Joined').length;
    const ongoingAll = requisitions.filter((r) => r.recruitmentStatus === 'Ongoing').length;

    map.set('HQ', {
      id: 'HQ',
      label: 'Renaissance Group HQ',
      subtitle: 'Corporate HR & Executive Tower',
      totalReqs: totalAll,
      joinedReqs: joinedAll,
      ongoingReqs: ongoingAll,
      focusPoint: new THREE.Vector3(0, 7.5, 0),
      cameraOffset: new THREE.Vector3(14, 11, 16),
    });

    COMPANY_META.forEach((comp, idx) => {
      const angle = (idx / COMPANY_META.length) * Math.PI * 2 + Math.PI / 6;
      const radius = 13.5;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius;
      const matching = requisitions.filter(
        (r) => (r.company || '').toUpperCase().trim() === comp.code
      );
      map.set(comp.code, {
        id: comp.code,
        label: `${comp.code} Pavilion`,
        subtitle: comp.name,
        totalReqs: matching.length,
        joinedReqs: matching.filter((r) => r.recruitmentStatus === 'Joined').length,
        ongoingReqs: matching.filter((r) => r.recruitmentStatus === 'Ongoing').length,
        focusPoint: new THREE.Vector3(px, 2.2, pz),
        cameraOffset: new THREE.Vector3(px + Math.cos(angle) * 7.5, 6.2, pz + Math.sin(angle) * 7.5),
      });
    });

    return map;
  }, [requisitions]);

  const entitiesMapRef = useRef(entitiesMap);
  entitiesMapRef.current = entitiesMap;

  // Load saved scene presets from Cloud SQL PostgreSQL
  const fetchPresets = async () => {
    const rows = await api.getScenePresets();
    setSavedPresets(rows);
  };

  useEffect(() => {
    fetchPresets();
  }, []);

  // Keyboard shortcut 'H' to toggle Zen/Cinema mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Sync control changes into animation loop refs
  useEffect(() => {
    sceneParamsRef.current.atmosphere = atmosphere;
  }, [atmosphere]);

  useEffect(() => {
    sceneParamsRef.current.finish = finish;
  }, [finish]);

  useEffect(() => {
    sceneParamsRef.current.explodedRatio = explodedRatio;
  }, [explodedRatio]);

  const triggerCameraPreset = (presetId: CameraPresetId) => {
    setCameraPreset(presetId);
    const p = CAMERA_PRESETS[presetId];
    sceneParamsRef.current.desiredCamPos.set(...p.pos);
    sceneParamsRef.current.desiredCamLook.set(...p.look);
    sceneParamsRef.current.cameraFlightActive = true;
  };

  const focusEntity = (entityId: string) => {
    setSelectedEntityId(entityId);
    const info = entitiesMapRef.current.get(entityId);
    if (!info) return;
    sceneParamsRef.current.desiredCamPos.copy(info.cameraOffset);
    sceneParamsRef.current.desiredCamLook.copy(info.focusPoint);
    sceneParamsRef.current.cameraFlightActive = true;
  };

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newPresetName.trim();
    if (!clean) return;
    setSavingPreset(true);
    setPresetMessage('');
    try {
      await api.saveScenePreset({
        name: clean,
        cameraPreset,
        atmosphere,
        finish,
        explodedRatio,
      });
      setNewPresetName('');
      setPresetMessage('Saved to Cloud SQL');
      await fetchPresets();
    } catch (err: any) {
      setPresetMessage(err?.message || 'Save failed');
    } finally {
      setSavingPreset(false);
    }
  };

  const handleApplyPreset = (preset: ScenePresetRecord) => {
    const camId = (['overview', 'spire', 'subsidiaries', 'aerial'].includes(preset.cameraPreset)
      ? preset.cameraPreset
      : 'overview') as CameraPresetId;
    const atmoId = (preset.atmosphere === 'daylight' ? 'daylight' : 'twilight') as AtmosphereId;
    const finId = (['brass', 'titanium', 'obsidian'].includes(preset.finish)
      ? preset.finish
      : 'brass') as ArchitecturalFinish;
    setAtmosphere(atmoId);
    setFinish(finId);
    setExplodedRatio(Math.max(0, Math.min(1, Number(preset.explodedRatio) || 0)));
    triggerCameraPreset(camId);
    setPresetsOpen(false);
  };

  const handleDeletePreset = async (id: number) => {
    try {
      await api.deleteScenePreset(id);
      await fetchPresets();
    } catch {}
  };

  // Initialize isolated Three.js WebGL scene once
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const width = mountEl.clientWidth || window.innerWidth;
    const height = mountEl.clientHeight || window.innerHeight;

    // 1. Software WebGL Guard from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountEl.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const twilightSky = new THREE.Color(0x0b1322);
    const daylightSky = new THREE.Color(0xcbd9ea);
    scene.background = twilightSky.clone();
    scene.fog = new THREE.FogExp2(0x0b1322, 0.0115);

    // 2. Mandatory Studio Reflection Map via RoomEnvironment + PMREMGenerator
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.25, 260);
    camera.position.set(...CAMERA_PRESETS.overview.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(...CAMERA_PRESETS.overview.look);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 7;
    controls.maxDistance = 68;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.update();

    const onControlStart = () => {
      sceneParamsRef.current.cameraFlightActive = false;
    };
    controls.addEventListener('start', onControlStart);

    // 3. Studio Lighting Rig (Warm Key + Cool Hemisphere Fill + Rim + Area Softbox)
    const hemiLight = new THREE.HemisphereLight(0x9bc4ff, 0x262f3d, 0.78);
    hemiLight.position.set(0, 40, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.15);
    keyLight.position.set(22, 30, 18);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 90;
    const shadowBound = 26;
    keyLight.shadow.camera.left = -shadowBound;
    keyLight.shadow.camera.right = shadowBound;
    keyLight.shadow.camera.top = shadowBound;
    keyLight.shadow.camera.bottom = -shadowBound;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x7cb6ff, 0.65);
    rimLight.position.set(-22, 16, -20);
    scene.add(rimLight);

    if (!isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xfff5e4, 2.2, 12, 18);
      softbox.position.set(-14, 14, 14);
      softbox.lookAt(0, 7, 0);
      scene.add(softbox);
    }

    // 4. Procedural Textures & Disposables Registry
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = createProceduralTextureSet(maxAniso);
    const disposables: Array<{ dispose: () => void }> = [];

    // 5. Continuous Horizon Terrain & Plaza Promenade (y = 0, no floating boxes)
    const terrainGeo = new THREE.CircleGeometry(170, 64);
    terrainGeo.rotateX(-Math.PI / 2);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x162032,
      roughness: 0.92,
      metalness: 0.02,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
    disposables.push(terrainGeo, terrainMat);

    const plazaGeo = new THREE.CircleGeometry(24, 64);
    plazaGeo.rotateX(-Math.PI / 2);
    const plazaMat = new THREE.MeshStandardMaterial({
      map: textures.plazaAlbedo,
      roughnessMap: textures.plazaRoughness,
      roughness: 0.72,
      metalness: 0.08,
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, plazaMat);
    plazaMesh.position.y = 0.015;
    plazaMesh.receiveShadow = true;
    scene.add(plazaMesh);
    disposables.push(plazaGeo, plazaMat);

    // Subtle Brass Promenade Ring flush on plaza (polygonOffset to prevent Z-fighting)
    const ringTrackGeo = new THREE.RingGeometry(13.15, 13.85, 72);
    ringTrackGeo.rotateX(-Math.PI / 2);
    const ringTrackMat = new THREE.MeshStandardMaterial({
      color: 0xc2953e,
      roughness: 0.25,
      metalness: 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const ringTrack = new THREE.Mesh(ringTrackGeo, ringTrackMat);
    ringTrack.position.y = 0.035;
    ringTrack.receiveShadow = true;
    scene.add(ringTrack);
    disposables.push(ringTrackGeo, ringTrackMat);

    // 6. Hero Subject: Composite 10-Part Headquarters Tower
    const hqRig = createHeadquartersTower(
      textures,
      isSoftwareGl,
      sceneParamsRef.current.finish,
      disposables
    );
    scene.add(hqRig.group);

    // 7. Six Subsidiary Pavilions arranged radially
    const pavilionSharedMats = {
      stone: new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78, metalness: 0.05 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.84 }),
      glass: hqRig.materialsToUpdate.atriumGlass,
      accent: hqRig.materialsToUpdate.accentMetal,
    };
    disposables.push(pavilionSharedMats.stone, pavilionSharedMats.metal);

    const clickableHitboxes: THREE.Object3D[] = [hqRig.hitbox];
    const pavilionIndicators: THREE.MeshStandardMaterial[] = [];

    COMPANY_META.forEach((comp, idx) => {
      const info = entitiesMapRef.current.get(comp.code);
      const angle = (idx / COMPANY_META.length) * Math.PI * 2 + Math.PI / 6;
      const radius = 13.5;
      const pav = createSubsidiaryPavilion(
        comp.code,
        info?.totalReqs ?? 2,
        info?.joinedReqs ?? 1,
        textures,
        pavilionSharedMats,
        comp.color,
        disposables
      );
      pav.group.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      pav.group.rotation.y = -angle + Math.PI / 2;
      scene.add(pav.group);
      clickableHitboxes.push(pav.hitbox);
      pavilionIndicators.push(pav.indicatorMat);
    });

    // 8. Instanced Perimeter Cypress Grove (> 20 repeated items via InstancedMesh)
    const treePositions: Array<{ x: number; z: number; scale: number }> = [];
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2 + 0.08;
      const r = 26.5 + (i % 3) * 3.2;
      const scale = 0.85 + ((i * 7) % 10) * 0.03; // ±15% natural variation
      treePositions.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, scale });
    }
    scene.add(createInstancedPerimeterCypresses(treePositions, disposables));

    // 9. Instanced Plaza Light Bollards (24 instances via InstancedMesh)
    const bollardPositions: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      bollardPositions.push({ x: Math.cos(a) * 19.6, z: Math.sin(a) * 19.6 });
    }
    scene.add(createInstancedPlazaBollards(bollardPositions, disposables));

    // 10. Pre-warm Shaders on GPU devices
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 11. Layer-1 Raycasting for Hover & Click Entity Selection
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    let lastHoverTime = 0;
    let pointerDownPos = { x: 0, y: 0 };

    const updateMouseNDC = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      _mouseVec.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      _mouseVec.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 45) return;
      lastHoverTime = now;
      updateMouseNDC(e.clientX, e.clientY);
      raycaster.setFromCamera(_mouseVec, camera);
      const hits = raycaster.intersectObjects(clickableHitboxes, false);
      if (hits.length > 0) {
        const entityId = hits[0].object.userData.entityId as string;
        setHoveredEntityId(entityId);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredEntityId(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Ignore orbit drags
      updateMouseNDC(e.clientX, e.clientY);
      raycaster.setFromCamera(_mouseVec, camera);
      const hits = raycaster.intersectObjects(clickableHitboxes, false);
      if (hits.length > 0) {
        const entityId = hits[0].object.userData.entityId as string;
        focusEntity(entityId);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    // 12. Responsive Resize Listener
    const onResize = () => {
      if (!mountEl) return;
      const w = mountEl.clientWidth || window.innerWidth;
      const h = mountEl.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 13. Continuous Damped Animation Loop + Software WebGL afterDraw Pacing
    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let currentExplode = 0;
    let currentFinishApplied: ArchitecturalFinish | null = null;
    let currentAtmosphereApplied: AtmosphereId | null = null;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const params = sceneParamsRef.current;

      // Apply Finish Swatch when changed
      if (currentFinishApplied !== params.finish) {
        currentFinishApplied = params.finish;
        const pal = FINISH_PALETTES[params.finish];
        hqRig.materialsToUpdate.accentMetal.color.setHex(pal.accentColor);
        hqRig.materialsToUpdate.stonePodium.color.setHex(pal.stoneColor);
        hqRig.materialsToUpdate.atriumGlass.color.setHex(pal.glassTint);
        hqRig.materialsToUpdate.beacon.color.setHex(pal.beaconColor);
        hqRig.materialsToUpdate.beacon.emissive.setHex(pal.beaconColor);
        ringTrackMat.color.setHex(pal.metalColor);
      }

      // Smoothly transition Atmosphere (Sky, Horizon Fog, Key/Fill Intensities)
      if (currentAtmosphereApplied !== params.atmosphere) {
        currentAtmosphereApplied = params.atmosphere;
        const isDay = params.atmosphere === 'daylight';
        const targetSky = isDay ? daylightSky : twilightSky;
        (scene.background as THREE.Color).copy(targetSky);
        if (scene.fog instanceof THREE.FogExp2) {
          scene.fog.color.copy(targetSky);
          scene.fog.density = isDay ? 0.0085 : 0.0115;
        }
        keyLight.intensity = isDay ? 2.65 : 2.15;
        keyLight.color.setHex(isDay ? 0xfff8ea : 0xfff1d6);
        hemiLight.intensity = isDay ? 1.15 : 0.78;
        terrainMat.color.setHex(isDay ? 0x3b4d63 : 0x162032);
      }

      // Smoothly damp Exploded Architecture vertical separation
      const explodeAlpha = 1 - Math.exp(-7 * dt);
      currentExplode += (params.explodedRatio - currentExplode) * explodeAlpha;
      hqRig.tiers.coreTier.position.y = currentExplode * 2.2;
      hqRig.tiers.terraceTier.position.y = currentExplode * 4.8;
      hqRig.tiers.crownTier.position.y = currentExplode * 7.6;

      // Subtle kinetic orbital rings rotation
      hqRig.orbitalRings[0].rotation.y = elapsed * 0.32;
      hqRig.orbitalRings[1].rotation.y = -elapsed * 0.22;

      // Subtle telemetry spire pulse
      const glow = 1.05 + Math.sin(elapsed * 2.0) * 0.2;
      hqRig.materialsToUpdate.beacon.emissiveIntensity = glow + 0.35;
      for (let i = 0; i < pavilionIndicators.length; i++) {
        pavilionIndicators[i].emissiveIntensity = glow;
      }

      // Smooth exponential damping for camera preset flights
      if (params.cameraFlightActive) {
        const camAlpha = 1 - Math.exp(-5.5 * dt);
        _targetCamPos.copy(params.desiredCamPos);
        _targetCamLook.copy(params.desiredCamLook);
        camera.position.lerp(_targetCamPos, camAlpha);
        controls.target.lerp(_targetCamLook, camAlpha);
        if (
          camera.position.distanceTo(_targetCamPos) < 0.08 &&
          controls.target.distanceTo(_targetCamLook) < 0.08
        ) {
          camera.position.copy(_targetCamPos);
          controls.target.copy(_targetCamLook);
          params.cameraFlightActive = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    if (isSoftwareGl) {
      renderer.render(scene, camera);
      afterDraw(tick);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onControlStart);
      controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      disposables.forEach((d) => d.dispose());
      textures.dispose();
      envTarget.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mountEl) {
        mountEl.removeChild(renderer.domElement);
      }
    };
  }, []);

  const activeEntity = entitiesMap.get(hoveredEntityId || selectedEntityId) || entitiesMap.get('HQ')!;

  return (
    <div className="fixed inset-0 z-50 w-screen h-screen overflow-hidden bg-slate-950 select-none">
      {/* Dedicated Isolated WebGL Canvas Container (100vw x 100vh) */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Top-Left Compact Header & Entity Telemetry Badge (No backdrop-filter, No pulsing dots) */}
      <div className="fixed top-4 left-4 z-20 flex flex-wrap items-center gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700/80 text-xs font-bold shadow-lg transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-amber-400" />
          <span>HR Portal</span>
        </button>

        <div className="px-3.5 py-2 rounded-xl bg-slate-900/95 border border-slate-700/80 text-white shadow-lg flex items-center space-x-3">
          <div>
            <div className="text-xs font-extrabold tracking-tight flex items-center space-x-2">
              <span>RENAISSANCE 3D CAMPUS</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px] font-bold">
                {activeEntity.id}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 font-medium mt-0.5">
              {activeEntity.label} · {activeEntity.totalReqs} MRFs ({activeEntity.joinedReqs} Joined, {activeEntity.ongoingReqs} Ongoing)
            </div>
          </div>
        </div>
      </div>

      {/* Collapsible Unified Bottom Control Dock (Zero Center Occlusion) */}
      <div
        className="fixed left-1/2 z-20 transition-transform duration-300 ease-out"
        style={{
          bottom: '18px',
          width: 'min(920px, 94vw)',
          transform: dockCollapsed
            ? 'translateX(-50%) translateY(calc(100% - 34px))'
            : 'translateX(-50%) translateY(0)',
        }}
      >
        {/* Collapse / Expand Handle */}
        <div className="flex justify-center mb-1.5">
          <button
            type="button"
            onClick={() => setDockCollapsed((v) => !v)}
            className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-900/95 hover:bg-slate-800 text-slate-200 border border-slate-700/80 text-[11px] font-bold shadow-md cursor-pointer"
          >
            {dockCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{dockCollapsed ? 'Show Controls (H)' : 'Hide Controls (H)'}</span>
          </button>
        </div>

        {/* Cloud SQL Scene Presets Popover (Anchored cleanly above dock when opened) */}
        {presetsOpen && !dockCollapsed && (
          <div className="mb-2 p-3.5 rounded-2xl bg-slate-900/95 border border-slate-700/80 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                Saved 3D Scene Presets (Cloud SQL)
              </span>
              {presetMessage && (
                <span className="text-[11px] font-mono text-emerald-400">{presetMessage}</span>
              )}
            </div>

            <form onSubmit={handleSavePreset} className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Name current camera & material setup..."
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="submit"
                disabled={savingPreset || !newPresetName.trim()}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold disabled:opacity-50 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{savingPreset ? 'Saving...' : 'Save Preset'}</span>
              </button>
            </form>

            {savedPresets.length === 0 ? (
              <div className="text-[11px] text-slate-400 py-1">
                No custom presets saved yet. Save your current angle, finish, and exploded view above.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {savedPresets.map((p) => (
                  <div
                    key={p.id}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(p)}
                      className="font-semibold text-slate-100 hover:text-amber-300 cursor-pointer"
                    >
                      {p.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeletePreset(p.id)}
                      title="Delete Preset"
                      className="text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Main Single-Row Horizontal Control Dock */}
        <div className="px-3.5 py-2.5 rounded-2xl bg-slate-900/95 border border-slate-700/85 text-white shadow-2xl flex flex-wrap items-center justify-between gap-3">
          {/* Camera Presets */}
          <div className="flex items-center space-x-1.5">
            <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div className="flex items-center bg-slate-950 rounded-lg p-0.5 border border-slate-800">
              {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => triggerCameraPreset(id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                    cameraPreset === id
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {CAMERA_PRESETS[id].label}
                </button>
              ))}
            </div>
          </div>

          {/* Exploded Architecture Slider */}
          <div className="flex items-center space-x-2 min-w-[155px]">
            <Layers className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-300 whitespace-nowrap">
              Explode {Math.round(explodedRatio * 100)}%
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={explodedRatio}
              onChange={(e) => setExplodedRatio(parseFloat(e.target.value))}
              className="w-20 accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Architectural Finish Swatches */}
          <div className="flex items-center space-x-1.5">
            <Palette className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            {(['brass', 'titanium', 'obsidian'] as ArchitecturalFinish[]).map((f) => {
              const swatchColors: Record<ArchitecturalFinish, string> = {
                brass: '#d4a348',
                titanium: '#38bdf8',
                obsidian: '#a78bfa',
              };
              return (
                <button
                  key={f}
                  type="button"
                  title={`Finish: ${f}`}
                  onClick={() => setFinish(f)}
                  className={`w-5 h-5 rounded-full border-2 transition cursor-pointer ${
                    finish === f ? 'border-white scale-110' : 'border-slate-700 opacity-75 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: swatchColors[f] }}
                />
              );
            })}
          </div>

          {/* Atmosphere & Cloud SQL Presets */}
          <div className="flex items-center space-x-1.5">
            <button
              type="button"
              onClick={() => setAtmosphere(atmosphere === 'twilight' ? 'daylight' : 'twilight')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-bold text-slate-200 cursor-pointer"
            >
              {atmosphere === 'twilight' ? (
                <>
                  <Moon className="w-3 h-3 text-indigo-300" />
                  <span>Twilight</span>
                </>
              ) : (
                <>
                  <Sun className="w-3 h-3 text-amber-300" />
                  <span>Daylight</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPresetsOpen((v) => !v)}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-bold cursor-pointer ${
                presetsOpen
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <Bookmark className="w-3 h-3" />
              <span>Presets</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
