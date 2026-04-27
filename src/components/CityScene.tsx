import { useEffect, useRef } from "react";
import * as THREE from "three";

type Building = {
  mesh: THREE.Mesh;
  basePos: THREE.Vector3;
  emissiveTarget: number; // 0..1, where 1 = on
  emissiveCurrent: number;
  windowColor: THREE.Color;
  outageDelay: number; // seconds to wait during restoration
  isGlitch: boolean;
};

type Stats = {
  fps: number;
  ms: number;
  draws: number;
};

export type CitySceneHandle = {
  setScroll: (v: number) => void;
  togglePower: (clientX: number, clientY: number) => void;
  onStats?: (s: Stats) => void;
};

interface Props {
  onReady?: (handle: CitySceneHandle) => void;
  onStats?: (s: Stats) => void;
}

// Lerp helper
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// Day/Sunset/Night palette
const DAY_SKY = new THREE.Color("#9cc1dc");
const SUNSET_SKY = new THREE.Color("#e58a5f");
const NIGHT_SKY = new THREE.Color("#0a0f1e");

const DAY_FOG = new THREE.Color("#cfd8e0");
const SUNSET_FOG = new THREE.Color("#5a3f4f");
const NIGHT_FOG = new THREE.Color("#0e1220");

const DAY_AMBIENT = new THREE.Color("#aac3d8");
const NIGHT_AMBIENT = new THREE.Color("#1a2238");

const DAY_SUN = new THREE.Color("#fff5e0");
const SUNSET_SUN = new THREE.Color("#ff7a3d");
const NIGHT_SUN = new THREE.Color("#1a2950");

function paletteAt(t: number) {
  // t in 0..1: 0 day, 0.5 sunset, 1 night
  const sky = new THREE.Color();
  const fog = new THREE.Color();
  const amb = new THREE.Color();
  const sun = new THREE.Color();
  if (t < 0.5) {
    const k = t / 0.5;
    sky.lerpColors(DAY_SKY, SUNSET_SKY, k);
    fog.lerpColors(DAY_FOG, SUNSET_FOG, k);
    amb.lerpColors(DAY_AMBIENT, SUNSET_SKY.clone().multiplyScalar(0.4), k);
    sun.lerpColors(DAY_SUN, SUNSET_SUN, k);
  } else {
    const k = (t - 0.5) / 0.5;
    sky.lerpColors(SUNSET_SKY, NIGHT_SKY, k);
    fog.lerpColors(SUNSET_FOG, NIGHT_FOG, k);
    amb.lerpColors(SUNSET_SKY.clone().multiplyScalar(0.4), NIGHT_AMBIENT, k);
    sun.lerpColors(SUNSET_SUN, NIGHT_SUN, k);
  }
  return { sky, fog, amb, sun };
}

export default function CityScene({ onReady, onStats }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<CitySceneHandle | null>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // ---- Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    // ---- Scene
    const scene = new THREE.Scene();
    scene.background = DAY_SKY.clone();
    scene.fog = new THREE.FogExp2(DAY_FOG.getHex(), 0.018);

    // ---- Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.5, 600);
    camera.position.set(0, 30, 70);
    camera.lookAt(0, 8, 0);

    // ---- Lights
    const ambient = new THREE.AmbientLight(DAY_AMBIENT.getHex(), 0.55);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(DAY_SUN.getHex(), 1.6);
    sun.position.set(-60, 80, 40);
    scene.add(sun);

    // Hemisphere for sky/ground bounce
    const hemi = new THREE.HemisphereLight(0xffffff, 0x202028, 0.4);
    scene.add(hemi);

    // Cursor energy point light
    const cursorLight = new THREE.PointLight(0x00bfff, 0, 60, 1.6);
    cursorLight.position.set(0, 12, 30);
    scene.add(cursorLight);

    // Subtle secondary cursor glow disk (sprite-like) for the bloom-feel
    const glowTex = makeRadialTexture();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0x33c8ff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(35, 35, 1);
    scene.add(glowSprite);

    // ---- Ground (wet asphalt feel via subtle reflection trick: simple dark plane)
    const groundGeo = new THREE.PlaneGeometry(600, 600, 1, 1);
    const groundMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1d1f24"),
      roughness: 0.55,
      metalness: 0.35,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Faint grid on ground for tech-industrial feel
    const grid = new THREE.GridHelper(600, 80, 0x000000, 0x222633);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.15;
    grid.position.y = 0.01;
    scene.add(grid);

    // ---- Buildings (instanced groups by emissive target ⇒ simpler: per-mesh)
    const buildings: Building[] = [];
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    const concreteMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#5a5f68"),
      roughness: 0.78,
      metalness: 0.1,
    });

    // Window emissive material — we'll clone per building so emissive can vary
    const baseWindowMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#2a2d33"),
      roughness: 0.35,
      metalness: 0.6,
      emissive: new THREE.Color(0xffc857),
      emissiveIntensity: 0,
    });

    // Generate a city block grid
    const gridSize = 9; // 9x9
    const spacing = 12;
    const center = (gridSize - 1) / 2;

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        // Skip occasional plots for streets variation
        if ((i + j) % 7 === 0 && Math.random() > 0.5) continue;

        // Cluster taller buildings off-center toward upper-right for asymmetry
        const distCenter = Math.hypot(i - center, j - center);
        const heightBias = clamp(1 - distCenter / (gridSize * 0.7), 0, 1);
        const baseH = 6 + Math.random() * 8;
        const tallH = 14 + Math.random() * 36 * heightBias;
        const h = lerp(baseH, tallH, Math.pow(Math.random(), 0.6));

        const w = 4 + Math.random() * 3.5;
        const d = 4 + Math.random() * 3.5;

        const x = (i - center) * spacing + (Math.random() - 0.5) * 2.0;
        const z = (j - center) * spacing + (Math.random() - 0.5) * 2.0;

        // Building body
        const geo = new THREE.BoxGeometry(w, h, d);
        const concrete = concreteMat.clone();
        // slight color variation
        concrete.color = new THREE.Color().setHSL(
          0.6,
          0.02 + Math.random() * 0.03,
          0.32 + Math.random() * 0.08,
        );
        const body = new THREE.Mesh(geo, concrete);
        body.position.set(x, h / 2, z);
        buildingGroup.add(body);

        // Windows: emissive shell as a slightly inset thinner box on the front faces.
        // Cheap trick: a colored emissive box slightly smaller, rendered with additive on top.
        const winMat = baseWindowMat.clone();
        winMat.color = new THREE.Color("#1b1d22");
        winMat.emissive = new THREE.Color(0xffc857);
        winMat.emissiveIntensity = 0;
        const winGeo = new THREE.BoxGeometry(w * 0.92, h * 0.92, d * 0.92);
        const win = new THREE.Mesh(winGeo, winMat);
        win.position.set(x, h / 2, z);
        // Slight texture: vary emissive color (some warm, a few cool)
        const cool = Math.random() < 0.18;
        if (cool) winMat.emissive = new THREE.Color(0xc9e3ff);
        buildingGroup.add(win);

        buildings.push({
          mesh: win,
          basePos: new THREE.Vector3(x, h / 2, z),
          emissiveTarget: 1,
          emissiveCurrent: 0,
          windowColor: winMat.emissive.clone(),
          outageDelay: 0,
          isGlitch: false,
        });
      }
    }

    // ---- Distant skyline silhouette (cheap, depth)
    const distantGroup = new THREE.Group();
    const distantMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#1a1d24"),
      roughness: 1,
      metalness: 0,
    });
    for (let k = 0; k < 60; k++) {
      const w = 5 + Math.random() * 10;
      const h = 10 + Math.random() * 50;
      const d = 5 + Math.random() * 10;
      const angle = Math.random() * Math.PI * 2;
      const r = 220 + Math.random() * 40;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), distantMat);
      m.position.set(Math.cos(angle) * r, h / 2, Math.sin(angle) * r);
      distantGroup.add(m);
    }
    scene.add(distantGroup);

    // ---------- State
    let scrollT = 0; // 0..1 day→night
    let scrollTSmooth = 0;
    const mouseNDC = new THREE.Vector2(0, 0);
    const mouseTarget = new THREE.Vector2(0, 0);
    const cursorWorld = new THREE.Vector3(0, 12, 0);
    let cursorIntensity = 0; // smoothed
    let cursorIntensityTarget = 0.5;

    // Power outage state
    // 'on' | 'off' | 'restoring'
    let powerState: "on" | "off" | "restoring" = "on";
    let restoreStart = 0;
    let restoreOriginXZ = new THREE.Vector2(0, 0);

    // Raycast plane for cursor world position
    const raycaster = new THREE.Raycaster();
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    function onPointerMove(e: PointerEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseTarget.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseTarget.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      cursorIntensityTarget = 1;
    }
    function onPointerLeave() {
      cursorIntensityTarget = 0.15;
    }
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerleave", onPointerLeave);

    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    // ---------- Public handle
    const handle: CitySceneHandle = {
      setScroll(v: number) {
        scrollT = clamp(v, 0, 1);
      },
      togglePower(clientX, clientY) {
        if (powerState === "on") {
          powerState = "off";
          // immediate cut
          for (const b of buildings) {
            b.emissiveTarget = 0;
          }
        } else {
          // restore (works during 'off' or interrupting 'restoring')
          powerState = "restoring";
          restoreStart = performance.now() / 1000;
          // origin in world from click
          const rect = renderer.domElement.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1,
          );
          raycaster.setFromCamera(ndc, camera);
          const p = new THREE.Vector3();
          raycaster.ray.intersectPlane(groundPlane, p);
          restoreOriginXZ.set(p.x, p.z);

          // assign delays based on distance from origin
          let maxDist = 1;
          for (const b of buildings) {
            const d = Math.hypot(
              b.basePos.x - restoreOriginXZ.x,
              b.basePos.z - restoreOriginXZ.y,
            );
            if (d > maxDist) maxDist = d;
          }
          for (const b of buildings) {
            const d = Math.hypot(
              b.basePos.x - restoreOriginXZ.x,
              b.basePos.z - restoreOriginXZ.y,
            );
            const norm = d / maxDist;
            // Restoration over ~3s with stagger + random jitter
            b.outageDelay = norm * 2.4 + Math.random() * 0.6;
            // Pick a single random building to glitch magenta briefly
            b.isGlitch = false;
          }
          const glitchPick = buildings[Math.floor(Math.random() * buildings.length)];
          if (glitchPick) glitchPick.isGlitch = true;
        }
      },
    };
    handleRef.current = handle;
    onReady?.(handle);

    // ---------- Stats
    let lastStat = performance.now();
    let frames = 0;
    let frameMsAccum = 0;

    // ---------- Render loop
    const clock = new THREE.Clock();
    let raf = 0;

    function render() {
      raf = requestAnimationFrame(render);
      const tStart = performance.now();
      const dt = Math.min(clock.getDelta(), 0.05);

      // Smooth scroll
      scrollTSmooth = lerp(scrollTSmooth, scrollT, 1 - Math.pow(0.001, dt));

      // Smooth mouse
      mouseNDC.x = lerp(mouseNDC.x, mouseTarget.x, 1 - Math.pow(0.0001, dt));
      mouseNDC.y = lerp(mouseNDC.y, mouseTarget.y, 1 - Math.pow(0.0001, dt));

      // Cursor world position via ray-plane intersection (plane y = 8)
      raycaster.setFromCamera(mouseNDC, camera);
      const planeY8 = new THREE.Plane(new THREE.Vector3(0, 1, 0), -8);
      const hit = new THREE.Vector3();
      raycaster.ray.intersectPlane(planeY8, hit);
      if (hit) cursorWorld.lerp(hit, 1 - Math.pow(0.001, dt));

      cursorIntensity = lerp(
        cursorIntensity,
        cursorIntensityTarget,
        1 - Math.pow(0.001, dt),
      );

      // ---- Palette
      const pal = paletteAt(scrollTSmooth);
      (scene.background as THREE.Color).copy(pal.sky);
      (scene.fog as THREE.FogExp2).color.copy(pal.fog);
      (scene.fog as THREE.FogExp2).density = lerp(0.012, 0.028, scrollTSmooth);

      ambient.color.copy(pal.amb);
      ambient.intensity = lerp(0.6, 0.18, scrollTSmooth);

      sun.color.copy(pal.sun);
      sun.intensity = lerp(1.7, 0.0, Math.pow(scrollTSmooth, 0.85));
      // Sun position: descends across scroll
      const sunAngle = lerp(Math.PI * 0.25, -Math.PI * 0.05, scrollTSmooth);
      sun.position.set(Math.cos(sunAngle) * 90, Math.sin(sunAngle) * 80 + 6, 30);

      hemi.intensity = lerp(0.5, 0.08, scrollTSmooth);

      // ---- Camera dolly tied to scroll (subtle)
      const camY = lerp(34, 14, scrollTSmooth);
      const camZ = lerp(82, 48, scrollTSmooth);
      const camX = mouseNDC.x * lerp(2.5, 6, scrollTSmooth);
      camera.position.set(
        lerp(camera.position.x, camX, 1 - Math.pow(0.001, dt)),
        lerp(camera.position.y, camY, 1 - Math.pow(0.001, dt)),
        lerp(camera.position.z, camZ, 1 - Math.pow(0.001, dt)),
      );
      const lookY = lerp(8, 12, scrollTSmooth) + mouseNDC.y * -2;
      camera.lookAt(0, lookY, 0);

      // ---- Cursor light
      cursorLight.position.set(cursorWorld.x, 16, cursorWorld.z);
      // Energy intensity is much stronger at night
      const nightBoost = lerp(0.25, 1.0, scrollTSmooth);
      const intensity = cursorIntensity * nightBoost;
      cursorLight.intensity = intensity * 18 * (powerState === "off" ? 0.4 : 1);
      cursorLight.distance = lerp(40, 75, scrollTSmooth);
      cursorLight.color.setHex(0x33c8ff);

      glowSprite.position.set(cursorWorld.x, 14, cursorWorld.z);
      glowMat.opacity = clamp(intensity * 0.55 * (powerState === "off" ? 0.6 : 1), 0, 0.7);
      glowSprite.scale.setScalar(lerp(28, 44, scrollTSmooth));

      // ---- Building emissive update
      const baseWindowOnByTime = clamp((scrollTSmooth - 0.35) / 0.45, 0, 1); // start glowing past sunset
      const tNow = performance.now() / 1000;

      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        const m = b.mesh.material as THREE.MeshStandardMaterial;

        if (powerState === "on") {
          b.emissiveTarget = 1;
        } else if (powerState === "off") {
          b.emissiveTarget = 0;
        } else if (powerState === "restoring") {
          const elapsed = tNow - restoreStart;
          if (elapsed >= b.outageDelay) b.emissiveTarget = 1;
          else b.emissiveTarget = 0;
          // Once all targets are 1, switch to on
          if (i === buildings.length - 1 && elapsed > 4) powerState = "on";
        }

        b.emissiveCurrent = lerp(
          b.emissiveCurrent,
          b.emissiveTarget,
          1 - Math.pow(0.0005, dt),
        );

        // Distance-based proximity glow boost from cursor (electrified)
        const dx = b.basePos.x - cursorWorld.x;
        const dz = b.basePos.z - cursorWorld.z;
        const distSq = dx * dx + dz * dz;
        const proximity = Math.exp(-distSq / 380); // ~ falloff radius
        const proxBoost = proximity * intensity * 1.4;

        // Glitch pick during restoring: brief magenta flicker right at restore moment
        if (
          powerState === "restoring" &&
          b.isGlitch &&
          tNow - restoreStart > b.outageDelay &&
          tNow - restoreStart < b.outageDelay + 0.6
        ) {
          m.emissive.setHex(0xff00ff);
          m.emissiveIntensity =
            (0.6 + Math.sin((tNow - restoreStart) * 60) * 0.4) * 2.2;
          continue;
        } else {
          m.emissive.copy(b.windowColor);
        }

        const baseGlow = b.emissiveCurrent * baseWindowOnByTime * 1.6;
        m.emissiveIntensity = baseGlow + proxBoost;
      }

      // Render
      renderer.render(scene, camera);

      // Stats
      frames++;
      frameMsAccum += performance.now() - tStart;
      const now = performance.now();
      if (now - lastStat > 500) {
        const fps = (frames * 1000) / (now - lastStat);
        const ms = frameMsAccum / Math.max(frames, 1);
        const draws = renderer.info.render.calls;
        onStats?.({ fps: Math.round(fps), ms: Math.round(ms * 10) / 10, draws });
        frames = 0;
        frameMsAccum = 0;
        lastStat = now;
      }
    }
    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      glowTex.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      buildings.forEach((b) => {
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
      });
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}

function makeRadialTexture(): THREE.Texture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  g.addColorStop(0, "rgba(120,210,255,0.95)");
  g.addColorStop(0.35, "rgba(80,180,255,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
