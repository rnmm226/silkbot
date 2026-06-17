"use client";

import { useEffect, useRef } from "react";

export function AnimatedWave() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Symboles juridiques pour la vague
    const symbols = ["·", "⚖️", "·", "📜", "·", "🔍", "·", "🏛️", "·", "📋", "·"];
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

    // Récupérer la couleur primaire du thème
    const getPrimaryColor = () => {
      return getComputedStyle(document.documentElement)
        .getPropertyValue('--color-primary')
        .trim() || '#c4956a';
    };

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);

      const baseFontSize = Math.max(12, Math.min(rect.width / 30, 20));
      ctx.font = `${baseFontSize}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const cols = Math.floor(rect.width / (baseFontSize * 1.4));
      const rows = Math.floor(rect.height / (baseFontSize * 1.4));
      
      const primaryColor = getPrimaryColor();
      const cellWidth = rect.width / cols;
      const cellHeight = rect.height / rows;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const px = (x + 0.5) * cellWidth;
          const py = (y + 0.5) * cellHeight;

          // Interférence de plusieurs ondes pour un effet organique
          const wave1 = Math.sin(x * 0.25 + time * 1.8) * Math.cos(y * 0.2 + time * 0.8);
          const wave2 = Math.sin((x + y) * 0.15 + time * 1.2);
          const wave3 = Math.cos(x * 0.12 - y * 0.12 + time * 0.6);
          const wave4 = Math.sin(x * 0.3 - time * 1.5) * Math.cos(y * 0.25);
          
          const combined = (wave1 + wave2 + wave3 + wave4) / 4;
          const normalized = (combined + 1) / 2;
          
          const symbolIndex = Math.floor(normalized * (symbols.length - 1));
          const intensity = 0.2 + normalized * 0.6;
          const sizeVariation = 0.8 + normalized * 0.4;

          // Ajuster la taille de police en fonction de l'intensité
          ctx.font = `${baseFontSize * sizeVariation}px monospace`;
          
          // Utiliser la couleur primaire avec opacité variable
          ctx.fillStyle = `color-mix(in oklch, ${primaryColor} ${intensity * 100}%, transparent)`;
          
          const symbol = symbols[symbolIndex];
          // Remplacer les points par des espaces pour les positions faibles
          if (symbol === "·" && normalized < 0.3) {
            ctx.fillStyle = `color-mix(in oklch, ${primaryColor} 10%, transparent)`;
          }
          ctx.fillText(symbol, px, py);
        }
      }

      time += 0.025;
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
        opacity: 0.7,
      }}
    />
  );
}