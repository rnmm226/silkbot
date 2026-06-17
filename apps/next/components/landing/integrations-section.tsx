"use client";

import { useEffect, useState, useRef } from "react";

const integrations = [
  { name: "JORT", category: "Journal Officiel", icon: "📜" },
  { name: "Code Civil", category: "Textes fondamentaux", icon: "⚖️" },
  { name: "Code Pénal", category: "Textes fondamentaux", icon: "🔒" },
  { name: "Code du Travail", category: "Droit social", icon: "💼" },
  { name: "Code des Obligations", category: "Droit des contrats", icon: "📝" },
  { name: "Code des Sociétés", category: "Droit commercial", icon: "🏢" },
  { name: "Code Immobilier", category: "Droit foncier", icon: "🏠" },
  { name: "Constitution 2022", category: "Droit constitutionnel", icon: "🏛️" },
  { name: "Code Fiscal", category: "Droit financier", icon: "💰" },
  { name: "Code de Procédure", category: "Droit judiciaire", icon: "⚖️" },
  { name: "Jurisprudence", category: "Décisions de justice", icon: "👨‍⚖️" },
  { name: "Décrets", category: "Textes réglementaires", icon: "📋" },
  { name: "Arrêtés", category: "Textes réglementaires", icon: "📄" },
  { name: "Code de la Famille", category: "Droit de la famille", icon: "👨‍👩‍👧" },
  { name: "Code de la Route", category: "Droit public", icon: "🚗" },
  { name: "Code de l'Investissement", category: "Droit des affaires", icon: "📈" },
  { name: "Code des Douanes", category: "Droit fiscal", icon: "🚢" },
  { name: "Code des Eaux", category: "Droit rural", icon: "💧" },
  { name: "Code Forestier", category: "Droit rural", icon: "🌳" },
  { name: "Code du Statut Personnel", category: "Droit civil", icon: "📜" },
];

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false);
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

  return (
    <section 
      id="integrations" 
      ref={sectionRef} 
      className="relative py-24 lg:py-28 overflow-hidden"
      style={{
        borderBottom: '1px solid var(--color-border,#2a2520)',
      }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary,#c4956a) 5%, transparent) 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div
          className={`text-center max-w-2xl mx-auto mb-12 lg:mb-16 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
          <span className="inline-flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase mb-5">
            <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
            <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
              Sources juridiques
            </span>
            <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
          </span>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold tracking-tight mb-4"
            style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
            Toutes les sources du droit tunisien
          </h2>
          <p className="text-sm font-light leading-relaxed"
            style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
            +1 200 textes officiels indexés — du JORT aux codes spécialisés, en passant par les décisions de justice
          </p>
        </div>
      </div>
      
      {/* Full-width marquees outside container */}
      <div className="w-full mb-4 overflow-hidden">
        <div className="flex gap-4 marquee">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-4 shrink-0">
              {integrations.slice(0, 12).map((integration) => (
                <div
                  key={`${integration.name}-${setIndex}`}
                  className="shrink-0 px-6 py-4 rounded-xl transition-all duration-300 group cursor-default"
                  style={{
                    background: 'var(--color-card,#1a1815)',
                    border: '1px solid var(--color-border,#2a2520)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--primary,#c4956a) 35%, transparent)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--color-border,#2a2520)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{integration.icon}</span>
                    <span className="text-sm font-medium group-hover:translate-x-0.5 transition-transform"
                      style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                      {integration.name}
                    </span>
                  </div>
                  <div className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                    {integration.category}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      
      {/* Reverse marquee */}
      <div className="w-full overflow-hidden">
        <div className="flex gap-4 marquee-reverse">
          {[...Array(2)].map((_, setIndex) => (
            <div key={setIndex} className="flex gap-4 shrink-0">
              {integrations.slice(12).concat(integrations.slice(0, 8)).map((integration) => (
                <div
                  key={`${integration.name}-reverse-${setIndex}`}
                  className="shrink-0 px-6 py-4 rounded-xl transition-all duration-300 group cursor-default"
                  style={{
                    background: 'var(--color-card,#1a1815)',
                    border: '1px solid var(--color-border,#2a2520)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--primary,#c4956a) 35%, transparent)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--color-border,#2a2520)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{integration.icon}</span>
                    <span className="text-sm font-medium group-hover:translate-x-0.5 transition-transform"
                      style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                      {integration.name}
                    </span>
                  </div>
                  <div className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                    {integration.category}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="max-w-6xl mx-auto px-6 mt-12">
        <div className="flex flex-wrap justify-center gap-8 pt-6"
          style={{ borderTop: '1px solid var(--color-border,#2a2520)' }}>
          {[
            { value: "1 247+", label: "Textes indexés" },
            { value: "24", label: "Codes officiels" },
            { value: "100%", label: "JORT couvert" },
            { value: "15+", label: "Décennies d'archives" },
          ].map((stat, i) => (
            <div key={i} className="text-center">
              <div className="font-serif text-xl font-bold" style={{ color: 'var(--primary,#c4956a)' }}>
                {stat.value}
              </div>
              <div className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        
        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        
        .marquee {
          animation: marquee 30s linear infinite;
          width: fit-content;
        }
        
        .marquee-reverse {
          animation: marquee-reverse 30s linear infinite;
          width: fit-content;
        }
        
        .marquee:hover,
        .marquee-reverse:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}