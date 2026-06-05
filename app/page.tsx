"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

function useCountUp(target: number, duration: number, start: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let current = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      setValue(Math.round(current));
      if (current >= target) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [start, target, duration]);
  return value;
}

function AnimatedCard({
  num, icon, title, desc, tag, delay,
}: {
  num: string; icon: string; title: string;
  desc: string; tag: string; delay: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ animationDelay: delay }}
      className={`group relative bg-card border border-border rounded-lg p-7 cursor-pointer overflow-hidden
        shadow-xs hover:shadow-lg hover:-translate-y-1 hover:scale-[1.01]
        transition-all duration-300 ease-out
        ${visible ? "animate-scaleIn opacity-100" : "opacity-0"}`}
    >
      {/* top accent bar */}
      <span className="absolute top-0 left-0 right-0 h-[3px] bg-primary origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out rounded-t-lg" />
      {/* hover tint */}
      <span className="absolute inset-0 bg-primary/[0.04] opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-lg" />

      <p className="relative text-[11px] font-medium tracking-[0.18em] uppercase text-muted-foreground/60 mb-4">{num}</p>
      <div className="relative text-3xl mb-3 leading-none inline-block transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
        {icon}
      </div>
      <h2 className="relative font-serif text-xl font-bold text-foreground mb-2">{title}</h2>
      <p className="relative text-sm font-light text-muted-foreground leading-relaxed">{desc}</p>
      <span className="relative inline-block mt-4 text-[11px] font-medium tracking-wider uppercase px-3 py-1 bg-muted text-muted-foreground rounded-md transition-all duration-200 group-hover:bg-primary group-hover:text-primary-foreground">
        {tag}
      </span>
      <span className="absolute bottom-5 right-5 text-primary text-lg font-medium opacity-0 translate-x-[-6px] translate-y-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:translate-y-0 transition-all duration-300 ease-out">
        →
      </span>
    </div>
  );
}

export default function Home() {
  const [statsStarted, setStatsStarted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setStatsStarted(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const laws    = useCountUp(1200, 1400, statsStarted);
  const domains = useCountUp(24,   1000, statsStarted);
  const users   = useCountUp(8500, 1600, statsStarted);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">

      {/* floating blobs */}
      <div className="pointer-events-none absolute -top-16 -left-20 w-80 h-80 rounded-full bg-muted/50 blur-[60px] animate-float" />
      <div className="pointer-events-none absolute -bottom-20 -right-16 w-64 h-64 rounded-full bg-secondary/30 blur-[50px] animate-float-reverse" />

      {/* Navigation */}
      <nav className="relative z-10 bg-background/90 border-b border-border backdrop-blur-md sticky top-0 animate-navSlide">
        <div className="container mx-auto px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-base font-bold select-none animate-pulseRing">
              ⚖
            </div>
            <span className="font-serif text-2xl font-bold text-primary tracking-tight">
              SilkBot
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <button className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg bg-transparent hover:bg-muted hover:-translate-y-px active:scale-95 transition-all duration-150 animate-fadeIn [animation-delay:300ms] opacity-0 [animation-fill-mode:forwards]">
                Connexion
              </button>
            </Link>
            <Link href="/register">
              <button className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 hover:-translate-y-px active:scale-95 transition-all duration-150 animate-fadeIn [animation-delay:400ms] opacity-0 [animation-fill-mode:forwards]">
                Inscription
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative z-5 text-center py-16 px-8">
        <div className="flex items-center justify-center gap-3 mb-5 animate-fadeIn [animation-delay:400ms] opacity-0 [animation-fill-mode:forwards]">
          <span className="h-px bg-border origin-right animate-slideRight [animation-delay:800ms]" style={{ width: 36 }} />
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            Plateforme juridique tunisienne
          </p>
          <span className="h-px bg-border origin-left animate-slideRight [animation-delay:800ms]" style={{ width: 36 }} />
        </div>

        <h1 className="font-serif text-5xl font-bold leading-tight text-foreground mb-4 animate-fadeUp [animation-delay:500ms] opacity-0 [animation-fill-mode:forwards]">
          Le Droit Tunisien,{" "}
          <em className="italic animate-shimmer bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, oklch(0.6083 0.0623 44.3588), oklch(0.7272 0.0539 52.332), oklch(0.6083 0.0623 44.3588))", backgroundSize: "200% auto" }}>
            enfin accessible
          </em>
        </h1>

        <p className="text-base font-light text-muted-foreground max-w-lg mx-auto leading-relaxed mb-10 animate-fadeUp [animation-delay:650ms] opacity-0 [animation-fill-mode:forwards]">
          Explorez les lois tunisiennes, vos droits et vos obligations à travers une plateforme moderne et interactive.
        </p>

        {/* Stats */}
        <div className="flex justify-center items-stretch gap-8 animate-fadeUp [animation-delay:800ms] opacity-0 [animation-fill-mode:forwards]">
          {[
            { val: laws,    suffix: "+", label: "Textes de loi" },
            { val: domains, suffix: "",  label: "Domaines juridiques" },
            { val: users,   suffix: "+", label: "Utilisateurs actifs" },
          ].map((s, i) => (
            <div key={i} className="flex items-stretch gap-8">
              {i > 0 && <div className="w-px bg-border self-stretch" />}
              <div className="text-center">
                <span className="block font-serif text-2xl font-bold text-primary">
                  {s.val.toLocaleString()}{s.suffix}
                </span>
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-normal">
                  {s.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* Cards */}
      <main className="relative z-5 container mx-auto px-8 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <AnimatedCard num="01" icon="⚖️" title="Droit Civil"
            desc="Comprendre les contrats, les obligations et les relations entre les citoyens."
            tag="Contrats · Famille" delay="50ms" />
          <AnimatedCard num="02" icon="🏛️" title="Constitution"
            desc="Découvrez les principes fondamentaux et les libertés garanties par la Constitution tunisienne."
            tag="Droits · Libertés" delay="180ms" />
          <AnimatedCard num="03" icon="👨‍⚖️" title="Droit Pénal"
            desc="Informez-vous sur les infractions, les sanctions et les procédures judiciaires."
            tag="Sanctions · Procédure" delay="310ms" />
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-5 border-t border-border py-6 animate-fadeIn [animation-delay:1200ms] opacity-0 [animation-fill-mode:forwards]">
        <p className="text-center text-sm font-light text-muted-foreground">
          © {new Date().getFullYear()} SilkBot Platform — Tous droits réservés
        </p>
      </footer>
    </div>
  );
}