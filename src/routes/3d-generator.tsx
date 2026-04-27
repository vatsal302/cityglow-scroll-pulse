import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import PageShell from "@/components/PageShell";
import Reveal from "@/components/Reveal";
import { supabase } from "@/integrations/supabase/client";
import { Upload, Download, RefreshCw, Loader2, Sparkles, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/3d-generator")({
  head: () => ({
    meta: [
      { title: "3D Generator — Urbanmesh" },
      {
        name: "description",
        content: "Upload a photograph of a building or vehicle. Our AI returns a navigable, web-ready 3D model preview.",
      },
      { property: "og:title", content: "3D Generator — Urbanmesh" },
      {
        property: "og:description",
        content: "Image-to-3D AI preview. Rotate, zoom, download.",
      },
    ],
  }),
  component: GeneratorPage,
});

type Analysis = {
  kind: "building" | "vehicle" | "structure";
  width: number; // meters
  depth: number;
  height: number;
  baseColor: string; // hex
  accentColor: string; // hex
  windowDensity: number; // 0..1
  roofStyle: "flat" | "pitched" | "domed";
  notes: string;
};

function GeneratorPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");

  const viewerRef = useRef<HTMLDivElement | null>(null);
  const sceneApiRef = useRef<{ rebuild: (a: Analysis, tex?: string) => void; exportGLB: () => Promise<Blob>; dispose: () => void } | null>(null);

  // Init Three.js viewer once
  useEffect(() => {
    const mount = viewerRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#0a0d1f");
    scene.fog = new THREE.Fog("#0a0d1f", 12, 38);

    const w = mount.clientWidth;
    const h = mount.clientHeight;
    const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100);
    camera.position.set(7, 5, 9);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // Lights
    const hemi = new THREE.HemisphereLight(0x9fb6ff, 0x1a1530, 0.55);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(8, 12, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 10;
    key.shadow.camera.bottom = -10;
    scene.add(key);
    const fill = new THREE.PointLight(0xb088ff, 1.2, 30);
    fill.position.set(-6, 4, -3);
    scene.add(fill);
    const rim = new THREE.PointLight(0x66ccff, 0.9, 30);
    rim.position.set(6, 3, -6);
    scene.add(rim);

    // Ground disc
    const groundGeo = new THREE.CircleGeometry(14, 64);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f3a,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(28, 28, 0x6677aa, 0x222a44);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.18;
    scene.add(grid);

    // Model holder
    const holder = new THREE.Group();
    scene.add(holder);

    // Default placeholder building
    function buildModel(a: Analysis, textureDataUrl?: string) {
      // clear
      while (holder.children.length) {
        const c = holder.children.pop()!;
        c.traverse((o) => {
          // @ts-expect-error - geom
          o.geometry?.dispose?.();
          // @ts-expect-error - mat
          o.material?.dispose?.();
        });
      }

      const baseColor = new THREE.Color(a.baseColor);
      const accentColor = new THREE.Color(a.accentColor);

      // Optional texture from uploaded image, used as façade map
      let facadeTex: THREE.Texture | undefined;
      if (textureDataUrl) {
        facadeTex = new THREE.TextureLoader().load(textureDataUrl);
        facadeTex.wrapS = THREE.RepeatWrapping;
        facadeTex.wrapT = THREE.RepeatWrapping;
        facadeTex.colorSpace = THREE.SRGBColorSpace;
      }

      if (a.kind === "vehicle") {
        // Vehicle: chassis + cabin + wheels
        const chassis = new THREE.Mesh(
          new THREE.BoxGeometry(a.width, a.height * 0.45, a.depth),
          new THREE.MeshStandardMaterial({
            color: baseColor,
            roughness: 0.32,
            metalness: 0.7,
            map: facadeTex,
          })
        );
        chassis.position.y = a.height * 0.35;
        chassis.castShadow = true;
        holder.add(chassis);

        const cabin = new THREE.Mesh(
          new THREE.BoxGeometry(a.width * 0.7, a.height * 0.45, a.depth * 0.85),
          new THREE.MeshPhysicalMaterial({
            color: 0x111824,
            roughness: 0.08,
            metalness: 0.4,
            transmission: 0.4,
            ior: 1.4,
            clearcoat: 1,
          })
        );
        cabin.position.y = a.height * 0.7;
        cabin.castShadow = true;
        holder.add(cabin);

        const wheelGeo = new THREE.CylinderGeometry(a.height * 0.22, a.height * 0.22, a.width * 0.18, 24);
        const wheelMat = new THREE.MeshStandardMaterial({ color: 0x101010, roughness: 0.85, metalness: 0.2 });
        const offsetsX = [a.width * 0.42, -a.width * 0.42];
        const offsetsZ = [a.depth * 0.38, -a.depth * 0.38];
        for (const ox of offsetsX) {
          for (const oz of offsetsZ) {
            const wheel = new THREE.Mesh(wheelGeo, wheelMat);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(ox, a.height * 0.22, oz);
            wheel.castShadow = true;
            holder.add(wheel);
          }
        }

        // Headlights
        const hlGeo = new THREE.SphereGeometry(0.08, 16, 16);
        const hlMat = new THREE.MeshStandardMaterial({
          color: 0xfff2c8,
          emissive: 0xfff0b0,
          emissiveIntensity: 2.5,
        });
        for (const ox of [a.width * 0.32, -a.width * 0.32]) {
          const hl = new THREE.Mesh(hlGeo, hlMat);
          hl.position.set(ox, a.height * 0.45, a.depth * 0.5);
          holder.add(hl);
        }
      } else {
        // Building: stack of floors with windowed façade
        const cols = Math.max(4, Math.round(a.width * 3));
        const rows = Math.max(6, Math.round(a.height * 2.5));

        // Procedural window texture
        const cnv = document.createElement("canvas");
        cnv.width = cols * 24;
        cnv.height = rows * 24;
        const ctx = cnv.getContext("2d")!;
        ctx.fillStyle = `rgb(${Math.round(baseColor.r * 90)}, ${Math.round(baseColor.g * 90)}, ${Math.round(baseColor.b * 90)})`;
        ctx.fillRect(0, 0, cnv.width, cnv.height);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const lit = Math.random() < a.windowDensity;
            const cx = x * 24 + 4;
            const cy = y * 24 + 4;
            ctx.fillStyle = lit
              ? `rgba(255, 220, 150, ${0.65 + Math.random() * 0.3})`
              : "rgba(40, 50, 80, 0.7)";
            ctx.fillRect(cx, cy, 16, 16);
            ctx.fillStyle = "rgba(0,0,0,0.35)";
            ctx.fillRect(cx + 7, cy, 2, 16);
            ctx.fillRect(cx, cy + 7, 16, 2);
          }
        }
        const facadeProcedural = new THREE.CanvasTexture(cnv);
        facadeProcedural.colorSpace = THREE.SRGBColorSpace;

        const buildingGeo = new THREE.BoxGeometry(a.width, a.height, a.depth);
        const buildingMat = new THREE.MeshStandardMaterial({
          map: facadeProcedural,
          roughness: 0.55,
          metalness: 0.25,
          color: 0xffffff,
        });
        const building = new THREE.Mesh(buildingGeo, buildingMat);
        building.position.y = a.height / 2;
        building.castShadow = true;
        building.receiveShadow = true;
        holder.add(building);

        // Roof
        if (a.roofStyle === "pitched") {
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(Math.max(a.width, a.depth) * 0.72, a.height * 0.25, 4),
            new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.7 })
          );
          roof.rotation.y = Math.PI / 4;
          roof.position.y = a.height + a.height * 0.125;
          roof.castShadow = true;
          holder.add(roof);
        } else if (a.roofStyle === "domed") {
          const dome = new THREE.Mesh(
            new THREE.SphereGeometry(Math.min(a.width, a.depth) * 0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
            new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.4, metalness: 0.5 })
          );
          dome.position.y = a.height;
          dome.castShadow = true;
          holder.add(dome);
        } else {
          // Flat roof with rooftop unit
          const unit = new THREE.Mesh(
            new THREE.BoxGeometry(a.width * 0.4, 0.3, a.depth * 0.4),
            new THREE.MeshStandardMaterial({ color: 0x333a52, roughness: 0.8 })
          );
          unit.position.y = a.height + 0.15;
          unit.castShadow = true;
          holder.add(unit);
        }

        // Plinth
        const plinth = new THREE.Mesh(
          new THREE.BoxGeometry(a.width * 1.05, 0.1, a.depth * 1.05),
          new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 })
        );
        plinth.position.y = 0.05;
        plinth.receiveShadow = true;
        holder.add(plinth);
      }
    }

    // Initial placeholder
    const defaultAnalysis: Analysis = {
      kind: "building",
      width: 3,
      depth: 3,
      height: 5,
      baseColor: "#4a5680",
      accentColor: "#7a8cc8",
      windowDensity: 0.5,
      roofStyle: "flat",
      notes: "Awaiting input.",
    };
    buildModel(defaultAnalysis);

    // Orbit controls (manual: drag to rotate, wheel to zoom)
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let azimuth = Math.PI * 0.25;
    let elevation = Math.PI * 0.25;
    let radius = 11;
    let autoRotate = true;

    const setCamera = () => {
      const x = Math.sin(azimuth) * Math.cos(elevation) * radius;
      const y = Math.sin(elevation) * radius;
      const z = Math.cos(azimuth) * Math.cos(elevation) * radius;
      camera.position.set(x, Math.max(1, y), z);
      camera.lookAt(0, 2, 0);
    };
    setCamera();

    const onDown = (e: PointerEvent) => {
      isDragging = true;
      autoRotate = false;
      lastX = e.clientX;
      lastY = e.clientY;
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!isDragging) return;
      azimuth -= (e.clientX - lastX) * 0.005;
      elevation = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, elevation + (e.clientY - lastY) * 0.005));
      lastX = e.clientX;
      lastY = e.clientY;
      setCamera();
    };
    const onUp = () => {
      isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(4, Math.min(22, radius + e.deltaY * 0.01));
      setCamera();
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    let raf = 0;
    const animate = () => {
      if (autoRotate) {
        azimuth += 0.0025;
        setCamera();
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    };
    animate();

    const ro = new ResizeObserver(() => {
      const W = mount.clientWidth;
      const H = mount.clientHeight;
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
      renderer.setSize(W, H);
    });
    ro.observe(mount);

    sceneApiRef.current = {
      rebuild: (a, tex) => {
        autoRotate = true;
        buildModel(a, tex);
      },
      exportGLB: async () => {
        const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
        const exporter = new GLTFExporter();
        return new Promise<Blob>((resolve, reject) => {
          exporter.parse(
            holder,
            (result) => {
              const blob =
                result instanceof ArrayBuffer
                  ? new Blob([result], { type: "model/gltf-binary" })
                  : new Blob([JSON.stringify(result)], { type: "model/gltf+json" });
              resolve(blob);
            },
            (err) => reject(err),
            { binary: true }
          );
        });
      },
      dispose: () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.domElement.removeEventListener("pointerdown", onDown);
        renderer.domElement.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        renderer.domElement.removeEventListener("wheel", onWheel);
        renderer.dispose();
        if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
      },
    };

    return () => {
      sceneApiRef.current?.dispose();
      sceneApiRef.current = null;
    };
  }, []);

  function onFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image (PNG, JPG or WEBP).");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Image is too large. Max 8MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = reader.result as string;
      setImageDataUrl(url);
      setImageUrl(url);
    };
    reader.readAsDataURL(file);
  }

  async function generate() {
    if (!imageDataUrl) {
      toast.error("Upload an image first.");
      return;
    }
    setLoading(true);
    setProgress("Reading façade…");
    try {
      const { data, error } = await supabase.functions.invoke("analyze-image-3d", {
        body: { imageUrl: imageDataUrl },
      });
      if (error) throw error;
      if (!data?.analysis) throw new Error("Empty response");
      setProgress("Composing geometry…");
      await new Promise((r) => setTimeout(r, 350));
      setAnalysis(data.analysis as Analysis);
      sceneApiRef.current?.rebuild(data.analysis as Analysis, imageDataUrl);
      toast.success("Model ready. Drag to rotate.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed";
      // Fallback: build a heuristic model without AI
      const fallback: Analysis = {
        kind: "building",
        width: 3,
        depth: 3,
        height: 5,
        baseColor: "#4f5e8a",
        accentColor: "#8aa1d8",
        windowDensity: 0.6,
        roofStyle: "flat",
        notes: "Heuristic preview (AI unavailable).",
      };
      setAnalysis(fallback);
      sceneApiRef.current?.rebuild(fallback, imageDataUrl);
      toast.warning(`Using heuristic preview · ${msg}`);
    } finally {
      setLoading(false);
      setProgress("");
    }
  }

  async function downloadGLB() {
    const api = sceneApiRef.current;
    if (!api) return;
    try {
      const blob = await api.exportGLB();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `urbanmesh-model-${Date.now()}.glb`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Model downloaded.");
    } catch {
      toast.error("Export failed.");
    }
  }

  return (
    <PageShell
      eyebrow="§05 — 3D Generator · Beta"
      title={
        <>
          A photograph in. <span className="text-gradient">A model out.</span>
        </>
      }
      lede="Upload a building or vehicle. Our model reads façades, mass and material, then composes a navigable, web-ready 3D asset in seconds."
    >
      <div className="grid gap-6 md:grid-cols-[380px_1fr]">
        {/* Upload + controls */}
        <div className="space-y-4">
          <Reveal>
            <DropZone imageUrl={imageUrl} onFile={onFile} />
          </Reveal>

          <Reveal delay={120}>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={generate}
                disabled={loading || !imageDataUrl}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--energy)] px-5 py-3 text-sm font-medium text-background transition-transform hover:-translate-y-px active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {progress || "Generating…"}
                  </>
                ) : analysis ? (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate 3D model
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={downloadGLB}
                disabled={!analysis}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3 text-sm font-medium text-foreground/85 transition-colors hover:bg-white/10 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Download className="h-4 w-4" />
                Download .glb
              </button>
            </div>
          </Reveal>

          {analysis && (
            <Reveal delay={160}>
              <div className="glass rounded-2xl p-5">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/55">
                  Inferred properties
                </p>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Prop label="Kind" v={analysis.kind} />
                  <Prop label="Roof" v={analysis.roofStyle} />
                  <Prop label="W × D × H" v={`${analysis.width.toFixed(1)} × ${analysis.depth.toFixed(1)} × ${analysis.height.toFixed(1)}`} />
                  <Prop label="Window density" v={`${Math.round(analysis.windowDensity * 100)}%`} />
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">Palette</span>
                    <span className="inline-block h-4 w-8 rounded-sm ring-1 ring-white/10" style={{ background: analysis.baseColor }} />
                    <span className="inline-block h-4 w-8 rounded-sm ring-1 ring-white/10" style={{ background: analysis.accentColor }} />
                  </div>
                </dl>
                {analysis.notes && (
                  <p className="mt-3 text-xs leading-relaxed text-foreground/55">{analysis.notes}</p>
                )}
              </div>
            </Reveal>
          )}
        </div>

        {/* Viewer */}
        <Reveal delay={120}>
          <div className="relative overflow-hidden rounded-2xl border border-white/10 glow-ring">
            <div ref={viewerRef} className="block h-[480px] w-full md:h-[640px]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
              <div className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-foreground/70">
                <span className="mr-2 inline-block h-1.5 w-1.5 translate-y-[-1px] rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                WebGL · PBR · auto-rotate
              </div>
              <div className="font-mono text-[10.5px] tabular-nums text-foreground/70">
                drag · wheel · zoom
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </PageShell>
  );
}

function Prop({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-foreground/55">{label}</dt>
      <dd className="mt-0.5 capitalize text-foreground/90">{v}</dd>
    </div>
  );
}

function DropZone({ imageUrl, onFile }: { imageUrl: string | null; onFile: (f: File) => void }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed transition-colors ${
        over ? "border-[var(--neon-violet)] bg-white/[0.05]" : "border-white/15 bg-white/[0.03] hover:bg-white/[0.05]"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {imageUrl ? (
        <div className="relative">
          <img src={imageUrl} alt="Uploaded reference" className="block h-56 w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-background/60 px-3 py-2 backdrop-blur-md">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-foreground/70">
              <ImageIcon className="mr-1.5 inline h-3 w-3 align-[-2px]" />
              Reference loaded
            </span>
            <span className="font-mono text-[10.5px] text-foreground/50">click to replace</span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[var(--neon-violet)] to-[var(--energy)] text-background">
            <Upload className="h-4 w-4" />
          </span>
          <p className="mt-4 text-[15px] font-medium text-foreground">Drop an image here</p>
          <p className="mt-1 text-xs text-foreground/55">PNG, JPG or WEBP · up to 8MB</p>
        </div>
      )}
    </div>
  );
}
