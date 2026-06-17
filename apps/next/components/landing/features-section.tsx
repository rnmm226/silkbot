"use client";

import { useEffect, useRef, useState } from "react";

const features = [
  {
    number: "01",
    title: "Analyse sémantique avancée",
    description: "Notre IA comprend le langage juridique et le langage naturel. Posez vos questions simplement, obtenez des réponses précises.",
    visual: "ai",
  },
  {
    number: "02",
    title: "Sources officielles en temps réel",
    description: "Synchronisation quotidienne avec le Journal Officiel de la République Tunisienne (JORT) et mise à jour automatique des textes.",
    visual: "sync",
  },
  {
    number: "03",
    title: "Réponses sourcées et vérifiables",
    description: "Chaque réponse cite ses références exactes. Accédez directement aux articles du code, lois et décrets cités.",
    visual: "citations",
  },
  {
    number: "04",
    title: "Bilingue français-arabe",
    description: "Posez vos questions en français ou en arabe. SilkBot comprend et répond dans les deux langues, avec les mêmes références juridiques.",
    visual: "bilingual",
  },
];

function AIVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <defs>
        <linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.8"/>
        </linearGradient>
      </defs>
      {/* Central node */}
      <circle cx="100" cy="80" r="12" fill="currentColor">
        <animate attributeName="r" values="12;14;12" dur="2s" repeatCount="indefinite" />
      </circle>
      
      {/* Orbiting nodes - représentant les textes juridiques */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = (i * 60) * (Math.PI / 180);
        const radius = 50;
        return (
          <g key={i}>
            <line
              x1="100"
              y1="80"
              x2={100 + Math.cos(angle) * radius}
              y2={80 + Math.sin(angle) * radius}
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.3"
            >
              <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </line>
            <circle
              cx={100 + Math.cos(angle) * radius}
              cy={80 + Math.sin(angle) * radius}
              r="6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <animate attributeName="r" values="6;8;6" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
      
      {/* Pulse rings */}
      <circle cx="100" cy="80" r="30" fill="none" stroke="url(#aiGrad)" strokeWidth="1.5" opacity="0">
        <animate attributeName="r" values="20;65" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="2.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function SyncVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* Document icon - JORT */}
      <rect x="40" y="30" width="120" height="100" rx="4" fill="none" stroke="currentColor" strokeWidth="2">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
      </rect>
      
      {/* Lines on document */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1="55"
          y1={50 + i * 18}
          x2="145"
          y2={50 + i * 18}
          stroke="currentColor"
          strokeWidth="1.5"
          opacity="0.3"
        >
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
        </line>
      ))}
      
      {/* Sync arrows */}
      <g transform="translate(100, 145)">
        <path d="M-15,-5 L0,-15 L15,-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" repeatCount="indefinite" />
        </path>
        <path d="M-15,5 L0,15 L15,5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <animate attributeName="opacity" values="1;0.4;1" dur="1.5s" repeatCount="indefinite" />
        </path>
      </g>
      
      {/* JORT tag */}
      <rect x="130" y="115" width="25" height="12" rx="2" fill="currentColor" opacity="0.8">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
      </rect>
    </svg>
  );
}

function CitationsVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* Citation marks */}
      <text x="30" y="50" fontSize="40" fontFamily="serif" fill="currentColor" opacity="0.3">«</text>
      <text x="150" y="130" fontSize="40" fontFamily="serif" fill="currentColor" opacity="0.3">»</text>
      
      {/* Citation text lines */}
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1="50"
          y1={55 + i * 20}
          x2="140"
          y2={55 + i * 20}
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.4"
        >
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="3s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
          <animate attributeName="x2" values="120;150;120" dur="3s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
        </line>
      ))}
      
      {/* Reference links */}
      <g transform="translate(50, 140)">
        <circle cx="0" cy="0" r="3" fill="currentColor">
          <animate attributeName="r" values="3;5;3" dur="1s" repeatCount="indefinite" />
        </circle>
        <line x1="8" y1="0" x2="80" y2="0" stroke="currentColor" strokeWidth="1" opacity="0.4">
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="1.5s" repeatCount="indefinite" />
        </line>
      </g>
    </svg>
  );
}

function BilingualVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      {/* French side */}
      <g transform="translate(0, 20)">
        <rect x="20" y="0" width="70" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
          <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite" />
        </rect>
        <text x="55" y="35" textAnchor="middle" fontSize="14" fontFamily="sans-serif" fill="currentColor" opacity="0.6">FR</text>
        <line x1="30" y1="48" x2="80" y2="48" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      </g>
      
      {/* Arrow */}
      <g transform="translate(100, 50)">
        <line x1="-10" y1="0" x2="10" y2="0" stroke="currentColor" strokeWidth="2">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite" />
        </line>
        <polygon points="10,-4 18,0 10,4" fill="currentColor" />
      </g>
      
      {/* Arabic side */}
      <g transform="translate(110, 20)">
        <rect x="0" y="0" width="70" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.5">
          <animate attributeName="opacity" values="0.7;0.3;0.7" dur="2s" repeatCount="indefinite" />
        </rect>
        <text x="35" y="35" textAnchor="middle" fontSize="14" fontFamily="sans-serif" fill="currentColor" opacity="0.6">AR</text>
        <line x1="10" y1="48" x2="60" y2="48" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      </g>
      
      {/* Equal sign */}
      <text x="100" y="115" textAnchor="middle" fontSize="20" fontFamily="serif" fill="currentColor" opacity="0.4">⇄</text>
    </svg>
  );
}

function AnimatedVisual({ type }: { type: string }) {
  switch (type) {
    case "ai":
      return <AIVisual />;
    case "sync":
      return <SyncVisual />;
    case "citations":
      return <CitationsVisual />;
    case "bilingual":
      return <BilingualVisual />;
    default:
      return <AIVisual />;
  }
}

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.2 }
    );

    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`group relative transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"
      }`}
      style={{ transitionDelay: `${index * 100}ms` }}
    >
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-12 py-10 lg:py-16"
        style={{ borderBottom: index < features.length - 1 ? '1px solid var(--color-border,#2a2520)' : 'none' }}>
        
        {/* Number */}
        <div className="shrink-0">
          <span className="text-xs font-mono" style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
            {feature.number}
          </span>
        </div>
        
        {/* Content */}
        <div className="flex-1 grid lg:grid-cols-2 gap-8 items-center">
          <div>
            <h3 className="text-xl lg:text-2xl font-serif font-semibold mb-3 group-hover:translate-x-1 transition-transform duration-500"
              style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
              {feature.title}
            </h3>
            <p className="text-sm font-light leading-relaxed"
              style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
              {feature.description}
            </p>
          </div>
          
          {/* Visual */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-40 h-32" style={{ color: 'var(--primary,#c4956a)' }}>
              <AnimatedVisual type={feature.visual} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FeaturesSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

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
      id="features"
      ref={sectionRef}
      className="relative py-16 lg:py-20"
    >
      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="mb-12 lg:mb-16">
          <span className="inline-flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase mb-5">
            <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
            <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
              Fonctionnalités
            </span>
          </span>
          <h2
            className={`font-serif text-3xl lg:text-4xl font-bold tracking-tight transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ color: 'var(--color-foreground,#e8e0d0)' }}
          >
            Tout ce dont vous avez besoin.
            <br />
            <span style={{ color: 'var(--primary,#c4956a)' }}>Rien de superflu.</span>
          </h2>
        </div>

        {/* Features List */}
        <div>
          {features.map((feature, index) => (
            <FeatureCard key={feature.number} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}