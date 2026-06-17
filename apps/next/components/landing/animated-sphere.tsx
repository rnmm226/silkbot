"use client";

import { useEffect, useRef } from "react";

export function AnimatedSphere() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Caractères représentant des symboles juridiques et tunisiens
    const chars = "⚖️📜📋🔍🏛️⚖️📖🔏⚡🎯📚🇹🇳";
    let time = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const radius = Math.min(rect.width, rect.height) * 0.5;

      // Utiliser la couleur primaire du thème
      const primaryColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#c4956a';

      ctx.font = "bold 14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const points: { x: number; y: number; z: number; char: string }[] = [];

      // Générer les points de la sphère
      for (let phi = 0; phi < Math.PI * 2; phi += 0.12) {
        for (let theta = 0; theta < Math.PI; theta += 0.12) {
          const x = Math.sin(theta) * Math.cos(phi + time * 0.5);
          const y = Math.sin(theta) * Math.sin(phi + time * 0.5);
          const z = Math.cos(theta);

          // Rotation autour de l'axe Y
          const rotY = time * 0.25;
          const newX = x * Math.cos(rotY) - z * Math.sin(rotY);
          const newZ = x * Math.sin(rotY) + z * Math.cos(rotY);

          // Rotation autour de l'axe X
          const rotX = time * 0.15;
          const newY = y * Math.cos(rotX) - newZ * Math.sin(rotX);
          const finalZ = y * Math.sin(rotX) + newZ * Math.cos(rotX);

          const depth = (finalZ + 1) / 2;
          const charIndex = Math.floor(depth * (chars.length - 1));

          points.push({
            x: centerX + newX * radius,
            y: centerY + newY * radius,
            z: finalZ,
            char: chars[charIndex],
          });
        }
      }

      // Trier par profondeur
      points.sort((a, b) => a.z - b.z);

      // Dessiner les points
      points.forEach((point) => {
        // Intensité basée sur la profondeur
        const intensity = 0.15 + (point.z + 1) * 0.35;
        
        // Utiliser la couleur primaire avec opacité variable
        ctx.fillStyle = `color-mix(in oklch, ${primaryColor} ${intensity * 100}%, transparent)`;
        ctx.fillText(point.char, point.x, point.y);
      });

      time += 0.016;
      frameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ 
        display: "block",
        filter: "drop-shadow(0 0 20px color-mix(in oklch, var(--primary, #c4956a) 30%, transparent))",
      }}
    />
  );
}