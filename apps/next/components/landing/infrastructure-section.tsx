"use client";

import { useEffect, useState, useRef } from "react";

const locations = [
  { city: "Tunis", region: "Nord-Est", latency: "1ms", courts: "Cour d'appel" },
  { city: "Sfax", region: "Centre-Est", latency: "2ms", courts: "Tribunal de première instance" },
  { city: "Sousse", region: "Centre-Est", latency: "1.5ms", courts: "Tribunal de première instance" },
  { city: "Kairouan", region: "Centre", latency: "2.5ms", courts: "Tribunal de première instance" },
  { city: "Bizerte", region: "Nord", latency: "1.8ms", courts: "Tribunal de première instance" },
  { city: "Gabès", region: "Sud-Est", latency: "3ms", courts: "Tribunal de première instance" },
  { city: "Nabeul", region: "Nord-Est", latency: "1.3ms", courts: "Tribunal de première instance" },
  { city: "Gafsa", region: "Sud-Ouest", latency: "3.5ms", courts: "Tribunal de première instance" },
];

export function InfrastructureSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [activeLocation, setActiveLocation] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLocation((prev) => (prev + 1) % locations.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section 
      ref={sectionRef} 
      className="relative py-24 lg:py-32 overflow-hidden"
      style={{
        borderTop: '1px solid var(--color-border,#2a2520)',
        borderBottom: '1px solid var(--color-border,#2a2520)',
      }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute top-1/2 right-0 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary,#c4956a) 5%, transparent) 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase mb-6">
              <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
              <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
                Infrastructure juridique
              </span>
            </span>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold tracking-tight mb-6"
              style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
              Couverture
              <br />
              <span style={{ color: 'var(--primary,#c4956a)' }}>nationale complète</span>
            </h2>
            <p className="text-base font-light leading-relaxed mb-10"
              style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
              SilkBot indexe et analyse les textes juridiques de toutes les juridictions tunisiennes,
              des cours d'appel aux tribunaux de première instance, pour une couverture légale sans précédent.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="font-serif text-3xl lg:text-4xl font-bold mb-1"
                  style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                  24
                </div>
                <div className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                  Gouvernorats
                </div>
              </div>
              <div>
                <div className="font-serif text-3xl lg:text-4xl font-bold mb-1"
                  style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                  100%
                </div>
                <div className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                  Codes officiels
                </div>
              </div>
              <div>
                <div className="font-serif text-3xl lg:text-4xl font-bold mb-1"
                  style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                  &lt;3s
                </div>
                <div className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                  Temps de réponse
                </div>
              </div>
            </div>
          </div>

          {/* Right: Location list */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="rounded-2xl overflow-hidden"
              style={{
                background: 'var(--color-card,#1a1815)',
                border: '1px solid var(--color-border,#2a2520)',
                boxShadow: '0 20px 60px color-mix(in oklch, rgba(0,0,0,0.4) 30%, transparent)',
              }}>
              {/* Header */}
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--color-border,#2a2520)' }}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">🏛️</span>
                  <span className="text-xs font-mono" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                    Juridictions couvertes
                  </span>
                </div>
                <span className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--primary,#c4956a)' }} />
                  <span style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>Synchronisé</span>
                </span>
              </div>

              {/* Locations */}
              <div className="max-h-[400px] overflow-y-auto">
                {locations.map((location, index) => (
                  <div
                    key={location.city}
                    className={`px-5 py-4 flex items-center justify-between transition-all duration-300 ${
                      index < locations.length - 1 ? 'border-b' : ''
                    }`}
                    style={{
                      borderColor: 'var(--color-border,#2a2520)',
                      background: activeLocation === index 
                        ? 'color-mix(in oklch, var(--primary,#c4956a) 5%, transparent)'
                        : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <span 
                        className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                          activeLocation === index 
                            ? 'bg-primary' 
                            : ''
                        }`}
                        style={{
                          background: activeLocation === index 
                            ? 'var(--primary,#c4956a)' 
                            : 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 30%, transparent)',
                        }}
                      />
                      <div>
                        <div className="text-sm font-medium" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                          {location.city}
                        </div>
                        <div className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                          {location.region}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono" style={{ color: 'var(--primary,#c4956a)' }}>
                        {location.latency}
                      </div>
                      <div className="text-[10px] font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                        {location.courts}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="px-5 py-3 flex justify-between items-center"
                style={{ borderTop: '1px solid var(--color-border,#2a2520)' }}>
                <span className="text-[10px] font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                  +8 autres juridictions
                </span>
                <div className="flex gap-1">
                  {locations.slice(0, 5).map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                        activeLocation === idx ? 'w-3' : ''
                      }`}
                      style={{
                        background: activeLocation === idx 
                          ? 'var(--primary,#c4956a)' 
                          : 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 30%, transparent)',
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}