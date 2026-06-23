"use client";

import { useState } from "react";
import Link from "next/link";

const plans = [
  {
    name: "Gratuit",
    description: "Pour les particuliers et petits besoins",
    price: { monthly: 0, annual: 0 },
    features: [
      "20 questions par mois",
      "Accès aux codes officiels",
      "Support communautaire",
      "Réponses sourcées",
      "Français & Arabe",
    ],
    cta: "Commencer gratuitement",
    popular: false,
    icon: "🎓",
  },
  {
    name: "Pro",
    description: "Pour les professionnels et cabinets",
    price: { monthly: 49, annual: 39 },
    features: [
      "Questions illimitées",
      "Accès à l'historique complet",
      "Support prioritaire 24/7",
      "Export PDF des réponses",
      "Annotations personnalisées",
      "Partage d'analyses",
      "API pour intégration",
      "Mises à jour juridiques",
    ],
    cta: "Commencer l'essai",
    popular: true,
    icon: "⚖️",
  },
  {
    name: "Expert",
    description: "Pour les grandes structures",
    price: { monthly: null, annual: null },
    features: [
      "Tout du plan Pro",
      "Base de connaissances dédiée",
      "Support dédié 24/7",
      "Intégrations sur mesure",
      "Formation équipe incluse",
      "SLA personnalisé",
      "Veille juridique proactive",
      "Audit de conformité",
      "Déploiement privé",
    ],
    cta: "Contacter les ventes",
    popular: false,
    icon: "🏛️",
  },
  
];

export function PricingSection() {
  const [isAnnual, setIsAnnual] = useState(true);

  return (
    <section 
      id="pricing" 
      className="relative py-20 lg:py-28 overflow-hidden"
      style={{
        borderTop: '1px solid var(--color-border,#2a2520)',
        background: 'color-mix(in oklch, var(--color-card,#1a1815) 30%, transparent)',
      }}
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary,#c4956a) 5%, transparent) 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        {/* Header */}
        <div className="max-w-2xl mx-auto text-center mb-12 lg:mb-16">
          <span className="inline-flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase mb-5">
            <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
            <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
              Tarifs
            </span>
            <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
          </span>
          <h2 className="font-serif text-3xl lg:text-4xl font-bold tracking-tight mb-4"
            style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
            Des tarifs adaptés à vos besoins
          </h2>
          <p className="text-sm font-light"
            style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
            Commencez gratuitement et évoluez au fil de vos besoins. Sans engagement.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span
            className={`text-sm transition-colors ${
              !isAnnual ? "font-medium" : "font-light"
            }`}
            style={{
              color: !isAnnual 
                ? 'var(--color-foreground,#e8e0d0)' 
                : 'var(--color-muted-foreground,#8a7f72)'
            }}
          >
            Mensuel
          </span>
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className="relative w-14 h-7 rounded-full p-1 transition-colors"
            style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 15%, transparent)' }}
          >
            <div
              className={`w-5 h-5 rounded-full transition-transform duration-300 ${
                isAnnual ? "translate-x-7" : "translate-x-0"
              }`}
              style={{ background: 'var(--primary,#c4956a)' }}
            />
          </button>
          <span
            className={`text-sm transition-colors ${
              isAnnual ? "font-medium" : "font-light"
            }`}
            style={{
              color: isAnnual 
                ? 'var(--color-foreground,#e8e0d0)' 
                : 'var(--color-muted-foreground,#8a7f72)'
            }}
          >
            Annuel
          </span>
          {isAnnual && (
            <span className="ml-2 px-2 py-1 rounded-md text-xs font-medium"
              style={{
                background: 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)',
                color: 'var(--primary,#c4956a)'
              }}>
              −17%
            </span>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((plan, idx) => (
            // NOUVEAU: enveloppe externe non "overflow-hidden" pour que le badge
            // "Recommandé" (positionné en -top-3) ne soit jamais rogné par l'effet shine
            <div key={plan.name} className="relative">
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 z-10 px-3 py-1 rounded-full text-[10px] font-medium whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/80">
                  Recommandé
                </span>
              )}

              <div
                className={`relative rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 ${
                  plan.popular 
                    ? "lg:p-8 recommended-shine overflow-hidden" // NOUVEAU: lumière en boucle douce sur le plan recommandé
                    : ""
                }`}
                style={{
                  background: 'var(--color-card,#1a1815)',
                  border: plan.popular 
                    ? `2px solid ${'var(--primary,#c4956a)'}`
                    : '1px solid var(--color-border,#2a2520)',
                  boxShadow: plan.popular 
                    ? `0 10px 40px color-mix(in oklch, var(--primary,#c4956a) 15%, transparent)`
                    : 'none',
                }}
              >
                {/* Plan Header */}
                <div className="mb-6">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl mb-4"
                    style={{
                      background: 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)',
                      border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 20%, transparent)',
                    }}>
                    {plan.icon}
                  </div>
                  <h3 className="font-serif text-xl font-semibold mb-1"
                    style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                    {plan.name}
                  </h3>
                  <p className="text-xs font-light"
                    style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-6 pb-6"
                  style={{ borderBottom: '1px solid var(--color-border,#2a2520)' }}>
                  {plan.price.monthly !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-4xl font-bold"
                        style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                        {isAnnual ? plan.price.annual : plan.price.monthly} DT
                      </span>
                      <span className="text-xs font-light"
                        style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                        /mois
                      </span>
                    </div>
                  ) : (
                    <span className="font-serif text-2xl font-bold"
                      style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                      Sur mesure
                    </span>
                  )}
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                        style={{ color: 'var(--primary,#c4956a)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-xs font-light"
                        style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href={plan.price.monthly === 0 ? "/register" : plan.price.monthly === null ? "/contact" : "/register"}
                  className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-medium transition-all group ${
                    plan.popular
                      ? "hover:opacity-90 btn-shine" // NOUVEAU: léger reflet au survol, cohérent avec le CTA du Hero
                      : "hover:translate-x-0.5"
                  }`}
                  style={{
                    background: plan.popular 
                      ? 'var(--primary,#c4956a)' 
                      : 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)',
                    color: plan.popular ? 'var(--primary-foreground)' : 'var(--primary,#c4956a)',
                    border: plan.popular ? 'none' : '1px solid color-mix(in oklch, var(--primary,#c4956a) 20%, transparent)',
                  }}
                >
                  {plan.cta}
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Note */}
        <div className="mt-12 text-center">
          <div className="inline-flex flex-wrap items-center gap-2 text-xs"
            style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
            <span>✓</span>
            <span>Tous les plans incluent les mises à jour juridiques</span>
            <span className="opacity-30">•</span>
            <span>✓</span>
            <span>Certificat SSL</span>
            <span className="opacity-30">•</span>
            <span>✓</span>
            <span>Conformité RGPD</span>
          </div>
          <p className="mt-4 text-xs font-light"
            style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
            *Les prix sont en Dinar Tunisien (DT) et hors taxes
          </p>
        </div>
      </div>
    </section>
  );
}