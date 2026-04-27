import { useEffect, useRef } from "react";
import * as THREE from "three";

type WindowedBuilding = {
  mesh: THREE.Mesh; // window shell
  basePos: THREE.Vector3;
  emissiveTarget: number;
  emissiveCurrent: number;
  windowColor: THREE.Color;
  outageDelay: number;
  isGlitch: boolean;
};

type Vehicle = {
  group: THREE.Group;
  // Path
  axis: "x" | "z";
  lane: number; // perpendicular offset
  y: number;
  speed: number; // units/s, sign = direction
  pos: number; // along axis
  range: number; // half-length of road
  headlightL: THREE.PointLight;
  headlightR: THREE.PointLight;
};

type Stats = { fps: number; ms: number; draws: number };

export type CitySceneHandle = {
  setScroll: (v: number) => void;
  togglePower: (clientX: number, clientY: number) => void;
  onStats?: (s: Stats) => void;
};

interface Props {
  onReady?: (handle: CitySceneHandle) => void;
  onStats?: (s: Stats) => void;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const rand = (a: number, b: number) => a + Math.random() * (b - a);

// Diorama palette — always nighttime-leaning, scroll just deepens it
const SKY_TOP_DAY = new THREE.Color("#1a2238");
const SKY_TOP_NIGHT = new THREE.Color("#05080f");
const SKY_BOT_DAY = new THREE.Color("#2c3a55");
const SKY_BOT_NIGHT = new THREE.Color("#0a1426");

const FOG_DAY = new THREE.Color("#101828");
const FOG_NIGHT = new THREE.Color("#03060c");

export default function CityScene({ onReady, onStats }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<CitySceneHandle | null>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // ===== Renderer =====
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    // ===== Scene + gradient sky background =====
    const scene = new THREE.Scene();
    const skyTex = makeGradientTexture(SKY_TOP_DAY, SKY_BOT_DAY);
    scene.background = skyTex;
    scene.fog = new THREE.FogExp2(FOG_DAY.getHex(), 0.012);

    // ===== Camera =====
    const camera = new THREE.PerspectiveCamera(38, width / height, 0.5, 600);
    camera.position.set(0, 38, 95);
    camera.lookAt(0, 6, 0);

    // ===== Lights =====
    const ambient = new THREE.AmbientLight(0x4a5878, 0.55);
    scene.add(ambient);

    const keyLight = new THREE.DirectionalLight(0xc7d8ff, 1.1);
    keyLight.position.set(60, 90, 50);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 10;
    keyLight.shadow.camera.far = 260;
    keyLight.shadow.camera.left = -100;
    keyLight.shadow.camera.right = 100;
    keyLight.shadow.camera.top = 100;
    keyLight.shadow.camera.bottom = -100;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.5;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x6a7fff, 0.4);
    rimLight.position.set(-80, 40, -40);
    scene.add(rimLight);

    const hemi = new THREE.HemisphereLight(0x556d99, 0x0a0d14, 0.35);
    scene.add(hemi);

    // Cursor energy point light
    const cursorLight = new THREE.PointLight(0xffd089, 0, 80, 1.7);
    cursorLight.position.set(0, 18, 0);
    scene.add(cursorLight);

    const glowTex = makeRadialTexture();
    const glowMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xffc97a,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const glowSprite = new THREE.Sprite(glowMat);
    glowSprite.scale.set(40, 40, 1);
    scene.add(glowSprite);

    // ===== Diorama plate (base plinth) =====
    // City fits within a rectangular plate, like the references.
    const PLATE_W = 130;
    const PLATE_D = 78;
    const PLATE_H = 3;

    const plateMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d24,
      roughness: 0.55,
      metalness: 0.45,
    });
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(PLATE_W, PLATE_H, PLATE_D),
      plateMat,
    );
    plate.position.y = -PLATE_H / 2;
    plate.receiveShadow = true;
    scene.add(plate);

    // Plate top inset trim (slightly raised border) — the engraved-name strip area
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x0d1018,
      roughness: 0.7,
      metalness: 0.3,
    });
    const trimFront = new THREE.Mesh(
      new THREE.BoxGeometry(PLATE_W, 0.2, 4),
      trimMat,
    );
    trimFront.position.set(0, 0.01, PLATE_D / 2 - 2);
    scene.add(trimFront);

    // Asphalt base layer (dark) covering most of the plate top
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: 0x14181f,
      roughness: 0.85,
      metalness: 0.15,
    });
    const asphalt = new THREE.Mesh(
      new THREE.PlaneGeometry(PLATE_W - 1, PLATE_D - 6),
      asphaltMat,
    );
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.position.set(0, 0.02, -1.5);
    asphalt.receiveShadow = true;
    scene.add(asphalt);

    // ===== City content groups =====
    const cityGroup = new THREE.Group();
    cityGroup.position.y = 0.03;
    scene.add(cityGroup);

    const buildings: WindowedBuilding[] = [];

    // ----- Streets (concrete sidewalks + asphalt strips with lane markings) -----
    const sidewalkMat = new THREE.MeshStandardMaterial({
      color: 0x3a3e47,
      roughness: 0.9,
      metalness: 0.05,
    });
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x0e1116,
      roughness: 0.95,
      metalness: 0.1,
    });
    const laneMat = new THREE.MeshBasicMaterial({ color: 0xc8c2a8 });

    // Helper to create a horizontal road strip along x-axis
    function addRoadX(z: number, length: number, width: number) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(length, width), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.05, z);
      road.receiveShadow = true;
      cityGroup.add(road);
      // dashed center line
      const dashLen = 1.4;
      const gap = 1.4;
      const total = length;
      const count = Math.floor(total / (dashLen + gap));
      for (let i = 0; i < count; i++) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(dashLen, 0.18), laneMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(-total / 2 + i * (dashLen + gap) + dashLen / 2, 0.06, z);
        cityGroup.add(dash);
      }
    }
    function addRoadZ(x: number, length: number, width: number) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.05, 0);
      road.receiveShadow = true;
      cityGroup.add(road);
      const dashLen = 1.4;
      const gap = 1.4;
      const total = length;
      const count = Math.floor(total / (dashLen + gap));
      for (let i = 0; i < count; i++) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.18, dashLen), laneMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.06, -total / 2 + i * (dashLen + gap) + dashLen / 2);
        cityGroup.add(dash);
      }
    }

    // Layout: one main avenue along x, two cross streets along z, plus elevated road on right
    const cityLength = PLATE_W - 6; // ~124
    const cityDepth = PLATE_D - 10; // ~68
    addRoadX(-12, cityLength, 7); // front avenue
    addRoadX(14, cityLength, 6); // back avenue
    addRoadZ(-30, cityDepth, 5);
    addRoadZ(20, cityDepth, 5);

    // Sidewalks lining the front avenue
    const sw1 = new THREE.Mesh(
      new THREE.BoxGeometry(cityLength, 0.4, 1.2),
      sidewalkMat,
    );
    sw1.position.set(0, 0.2, -12 - 4);
    sw1.receiveShadow = true;
    cityGroup.add(sw1);
    const sw2 = new THREE.Mesh(
      new THREE.BoxGeometry(cityLength, 0.4, 1.2),
      sidewalkMat,
    );
    sw2.position.set(0, 0.2, -12 + 4);
    sw2.receiveShadow = true;
    cityGroup.add(sw2);

    // ===== Materials for buildings =====
    const concretePalette = [0x4a4d54, 0x53565d, 0x3f4148, 0x5a5d63, 0x44474d];
    const brickPalette = [0x6a4a3a, 0x5b4030, 0x7a5a44];

    function makeConcrete(color: number) {
      return new THREE.MeshStandardMaterial({
        color,
        roughness: 0.78,
        metalness: 0.12,
      });
    }
    function makeMetal() {
      return new THREE.MeshStandardMaterial({
        color: 0x2c3038,
        roughness: 0.4,
        metalness: 0.85,
      });
    }
    function makeGlass() {
      return new THREE.MeshStandardMaterial({
        color: 0x18202c,
        roughness: 0.18,
        metalness: 0.85,
      });
    }

    // Generate a procedural window grid texture for tall buildings
    function makeWindowTexture(
      cols: number,
      rows: number,
      warm = true,
    ): THREE.Texture {
      const cell = 16;
      const w = cols * cell;
      const h = rows * cell;
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      // facade base
      ctx.fillStyle = "#1a1d24";
      ctx.fillRect(0, 0, w, h);
      // mullions
      ctx.fillStyle = "#0a0c10";
      for (let i = 0; i <= cols; i++) ctx.fillRect(i * cell - 1, 0, 2, h);
      for (let j = 0; j <= rows; j++) ctx.fillRect(0, j * cell - 1, w, 2);
      // windows (lit) — varied for organic feel
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const lit = Math.random() < 0.78;
          if (!lit) continue;
          const intensity = 0.55 + Math.random() * 0.45;
          const r = warm
            ? Math.round(255 * intensity)
            : Math.round(180 * intensity);
          const g = warm
            ? Math.round(190 * intensity)
            : Math.round(210 * intensity);
          const b = warm
            ? Math.round(110 * intensity)
            : Math.round(255 * intensity);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.fillRect(i * cell + 2, j * cell + 2, cell - 4, cell - 4);
        }
      }
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      return tex;
    }

    // Build a windowed building. The "shell" is a slightly inset emissive box
    // textured with the window grid. The "body" is a concrete frame.
    function buildWindowedTower(
      x: number,
      z: number,
      w: number,
      d: number,
      h: number,
      opts: { warm?: boolean; metal?: boolean; concreteColor?: number } = {},
    ) {
      const concreteColor =
        opts.concreteColor ??
        concretePalette[Math.floor(Math.random() * concretePalette.length)];
      const bodyMat = opts.metal ? makeMetal() : makeConcrete(concreteColor);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
      body.position.set(x, h / 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      cityGroup.add(body);

      // Window shell (slightly inset on sides, full height)
      const inset = 0.12;
      const shellW = w - inset;
      const shellD = d - inset;
      const cols = Math.max(4, Math.round(w * 1.6));
      const rows = Math.max(8, Math.round(h * 1.4));
      const winTex = makeWindowTexture(cols, rows, opts.warm ?? true);
      const winTexSide = makeWindowTexture(
        Math.max(4, Math.round(d * 1.6)),
        rows,
        opts.warm ?? true,
      );

      const matFront = new THREE.MeshStandardMaterial({
        map: winTex,
        emissiveMap: winTex,
        emissive: 0xffffff,
        emissiveIntensity: 1.0,
        roughness: 0.35,
        metalness: 0.5,
      });
      const matSide = new THREE.MeshStandardMaterial({
        map: winTexSide,
        emissiveMap: winTexSide,
        emissive: 0xffffff,
        emissiveIntensity: 1.0,
        roughness: 0.35,
        metalness: 0.5,
      });
      const topMat = new THREE.MeshStandardMaterial({
        color: 0x14171c,
        roughness: 0.8,
        metalness: 0.2,
      });

      // Use a single BoxGeometry with material array for 6 faces
      const mats: THREE.Material[] = [
        matSide, // +x
        matSide, // -x
        topMat, // +y
        topMat, // -y
        matFront, // +z
        matFront, // -z
      ];
      const shell = new THREE.Mesh(
        new THREE.BoxGeometry(shellW, h - 0.05, shellD),
        mats,
      );
      shell.position.set(x, h / 2, z);
      shell.castShadow = false;
      shell.receiveShadow = false;
      cityGroup.add(shell);

      buildings.push({
        mesh: shell,
        basePos: new THREE.Vector3(x, h / 2, z),
        emissiveTarget: 1,
        emissiveCurrent: 0,
        windowColor: new THREE.Color(0xffffff),
        outageDelay: 0,
        isGlitch: false,
      });

      return { body, shell };
    }

    // Low industrial building (no/few windows)
    function buildLowIndustrial(
      x: number,
      z: number,
      w: number,
      d: number,
      h: number,
      brick = false,
    ) {
      const color = brick
        ? brickPalette[Math.floor(Math.random() * brickPalette.length)]
        : concretePalette[Math.floor(Math.random() * concretePalette.length)];
      const m = makeConcrete(color);
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      body.position.set(x, h / 2, z);
      body.castShadow = true;
      body.receiveShadow = true;
      cityGroup.add(body);

      // small rooftop equipment cube
      if (Math.random() < 0.7) {
        const eq = new THREE.Mesh(
          new THREE.BoxGeometry(rand(0.6, 1.5), rand(0.4, 1), rand(0.6, 1.5)),
          makeMetal(),
        );
        eq.position.set(
          x + rand(-w / 3, w / 3),
          h + 0.4,
          z + rand(-d / 3, d / 3),
        );
        eq.castShadow = true;
        cityGroup.add(eq);
      }
      return body;
    }

    // ===== Layout buildings — diorama-style: hero tower + flanking blocks + lows =====

    // Central hero tower (tallest, slightly off-center toward back)
    buildWindowedTower(2, 5, 10, 10, 46, { warm: true });

    // Secondary tower
    buildWindowedTower(-12, 6, 7, 7, 32, { warm: true });

    // Wide back office (long, mid-rise)
    buildWindowedTower(22, 6, 22, 10, 16, { warm: true });

    // Left back mid-rise
    buildWindowedTower(-30, 5, 10, 8, 14, { warm: true });

    // Right back slim block
    buildWindowedTower(40, 5, 8, 8, 18, { warm: false });

    // Far left office
    buildWindowedTower(-44, 4, 8, 7, 12, { warm: true });

    // Front-row low industrials (left to right)
    buildLowIndustrial(-52, -22, 12, 8, 4.5);
    buildLowIndustrial(-38, -22, 8, 7, 3.5, true); // brick warehouse
    buildLowIndustrial(-26, -22, 8, 7, 4);
    buildLowIndustrial(-14, -22, 6, 6, 3.5);
    buildLowIndustrial(0, -22, 10, 8, 5, true);
    buildLowIndustrial(14, -22, 8, 7, 4);
    buildLowIndustrial(26, -22, 7, 7, 4.5);
    buildLowIndustrial(42, -22, 9, 8, 4);

    // Mid-row small office blocks between roads
    buildLowIndustrial(-20, 0, 5, 5, 6);
    buildLowIndustrial(10, 0, 5, 5, 5.5);
    buildLowIndustrial(34, 0, 5, 5, 6.5);

    // ===== Central plaza with trees (between buildings) =====
    const plazaCenter = new THREE.Vector3(-2, 0, -6);
    const plazaMat = new THREE.MeshStandardMaterial({
      color: 0x2a2d34,
      roughness: 0.85,
      metalness: 0.05,
    });
    const plaza = new THREE.Mesh(
      new THREE.CircleGeometry(5, 24),
      plazaMat,
    );
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.copy(plazaCenter).setY(0.06);
    plaza.receiveShadow = true;
    cityGroup.add(plaza);

    // Plaza fountain (cylinder)
    const fountain = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.7, 1.2, 16),
      makeMetal(),
    );
    fountain.position.copy(plazaCenter).setY(0.6);
    fountain.castShadow = true;
    cityGroup.add(fountain);

    // ===== Trees (instanced cone + sphere clusters) =====
    function addTree(x: number, z: number, scale = 1) {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08 * scale, 0.1 * scale, 0.7 * scale, 6),
        new THREE.MeshStandardMaterial({ color: 0x2a1f15, roughness: 1 }),
      );
      trunk.position.set(x, 0.35 * scale, z);
      cityGroup.add(trunk);
      const foliage = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.7 * scale, 1),
        new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(0.28, 0.35, 0.18 + Math.random() * 0.06),
          roughness: 0.95,
        }),
      );
      foliage.position.set(x, 0.95 * scale, z);
      foliage.castShadow = true;
      cityGroup.add(foliage);
    }
    // Plaza tree ring
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 3.4 + Math.random() * 0.8;
      addTree(
        plazaCenter.x + Math.cos(a) * r,
        plazaCenter.z + Math.sin(a) * r,
        0.9 + Math.random() * 0.5,
      );
    }
    // Street trees along front avenue
    for (let i = -55; i <= 55; i += 6) {
      if (Math.abs(i + 2) < 6) continue; // gap near plaza
      addTree(i, -16, 0.7);
    }

    // ===== Elevated highway on the right side, curving over the plate =====
    const highwayGroup = new THREE.Group();
    cityGroup.add(highwayGroup);

    const highwayMat = new THREE.MeshStandardMaterial({
      color: 0x1c1f26,
      roughness: 0.9,
      metalness: 0.1,
    });
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x33363c,
      roughness: 0.7,
      metalness: 0.3,
    });

    // Highway runs along x near the back/right, raised on pillars
    const HW_Y = 5.5;
    const HW_W = 8;
    const segments = 30;
    const hwLen = 80;
    // Use a slight curve via several segments
    for (let i = 0; i < segments; i++) {
      const tA = i / segments;
      const tB = (i + 1) / segments;
      const xA = lerp(-30, 50, tA);
      const xB = lerp(-30, 50, tB);
      const zA = 22 + Math.sin(tA * Math.PI) * -2;
      const zB = 22 + Math.sin(tB * Math.PI) * -2;
      const dx = xB - xA;
      const dz = zB - zA;
      const len = Math.hypot(dx, dz);
      const angle = Math.atan2(dz, dx);
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(len + 0.1, 0.4, HW_W),
        highwayMat,
      );
      seg.position.set((xA + xB) / 2, HW_Y, (zA + zB) / 2);
      seg.rotation.y = -angle;
      seg.castShadow = true;
      seg.receiveShadow = true;
      highwayGroup.add(seg);
      // pillars every few segments
      if (i % 4 === 0) {
        const px = (xA + xB) / 2;
        const pz = (zA + zB) / 2;
        const pillar = new THREE.Mesh(
          new THREE.BoxGeometry(1.2, HW_Y, 1.2),
          pillarMat,
        );
        pillar.position.set(px, HW_Y / 2, pz);
        pillar.castShadow = true;
        highwayGroup.add(pillar);
      }
    }
    // Guard rails
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x9098a4,
      roughness: 0.5,
      metalness: 0.7,
    });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(hwLen, 0.3, 0.15),
        railMat,
      );
      rail.position.set(10, HW_Y + 0.4, 22 + side * (HW_W / 2 - 0.1));
      highwayGroup.add(rail);
    }

    // ===== Vehicles =====
    const vehicles: Vehicle[] = [];

    function makeCar(
      colorHex: number,
      type: "sedan" | "suv" | "bus" | "truck",
    ): {
      group: THREE.Group;
      headlightL: THREE.PointLight;
      headlightR: THREE.PointLight;
      length: number;
    } {
      const g = new THREE.Group();
      let bodyW = 1.1;
      let bodyL = 2.4;
      let bodyH = 0.7;
      let cabinH = 0.55;
      let cabinScale = 0.6;
      if (type === "suv") {
        bodyL = 2.6;
        bodyH = 0.85;
        cabinH = 0.7;
        cabinScale = 0.75;
      } else if (type === "bus") {
        bodyL = 4.5;
        bodyW = 1.3;
        bodyH = 1.3;
        cabinH = 0;
      } else if (type === "truck") {
        bodyL = 3.8;
        bodyW = 1.3;
        bodyH = 1.4;
        cabinH = 0;
      }

      const bodyMat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.35,
        metalness: 0.7,
      });
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(bodyL, bodyH, bodyW),
        bodyMat,
      );
      body.position.y = bodyH / 2 + 0.12;
      body.castShadow = true;
      g.add(body);

      if (cabinH > 0) {
        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(bodyL * cabinScale, cabinH, bodyW * 0.95),
          new THREE.MeshStandardMaterial({
            color: 0x0a0d12,
            roughness: 0.2,
            metalness: 0.9,
          }),
        );
        cabin.position.set(-bodyL * 0.05, bodyH + cabinH / 2 + 0.12, 0);
        cabin.castShadow = true;
        g.add(cabin);
      } else if (type === "bus") {
        // bus windows strip (emissive)
        const windows = new THREE.Mesh(
          new THREE.BoxGeometry(bodyL * 0.9, 0.4, bodyW * 1.01),
          new THREE.MeshStandardMaterial({
            color: 0x223,
            emissive: 0xffd089,
            emissiveIntensity: 0.6,
            roughness: 0.3,
            metalness: 0.8,
          }),
        );
        windows.position.set(0, bodyH * 0.65 + 0.12, 0);
        g.add(windows);
      }

      // Wheels
      const wheelMat = new THREE.MeshStandardMaterial({
        color: 0x0a0a0c,
        roughness: 0.9,
        metalness: 0.05,
      });
      const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.18, 12);
      const wheelOff = bodyL * 0.32;
      const wheelZ = bodyW / 2;
      for (const sx of [-wheelOff, wheelOff]) {
        for (const sz of [-wheelZ, wheelZ]) {
          const w = new THREE.Mesh(wheelGeo, wheelMat);
          w.rotation.x = Math.PI / 2;
          w.position.set(sx, 0.18, sz);
          g.add(w);
        }
      }

      // Headlights (small emissive squares + point lights)
      const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
      const hL = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.1), headMat);
      hL.position.set(bodyL / 2 + 0.01, bodyH * 0.5 + 0.12, -bodyW * 0.3);
      hL.rotation.y = Math.PI / 2;
      g.add(hL);
      const hR = hL.clone();
      hR.position.z = bodyW * 0.3;
      g.add(hR);

      const headlightL = new THREE.PointLight(0xfff0c0, 0.6, 8, 2);
      headlightL.position.set(bodyL / 2 + 0.5, 0.4, -bodyW * 0.3);
      g.add(headlightL);
      const headlightR = new THREE.PointLight(0xfff0c0, 0.6, 8, 2);
      headlightR.position.set(bodyL / 2 + 0.5, 0.4, bodyW * 0.3);
      g.add(headlightR);

      // Tail lights
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
      const tL = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.08), tailMat);
      tL.position.set(-bodyL / 2 - 0.01, bodyH * 0.55 + 0.12, -bodyW * 0.3);
      tL.rotation.y = -Math.PI / 2;
      g.add(tL);
      const tR = tL.clone();
      tR.position.z = bodyW * 0.3;
      g.add(tR);

      return { group: g, headlightL, headlightR, length: bodyL };
    }

    // Spawn vehicles on each road
    const carColors = [
      0x222428, 0x9098a0, 0x6b1f1f, 0x2c3b6a, 0xd9d6cc, 0x3a3d42, 0x1e1e22,
      0x6e6a5e,
    ];
    function spawnRoadVehicles(
      axis: "x" | "z",
      along: number,
      perpCenter: number,
      laneOffsets: number[],
      countPerLane: number,
    ) {
      laneOffsets.forEach((laneOff, laneIdx) => {
        for (let i = 0; i < countPerLane; i++) {
          const r = Math.random();
          let type: "sedan" | "suv" | "bus" | "truck" = "sedan";
          if (r > 0.92) type = "bus";
          else if (r > 0.78) type = "truck";
          else if (r > 0.55) type = "suv";
          const color = carColors[Math.floor(Math.random() * carColors.length)];
          const car = makeCar(color, type);
          const pos = (i / countPerLane) * along - along / 2;
          // direction by lane index
          const dir = laneIdx % 2 === 0 ? 1 : -1;
          if (axis === "x") {
            car.group.position.set(pos, 0.05, perpCenter + laneOff);
            car.group.rotation.y = dir > 0 ? 0 : Math.PI;
          } else {
            car.group.position.set(perpCenter + laneOff, 0.05, pos);
            car.group.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
          }
          cityGroup.add(car.group);
          vehicles.push({
            group: car.group,
            axis,
            lane: perpCenter + laneOff,
            y: 0.05,
            speed: dir * (2.5 + Math.random() * 2.5),
            pos,
            range: along / 2,
            headlightL: car.headlightL,
            headlightR: car.headlightR,
          });
        }
      });
    }

    // Front avenue (z=-12), two lanes
    spawnRoadVehicles("x", cityLength, -12, [-1.6, 1.6], 5);
    // Back avenue (z=14), two lanes
    spawnRoadVehicles("x", cityLength, 14, [-1.4, 1.4], 4);
    // Cross streets
    spawnRoadVehicles("z", cityDepth, -30, [-1.2, 1.2], 2);
    spawnRoadVehicles("z", cityDepth, 20, [-1.2, 1.2], 2);

    // Highway vehicles (raised on HW_Y)
    function spawnHighwayVehicle(t: number, dir: 1 | -1, type: "sedan" | "suv" | "truck") {
      const color = carColors[Math.floor(Math.random() * carColors.length)];
      const car = makeCar(color, type);
      const x = lerp(-30, 50, t);
      const z = 22 + Math.sin(t * Math.PI) * -2 + (dir === 1 ? -1.6 : 1.6);
      car.group.position.set(x, HW_Y + 0.25, z);
      car.group.rotation.y = dir === 1 ? 0 : Math.PI;
      cityGroup.add(car.group);
      vehicles.push({
        group: car.group,
        axis: "x",
        lane: z,
        y: HW_Y + 0.25,
        speed: dir * (4 + Math.random() * 3),
        pos: x,
        range: 40,
        headlightL: car.headlightL,
        headlightR: car.headlightR,
      });
    }
    for (let i = 0; i < 10; i++) {
      const t = i / 10;
      spawnHighwayVehicle(t, 1, Math.random() > 0.7 ? "truck" : "sedan");
      spawnHighwayVehicle(t + 0.05, -1, Math.random() > 0.6 ? "suv" : "sedan");
    }

    // ===== Street lamps =====
    function addLamp(x: number, z: number) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 2.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x222, roughness: 0.7 }),
      );
      post.position.set(x, 1.1, z);
      cityGroup.add(post);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffd089 }),
      );
      head.position.set(x, 2.2, z);
      cityGroup.add(head);
      const lamp = new THREE.PointLight(0xffd089, 0.6, 7, 2);
      lamp.position.set(x, 2.1, z);
      cityGroup.add(lamp);
    }
    for (let i = -55; i <= 55; i += 12) {
      addLamp(i, -8);
      addLamp(i, -16);
    }

    // ===== State =====
    let scrollT = 0;
    let scrollTSmooth = 0;
    const mouseNDC = new THREE.Vector2(0, 0);
    const mouseTarget = new THREE.Vector2(0, 0);
    const cursorWorld = new THREE.Vector3(0, 12, 0);
    let cursorIntensity = 0;
    let cursorIntensityTarget = 0.3;

    let powerState: "on" | "off" | "restoring" = "on";
    let restoreStart = 0;
    const restoreOriginXZ = new THREE.Vector2(0, 0);

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

    // ===== Public handle =====
    const handle: CitySceneHandle = {
      setScroll(v: number) {
        scrollT = clamp(v, 0, 1);
      },
      togglePower(clientX, clientY) {
        if (powerState === "on") {
          powerState = "off";
          for (const b of buildings) b.emissiveTarget = 0;
        } else {
          powerState = "restoring";
          restoreStart = performance.now() / 1000;
          const rect = renderer.domElement.getBoundingClientRect();
          const ndc = new THREE.Vector2(
            ((clientX - rect.left) / rect.width) * 2 - 1,
            -((clientY - rect.top) / rect.height) * 2 + 1,
          );
          raycaster.setFromCamera(ndc, camera);
          const p = new THREE.Vector3();
          raycaster.ray.intersectPlane(groundPlane, p);
          restoreOriginXZ.set(p.x, p.z);
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
            b.outageDelay = norm * 2.4 + Math.random() * 0.6;
            b.isGlitch = false;
          }
          const glitch = buildings[Math.floor(Math.random() * buildings.length)];
          if (glitch) glitch.isGlitch = true;
        }
      },
    };
    handleRef.current = handle;
    onReady?.(handle);

    // ===== Stats =====
    let lastStat = performance.now();
    let frames = 0;
    let frameMsAccum = 0;

    // ===== Render loop =====
    const clock = new THREE.Clock();
    let raf = 0;

    function render() {
      raf = requestAnimationFrame(render);
      const tStart = performance.now();
      const dt = Math.min(clock.getDelta(), 0.05);

      scrollTSmooth = lerp(scrollTSmooth, scrollT, 1 - Math.pow(0.001, dt));
      mouseNDC.x = lerp(mouseNDC.x, mouseTarget.x, 1 - Math.pow(0.0001, dt));
      mouseNDC.y = lerp(mouseNDC.y, mouseTarget.y, 1 - Math.pow(0.0001, dt));

      // Cursor world position via ray on plane y=8
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

      // ----- Sky + fog interpolation -----
      const skyTop = SKY_TOP_DAY.clone().lerp(SKY_TOP_NIGHT, scrollTSmooth);
      const skyBot = SKY_BOT_DAY.clone().lerp(SKY_BOT_NIGHT, scrollTSmooth);
      updateGradientTexture(skyTex, skyTop, skyBot);
      const fogCol = FOG_DAY.clone().lerp(FOG_NIGHT, scrollTSmooth);
      (scene.fog as THREE.FogExp2).color.copy(fogCol);
      (scene.fog as THREE.FogExp2).density = lerp(0.010, 0.022, scrollTSmooth);

      ambient.intensity = lerp(0.55, 0.22, scrollTSmooth);
      keyLight.intensity = lerp(1.1, 0.35, scrollTSmooth);
      hemi.intensity = lerp(0.4, 0.15, scrollTSmooth);

      // ----- Camera dolly: subtle dolly + mouse parallax -----
      const camY = lerp(40, 22, scrollTSmooth);
      const camZ = lerp(98, 70, scrollTSmooth);
      const camX = mouseNDC.x * lerp(6, 12, scrollTSmooth);
      camera.position.set(
        lerp(camera.position.x, camX, 1 - Math.pow(0.001, dt)),
        lerp(camera.position.y, camY, 1 - Math.pow(0.001, dt)),
        lerp(camera.position.z, camZ, 1 - Math.pow(0.001, dt)),
      );
      const lookY = lerp(7, 12, scrollTSmooth) + mouseNDC.y * -2;
      camera.lookAt(0, lookY, 0);

      // ----- Cursor light -----
      cursorLight.position.set(cursorWorld.x, 18, cursorWorld.z);
      const nightBoost = lerp(0.4, 1.0, scrollTSmooth);
      const intensity = cursorIntensity * nightBoost;
      cursorLight.intensity = intensity * 24 * (powerState === "off" ? 0.4 : 1);
      cursorLight.distance = lerp(60, 95, scrollTSmooth);

      glowSprite.position.set(cursorWorld.x, 14, cursorWorld.z);
      glowMat.opacity = clamp(
        intensity * 0.5 * (powerState === "off" ? 0.6 : 1),
        0,
        0.6,
      );
      glowSprite.scale.setScalar(lerp(28, 44, scrollTSmooth));

      // ----- Buildings emissive -----
      const baseOnByTime = clamp((scrollTSmooth - 0.05) / 0.55, 0, 1);
      const tNow = performance.now() / 1000;

      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i];
        const mats = b.mesh.material as THREE.Material[];

        if (powerState === "on") b.emissiveTarget = 1;
        else if (powerState === "off") b.emissiveTarget = 0;
        else if (powerState === "restoring") {
          const elapsed = tNow - restoreStart;
          if (elapsed >= b.outageDelay) b.emissiveTarget = 1;
          else b.emissiveTarget = 0;
          if (i === buildings.length - 1 && elapsed > 4) powerState = "on";
        }

        b.emissiveCurrent = lerp(
          b.emissiveCurrent,
          b.emissiveTarget,
          1 - Math.pow(0.0008, dt),
        );

        const dx = b.basePos.x - cursorWorld.x;
        const dz = b.basePos.z - cursorWorld.z;
        const distSq = dx * dx + dz * dz;
        const proximity = Math.exp(-distSq / 600);
        const proxBoost = proximity * intensity * 0.9;

        const glitchActive =
          powerState === "restoring" &&
          b.isGlitch &&
          tNow - restoreStart > b.outageDelay &&
          tNow - restoreStart < b.outageDelay + 0.6;

        const baseGlow = b.emissiveCurrent * baseOnByTime * 1.4 + proxBoost;

        // Apply to side and front materials (indices 0,1,4,5)
        for (const idx of [0, 1, 4, 5]) {
          const m = mats[idx] as THREE.MeshStandardMaterial;
          if (glitchActive) {
            m.emissive.setHex(0xff3a8a);
            m.emissiveIntensity =
              (0.6 + Math.sin((tNow - restoreStart) * 60) * 0.4) * 2.0;
          } else {
            m.emissive.setHex(0xffffff);
            m.emissiveIntensity = baseGlow;
          }
        }
      }

      // ----- Vehicles update -----
      for (const v of vehicles) {
        v.pos += v.speed * dt;
        if (v.pos > v.range) v.pos = -v.range;
        else if (v.pos < -v.range) v.pos = v.range;
        if (v.axis === "x") {
          v.group.position.x = v.pos;
          v.group.position.z = v.lane;
          v.group.position.y = v.y;
        } else {
          v.group.position.z = v.pos;
          v.group.position.x = v.lane;
          v.group.position.y = v.y;
        }
        // Headlights stronger at night
        const hi = lerp(0.0, 1.4, scrollTSmooth) * (powerState === "off" ? 0.2 : 1);
        v.headlightL.intensity = hi;
        v.headlightR.intensity = hi;
      }

      renderer.render(scene, camera);

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
      skyTex.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}

// ===== Helpers =====

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
  g.addColorStop(0, "rgba(255,210,140,0.95)");
  g.addColorStop(0.35, "rgba(255,180,100,0.4)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeGradientTexture(top: THREE.Color, bot: THREE.Color): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  drawGradient(ctx, c.width, c.height, top, bot);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function updateGradientTexture(
  tex: THREE.CanvasTexture,
  top: THREE.Color,
  bot: THREE.Color,
) {
  const c = tex.image as HTMLCanvasElement;
  const ctx = c.getContext("2d")!;
  drawGradient(ctx, c.width, c.height, top, bot);
  tex.needsUpdate = true;
}

function drawGradient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  top: THREE.Color,
  bot: THREE.Color,
) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `#${top.getHexString()}`);
  g.addColorStop(1, `#${bot.getHexString()}`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
