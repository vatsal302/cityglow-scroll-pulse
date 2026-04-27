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

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function CityScene({ onReady, onStats }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const width = container.clientWidth;
    const height = container.clientHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0d1f");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 600);
    camera.position.set(0, 30, 40);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(20, 50, 20);
    scene.add(dirLight);

    const texLoader = new THREE.TextureLoader();
    const map = texLoader.load("/media__1777297214643.png");
    map.colorSpace = THREE.SRGBColorSpace;

    const planeGeo = new THREE.PlaneGeometry(60, 40, 512, 512);
    const planeMat = new THREE.MeshStandardMaterial({
      map: map,
      displacementMap: map,
      displacementScale: 6.0,
      roughness: 0.6,
      metalness: 0.2,
      side: THREE.DoubleSide
    });

    const plane = new THREE.Mesh(planeGeo, planeMat);
    plane.rotation.x = -Math.PI / 2;
    scene.add(plane);

    let scrollT = 0;
    const mouseTarget = new THREE.Vector2(0, 0);
    const mouseNDC = new THREE.Vector2(0, 0);

    window.addEventListener("pointermove", (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseTarget.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseTarget.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    const handle: CitySceneHandle = {
      setScroll(v: number) {
        scrollT = v;
      },
      togglePower() {}
    };
    onReady?.(handle);

    let raf = 0;
    const clock = new THREE.Clock();

    function render() {
      raf = requestAnimationFrame(render);
      const dt = Math.min(clock.getDelta(), 0.05);

      mouseNDC.x = lerp(mouseNDC.x, mouseTarget.x, 1 - Math.pow(0.0001, dt));
      mouseNDC.y = lerp(mouseNDC.y, mouseTarget.y, 1 - Math.pow(0.0001, dt));

      const camX = Math.sin(scrollT * Math.PI / 4) * 40 + mouseNDC.x * 5;
      const camY = 30 - scrollT * 15;
      const camZ = Math.cos(scrollT * Math.PI / 4) * 40 + mouseNDC.y * 5;
      
      camera.position.set(
        lerp(camera.position.x, camX, 1 - Math.pow(0.001, dt)),
        lerp(camera.position.y, camY, 1 - Math.pow(0.001, dt)),
        lerp(camera.position.z, camZ, 1 - Math.pow(0.001, dt))
      );
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    render();

    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" />;
}
