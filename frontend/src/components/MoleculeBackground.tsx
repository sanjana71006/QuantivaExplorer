import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  z: number; // depth
  vx: number;
  vy: number;
  radius: number;
  hue: number;
}

const MoleculeBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    const particles: Particle[] = [];
    const LAYERS = 3;
    const counts = [40, 30, 20];
    const maxDepth = 1.5;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // mouse parallax
    let mouseX = 0;
    let mouseY = 0;
    const onMouse = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouse);

    for (let layer = 0; layer < LAYERS; layer++) {
      for (let i = 0; i < counts[layer]; i++) {
        const depth = 0.2 + (layer / (LAYERS - 1)) * maxDepth;
        particles.push({
          x: Math.random() * window.innerWidth,
          y: Math.random() * window.innerHeight,
          z: depth,
          vx: (Math.random() - 0.5) * (0.3 / depth),
          vy: (Math.random() - 0.5) * (0.3 / depth),
          radius: Math.random() * (3 + layer * 1.5) + 1,
          hue: 180 + Math.random() * 60,
        });
      }
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // subtle gradient background
      const g = ctx.createLinearGradient(0, 0, 0, window.innerHeight);
      g.addColorStop(0, "rgba(20,14,30,0.85)");
      g.addColorStop(1, "rgba(32,10,60,0.9)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      // draw particles by depth (farthest first)
      const sorted = particles.slice().sort((a, b) => b.z - a.z);

      sorted.forEach((p) => {
        // move
        p.x += p.vx;
        p.y += p.vy;

        // wrap
        if (p.x < -50) p.x = window.innerWidth + 50;
        if (p.x > window.innerWidth + 50) p.x = -50;
        if (p.y < -50) p.y = window.innerHeight + 50;
        if (p.y > window.innerHeight + 50) p.y = -50;

        const parallaxX = mouseX * 20 * p.z;
        const parallaxY = mouseY * 12 * p.z;

        const drawX = p.x + parallaxX;
        const drawY = p.y + parallaxY;

        // glow
        const grad = ctx.createRadialGradient(drawX, drawY, 0, drawX, drawY, p.radius * 6);
        grad.addColorStop(0, `hsla(${p.hue},100%,60%,0.18)`);
        grad.addColorStop(0.4, `hsla(${p.hue},100%,60%,0.08)`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.beginPath();
        ctx.fillStyle = grad;
        ctx.arc(drawX, drawY, p.radius * 6, 0, Math.PI * 2);
        ctx.fill();

        // core
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue},90%,65%,0.95)`;
        ctx.arc(drawX, drawY, p.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // lightweight molecular links for nearest neighbours
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const maxDist = 140 * ((a.z + b.z) / 2);
          if (dist < maxDist) {
            const midZ = (a.z + b.z) / 2;
            ctx.beginPath();
            ctx.strokeStyle = `hsla(190,80%,70%,${(1 - dist / maxDist) * 0.08})`;
            ctx.lineWidth = 0.6 * midZ;
            ctx.moveTo(a.x + mouseX * 10 * a.z, a.y + mouseY * 6 * a.z);
            ctx.lineTo(b.x + mouseX * 10 * b.z, b.y + mouseY * 6 * b.z);
            ctx.stroke();
          }
        }
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default MoleculeBackground;
