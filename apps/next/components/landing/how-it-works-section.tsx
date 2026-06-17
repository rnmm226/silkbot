"use client";

import { useEffect, useRef, useState } from "react";

const steps = [
  {
    number: "01",
    title: "Posez votre question",
    description: "En français ou en arabe, comme vous poseriez la question à un juriste. Aucun jargon requis.",
    icon: "💬",
    detail: "Notre IA comprend le langage naturel et s'adapte à votre niveau de connaissance juridique.",
  },
  {
    number: "02",
    title: "L'IA analyse les sources",
    description: "SilkBot interroge +1 200 textes officiels : codes, lois, décrets et jurisprudences tunisiens.",
    icon: "🔍",
    detail: "Analyse sémantique avancée pour trouver les passages les plus pertinents parmi des milliers de documents.",
  },
  {
    number: "03",
    title: "Réponse précise & sourcée",
    description: "Chaque réponse cite ses références exactes — vous pouvez ouvrir le document original en un clic.",
    icon: "📋",
    detail: "Lien direct vers les articles du JORT, codes officiels et décisions de justice cités.",
  },
];

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const { ref, inView } = useInView(0.15);

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
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="how"
      ref={sectionRef}
      className="relative py-24 lg:py-32 overflow-hidden"
      style={{
        background: 'color-mix(in oklch, var(--color-card,#1a1815) 30%, transparent)',
        borderTop: '1px solid var(--color-border,#2a2520)',
        borderBottom: '1px solid var(--color-border,#2a2520)',
      }}
    >
      {/* Ambient glow effect */}
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary,#c4956a) 6%, transparent) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 lg:mb-20">
          <p 
            className={`text-xs font-medium tracking-[0.2em] uppercase mb-3 transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}
          >
            Processus
          </p>
          <h2
            className={`font-serif text-3xl lg:text-4xl font-bold tracking-tight transition-all duration-700 delay-100 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ color: 'var(--color-foreground,#e8e0d0)' }}
          >
            Une réponse sourcée en{" "}
            <em className="italic font-normal" style={{ color: 'var(--primary,#c4956a)' }}>trois étapes</em>
          </h2>
          <p
            className={`text-sm font-light mt-3 max-w-md mx-auto transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}
          >
            De la question à la réponse sourcée, SilkBot vous guide pas à pas
          </p>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Steps - Left side */}
          <div className="space-y-0">
            {steps.map((step, index) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`w-full text-left py-6 border-b transition-all duration-500 group ${
                  activeStep === index 
                    ? "opacity-100" 
                    : "opacity-50 hover:opacity-70"
                }`}
                style={{
                  borderColor: activeStep === index 
                    ? 'var(--primary,#c4956a)' 
                    : 'var(--color-border,#2a2520)',
                }}
              >
                <div className="flex items-start gap-5">
                  {/* Step number */}
                  <div className="shrink-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      activeStep === index ? 'scale-110' : ''
                    }`}
                      style={{
                        background: activeStep === index 
                          ? 'var(--primary,#c4956a)' 
                          : 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)',
                        color: activeStep === index ? '#0f0e0c' : 'var(--primary,#c4956a)',
                      }}>
                      {step.number}
                    </div>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{step.icon}</span>
                      <h3 className={`text-xl font-serif font-semibold transition-all duration-300 ${
                        activeStep === index ? 'translate-x-1' : ''
                      }`}
                        style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                        {step.title}
                      </h3>
                    </div>
                    <p className="text-sm font-light leading-relaxed mb-3"
                      style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      {step.description}
                    </p>
                    
                    {/* Expanded detail */}
                    {activeStep === index && (
                      <div 
                        className="mt-3 pt-3 text-xs font-light"
                        style={{ 
                          color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 80%, transparent)',
                          borderTop: '1px solid color-mix(in oklch, var(--primary,#c4956a) 20%, transparent)',
                        }}
                      >
                        {step.detail}
                      </div>
                    )}

                    {/* Progress indicator */}
                    {activeStep === index && (
                      <div className="mt-4 h-px overflow-hidden rounded-full"
                        style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 20%, transparent)' }}>
                        <div 
                          className="h-full rounded-full"
                          style={{
                            width: '0%',
                            background: 'var(--primary,#c4956a)',
                            animation: 'progressBar 6s linear forwards',
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Visual display - Right side */}
          <div className="lg:sticky lg:top-32 self-start">
            <div className="relative rounded-2xl overflow-hidden"
              style={{
                background: 'var(--color-card,#1a1815)',
                border: '1px solid var(--color-border,#2a2520)',
                boxShadow: '0 20px 60px color-mix(in oklch, rgba(0,0,0,0.4) 30%, transparent)',
              }}>
              
              {/* Card header */}
              <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--color-border,#2a2520)' }}>
                <div className="flex gap-2">
                  {['#ff5f57', '#ffbd2e', '#28c840'].map(c => (
                    <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.6 }} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[8px]"
                    style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 15%, transparent)' }}>
                    ⚖
                  </span>
                  <span className="text-xs font-mono" style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 50%, transparent)' }}>
                    silkbot.ai/process
                  </span>
                </div>
              </div>

              {/* Visual content based on active step */}
              <div className="p-6 min-h-[320px] flex flex-col items-center justify-center">
                {activeStep === 0 && (
                  <div className="text-center space-y-4 reveal-animation">
                    <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-4xl"
                      style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)' }}>
                      💬
                    </div>
                    <h4 className="font-serif text-lg font-semibold" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                      Interface conversationnelle
                    </h4>
                    <p className="text-sm font-light max-w-xs mx-auto" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      Posez votre question comme vous parleriez à un conseiller juridique
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs"
                      style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 8%, transparent)' }}>
                      <span>🌐</span>
                      <span>Français · العربية</span>
                    </div>
                  </div>
                )}

                {activeStep === 1 && (
                  <div className="text-center space-y-4 reveal-animation">
                    <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-4xl relative"
                      style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)' }}>
                      🔍
                      <div className="absolute -inset-1 rounded-2xl animate-pulse"
                        style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 20%, transparent)' }} />
                    </div>
                    <h4 className="font-serif text-lg font-semibold" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                      Analyse intelligente
                    </h4>
                    <p className="text-sm font-light max-w-xs mx-auto" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      Parcours de 1 247+ textes officiels pour trouver la réponse exacte
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {['C.O.C.', 'C.P.C.', 'C.S.T.', 'JORT'].map(tag => (
                        <span key={tag} className="text-xs px-2 py-1 rounded-full"
                          style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 8%, transparent)', color: 'var(--primary,#c4956a)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {activeStep === 2 && (
                  <div className="text-center space-y-4 reveal-animation">
                    <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center text-4xl"
                      style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)' }}>
                      📋
                    </div>
                    <h4 className="font-serif text-lg font-semibold" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                      Réponse sourcée
                    </h4>
                    <p className="text-sm font-light max-w-xs mx-auto" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      Chaque réponse inclut les références exactes des textes utilisés
                    </p>
                    <div className="bg-opacity-10 rounded-xl p-3 text-left text-xs"
                      style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 5%, transparent)' }}>
                      <div className="flex items-center gap-2 mb-2">
                        <span>📖</span>
                        <span className="font-medium">Article 113 du C.O.C.</span>
                      </div>
                      <p className="font-light opacity-80">"Chaque partie peut résilier le contrat..."</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer with step indicator */}
              <div className="px-5 py-3 flex justify-center gap-2"
                style={{ borderTop: '1px solid var(--color-border,#2a2520)' }}>
                {steps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveStep(idx)}
                    className={`w-2 h-2 rounded-full transition-all duration-300 ${
                      activeStep === idx ? 'w-6' : ''
                    }`}
                    style={{
                      background: activeStep === idx 
                        ? 'var(--primary,#c4956a)' 
                        : 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 30%, transparent)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Stats badge */}
            <div className="absolute -bottom-3 -right-3 lg:static lg:mt-4 lg:text-center">
              <div className="inline-flex items-center gap-3 rounded-full px-4 py-2 text-xs"
                style={{ background: 'var(--color-card,#1a1815)', border: '1px solid var(--color-border,#2a2520)' }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--primary,#c4956a)' }} />
                <span style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                  <span className="font-medium" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>99.1%</span> de précision
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes progressBar {
          from { width: 0%; }
          to { width: 100%; }
        }
        
        .reveal-animation {
          animation: fadeScaleIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        @keyframes fadeScaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </section>
  );
}

// Hook useInView pour l'intersection observer
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}