"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const words = ["comprendre", "explorer", "clarifier", "maîtriser"];

export function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);
  const [chatVisible, setChatVisible] = useState(false);
  const [showResponse, setShowResponse] = useState(false);
  const magnetRef = useRef<HTMLAnchorElement>(null);
  const buttonMagnetRef = useRef<HTMLAnchorElement>(null);
  // NOUVEAU: ref pour le tilt 3D au survol de la démo de chat
  const tiltRef = useRef<HTMLDivElement>(null);
  // NOUVEAU: compteur d'utilisateurs en ligne (preuve sociale, légère variation simulée)
  const [onlineUsers, setOnlineUsers] = useState(312);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Demo chat animation sequence
  useEffect(() => {
    if (!isVisible) return;
    const t1 = setTimeout(() => setChatVisible(true), 1400);
    const t2 = setTimeout(() => setShowResponse(true), 3800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isVisible]);

  // NOUVEAU: fait légèrement varier le nombre d'utilisateurs en ligne toutes les ~3s
  useEffect(() => {
    const id = setInterval(() => {
      setOnlineUsers((prev) => {
        const delta = Math.floor(Math.random() * 7) - 3; // -3 à +3
        return Math.min(420, Math.max(280, prev + delta));
      });
    }, 3200);
    return () => clearInterval(id);
  }, []);

  // Effet magnet
  const applyMagnet = useCallback((e: React.MouseEvent<HTMLAnchorElement>, ref: React.RefObject<HTMLAnchorElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.22;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.22;
    el.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  const resetMagnet = useCallback((ref: React.RefObject<HTMLAnchorElement>) => {
    if (ref.current) ref.current.style.transform = "";
  }, []);

  // NOUVEAU: tilt 3D — la carte de démo suit subtilement le curseur (parallax léger)
  const handleTiltMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = tiltRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `rotateY(${px * 8}deg) rotateX(${-py * 8}deg)`;
  }, []);

  const handleTiltLeave = useCallback(() => {
    if (tiltRef.current) tiltRef.current.style.transform = "rotateY(0deg) rotateX(0deg)";
  }, []);

  // Composant TypingText local
  const TypingText = ({ text, delay = 0 }: { text: string; delay?: number }) => {
    const [displayed, setDisplayed] = useState('');
    const [started, setStarted] = useState(false);
    useEffect(() => {
      const t = setTimeout(() => setStarted(true), delay);
      return () => clearTimeout(t);
    }, [delay]);
    useEffect(() => {
      if (!started) return;
      let i = 0;
      const timer = setInterval(() => {
        setDisplayed(text.slice(0, i + 1));
        i++;
        if (i >= text.length) clearInterval(timer);
      }, 28);
      return () => clearInterval(timer);
    }, [started, text]);
    return <>{displayed}<span className="inline-block w-0.5 h-3 bg-current ml-0.5 animate-pulse" style={{ opacity: displayed.length < text.length ? 1 : 0 }} /></>;
  };

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      {/* Ambient orbs - cohérent avec page.tsx */}
      <div className="pointer-events-none absolute top-0 left-0 w-[600px] h-[600px] rounded-full" 
        style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary,#c4956a) 8%, transparent) 0%, transparent 65%)', animation: 'floatSlow 14s ease-in-out infinite', transform: 'translate(-30%, -30%)' }} />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full" 
        style={{ background: 'radial-gradient(circle, color-mix(in oklch, #c4a46a 6%, transparent) 0%, transparent 65%)', animation: 'floatSlow 18s ease-in-out infinite reverse', transform: 'translate(30%, 30%)' }} />

      {/* Styles globaux pour les animations */}
      <style>{`
        @keyframes floatSlow { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes scaleIn { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
        @keyframes slideInRight { from { opacity:0; transform:translateX(16px); } to { opacity:1; transform:translateX(0); } }
        @keyframes dotPulse { 0%,80%,100%{opacity:.3;transform:scale(.7)} 40%{opacity:1;transform:scale(1)} }
        @keyframes charIn {
          0% { opacity: 0; transform: translateY(20px) rotateX(-90deg); }
          100% { opacity: 1; transform: translateY(0) rotateX(0); }
        }
        .animate-char-in {
          animation: charIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
      `}</style>
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left: copy */}
          <div>
            {/* Eyebrow pill */}
            <div 
              className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 mb-7 transition-all duration-700 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{
                background: 'color-mix(in oklch, var(--primary,#c4956a) 8%, transparent)',
                border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 22%, transparent)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary,#c4956a)', animation: 'dotPulse 2s ease infinite' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--primary,#c4956a)' }}>Plateforme juridique tunisienne</span>
            </div>

            {/* Main headline */}
            <div className="mb-8">
              <h1 
                className={`font-serif font-bold leading-[1.08] tracking-tight transition-all duration-1000 ${
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                }`}
                style={{ fontSize: 'clamp(2.4rem, 5vw, 3.5rem)', color: 'var(--color-foreground,#e8e0d0)' }}
              >
                <span className="block">Le Droit Tunisien,</span>
                <span className="block">
                  pour{" "}
                  <span className="relative inline-block">
                    <span className="inline-flex">
                      {words[wordIndex].split("").map((char, i) => (
                        <span
                          key={`${wordIndex}-${i}`}
                          className="inline-block animate-char-in"
                          style={{
                            animationDelay: `${i * 50}ms`,
                            color: 'var(--primary,#c4956a)',
                          }}
                        >
                          {char}
                        </span>
                      ))}
                    </span>
                    <span className="absolute -bottom-2 left-0 right-0 h-3" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 15%, transparent)' }} />
                  </span>
                </span>
                <span className="block">mieux.</span>
              </h1>
            </div>

            {/* Description */}
            <p 
              className={`text-base font-light leading-relaxed mb-8 max-w-md transition-all duration-700 delay-200 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
              style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}
            >
              Posez vos questions juridiques en français ou en arabe. SilkBot analyse les textes officiels tunisiens et vous répond avec des références précises et vérifiables.
            </p>

            {/* CTAs */}
            <div 
              className={`flex flex-wrap items-center gap-3 transition-all duration-700 delay-300 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <Link
                href="/register"
                ref={magnetRef}
                onMouseMove={e => applyMagnet(e, magnetRef)}
                onMouseLeave={() => resetMagnet(magnetRef)}
                className="btn-shine inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all active:scale-95 hover:-translate-y-0.5"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Essayer gratuitement
                <span style={{ opacity: 0.7 }}>→</span>
              </Link>
              <a
                href="#how"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-medium transition-all hover:-translate-y-0.5"
                style={{ border: '1px solid var(--color-border,#2a2520)', color: 'var(--color-muted-foreground,#8a7f72)' }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'color-mix(in oklch, var(--primary,#c4956a) 35%, transparent)';
                  e.currentTarget.style.color = 'var(--color-foreground,#e8e0d0)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--color-border,#2a2520)';
                  e.currentTarget.style.color = 'var(--color-muted-foreground,#8a7f72)';
                }}
              >
                Voir comment ça marche
              </a>
            </div>

            {/* Trust row */}
            <div 
              className={`flex items-center gap-5 mt-7 flex-wrap transition-all duration-700 delay-400 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              {['🔒 Données sécurisées', '📚 Sources officielles', '⚡ Réponse en secondes'].map((b, i) => (
                <span key={i} className="text-xs font-light flex items-center gap-1.5" style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 70%, transparent)' }}>{b}</span>
              ))}
            </div>

            {/* NOUVEAU: compteur d'utilisateurs en ligne — preuve sociale discrète et vivante */}
            <div 
              className={`inline-flex items-center gap-2 mt-4 transition-all duration-700 delay-500 ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full opacity-60" style={{ background: '#4ade80', animation: 'dotPulse 2s ease infinite' }} />
                <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: '#4ade80' }} />
              </span>
              <span className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                <strong style={{ color: 'var(--color-foreground,#e8e0d0)', fontWeight: 600 }}>{onlineUsers}</strong> personnes en ligne actuellement
              </span>
            </div>
          </div>

          {/* Right: animated chat demo */}
          <div 
            className={`relative transition-all duration-700 delay-500 ${
              isVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            }`}
          >
            {/* NOUVEAU: enveloppe de tilt 3D — suit la souris, indépendante de l'animation
                de flottement (floatSlow) qui reste posée sur la carte elle-même */}
            <div
              ref={tiltRef}
              onMouseMove={handleTiltMove}
              onMouseLeave={handleTiltLeave}
              style={{
                perspective: '1200px',
                transformStyle: 'preserve-3d',
                transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              <div className="relative rounded-2xl overflow-hidden shadow-2xl"
                style={{
                  background: 'var(--color-card,#1a1815)',
                  border: '1px solid var(--color-border,#2a2520)',
                  animation: 'floatSlow 9s ease-in-out infinite',
                  boxShadow: '0 25px 80px color-mix(in oklch, var(--primary,#c4956a) 12%, rgba(0,0,0,0.5))',
                }}>

                {/* Window chrome */}
                <div className="flex items-center gap-2.5 px-4 py-3.5" style={{ borderBottom: '1px solid var(--color-border,#2a2520)', background: 'color-mix(in oklch, var(--color-background,#0f0e0c) 60%, transparent)' }}>
                  <div className="flex gap-1.5">
                    {['#ff5f57', '#ffbd2e', '#28c840'].map(c => <div key={c} className="w-2.5 h-2.5 rounded-full" style={{ background: c, opacity: 0.7 }} />)}
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground,#8a7f72)', opacity: 0.6 }}>silkbot.app/chat</span>
                  </div>
                </div>

                {/* Chat body */}
                <div className="p-5 space-y-4 min-h-[280px]">
                  {/* User message */}
                  {chatVisible && (
                    <div className="flex justify-end" style={{ animation: 'slideInRight 0.4s cubic-bezier(0.22,1,0.36,1) both' }}>
                      <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm" style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
                        <TypingText text="Puis-je résilier mon bail avant terme ?" delay={100} />
                      </div>
                    </div>
                  )}

                  {/* Assistant response */}
                  {showResponse && (
                    <div className="flex gap-3" style={{ animation: 'fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both' }}>
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 25%, transparent)' }}>
                        <span style={{ fontSize: '12px' }}>⚖</span>
                      </div>
                      <div className="max-w-[82%]">
                        <div className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 mb-2 text-xs"
                          style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 8%, transparent)', color: 'color-mix(in oklch, var(--primary,#c4956a) 80%, transparent)', border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 18%, transparent)' }}>
                          ✦ <TypingText text="12 passages analysés · 3 retenus" delay={200} />
                        </div>
                        <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 text-sm leading-relaxed"
                          style={{ background: 'color-mix(in oklch, var(--color-background,#0f0e0c) 60%, transparent)', border: '1px solid var(--color-border,#2a2520)', color: 'var(--color-foreground,#e8e0d0)' }}>
                          <TypingText text="Selon l'art. 113 du C.O.C., vous pouvez résilier avant terme avec un préavis écrit d'un mois, sauf clause contraire dans le contrat." delay={400} />
                          <div className="flex gap-1.5 mt-3 flex-wrap">
                            {['C.O.C. art. 113', 'Loi 76-35 art. 8'].map(s => (
                              <span key={s} className="text-xs px-2.5 py-1 rounded-full"
                                style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)', color: 'var(--primary,#c4956a)', border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 22%, transparent)' }}>
                                {s} ✓
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Typing indicator */}
                  {chatVisible && !showResponse && (
                    <div className="flex gap-3" style={{ animation: 'fadeUp 0.4s ease 0.3s both' }}>
                      <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 12%, transparent)', border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 25%, transparent)' }}>
                        <span style={{ fontSize: '12px' }}>⚖</span>
                      </div>
                      <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5"
                        style={{ background: 'color-mix(in oklch, var(--color-background,#0f0e0c) 60%, transparent)', border: '1px solid var(--color-border,#2a2520)' }}>
                        {[0, 160, 320].map(d => (
                          <span key={d} className="w-1.5 h-1.5 rounded-full"
                            style={{ background: 'var(--primary,#c4956a)', animation: `dotPulse 1.4s ease ${d}ms infinite` }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Input bar */}
                <div className="px-4 pb-4">
                  <div className="flex items-center gap-2 rounded-xl px-4 py-2.5" style={{ background: 'color-mix(in oklch, var(--color-background,#0f0e0c) 70%, transparent)', border: '1px solid var(--color-border,#2a2520)' }}>
                    <span className="text-xs flex-1 font-light" style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 50%, transparent)' }}>Posez votre question juridique…</span>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: 'var(--primary,#c4956a)' }}>
                      <span style={{ fontSize: '10px', color: '#0f0e0c' }}>→</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating accuracy badge */}
              <div className="absolute -bottom-4 -left-5 rounded-2xl px-4 py-3 shadow-xl"
                style={{ background: 'var(--color-card,#1a1815)', border: '1px solid var(--color-border,#2a2520)', animation: 'floatSlow 11s ease-in-out 1.5s infinite reverse' }}>
                <div className="text-xs font-light mb-0.5" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>Précision des sources</div>
                <div className="font-serif text-xl font-bold" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>99.1<span style={{ fontSize: '14px', color: 'var(--primary,#c4956a)' }}>%</span></div>
              </div>

              {/* Floating doc count badge */}
              <div className="absolute -top-3 -right-4 rounded-2xl px-3.5 py-2.5 shadow-xl"
                style={{ background: 'var(--color-card,#1a1815)', border: '1px solid color-mix(in oklch, var(--primary,#c4956a) 25%, transparent)', animation: 'floatSlow 13s ease-in-out 3s infinite' }}>
                <div className="text-xs font-medium" style={{ color: 'var(--primary,#c4956a)' }}>📚 1 247 textes</div>
                <div className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>mis à jour</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats marquee - full width */}
      <div 
        className={`absolute bottom-12 left-0 right-0 transition-all duration-700 delay-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="overflow-hidden whitespace-nowrap">
          <div className="flex gap-16 animate-marquee">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="flex gap-16">
                {[
                  { value: "1 247+", label: "textes juridiques indexés", company: "JORT" },
                  { value: "2", label: "langues supportées", company: "AR / FR" },
                  { value: "24", label: "domaines du droit couverts", company: "TUNISIE" },
                  { value: "8 500+", label: "utilisateurs accompagnés", company: "SILKBOT" },
                ].map((stat) => (
                  <div key={`${stat.company}-${i}`} className="flex items-baseline gap-4 px-4">
                    <span className="text-2xl lg:text-3xl font-serif font-bold" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>{stat.value}</span>
                    <span className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                      {stat.label}
                      <span className="block font-mono text-[10px] mt-0.5 opacity-60">{stat.company}</span>
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 25s linear infinite;
        }
      `}</style>
    </section>
  );
}