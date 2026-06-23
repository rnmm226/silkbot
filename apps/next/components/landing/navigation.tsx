"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const navLinks = [
  { name: "Fonctionnalités", href: "#features" },
  { name: "Comment ça marche", href: "#how" },
  { name: "FAQ", href: "#faq" },
];

export function Navigation() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [heroReady, setHeroReady] = useState(false);
  const [logoIconError, setLogoIconError] = useState(false);
  const [logoTextError, setLogoTextError] = useState(false);
  // NOUVEAU: progression de scroll (0 à 100) pour la barre en haut de page
  const [scrollProgress, setScrollProgress] = useState(0);
  const magnetRef = useRef<HTMLAnchorElement>(null);
  const buttonMagnetRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      // NOUVEAU: calcule le % de scroll sur la hauteur totale de la page
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(docHeight > 0 ? (scrollTop / docHeight) * 100 : 0);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // valeur initiale au montage

    // Animation d'entrée
    const t = setTimeout(() => setHeroReady(true), 120);
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(t);
    };
  }, []);

  // Effet magnet pour les liens
  const applyMagnet = useCallback((e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>, ref: React.RefObject<HTMLElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * 0.22;
    const y = (e.clientY - rect.top - rect.height / 2) * 0.22;
    el.style.transform = `translate(${x}px, ${y}px)`;
  }, []);

  const resetMagnet = useCallback((ref: React.RefObject<HTMLElement>) => {
    if (ref.current) ref.current.style.transform = "";
  }, []);

  // Fermer le menu mobile lors du clic sur un lien
  const handleLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* NOUVEAU: barre de progression de scroll — indépendante du header flottant,
          reste fixée en haut de l'écran pendant toute la navigation */}
      <div
        className="fixed top-0 left-0 right-0 z-[60] h-[2px] pointer-events-none"
        aria-hidden="true"
      >
        <div
          style={{
            width: `${scrollProgress}%`,
            height: "100%",
            background: "var(--primary, #c4956a)",
            boxShadow: "0 0 8px color-mix(in oklch, var(--primary,#c4956a) 60%, transparent)",
            transition: "width 0.1s linear",
          }}
        />
      </div>

      <header
        className={`fixed z-50 transition-all duration-500 ${
          isScrolled 
            ? "top-4 left-4 right-4" 
            : "top-0 left-0 right-0"
        }`}
        style={{
          opacity: heroReady ? 1 : 0,
          transform: heroReady ? "translateY(0)" : "translateY(-100%)",
          transition: "opacity 0.5s ease, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <nav 
          className={`mx-auto transition-all duration-500 ${
            isScrolled || isMobileMenuOpen
              ? "bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-lg max-w-[1200px]"
              : "bg-transparent max-w-[1400px]"
          }`}
          style={{
            background: isScrolled || isMobileMenuOpen 
              ? "color-mix(in oklch, var(--color-background, #0f0e0c) 88%, transparent)"
              : "transparent",
            borderBottom: isScrolled || isMobileMenuOpen 
              ? "1px solid color-mix(in oklch, var(--color-border, #2a2520) 60%, transparent)"
              : "none",
          }}
        >
          <div 
            className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${
              isScrolled ? "h-14" : "h-20"
            }`}
          >
            {/* Logo */}
            
<Link href="/" className="flex items-center gap-2">
  <Image 
    src="/silkbot-logo-dark.png"
    alt="SilkBot"
    width={32}
    height={32}
    className="rounded-lg"
  />
  <Image 
    src="/silkbot-black.png"
    alt="SilkBot"
    width={90}
    height={28}
  />
</Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-12">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  className="nav-link text-sm transition-colors duration-300 relative group"
                  style={{ color: "var(--color-muted-foreground, #8a7f72)" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--color-foreground, #e8e0d0)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--color-muted-foreground, #8a7f72)")}
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-px transition-all duration-300 group-hover:w-full"
                    style={{ background: "var(--primary, #c4956a)" }} />
                </a>
              ))}
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-4">
              <Link
                href="/login"
                ref={magnetRef}
                onMouseMove={e => applyMagnet(e, magnetRef as React.RefObject<HTMLAnchorElement>)}
                onMouseLeave={() => resetMagnet(magnetRef as React.RefObject<HTMLAnchorElement>)}
                className={`transition-all duration-500 ${
                  isScrolled ? "text-xs" : "text-sm"
                } font-medium px-4 py-2 rounded-xl`}
                style={{
                  color: "var(--color-muted-foreground, #8a7f72)",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--color-foreground, #e8e0d0)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--color-muted-foreground, #8a7f72)")}
              >
                Connexion
              </Link>

              <Link
                href="/register"
                className={`rounded-full transition-all duration-500 active:scale-95 ${
                  isScrolled ? "px-4 h-8 text-xs" : "px-6 py-2.5 text-sm"
                } font-medium inline-flex items-center justify-center`}
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Essayer gratuitement
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 transition-transform duration-300 hover:scale-110"
              aria-label="Toggle menu"
              style={{ color: "var(--color-foreground, #e8e0d0)" }}
            >
              {isMobileMenuOpen ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </nav>
        
        {/* Mobile Menu - Full Screen Overlay */}
        <div
          className={`md:hidden fixed inset-0 z-40 transition-all duration-500 ${
            isMobileMenuOpen 
              ? "opacity-100 pointer-events-auto" 
              : "opacity-0 pointer-events-none"
          }`}
          style={{
            top: 0,
            background: "var(--color-background, #0f0e0c)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex flex-col h-full px-8 pt-28 pb-8">
            {/* Navigation Links */}
            {/* NOUVEAU: perspective posée sur le conteneur pour que la rotation 3D
                des liens ci-dessous soit visible */}
            <div className="flex-1 flex flex-col justify-center gap-8" style={{ perspective: "600px" }}>
              {navLinks.map((link, i) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={handleLinkClick}
                  className="text-4xl font-serif transition-all duration-500 hover:translate-x-2"
                  style={{
                    color: "var(--color-foreground, #e8e0d0)",
                    opacity: isMobileMenuOpen ? 1 : 0,
                    // NOUVEAU: entrée en cascade avec légère rotation 3D (au lieu d'un simple fade+translate)
                    transform: isMobileMenuOpen
                      ? "translateY(0) rotateX(0deg)"
                      : "translateY(16px) rotateX(-25deg)",
                    transitionDelay: isMobileMenuOpen ? `${i * 75}ms` : "0ms",
                  }}
                >
                  {link.name}
                </a>
              ))}
            </div>
            
            {/* Bottom CTAs */}
            <div className={`flex flex-col gap-4 pt-8 border-t transition-all duration-500 ${
              isMobileMenuOpen 
                ? "opacity-100 translate-y-0" 
                : "opacity-0 translate-y-4"
            }`}
            style={{
              borderColor: "var(--color-border, #2a2520)",
              transitionDelay: isMobileMenuOpen ? "300ms" : "0ms",
            }}>
              <Link
                href="/login"
                onClick={handleLinkClick}
                className="text-center text-sm font-medium px-4 py-3 rounded-xl transition-all"
                style={{
                  color: "var(--color-muted-foreground, #8a7f72)",
                  border: "1px solid var(--color-border, #2a2520)",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = "color-mix(in oklch, var(--primary, #c4956a) 35%, transparent)";
                  e.currentTarget.style.color = "var(--color-foreground, #e8e0d0)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = "var(--color-border, #2a2520)";
                  e.currentTarget.style.color = "var(--color-muted-foreground, #8a7f72)";
                }}
              >
                Connexion
              </Link>

              <Link
                href="/register"
                onClick={handleLinkClick}
                className="text-center text-sm font-medium px-4 py-3 rounded-xl transition-all active:scale-95"
                style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Essayer gratuitement
              </Link>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}