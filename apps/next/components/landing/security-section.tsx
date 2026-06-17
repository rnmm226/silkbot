"use client";

import { useEffect, useState, useRef } from "react";

const securityFeatures = [
  {
    icon: "🔒",
    title: "Chiffrement de bout en bout",
    description: "AES-256 pour les données au repos et TLS 1.3 pour les données en transit.",
  },
  {
    icon: "🏛️",
    title: "Conformité JORT",
    description: "Synchronisation quotidienne avec le Journal Officiel de la République Tunisienne.",
  },
  {
    icon: "⚖️",
    title: "Confidentialité des échanges",
    description: "Les conversations avocat-client bénéficient d'une protection renforcée.",
  },
  {
    icon: "📋",
    title: "Traçabilité complète",
    description: "Journal d'audit détaillé de toutes les actions et consultations.",
  },
  {
    icon: "🔐",
    title: "Authentification sécurisée",
    description: "2FA, SSO et politique de mots de passe robuste.",
  },
  {
    icon: "🛡️",
    title: "Protection des données",
    description: "Conformité avec la loi tunisienne 63/2004 sur la protection des données.",
  },
];

const certifications = [
  "CNPD", 
  "LOI 63/2004", 
  "RGPD", 
  "ISO 27001", 
  "JORT Sync",
  "Archivage légal"
];

export function SecuritySection() {
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
      id="security" 
      ref={sectionRef} 
      className="relative py-20 lg:py-28 overflow-hidden"
      style={{
        borderTop: '1px solid var(--color-border,#2a2520)',
        borderBottom: '1px solid var(--color-border,#2a2520)',
      }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary,#c4956a) 5%, transparent) 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase mb-5">
              <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
              <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
                Sécurité & Conformité
              </span>
            </span>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold tracking-tight mb-5"
              style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
              La confiance est
              <br />
              <span style={{ color: 'var(--primary,#c4956a)' }}>notre priorité absolue</span>
            </h2>
            <p className="text-base font-light leading-relaxed mb-8"
              style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
              SilkBot est conçu avec les plus hauts standards de sécurité. Vos données
              juridiques sont protégées conformément à la législation tunisienne et internationale.
            </p>

            {/* Certifications */}
            <div className="flex flex-wrap gap-2">
              {certifications.map((cert, index) => (
                <span
                  key={cert}
                  className={`px-3 py-1.5 rounded-full text-xs font-mono transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{
                    background: 'color-mix(in oklch, var(--primary,#c4956a) 8%, transparent)',
                    border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 15%, transparent)',
                    color: 'var(--primary,#c4956a)',
                    transitionDelay: `${index * 50 + 200}ms`,
                  }}
                >
                  {cert}
                </span>
              ))}
            </div>

            {/* Trust badge */}
            <div className="mt-8 p-4 rounded-xl"
              style={{
                background: 'color-mix(in oklch, var(--primary,#c4956a) 5%, transparent)',
                border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 15%, transparent)',
              }}>
              <div className="flex items-center gap-3">
                <span className="text-xl">🏛️</span>
                <div>
                  <div className="text-sm font-medium" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                    Conformité avec la loi tunisienne
                  </div>
                  <div className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                    Respect de la loi 63/2004 sur la protection des données à caractère personnel
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Features */}
          <div className="grid gap-4">
            {securityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-5 rounded-xl transition-all duration-500 group hover:-translate-y-0.5 ${
                  isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
                }`}
                style={{
                  background: 'var(--color-card,#1a1815)',
                  border: '1px solid var(--color-border,#2a2520)',
                  transitionDelay: `${index * 80}ms`,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--primary,#c4956a) 35%, transparent)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border,#2a2520)';
                }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg transition-all duration-300 group-hover:scale-110"
                    style={{
                      background: 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)',
                      border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 20%, transparent)',
                    }}>
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold mb-1 transition-all duration-300 group-hover:translate-x-0.5"
                      style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                      {feature.title}
                    </h3>
                    <p className="text-xs font-light leading-relaxed"
                      style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}