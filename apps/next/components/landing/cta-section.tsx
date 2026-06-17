"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function CtaSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePosition({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  return (
    <section ref={sectionRef} className="relative py-16 lg:py-20 overflow-hidden">
      <div className="max-w-6xl mx-auto px-6">
        <div
          className={`relative rounded-2xl transition-all duration-1000 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
          onMouseMove={handleMouseMove}
          style={{
            background: 'var(--primary)',
            boxShadow: '0 30px 80px color-mix(in oklch, var(--primary) 25%, transparent)',
          }}
        >
          {/* Spotlight effect */}
          <div 
            className="absolute inset-0 rounded-2xl opacity-20 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(600px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(255,255,255,0.25), transparent 40%)`
            }}
          />
          
          {/* Background pattern */}
          <div className="pointer-events-none absolute inset-0 rounded-2xl overflow-hidden">
            <div className="absolute top-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-black/5 rounded-full blur-3xl" />
          </div>

          <div className="relative z-10 px-6 lg:px-12 py-12 lg:py-16">
            <div className="flex flex-col lg:flex-row items-center justify-between gap-8 text-center lg:text-left">
              {/* Left content */}
              <div className="flex-1">
                <h2 className="font-serif text-3xl lg:text-5xl font-bold tracking-tight mb-4 leading-[1.1]"
                  style={{ color: 'var(--primary-foreground)' }}>
                  Prêt à maîtriser
                  <br />
                  le droit tunisien ?
                </h2>

                <p className="text-base font-light mb-6 leading-relaxed max-w-lg mx-auto lg:mx-0"
                  style={{ color: 'color-mix(in oklch, var(--primary-foreground) 70%, transparent)' }}>
                  Rejoignez +8 000 utilisateurs qui font confiance à SilkBot. 
                  Gratuit pour commencer.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all active:scale-95 hover:-translate-y-0.5 group"
                    style={{
                      background: 'var(--primary-foreground)',
                      color: 'var(--primary)',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                    }}
                  >
                    Créer un compte gratuit
                    <span className="transition-transform group-hover:translate-x-1">→</span>
                  </Link>
                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
                    style={{
                      border: '1px solid color-mix(in oklch, var(--primary-foreground) 30%, transparent)',
                      color: 'var(--primary-foreground)',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = 'var(--primary-foreground)';
                      e.currentTarget.style.background = 'color-mix(in oklch, var(--primary-foreground) 10%, transparent)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--primary-foreground) 30%, transparent)';
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    En savoir plus
                  </a>
                </div>

                <p className="text-xs font-light mt-6"
                  style={{ color: 'color-mix(in oklch, var(--primary-foreground) 60%, transparent)' }}>
                  Sans engagement • Annulation à tout moment
                </p>
              </div>

              {/* Right - Stats */}
              <div className="flex flex-col gap-4 min-w-[180px]">
                <div className="text-center lg:text-right">
                  <div className="font-serif text-3xl font-bold" style={{ color: 'var(--primary-foreground)' }}>8 500+</div>
                  <div className="text-xs font-light" style={{ color: 'color-mix(in oklch, var(--primary-foreground) 70%, transparent)' }}>Utilisateurs actifs</div>
                </div>
                <div className="text-center lg:text-right">
                  <div className="font-serif text-3xl font-bold" style={{ color: 'var(--primary-foreground)' }}>99.1%</div>
                  <div className="text-xs font-light" style={{ color: 'color-mix(in oklch, var(--primary-foreground) 70%, transparent)' }}>Précision des réponses</div>
                </div>
                <div className="text-center lg:text-right">
                  <div className="font-serif text-3xl font-bold" style={{ color: 'var(--primary-foreground)' }}>24/7</div>
                  <div className="text-xs font-light" style={{ color: 'color-mix(in oklch, var(--primary-foreground) 70%, transparent)' }}>Disponibilité</div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative corners */}
          <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-white/15 rounded-tr-2xl" />
          <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-white/15 rounded-bl-2xl" />
        </div>
      </div>
    </section>
  );
}