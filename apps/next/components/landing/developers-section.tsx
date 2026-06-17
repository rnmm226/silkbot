"use client";

import { useState, useEffect, useRef } from "react";

const codeExamples = [
  {
    label: "Question simple",
    code: `import { SilkBot } from '@silkbot/sdk'

const client = new SilkBot({
  apiKey: process.env.SILKBOT_API_KEY
})

// Question en français
const response = await client.ask({
  question: "Quels sont mes droits en cas de licenciement abusif ?",
  language: "fr"
})

console.log(response.answer)
console.log(response.sources)`,
  },
  {
    label: "Avec sources",
    code: `// Récupérer les sources juridiques
const response = await client.ask({
  question: "Puis-je résilier mon bail avant terme ?",
  language: "fr",
  includeSources: true
})

response.sources.forEach(source => {
  console.log(\`\${source.title} - \${source.article}\`)
  console.log(source.url) // Lien vers JORT
})`,
  },
  {
    label: "API REST",
    code: `curl -X POST https://api.silkbot.ai/v1/ask \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "question": "Quels sont les délais de prescription en droit tunisien ?",
    "language": "fr",
    "sources": true
  }'`,
  },
];

const features = [
  { 
    title: "TypeScript natif", 
    description: "Types complets avec auto-complétion."
  },
  { 
    title: "SDK simple", 
    description: "Une API intuitive pour vos intégrations."
  },
  { 
    title: "Support bilingue", 
    description: "Français et arabe dans la même requête."
  },
  { 
    title: "Sources vérifiables", 
    description: "Retour des références juridiques exactes."
  },
];

const codeAnimationStyles = `
  .dev-code-line {
    opacity: 0;
    transform: translateX(-8px);
    animation: devLineReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes devLineReveal {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  
  .dev-code-char {
    opacity: 0;
    filter: blur(8px);
    animation: devCharReveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  @keyframes devCharReveal {
    to {
      opacity: 1;
      filter: blur(0);
    }
  }
`;

export function DevelopersSection() {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExamples[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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
      id="developers" 
      ref={sectionRef} 
      className="relative py-20 lg:py-28 overflow-hidden"
      style={{
        borderBottom: '1px solid var(--color-border,#2a2520)',
      }}
    >
      <style dangerouslySetInnerHTML={{ __html: codeAnimationStyles }} />
      
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, color-mix(in oklch, var(--primary,#c4956a) 5%, transparent) 0%, transparent 70%)' }} />
      </div>

      <div className="max-w-6xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="inline-flex items-center gap-3 text-xs font-medium tracking-[0.2em] uppercase mb-5">
              <span className="w-8 h-px" style={{ background: 'color-mix(in oklch, var(--primary,#c4956a) 40%, transparent)' }} />
              <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 60%, transparent)' }}>
                Pour les développeurs
              </span>
            </span>
            <h2 className="font-serif text-3xl lg:text-4xl font-bold tracking-tight mb-5"
              style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
              Intégrez SilkBot
              <br />
              <span style={{ color: 'var(--primary,#c4956a)' }}>dans vos applications</span>
            </h2>
            <p className="text-base font-light mb-10 leading-relaxed"
              style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
              Une API et un SDK pensés pour les développeurs. Intégrez la puissance 
              du droit tunisien en quelques lignes de code.
            </p>
            
            {/* Features */}
            <div className="grid grid-cols-2 gap-5">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 text-sm"
                    style={{
                      background: 'color-mix(in oklch, var(--primary,#c4956a) 10%, transparent)',
                      color: 'var(--primary,#c4956a)',
                    }}>
                    {index === 0 && "📘"}
                    {index === 1 && "⚡"}
                    {index === 2 && "🌐"}
                    {index === 3 && "📋"}
                  </div>
                  <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                    {feature.title}
                  </h3>
                  <p className="text-xs font-light" style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
          
          {/* Right: Code block */}
          <div
            className={`lg:sticky lg:top-32 transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="rounded-xl overflow-hidden"
              style={{
                background: 'var(--color-card,#1a1815)',
                border: '1px solid var(--color-border,#2a2520)',
              }}>
              {/* Tabs */}
              <div className="flex items-center border-b" style={{ borderColor: 'var(--color-border,#2a2520)' }}>
                {codeExamples.map((example, idx) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => setActiveTab(idx)}
                    className={`px-5 py-3 text-xs font-mono transition-colors relative ${
                      activeTab === idx
                        ? "font-medium"
                        : "font-light"
                    }`}
                    style={{
                      color: activeTab === idx
                        ? 'var(--primary,#c4956a)'
                        : 'var(--color-muted-foreground,#8a7f72)',
                    }}
                  >
                    {example.label}
                    {activeTab === idx && (
                      <span className="absolute bottom-0 left-0 right-0 h-px" style={{ background: 'var(--primary,#c4956a)' }} />
                    )}
                  </button>
                ))}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-4 py-3 transition-colors"
                  style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}
                  aria-label="Copy code"
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--primary,#c4956a)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--color-muted-foreground,#8a7f72)'}
                >
                  {copied ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Code content */}
              <div className="p-6 font-mono text-xs min-h-[280px] overflow-x-auto">
                <pre style={{ color: 'color-mix(in oklch, var(--color-foreground,#e8e0d0) 80%, transparent)' }}>
                  {codeExamples[activeTab].code.split('\n').map((line, lineIndex) => (
                    <div 
                      key={`${activeTab}-${lineIndex}`} 
                      className="leading-loose dev-code-line"
                      style={{ animationDelay: `${lineIndex * 80}ms` }}
                    >
                      <span className="inline-flex">
                        {line.split('').map((char, charIndex) => (
                          <span
                            key={`${activeTab}-${lineIndex}-${charIndex}`}
                            className="dev-code-char"
                            style={{
                              animationDelay: `${lineIndex * 80 + charIndex * 15}ms`,
                            }}
                          >
                            {char === ' ' ? '\u00A0' : char}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>
            </div>
            
            {/* Links */}
            <div className="mt-6 flex items-center gap-6 text-xs">
              <a href="#" className="transition-colors hover:underline underline-offset-4"
                style={{ color: 'var(--color-foreground,#e8e0d0)' }}>
                📖 Lire la documentation
              </a>
              <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 30%, transparent)' }}>|</span>
              <a href="#" className="transition-colors"
                style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary,#c4956a)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-muted-foreground,#8a7f72)'}>
                🔗 API Reference
              </a>
              <span style={{ color: 'color-mix(in oklch, var(--color-muted-foreground,#8a7f72) 30%, transparent)' }}>|</span>
              <a href="#" className="transition-colors"
                style={{ color: 'var(--color-muted-foreground,#8a7f72)' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--primary,#c4956a)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--color-muted-foreground,#8a7f72)'}>
                💬 Support technique
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}