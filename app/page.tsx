"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

/* ── Counter hook ── */
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

/* ── Intersection observer hook ── */
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

/* ── Word-by-word animated headline ── */
function AnimatedHeadline({ text, delay = 0 }: { text: string; delay?: number }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span
          key={i}
          className="inline-block opacity-0"
          style={{
            animation: `wordReveal 0.7s cubic-bezier(0.22,1,0.36,1) both`,
            animationDelay: `${delay + i * 80}ms`,
          }}
        >
          {word}&nbsp;
        </span>
      ))}
    </>
  );
}

/* ── Feature card with hover bar ── */
function FeatureCard({
  icon, title, desc, delay,
}: {
  icon: string; title: string; desc: string; delay: number;
}) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className="group relative bg-card border border-border rounded-xl p-7 overflow-hidden cursor-default
        hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(24px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms, box-shadow 0.3s, translate 0.3s`,
      }}
    >
      {/* top accent bar */}
      <span className="absolute top-0 left-0 right-0 h-[2px] bg-accent origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-out" />

      <div className="text-3xl mb-4 inline-block transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6">
        {icon}
      </div>
      <h3 className="font-serif text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed font-light">{desc}</p>
    </div>
  );
}

/* ── Step item ── */
function StepItem({
  num, title, desc, delay,
}: {
  num: string; title: string; desc: string; delay: number;
}) {
  const { ref, inView } = useInView(0.1);
  return (
    <div
      ref={ref}
      className="flex gap-6 items-start"
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateX(0)" : "translateX(-20px)",
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
    >
      <div className="shrink-0 w-10 h-10 rounded-full border-2 border-accent flex items-center justify-center">
        <span className="font-serif text-sm font-bold text-accent">{num}</span>
      </div>
      <div>
        <h4 className="font-serif text-base font-semibold text-foreground mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground font-light leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function Home() {
  const [statsStarted, setStatsStarted] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  const laws    = useCountUp(1200, 1600, statsStarted);
  const domains = useCountUp(24,   1000, statsStarted);
  const users   = useCountUp(8500, 1800, statsStarted);

  useEffect(() => {
    // Hero entrance after mount
    const t = setTimeout(() => setHeroReady(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = statsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsStarted(true); },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  /* Magnetic button effect */
  const magnetRef = useRef<HTMLAnchorElement>(null);
  const magnet2Ref = useRef<HTMLAnchorElement>(null);
  const applyMagnet = useCallback((
    e: React.MouseEvent<HTMLAnchorElement>,
    ref: React.RefObject<HTMLAnchorElement>
  ) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.25;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.25;
    el.style.transform = `translate(${x}px, ${y}px)`;
  }, []);
  const resetMagnet = useCallback((ref: React.RefObject<HTMLAnchorElement>) => {
    if (ref.current) ref.current.style.transform = "";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <style>{`
        @keyframes wordReveal {
          from { opacity: 0; transform: translateY(18px) rotate(-1deg); }
          to   { opacity: 1; transform: translateY(0) rotate(0deg); }
        }
        @keyframes lineGrow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes badgePop {
          from { opacity: 0; transform: scale(0.8) translateY(6px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-8px) rotate(0.5deg); }
          66%       { transform: translateY(-4px) rotate(-0.5deg); }
        }
        @keyframes glowPulse {
          0%, 100% { opacity: 0.35; }
          50%       { opacity: 0.55; }
        }
        .btn-transition { transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease; }
      `}</style>

      {/* ── Ambient background orbs ── */}
      <div
        className="pointer-events-none fixed top-[-120px] left-[-80px] w-[500px] h-[500px] rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.64 0.058 52 / 0.12) 0%, transparent 70%)",
          animation: "floatSlow 12s ease-in-out infinite",
        }}
      />
      <div
        className="pointer-events-none fixed bottom-[-100px] right-[-60px] w-[400px] h-[400px] rounded-full"
        style={{
          background: "radial-gradient(circle, oklch(0.72 0.052 70 / 0.10) 0%, transparent 70%)",
          animation: "floatSlow 16s ease-in-out infinite reverse",
        }}
      />

      {/* ── Navigation ── */}
      <nav
        className="relative z-20 border-b border-border/50 backdrop-blur-md sticky top-0"
        style={{
          background: "oklch(from var(--background) l c h / 0.85)",
          opacity: heroReady ? 1 : 0,
          transform: heroReady ? "translateY(0)" : "translateY(-100%)",
          transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="container mx-auto px-8 py-4 flex justify-between items-center max-w-6xl">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-sm font-bold select-none"
              style={{ animation: heroReady ? "badgePop 0.6s cubic-bezier(0.22,1,0.36,1) 0.3s both" : "none" }}
            >
              ⚖
            </div>
            <span className="font-serif text-xl font-bold text-foreground tracking-tight">
              Silk<span className="text-accent">Bot</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              ref={magnetRef}
              onMouseMove={(e) => applyMagnet(e, magnetRef as React.RefObject<HTMLAnchorElement>)}
              onMouseLeave={() => resetMagnet(magnetRef as React.RefObject<HTMLAnchorElement>)}
              className="btn-transition px-4 py-2 text-sm font-medium text-foreground/70 hover:text-foreground rounded-lg hover:bg-muted"
              style={{ animationDelay: "400ms" }}
            >
              Connexion
            </Link>
            <Link
              href="/register"
              ref={magnet2Ref}
              onMouseMove={(e) => applyMagnet(e, magnet2Ref as React.RefObject<HTMLAnchorElement>)}
              onMouseLeave={() => resetMagnet(magnet2Ref as React.RefObject<HTMLAnchorElement>)}
              className="btn-transition px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 shadow-sm active:scale-95"
            >
              Commencer
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <header className="relative z-10 pt-24 pb-20 px-8 text-center max-w-4xl mx-auto">

        {/* Eyebrow */}
        <div
          className="flex items-center justify-center gap-3 mb-8"
          style={{
            opacity: heroReady ? 1 : 0,
            transition: "opacity 0.6s ease 0.2s",
          }}
        >
          <span
            className="h-px bg-border origin-right"
            style={{
              width: 32,
              animation: heroReady ? "lineGrow 0.8s cubic-bezier(0.22,1,0.36,1) 0.5s both" : "none",
            }}
          />
          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-muted-foreground">
            Plateforme juridique tunisienne
          </p>
          <span
            className="h-px bg-border origin-left"
            style={{
              width: 32,
              animation: heroReady ? "lineGrow 0.8s cubic-bezier(0.22,1,0.36,1) 0.5s both" : "none",
            }}
          />
        </div>

        {/* Headline */}
        <h1 className="font-serif text-5xl md:text-6xl font-bold leading-[1.1] text-foreground mb-6 tracking-tight">
          {heroReady && (
            <>
              <AnimatedHeadline text="Le Droit Tunisien," delay={400} />
              <br />
              <span
                className="inline-block"
                style={{
                  backgroundImage: "linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 50%, var(--color-primary) 100%)",
                  backgroundSize: "200% auto",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  animation: "shimmer 4s linear infinite",
                }}
              >
                <AnimatedHeadline text="enfin accessible." delay={700} />
              </span>
            </>
          )}
        </h1>

        {/* Subline */}
        <p
          className="text-base md:text-lg font-light text-muted-foreground max-w-xl mx-auto leading-relaxed mb-10"
          style={{
            opacity: heroReady ? 1 : 0,
            transform: heroReady ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.7s ease 1.1s, transform 0.7s cubic-bezier(0.22,1,0.36,1) 1.1s",
          }}
        >
          Explorez les lois tunisiennes, vos droits et obligations — avec une précision que seule une IA juridique entraînée sur des sources officielles peut offrir.
        </p>

        {/* CTAs */}
        <div
          className="flex items-center justify-center gap-3 flex-wrap"
          style={{
            opacity: heroReady ? 1 : 0,
            transform: heroReady ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.6s ease 1.3s, transform 0.6s cubic-bezier(0.22,1,0.36,1) 1.3s",
          }}
        >
          <Link
            href="/register"
            className="btn-transition inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm font-medium rounded-xl shadow-md hover:opacity-90 hover:-translate-y-0.5 active:scale-95"
          >
            Essayer gratuitement
            <span className="text-primary-foreground/70">→</span>
          </Link>
          <Link
            href="#features"
            className="btn-transition inline-flex items-center gap-2 px-6 py-3 border border-border text-foreground/70 hover:text-foreground text-sm font-medium rounded-xl hover:bg-muted hover:-translate-y-0.5"
          >
            Voir les fonctionnalités
          </Link>
        </div>

        {/* Trust badges */}
        <div
          className="flex items-center justify-center gap-6 mt-10 flex-wrap"
          style={{
            opacity: heroReady ? 1 : 0,
            transition: "opacity 0.6s ease 1.6s",
          }}
        >
          {["🔒 Données sécurisées", "⚡ Réponses en temps réel", "📚 +2M de sources"].map((badge, i) => (
            <span
              key={i}
              className="text-[11px] text-muted-foreground/70 font-medium tracking-wide flex items-center gap-1.5"
            >
              {badge}
            </span>
          ))}
        </div>
      </header>

      {/* ── Stats ── */}
      <div ref={statsRef} className="relative z-10 border-y border-border/50 py-12 px-8 bg-muted/20">
        <div className="flex justify-center items-stretch gap-0 max-w-2xl mx-auto">
          {[
            { val: laws,    suffix: "+", label: "Textes de loi", sub: "mis à jour quotidiennement" },
            { val: domains, suffix: "",  label: "Domaines juridiques", sub: "couverts intégralement" },
            { val: users,   suffix: "+", label: "Utilisateurs actifs", sub: "juristes & particuliers" },
          ].map((s, i) => (
            <div key={i} className="flex items-stretch gap-0 flex-1">
              {i > 0 && <div className="w-px bg-border/60 self-stretch mx-8" />}
              <div className="text-center flex-1">
                <span className="block font-serif text-3xl font-bold text-foreground mb-0.5">
                  {s.val.toLocaleString()}{s.suffix}
                </span>
                <span className="block text-[13px] font-medium text-foreground/70 mb-0.5">
                  {s.label}
                </span>
                <span className="block text-[11px] text-muted-foreground/60 font-light">
                  {s.sub}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Feature cards ── */}
      <section id="features" className="relative z-10 py-20 px-8 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground/60 mb-3">
            Fonctionnalités
          </p>
          <h2 className="font-serif text-3xl font-bold text-foreground tracking-tight">
            Tout ce dont vous avez besoin
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <FeatureCard
            icon="⚖️"
            title="Droit Civil"
            desc="Contrats, obligations, famille et héritage — comprenez vos droits en langage clair, sourcé sur le Code Civil tunisien."
            delay={0}
          />
          <FeatureCard
            icon="🏛️"
            title="Droit Constitutionnel"
            desc="Libertés fondamentales, institutions et principes garantis par la Constitution tunisienne de 2022."
            delay={120}
          />
          <FeatureCard
            icon="👨‍⚖️"
            title="Droit Pénal"
            desc="Infractions, sanctions et procédures judiciaires expliqués avec précision et pédagogie."
            delay={240}
          />
          <FeatureCard
            icon="🏢"
            title="Droit des Sociétés"
            desc="Création d'entreprise, gouvernance, responsabilités des dirigeants selon le droit tunisien."
            delay={100}
          />
          <FeatureCard
            icon="💼"
            title="Droit du Travail"
            desc="Contrats de travail, licenciements, droits des salariés — le Code du Travail à portée de main."
            delay={220}
          />
          <FeatureCard
            icon="🏠"
            title="Droit Immobilier"
            desc="Propriété foncière, baux, permis de construire et transactions immobilières en Tunisie."
            delay={340}
          />
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="relative z-10 py-20 px-8 bg-muted/20 border-y border-border/50">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">

          {/* Left: text */}
          <div>
            <p className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground/60 mb-3">
              Comment ça marche
            </p>
            <h2 className="font-serif text-3xl font-bold text-foreground mb-10 tracking-tight">
              Une réponse juridique<br />
              <em className="italic font-normal text-accent">en trois étapes.</em>
            </h2>

            <div className="space-y-8">
              <StepItem
                num="01"
                title="Posez votre question"
                desc="En langage naturel, comme vous poseriez une question à un juriste."
                delay={0}
              />
              <StepItem
                num="02"
                title="L'IA analyse les sources"
                desc="SilkBot interroge les textes officiels, jurisprudences et codes en vigueur."
                delay={100}
              />
              <StepItem
                num="03"
                title="Réponse sourcée & précise"
                desc="Chaque réponse cite ses références exactes — vérifiables en un clic."
                delay={200}
              />
            </div>
          </div>

          {/* Right: visual */}
          <div className="relative">
            {/* Decorative chat preview */}
            <div
              className="bg-card border border-border rounded-2xl p-5 shadow-lg"
              style={{ animation: "floatSlow 8s ease-in-out infinite" }}
            >
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/50">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center text-xs">⚖</div>
                <span className="text-xs font-medium text-foreground/60">Assistant juridique</span>
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-green-400" />
              </div>
              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="bg-primary text-primary-foreground text-xs rounded-xl rounded-tr-sm px-3 py-2 max-w-[75%]">
                    Puis-je résilier mon bail avant terme ?
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-muted text-foreground text-xs rounded-xl rounded-tl-sm px-3 py-2 max-w-[80%] leading-relaxed">
                    Selon l'article 113 du Code des Obligations tunisien, vous pouvez résilier un bail avant terme sous certaines conditions…
                    <span className="block mt-1.5 text-[10px] text-muted-foreground">Source : C.O.C. art. 113 ✓</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 flex gap-2">
                <div className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5 text-[11px] text-muted-foreground">
                  Posez votre question…
                </div>
                <button className="w-7 h-7 bg-primary text-primary-foreground rounded-lg flex items-center justify-center text-xs">→</button>
              </div>
            </div>
            {/* Floating badge */}
            <div
              className="absolute -bottom-4 -left-6 bg-card border border-border rounded-xl px-4 py-2.5 shadow-md"
              style={{ animation: "floatSlow 10s ease-in-out 2s infinite reverse" }}
            >
              <div className="text-[11px] font-medium text-foreground/70">Taux de précision</div>
              <div className="font-serif text-lg font-bold text-foreground">99.1%</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Quote ── */}
      <section className="relative z-10 py-20 px-8 text-center max-w-3xl mx-auto">
        <span className="font-serif text-6xl text-accent/30 leading-none block mb-2">"</span>
        <blockquote className="font-serif text-xl md:text-2xl font-normal italic text-foreground/80 leading-relaxed mb-6">
          Le droit n'est pas un luxe réservé aux juristes. SilkBot le rend accessible à chaque citoyen.
        </blockquote>
        <p className="text-sm text-muted-foreground font-light">— L'équipe SilkBot</p>
      </section>

      {/* ── CTA Banner ── */}
      <section className="relative z-10 mx-8 mb-16">
        <div className="max-w-5xl mx-auto bg-primary rounded-2xl px-10 py-14 text-center overflow-hidden relative">
          <div
            className="pointer-events-none absolute inset-0 rounded-2xl"
            style={{
              background: "radial-gradient(ellipse at 30% 50%, oklch(1 0 0 / 0.06) 0%, transparent 60%), radial-gradient(ellipse at 70% 50%, oklch(1 0 0 / 0.04) 0%, transparent 60%)",
            }}
          />
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-3 relative">
            Prêt à maîtriser le droit tunisien ?
          </h2>
          <p className="text-primary-foreground/70 text-sm mb-8 font-light relative">
            Rejoignez +8 000 utilisateurs qui font confiance à SilkBot.
          </p>
          <Link
            href="/register"
            className="btn-transition inline-flex items-center gap-2 px-8 py-3.5 bg-primary-foreground text-primary text-sm font-medium rounded-xl hover:opacity-90 hover:-translate-y-0.5 active:scale-95 shadow-lg relative"
          >
            Créer un compte gratuit →
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/50 py-10 px-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚖</span>
            <span className="font-serif text-base font-bold text-foreground/80">
              Silk<span className="text-accent">Bot</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-light text-center">
            © {new Date().getFullYear()} SilkBot Platform — Tous droits réservés
          </p>
          <div className="flex gap-5">
            {["Mentions légales", "Confidentialité", "Contact"].map((l) => (
              <a key={l} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {l}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}