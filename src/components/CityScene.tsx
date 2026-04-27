import { useEffect, useRef } from "react";
import * as THREE from "three";

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

export default function CityScene({ onReady, onStats }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<CitySceneHandle | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    // --- SETUP ---
    const w = mountRef.current.clientWidth;
    const h = mountRef.current.clientHeight;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x111116, 0.015);

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 500);
    camera.position.set(0, 35, 45);
    camera.lookAt(0, 0, 0);

    // --- LIGHTING ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xfff0dd, 2.5);
    dirLight.position.set(20, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    dirLight.shadow.camera.left = -30;
    dirLight.shadow.camera.right = 30;
    dirLight.shadow.camera.top = 30;
    dirLight.shadow.camera.bottom = -30;
    dirLight.shadow.bias = -0.0005;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x88bbff, 0.8);
    fillLight.position.set(-20, 30, -20);
    scene.add(fillLight);

    // --- DIORAMA BASE ---
    const dioramaGroup = new THREE.Group();
    scene.add(dioramaGroup);

    // Wooden Base Rim
    const woodGeo = new THREE.BoxGeometry(52, 2, 36);
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3b32, roughness: 0.9 });
    const woodBase = new THREE.Mesh(woodGeo, woodMat);
    woodBase.position.y = -1.1;
    woodBase.receiveShadow = true;
    dioramaGroup.add(woodBase);

    // Concrete/Asphalt Ground
    const groundGeo = new THREE.BoxGeometry(50, 0.2, 34);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    dioramaGroup.add(ground);

    // --- MATERIALS ---
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x333335, roughness: 0.7 });
    const darkBuildingMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.8 });
    const windowMat = new THREE.MeshStandardMaterial({ 
      color: 0xffddaa, 
      emissive: 0xffbbaa, 
      emissiveIntensity: 2.0 
    });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x2a3b22, roughness: 1.0 });
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1a2b12, roughness: 0.9 });

    const windowsArray: THREE.Mesh[] = [];

    // Helper: Create a building with glowing windows
    function createBuilding(w: number, h: number, d: number, x: number, z: number, hasWindows=true, mat=buildingMat) {
      const group = new THREE.Group();
      group.position.set(x, h/2, z);
      
      const core = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      core.castShadow = true;
      core.receiveShadow = true;
      group.add(core);

      if (hasWindows) {
        // Simple window patterns
        const rows = Math.floor(h / 1.5);
        const colsX = Math.floor(w / 1.5);
        const colsZ = Math.floor(d / 1.5);
        
        const winGeo = new THREE.PlaneGeometry(0.8, 0.8);
        
        // Front & Back
        for (let r=0; r<rows; r++) {
          for (let c=0; c<colsX; c++) {
            if (Math.random() > 0.3) {
              const wx = (c - colsX/2 + 0.5) * 1.5;
              const wy = (r - rows/2 + 0.5) * 1.5;
              
              const winF = new THREE.Mesh(winGeo, windowMat);
              winF.position.set(wx, wy, d/2 + 0.01);
              windowsArray.push(winF);
              group.add(winF);
              
              const winB = new THREE.Mesh(winGeo, windowMat);
              winB.rotation.y = Math.PI;
              winB.position.set(wx, wy, -d/2 - 0.01);
              windowsArray.push(winB);
              group.add(winB);
            }
          }
        }
        
        // Left & Right
        for (let r=0; r<rows; r++) {
          for (let c=0; c<colsZ; c++) {
            if (Math.random() > 0.3) {
              const wz = (c - colsZ/2 + 0.5) * 1.5;
              const wy = (r - rows/2 + 0.5) * 1.5;
              
              const winL = new THREE.Mesh(winGeo, windowMat);
              winL.rotation.y = -Math.PI/2;
              winL.position.set(-w/2 - 0.01, wy, wz);
              windowsArray.push(winL);
              group.add(winL);
              
              const winR = new THREE.Mesh(winGeo, windowMat);
              winR.rotation.y = Math.PI/2;
              winR.position.set(w/2 + 0.01, wy, wz);
              windowsArray.push(winR);
              group.add(winR);
            }
          }
        }
      }
      
      dioramaGroup.add(group);
      return group;
    }

    // --- BUILDINGS ---
    // Main Skyscraper (Center/Back)
    createBuilding(6, 28, 6, 2, -6);
    // Skyscraper Top (Pyramid/Slanted)
    const topGeo = new THREE.ConeGeometry(4.24, 6, 4);
    topGeo.rotateY(Math.PI/4);
    const topMesh = new THREE.Mesh(topGeo, buildingMat);
    topMesh.position.set(2, 31, -6);
    dioramaGroup.add(topMesh);

    // Medium Office 1 (Left)
    createBuilding(8, 14, 6, -8, -4);
    
    // Medium Office 2 (Front Left)
    createBuilding(6, 10, 6, -7, 6);

    // Medium Office 3 (Right)
    createBuilding(6, 16, 6, 10, -5);

    // Low Warehouse 1 (Far Left)
    createBuilding(10, 6, 8, -18, 0, false, darkBuildingMat);
    
    // Low Warehouse 2 (Front Far Left)
    createBuilding(8, 4, 6, -18, 9, false, darkBuildingMat);

    // --- PARK (Front Right) ---
    const parkGeo = new THREE.BoxGeometry(12, 0.5, 10);
    const parkMesh = new THREE.Mesh(parkGeo, grassMat);
    parkMesh.position.set(8, 0.25, 8);
    parkMesh.receiveShadow = true;
    dioramaGroup.add(parkMesh);

    // Park Trees
    const treeGeom = new THREE.SphereGeometry(0.8, 8, 8);
    for(let i=0; i<15; i++) {
      const tree = new THREE.Mesh(treeGeom, treeMat);
      tree.position.set(
        8 + (Math.random() - 0.5) * 10,
        0.8 + Math.random() * 0.5,
        8 + (Math.random() - 0.5) * 8
      );
      tree.castShadow = true;
      dioramaGroup.add(tree);
    }

    // --- ELEVATED HIGHWAY (Far Right) ---
    const viaductGroup = new THREE.Group();
    dioramaGroup.add(viaductGroup);
    
    // Road Deck
    const deckGeo = new THREE.BoxGeometry(6, 0.5, 34);
    const deckMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(20, 6, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    viaductGroup.add(deck);

    // Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.5, 6);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
    for(let z=-14; z<=14; z+=7) {
      const p1 = new THREE.Mesh(pillarGeo, pillarMat);
      p1.position.set(18.5, 3, z);
      p1.castShadow = true;
      viaductGroup.add(p1);
      
      const p2 = new THREE.Mesh(pillarGeo, pillarMat);
      p2.position.set(21.5, 3, z);
      p2.castShadow = true;
      viaductGroup.add(p2);
    }

    // --- CARS (Animated) ---
    const cars: { mesh: THREE.Mesh, speed: number, z: number, x: number, y: number }[] = [];
    const carGeo = new THREE.BoxGeometry(0.8, 0.6, 1.8);
    const carMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 });
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    function createCar(x: number, y: number, z: number, speed: number) {
      const car = new THREE.Group();
      car.position.set(x, y, z);
      
      const body = new THREE.Mesh(carGeo, carMat);
      body.castShadow = true;
      car.add(body);
      
      // Lights
      const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), tailMat);
      tl.position.set(-0.25, 0, speed > 0 ? -0.91 : 0.91);
      tl.rotation.y = speed > 0 ? Math.PI : 0;
      car.add(tl);
      
      const tr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), tailMat);
      tr.position.set(0.25, 0, speed > 0 ? -0.91 : 0.91);
      tr.rotation.y = speed > 0 ? Math.PI : 0;
      car.add(tr);

      const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), headMat);
      hl.position.set(-0.25, 0, speed > 0 ? 0.91 : -0.91);
      hl.rotation.y = speed > 0 ? 0 : Math.PI;
      car.add(hl);
      
      const hr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.1), headMat);
      hr.position.set(0.25, 0, speed > 0 ? 0.91 : -0.91);
      hr.rotation.y = speed > 0 ? 0 : Math.PI;
      car.add(hr);

      dioramaGroup.add(car);
      cars.push({ mesh: car as any, speed, z, x, y });
    }

    // Add cars on viaduct
    createCar(19, 6.4, 10, 0.15);
    createCar(19, 6.4, -5, 0.12);
    createCar(21, 6.4, 0, -0.18);
    createCar(21, 6.4, 12, -0.14);

    // Add cars on ground road (x=1)
    createCar(0, 0.4, 5, 0.08);
    createCar(2, 0.4, -8, -0.09);


    // --- STATE & ANIMATION ---
    let time = 0;
    let powerState = 1.0; // 1 = on, 0 = off
    let scrollPos = 0;
    
    // Smooth camera interpolation
    let targetCamX = 0;
    let targetCamY = 35;
    let targetCamZ = 45;

    let frames = 0;
    let lastTime = performance.now();

    const renderLoop = () => {
      requestAnimationFrame(renderLoop);
      time += 0.016;

      // Animate cars
      cars.forEach(car => {
        car.z += car.speed;
        if (car.z > 17) car.z = -17;
        if (car.z < -17) car.z = 17;
        car.mesh.position.z = car.z;
      });

      // Camera Scroll Effect
      // Scroll shifts the camera slightly down and rotates around the diorama
      targetCamY = 35 - scrollPos * 15;
      targetCamZ = 45 - scrollPos * 10;
      targetCamX = Math.sin(scrollPos * 2) * 15;

      camera.position.x += (targetCamX - camera.position.x) * 0.05;
      camera.position.y += (targetCamY - camera.position.y) * 0.05;
      camera.position.z += (targetCamZ - camera.position.z) * 0.05;
      camera.lookAt(0, 5, 0);

      // Power outage effect
      if (powerState < 1.0) {
        powerState -= 0.05;
        if (powerState < 0) powerState = 0;
      }
      
      // Flicker windows
      windowMat.emissiveIntensity = powerState > 0 ? 2.0 + Math.sin(time * 10) * 0.2 : 0;
      
      renderer.render(scene, camera);

      // Stats
      frames++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        onStats?.({
          fps: frames,
          ms: renderer.info.render.frame,
          draws: renderer.info.render.calls,
        });
        frames = 0;
        lastTime = now;
      }
    };
    renderLoop();

    // --- EXPORT HANDLE ---
    handleRef.current = {
      setScroll: (v) => {
        scrollPos = v;
      },
      togglePower: () => {
        powerState = powerState > 0 ? 0.99 : 1.0; // trigger outage
      },
    };
    if (onReady) onReady(handleRef.current);

    // --- CLEANUP ---
    const handleResize = () => {
      if (!mountRef.current) return;
      const nw = mountRef.current.clientWidth;
      const nh = mountRef.current.clientHeight;
      renderer.setSize(nw, nh);
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 bg-[#111116]"
      style={{ touchAction: "none" }}
    />
  );
}
