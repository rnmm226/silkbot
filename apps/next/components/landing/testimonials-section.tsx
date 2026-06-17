"use client";

import { useEffect, useState } from "react";

const testimonials = [
  {
    quote: "J'ai obtenu une réponse claire sur mon contrat de bail en moins d'une minute. Les sources citées m'ont permis de vérifier moi-même.",
    author: "Sarra M.",
    role: "Particulier",
    company: "Tunis",
    metric: "Réponse en 30 secondes",
    avatar: "S",
  },
  {
    quote: "Un outil indispensable pour préparer mes consultations. La précision des références juridiques est remarquable.",
    author: "Maître Aymen B.",
    role: "Avocat",
    company: "Barreau de Sfax",
    metric: "50+ consultations préparées",
    avatar: "A",
  },
  {
    quote: "Nous l'utilisons pour former nos équipes RH sur le Code du Travail. Simple, précis, toujours sourcé.",
    author: "Rania K.",
    role: "DRH",
    company: "Groupe industriel Sousse",
    metric: "200+ employés formés",
    avatar: "R",
  },
  {
    quote: "Gain de temps considérable pour nos équipes juridiques. L'IA nous fait gagner des heures de recherche documentaire.",
    author: "Mehdi L.",
    role: "Juriste d'entreprise",
    company: "Carthage Holding",
    metric: "15h/semaine économisées",
    avatar: "M",
  },
  {
    quote: "La couverture des textes tunisiens est impressionnante. Du JORT aux décisions de justice, tout y est.",
    author: "Dre Nadia F.",
    role: "Professeure de droit",
    company: "Université Tunis El Manar",
    metric: "1 200+ textes indexés",
    avatar: "N",
  },
];

export function TestimonialsSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % testimonials.length);
        setIsAnimating(false);
      }, 300);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const activeTestimonial = testimonials[activeIndex];

  return (
    <section className="relative py-20 lg:py-28 overflow-hidden"
      style={{
        borderBottom: '1px solid var(--color-border,#2a2520)',
      }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary,#c4956a) 5%, transparent) 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        {/* Section Label */}
        <div className="flex items-center gap-4 mb-12">
          <span className="inline-flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase">
            <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
            <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
              Témoignages
            </span>
          </span>
          <div className="flex-1 h-px" style={{ background: 'var(--color-border,#2a2520)' }} />
          <span className="text-xs font-mono" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
            {String(activeIndex + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
          </span>
        </div>

        {/* Main Quote */}
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16">
          <div className="lg:col-span-8">
            <blockquote
              className={`transition-all duration-300 ${
                isAnimating ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
              }`}
            >
              <p className="font-serif text-xl md:text-2xl lg:text-3xl leading-relaxed tracking-tight"
                style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                "{activeTestimonial.quote}"
              </p>
            </blockquote>

            {/* Author */}
            <div
              className={`mt-8 flex items-center gap-4 transition-all duration-300 delay-100 ${
                isAnimating ? "opacity-0" : "opacity-100"
              }`}
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold"
                style={{
                  background: 'color-mix(in oklch, var(--primary,#c4956a) 15%, transparent)',
                  color: 'var(--primary,#c4956a)',
                  border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 25%, transparent)',
                }}>
                {activeTestimonial.avatar}
              </div>
              <div>
                <p className="text-base font-semibold" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                  {activeTestimonial.author}
                </p>
                <p className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                  {activeTestimonial.role}, {activeTestimonial.company}
                </p>
              </div>
            </div>
          </div>

          {/* Metric Highlight */}
          <div className="lg:col-span-4 flex flex-col justify-center">
            <div
              className={`p-6 rounded-xl transition-all duration-300 ${
                isAnimating ? "opacity-0 scale-95" : "opacity-100 scale-100"
              }`}
              style={{
                background: 'var(--color-card,#1a1815)',
                border: '1px solid var(--color-border,#2a2520)',
              }}
            >
              <span className="text-xs font-medium tracking-[0.2em] uppercase block mb-3"
                style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
                Résultat clé
              </span>
              <p className="font-serif text-2xl lg:text-3xl font-bold"
                style={{ color: 'var(--primary,#c4956a)' }}>
                {activeTestimonial.metric}
              </p>
            </div>

            {/* Navigation Dots */}
            <div className="flex gap-2 mt-6">
              {testimonials.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setIsAnimating(true);
                    setTimeout(() => {
                      setActiveIndex(idx);
                      setIsAnimating(false);
                    }, 300);
                  }}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    idx === activeIndex
                      ? "w-6"
                      : "w-1.5 hover:w-3"
                  }`}
                  style={{
                    background: idx === activeIndex 
                      ? 'var(--primary,#c4956a)' 
                      : 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 30%, transparent)',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Trust bar */}
        <div className="mt-12 pt-8"
          style={{ borderTop: '1px solid var(--color-border,#2a2520)' }}>
          <p className="text-xs font-medium tracking-[0.2em] uppercase mb-6 text-center"
            style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
            Ils nous font confiance
          </p>
        </div>
      </div>
      
      {/* Full-width marquee outside container */}
      <div className="w-full overflow-hidden">
        <div className="flex gap-12 items-center marquee">
          {[...Array(2)].map((_, setIdx) => (
            <div key={setIdx} className="flex gap-12 items-center shrink-0">
              {["Cabinet Tellili", "KPMG Tunisie", "BNP Paribas Tunis", "PwC Tunis", "Delmonte Tunis", "STB", "BIAT", "Amen Bank", "Tunisair", "Orange Tunisie"].map(
                (company) => (
                  <span
                    key={`${setIdx}-${company}`}
                    className="font-serif text-base md:text-lg whitespace-nowrap transition-colors duration-300"
                    style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 40%, transparent)' }}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--primary,#c4956a)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 40%, transparent)'}
                  >
                    {company}
                  </span>
                )
              )}
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .marquee {
          animation: marquee 25s linear infinite;
          width: fit-content;
        }
        .marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}