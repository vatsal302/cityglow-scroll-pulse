import { useEffect, useRef } from "react";

type Vehicle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  lane: number;
  isBus?: boolean;
  isBike?: boolean;
  flicker: number;
};

type Props = {
  density?: number; // 0..1
  className?: string;
};

/**
 * Top-down animated traffic canvas.
 * - Two cross intersections, multi-lane roads
 * - Cars, buses (longer, yellow-warm), bikes (smaller, magenta)
 * - Headlights, taillights, road markings, subtle radar sweep
 */
export function TrafficCanvas({ density = 0.6, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const densityRef = useRef(density);
  densityRef.current = density;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    const vehicles: Vehicle[] = [];

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = rect.width;
      H = rect.height;
      canvas!.width = Math.floor(W * dpr);
      canvas!.height = Math.floor(H * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Lane geometry: 4 horizontal lanes, 4 vertical lanes
    function laneY(i: number) {
      // 0..3, centered around H/2
      const spacing = 22;
      return H / 2 + (i - 1.5) * spacing;
    }
    function laneX(i: number) {
      const spacing = 22;
      return W / 2 + (i - 1.5) * spacing;
    }

    function spawn() {
      const target = Math.floor(40 + densityRef.current * 80);
      while (vehicles.length < target) {
        const isBus = Math.random() < 0.08;
        const isBike = !isBus && Math.random() < 0.18;
        const horizontal = Math.random() < 0.55;
        const lane = Math.floor(Math.random() * 4);
        const dir = lane < 2 ? 1 : -1;

        const speedBase = isBus ? 0.55 : isBike ? 1.1 : 0.9 + Math.random() * 0.5;
        const v: Vehicle = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          w: isBus ? 26 : isBike ? 6 : 12 + Math.random() * 4,
          h: isBus ? 9 : isBike ? 4 : 7,
          color: isBus
            ? "#e6c890"
            : isBike
              ? "#d36cff"
              : ["#9fb3ff", "#c1cfee", "#7c93d6", "#abc2ff", "#7da0ff"][
                  Math.floor(Math.random() * 5)
                ],
          lane,
          isBus,
          isBike,
          flicker: Math.random() * Math.PI * 2,
        };

        if (horizontal) {
          v.y = laneY(lane);
          v.x = dir > 0 ? -30 - Math.random() * W : W + 30 + Math.random() * W;
          v.vx = dir * speedBase;
          v.vy = 0;
        } else {
          v.x = laneX(lane);
          v.y = dir > 0 ? -30 - Math.random() * H : H + 30 + Math.random() * H;
          v.vx = 0;
          v.vy = dir * speedBase;
          // swap dimensions for vertical
          const t = v.w;
          v.w = v.h;
          v.h = t;
        }
        vehicles.push(v);
      }
    }

    function drawRoad() {
      // Background asphalt block
      ctx!.fillStyle = "rgba(8, 10, 22, 1)";
      ctx!.fillRect(0, 0, W, H);

      // Soft city lights in background
      const grad = ctx!.createRadialGradient(W * 0.3, H * 0.2, 0, W * 0.3, H * 0.2, Math.max(W, H) * 0.7);
      grad.addColorStop(0, "rgba(120, 90, 220, 0.18)");
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = grad;
      ctx!.fillRect(0, 0, W, H);

      const grad2 = ctx!.createRadialGradient(W * 0.75, H * 0.85, 0, W * 0.75, H * 0.85, Math.max(W, H) * 0.6);
      grad2.addColorStop(0, "rgba(60, 140, 220, 0.18)");
      grad2.addColorStop(1, "rgba(0,0,0,0)");
      ctx!.fillStyle = grad2;
      ctx!.fillRect(0, 0, W, H);

      // Horizontal road
      const rH = 92;
      const rW = 92;
      ctx!.fillStyle = "rgba(20, 22, 36, 1)";
      ctx!.fillRect(0, H / 2 - rH / 2, W, rH);
      ctx!.fillRect(W / 2 - rW / 2, 0, rW, H);

      // Lane markings — dashed
      ctx!.save();
      ctx!.strokeStyle = "rgba(220, 225, 245, 0.18)";
      ctx!.lineWidth = 1;
      ctx!.setLineDash([14, 12]);
      for (let i = 1; i < 4; i++) {
        const y = laneY(i - 0.5);
        ctx!.beginPath();
        ctx!.moveTo(0, y);
        ctx!.lineTo(W / 2 - rW / 2, y);
        ctx!.moveTo(W / 2 + rW / 2, y);
        ctx!.lineTo(W, y);
        ctx!.stroke();
      }
      for (let i = 1; i < 4; i++) {
        const x = laneX(i - 0.5);
        ctx!.beginPath();
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, H / 2 - rH / 2);
        ctx!.moveTo(x, H / 2 + rH / 2);
        ctx!.lineTo(x, H);
        ctx!.stroke();
      }
      ctx!.restore();

      // Intersection box outline
      ctx!.strokeStyle = "rgba(140, 170, 255, 0.18)";
      ctx!.lineWidth = 1;
      ctx!.strokeRect(W / 2 - rW / 2, H / 2 - rH / 2, rW, rH);
    }

    function drawVehicle(v: Vehicle) {
      ctx!.save();
      ctx!.translate(v.x, v.y);

      // Shadow
      ctx!.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx!.fillRect(-v.w / 2 + 1, -v.h / 2 + 2, v.w, v.h);

      // Body
      ctx!.fillStyle = v.color;
      ctx!.fillRect(-v.w / 2, -v.h / 2, v.w, v.h);

      // Glass strip
      ctx!.fillStyle = "rgba(20, 30, 60, 0.6)";
      if (Math.abs(v.vx) > Math.abs(v.vy)) {
        ctx!.fillRect(-v.w / 2 + 2, -v.h / 2 + 1, v.w - 4, v.h - 2);
      } else {
        ctx!.fillRect(-v.w / 2 + 1, -v.h / 2 + 2, v.w - 2, v.h - 4);
      }

      // Headlights / taillights
      const glow = 0.7 + Math.sin(performance.now() * 0.003 + v.flicker) * 0.15;
      if (v.vx !== 0) {
        const dir = Math.sign(v.vx);
        // headlight cone
        const lx = (v.w / 2) * dir;
        const grad = ctx!.createRadialGradient(lx + dir * 4, 0, 0, lx + dir * 30, 0, 60);
        grad.addColorStop(0, `rgba(255, 245, 220, ${0.55 * glow})`);
        grad.addColorStop(1, "rgba(255, 245, 220, 0)");
        ctx!.fillStyle = grad;
        ctx!.fillRect(lx, -30, dir * 80, 60);
        // taillight
        ctx!.fillStyle = `rgba(255, 70, 70, ${0.85 * glow})`;
        ctx!.fillRect(-lx - dir * 1.2, -1, dir * -1.2, 2);
      } else {
        const dir = Math.sign(v.vy);
        const ly = (v.h / 2) * dir;
        const grad = ctx!.createRadialGradient(0, ly + dir * 4, 0, 0, ly + dir * 30, 60);
        grad.addColorStop(0, `rgba(255, 245, 220, ${0.55 * glow})`);
        grad.addColorStop(1, "rgba(255, 245, 220, 0)");
        ctx!.fillStyle = grad;
        ctx!.fillRect(-30, ly, 60, dir * 80);
        ctx!.fillStyle = `rgba(255, 70, 70, ${0.85 * glow})`;
        ctx!.fillRect(-1, -ly - dir * 1.2, 2, dir * -1.2);
      }

      ctx!.restore();
    }

    let last = performance.now();
    function frame(t: number) {
      const dt = Math.min(48, t - last);
      last = t;

      drawRoad();
      spawn();

      for (let i = vehicles.length - 1; i >= 0; i--) {
        const v = vehicles[i];
        v.x += v.vx * dt * 0.06;
        v.y += v.vy * dt * 0.06;
        // Wrap-around removal
        if (v.x < -80 || v.x > W + 80 || v.y < -80 || v.y > H + 80) {
          vehicles.splice(i, 1);
          continue;
        }
        drawVehicle(v);
      }

      // Radar sweep
      const sweep = (t * 0.0004) % (Math.PI * 2);
      ctx!.save();
      ctx!.translate(W / 2, H / 2);
      ctx!.rotate(sweep);
      const sg = ctx!.createLinearGradient(0, 0, Math.max(W, H), 0);
      sg.addColorStop(0, "rgba(140, 175, 255, 0.18)");
      sg.addColorStop(1, "rgba(140, 175, 255, 0)");
      ctx!.fillStyle = sg;
      ctx!.beginPath();
      ctx!.moveTo(0, 0);
      ctx!.arc(0, 0, Math.max(W, H), -0.18, 0.18);
      ctx!.closePath();
      ctx!.fill();
      ctx!.restore();

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}

export default TrafficCanvas;
