"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

export function FooterSection() {
  const currentYear = new Date().getFullYear();
  const [logoIconError, setLogoIconError] = useState(false);
  const [logoTextError, setLogoTextError] = useState(false);

  return (
    <footer className="px-6 py-10" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-5">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold overflow-hidden" 
            style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            {logoIconError ? (
              <span>⚖</span>
            ) : (
              <Image 
                src="/silkbot-logo-white.png"
                alt="SilkBot Logo"
                width={28}
                height={28}
                className="object-contain"
                onError={() => setLogoIconError(true)}
              />
            )}
          </div>
          {logoTextError ? (
            <span className="font-serif text-base font-bold" 
              style={{ color: 'color-mix(in oklch, var(--foreground) 70%, transparent)' }}>
              Silk<span style={{ color: 'var(--primary)' }}>Bot</span>
            </span>
          ) : (
            <Image 
              src="/silkbot-black.png"
              alt="SilkBot"
              width={80}
              height={24}
              className="object-contain"
              onError={() => setLogoTextError(true)}
            />
          )}
        </Link>
        
        <p className="text-xs text-center font-light" 
          style={{ color: 'color-mix(in oklch, var(--muted-foreground) 60%, transparent)' }}>
          © {currentYear} SilkBot — Plateforme juridique tunisienne
        </p>
        
        <div className="flex gap-5">
          {['Mentions légales', 'Confidentialité', 'Contact'].map(l => (
            <a key={l} href="#" className="text-xs font-light nav-link transition-colors" 
              style={{ color: 'color-mix(in oklch, var(--muted-foreground) 70%, transparent)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'color-mix(in oklch, var(--muted-foreground) 70%, transparent)'}>
              {l}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}