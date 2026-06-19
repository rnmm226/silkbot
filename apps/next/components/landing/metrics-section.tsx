"use client";

import { useEffect, useState, useRef } from "react";

function AnimatedCounter({ end, suffix = "", prefix = "" }: { end: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start = 0;
          const duration = 2000;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setCount(Math.floor(eased * end));

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.5 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [end, hasAnimated]);

  return (
    <div ref={ref} className="font-serif text-4xl lg:text-5xl font-bold tracking-tight"
      style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
      {prefix}{count.toLocaleString()}{suffix}
    </div>
  );
}

// NOUVEAU: anneau de progression animé — donne une lecture immédiate et visuelle
// des métriques exprimées en pourcentage (précision, fraîcheur des données).
function DonutChart({ percentage, size = 84, strokeWidth = 7 }: { percentage: number; size?: number; strokeWidth?: number }) {
  const [animated, setAnimated] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setHasAnimated(true);
          let start: number | null = null;
          const duration = 1400;

          const step = (timestamp: number) => {
            if (start === null) start = timestamp;
            const progress = Math.min((timestamp - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setAnimated(eased * percentage);
            if (progress < 1) requestAnimationFrame(step);
          };

          requestAnimationFrame(step);
        }
      },
      { threshold: 0.4 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [percentage, hasAnimated]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (animated / 100) * circumference;

  return (
    <div ref={ref} className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border,#2a2520)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--primary,#c4956a)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.1s linear' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-serif text-sm font-bold"
        style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
        {animated.toFixed(1)}%
      </div>
    </div>
  );
}

// NOUVEAU: type explicite pour autoriser un champ "donutValue" optionnel
type Metric = {
  value: number;
  suffix: string;
  prefix: string;
  label: string;
  description: string;
  icon: string;
  donutValue?: number;
};

const metrics: Metric[] = [
  { 
    value: 247, 
    suffix: "+", 
    prefix: "",
    label: "Textes de loi indexés",
    description: "Codes, lois et décrets en vigueur",
    icon: "📚"
  },
  { 
    value: 99, 
    suffix: ".9%", 
    prefix: "",
    label: "Précision des réponses",
    description: "Sources vérifiables et référencées",
    icon: "🎯",
    donutValue: 99.9, // NOUVEAU: affiché en anneau de progression plutôt qu'en simple compteur
  },
  { 
    value: 3, 
    suffix: "s", 
    prefix: "",
    label: "Temps de réponse moyen",
    description: "Analyse et génération incluses",
    icon: "⚡"
  },
  { 
    value: 8500, 
    suffix: "+", 
    prefix: "",
    label: "Utilisateurs actifs",
    description: "Juristes, étudiants et particuliers",
    icon: "👥"
  },
  { 
    value: 24, 
    suffix: "", 
    prefix: "",
    label: "Gouvernorats couverts",
    description: "Présence sur tout le territoire",
    icon: "🗺️"
  },
  { 
    value: 100, 
    suffix: "%", 
    prefix: "",
    label: "Textes à jour",
    description: "Synchronisation JORT quotidienne",
    icon: "🔄",
    donutValue: 100, // NOUVEAU
  },
];

export function MetricsSection() {
  const [time, setTime] = useState(new Date());
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

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
      id="metrics" 
      ref={sectionRef} 
      className="relative py-20 lg:py-28 overflow-hidden"
      style={{
        borderTop: '1px solid var(--color-border,#2a2520)',
        borderBottom: '1px solid var(--color-border,#2a2520)',
        background: 'color-mix(in oklch, var(--color-card,#1a1815) 30%, transparent)',
      }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary,#c4956a) 5%, transparent) 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 lg:mb-16">
          <div>
            <span className="inline-flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase mb-4">
              <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
              <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
                Métriques en direct
              </span>
            </span>
            <h2
              className={`font-serif text-3xl lg:text-4xl font-bold tracking-tight transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ color: 'var(--color-foreground,#e8e0d0)' }}
            >
              Une plateforme
              <br />
              <span style={{ color: 'var(--primary,#c4956a)' }}>qui prouve son efficacité</span>
            </h2>
          </div>
          
          <div className="flex items-center gap-4 text-xs font-mono"
            style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--primary,#c4956a)' }} />
              En direct
            </span>
            <span className="opacity-30">|</span>
            <span>{time.toLocaleTimeString('fr-FR')}</span>
          </div>
        </div>
        
        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              className={`rounded-2xl p-6 transition-all duration-700 hover:-translate-y-1 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{
                transitionDelay: `${index * 100}ms`,
                background: 'var(--color-card,#1a1815)',
                border: '1px solid var(--color-border,#2a2520)',
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{metric.icon}</span>
                <span className="text-xs px-2 py-1 rounded-full"
                  style={{
                    background: 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)',
                    color: 'var(--primary,#c4956a)'
                  }}>
                  #{index + 1}
                </span>
              </div>

              {metric.donutValue !== undefined ? (
                // NOUVEAU: rendu en anneau de progression pour les métriques en %
                <div className="flex items-center gap-4">
                  <DonutChart percentage={metric.donutValue} />
                  <div>
                    <div className="text-base font-medium" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                      {metric.label}
                    </div>
                    <div className="mt-1 text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      {metric.description}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <AnimatedCounter 
                    end={metric.value} 
                    suffix={metric.suffix} 
                    prefix={metric.prefix}
                  />
                  <div className="mt-3 text-base font-medium" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                    {metric.label}
                  </div>
                  <div className="mt-1 text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                    {metric.description}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Trust badge */}
        <div className="mt-10 text-center">
          <div className="inline-flex items-center gap-3 rounded-full px-4 py-2 text-xs"
            style={{
              background: 'color-mix(in oklch, var(--primary,#c4956a) 6%, transparent)',
              border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 15%, transparent)',
            }}>
            <span>⭐</span>
            <span style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
              Données mises à jour en temps réel depuis le{" "}
              <span style={{ color: 'var(--primary,#c4956a)' }}>Journal Officiel Tunisien</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}