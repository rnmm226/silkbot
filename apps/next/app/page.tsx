// app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Navigation } from "@/components/landing/navigation";
import { HeroSection } from "@/components/landing/hero-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { InfrastructureSection } from "@/components/landing/infrastructure-section";
import { IntegrationsSection } from "@/components/landing/integrations-section";
import { MetricsSection } from "@/components/landing/metrics-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { SecuritySection } from "@/components/landing/security-section";
import { DevelopersSection } from "@/components/landing/developers-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { CtaSection } from "@/components/landing/cta-section";
import { FooterSection } from "@/components/landing/footer-section";

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

/* ── Feature card ── */
function FeatureCard({ icon, title, desc, delay }: { icon: string; title: string; desc: string; delay: number }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className="group relative rounded-2xl p-6 overflow-hidden cursor-default transition-all duration-300"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--primary)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
      }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: 'radial-gradient(circle at 50% 0%, color-mix(in oklch, var(--primary) 15%, transparent) 0%, transparent 70%)' }} />

      <div className="relative">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 text-lg"
          style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)', border: '1px solid color-mix(in oklch, var(--primary) 25%, transparent)' }}>
          {icon}
        </div>
        <h3 className="font-serif text-base font-semibold mb-2" style={{ color: 'var(--foreground)' }}>{title}</h3>
        <p className="text-sm font-light leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>{desc}</p>
      </div>
    </div>
  );
}

/* ── Testimonial card ── */
function TestimonialCard({ quote, author, role, delay }: { quote: string; author: string; role: string; delay: number }) {
  const { ref, inView } = useInView(0.1);
  return (
    <div ref={ref} className="rounded-2xl p-6"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateY(0)' : 'translateY(20px)',
        transition: `opacity 0.55s ease ${delay}ms, transform 0.55s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}>
      <p className="font-serif text-sm italic leading-relaxed mb-4" style={{ color: 'var(--foreground)', opacity: 0.85 }}>
        « {quote} »
      </p>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'color-mix(in oklch, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>
          {author[0]}
        </div>
        <div>
          <p className="text-xs font-medium" style={{ color: 'var(--foreground)' }}>{author}</p>
          <p className="text-xs font-light" style={{ color: 'var(--muted-foreground)' }}>{role}</p>
        </div>
      </div>
    </div>
  );
}

/* ── FAQ item ── */
function FaqItem({ q, a, delay }: { q: string; a: string; delay: number }) {
  const [open, setOpen] = useState(false);
  const { ref, inView } = useInView(0.05);
  return (
    <div ref={ref} className="border-b overflow-hidden"
      style={{
        borderColor: 'var(--border)',
        opacity: inView ? 1 : 0,
        transform: inView ? 'translateX(0)' : 'translateX(-16px)',
        transition: `opacity 0.5s ease ${delay}ms, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}ms`,
      }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex justify-between items-center py-5 text-left gap-4 group">
        <span className="text-sm font-medium transition-colors" style={{ color: 'var(--foreground)' }}>{q}</span>
        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300"
          style={{
            background: open ? 'var(--primary)' : 'color-mix(in oklch, var(--primary) 15%, transparent)',
            color: open ? 'var(--primary-foreground)' : 'var(--primary)',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}>+</span>
      </button>
      <div style={{ maxHeight: open ? '200px' : '0', transition: 'max-height 0.35s cubic-bezier(0.22,1,0.36,1)', overflow: 'hidden' }}>
        <p className="text-sm font-light leading-relaxed pb-5" style={{ color: 'var(--muted-foreground)' }}>{a}</p>
      </div>
    </div>
  );
}

/* ── Main page ── */
export default function Home() {
  const [statsStarted, setStatsStarted] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);

  const laws    = useCountUp(1247, 1600, statsStarted);
  const domains = useCountUp(24,   1000, statsStarted);
  const users   = useCountUp(8500, 1800, statsStarted);

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

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--background)', color: 'var(--foreground)', fontFamily: 'var(--font-sans)' }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes floatSlow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes dotPulse { 0%,80%,100%{opacity:.3;transform:scale(.7)} 40%{opacity:1;transform:scale(1)} }
        .nav-link { transition: color 0.2s; }
        .nav-link:hover { color: var(--primary); }
      `}</style>

      {/* ── Ambient orbs ── */}
      <div className="pointer-events-none fixed top-0 left-0 w-[600px] h-[600px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary) 15%, transparent) 0%, transparent 65%)', animation: 'floatSlow 14s ease-in-out infinite', transform: 'translate(-30%, -30%)' }} />
      <div className="pointer-events-none fixed bottom-0 right-0 w-[500px] h-[500px] rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary) 10%, transparent) 0%, transparent 65%)', animation: 'floatSlow 18s ease-in-out infinite reverse', transform: 'translate(30%, 30%)' }} />

      {/* ── Navigation ── */}
      <Navigation />

      {/* ── Hero Section ── */}
      <HeroSection />

      {/* ── Stats bar ── */}
      <div ref={statsRef} className="relative py-12 px-6"
        style={{ borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'color-mix(in oklch, var(--card) 40%, transparent)' }}>
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-0">
          {[
            { val: laws, suf: '+', label: 'Textes de loi', sub: 'mis à jour quotidiennement' },
            { val: domains, suf: '', label: 'Domaines couverts', sub: 'droit civil, pénal, social…' },
            { val: users, suf: '+', label: 'Utilisateurs actifs', sub: 'juristes & particuliers' },
          ].map((s, i) => (
            <div key={i} className="flex items-stretch gap-0">
              {i > 0 && <div className="w-px self-stretch mx-6 md:mx-10" style={{ background: 'var(--border)' }} />}
              <div className="flex-1 text-center py-2">
                <div className="font-serif text-3xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>
                  {s.val.toLocaleString()}{s.suf}
                </div>
                <div className="text-sm font-medium mb-0.5" style={{ color: 'color-mix(in oklch, var(--foreground) 70%, transparent)' }}>{s.label}</div>
                <div className="text-xs font-light" style={{ color: 'color-mix(in oklch, var(--muted-foreground) 60%, transparent)' }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features Section ── */}
      <FeaturesSection />

      {/* ── How It Works Section ── */}
      <HowItWorksSection />

      {/* ── Infrastructure Section ── */}
      <InfrastructureSection />

      {/* ── Metrics Section ── */}
      <MetricsSection />

      {/* ── Integrations Section ── */}
      <IntegrationsSection />

      {/* ── Security Section ── */}
      <SecuritySection />

      {/* ── Developers Section ── */}
      <DevelopersSection />

      {/* ── Testimonials Section ── */}
      <TestimonialsSection />

      {/* ── Pricing Section ── */}
      <PricingSection />

      {/* ── FAQ Section ── */}
      <section id="faq" className="py-20 px-6" style={{ borderTop: '1px solid var(--border)', background: 'color-mix(in oklch, var(--card) 30%, transparent)' }}>
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-medium tracking-[0.2em] uppercase mb-3" style={{ color: 'color-mix(in oklch, var(--muted-foreground) 60%, transparent)' }}>FAQ</p>
            <h2 className="font-serif text-3xl font-bold tracking-tight" style={{ color: 'var(--foreground)' }}>Questions fréquentes</h2>
          </div>
          {[
            { q: 'SilkBot remplace-t-il un avocat ?', a: 'Non. SilkBot est un outil d\'information juridique, pas un conseil professionnel. Pour des situations complexes ou litigieuses, consultez toujours un avocat qualifié.', delay: 0 },
            { q: 'Les sources sont-elles à jour ?', a: 'Oui. Notre base de données est synchronisée avec le Journal Officiel de la République Tunisienne et mise à jour en continu. Chaque réponse indique la date de dernière mise à jour des textes cités.', delay: 50 },
            { q: 'Puis-je utiliser SilkBot en arabe ?', a: 'Absolument. SilkBot comprend et répond en arabe et en français. Vous pouvez mélanger les deux langues dans la même conversation.', delay: 100 },
            { q: 'Mes données sont-elles confidentielles ?', a: 'Oui. Vos conversations ne sont jamais partagées avec des tiers et ne servent pas à entraîner nos modèles. Vous pouvez supprimer votre historique à tout moment.', delay: 150 },
            { q: 'L\'accès est-il vraiment gratuit ?', a: 'Le plan gratuit vous donne accès à 20 questions par mois. Pour un usage professionnel illimité, des plans Pro et Équipe sont disponibles à des tarifs adaptés.', delay: 200 },
          ].map(f => <FaqItem key={f.q} {...f} />)}
        </div>
      </section>

      {/* ── CTA Section ── */}
      <CtaSection />

      {/* ── Footer Section ── */}
      <FooterSection />
    </div>
  );
}