"use client";

export function AnimatedTetrahedron() {
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <svg viewBox="0 0 300 300" className="w-full h-full">
        <defs>
          <linearGradient id="tetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary, #c4956a)" stopOpacity="0.9"/>
            <stop offset="100%" stopColor="var(--primary, #c4956a)" stopOpacity="0.3"/>
          </linearGradient>
          
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        {/* Lignes du tétraèdre */}
        {/* Arête sommet - bas gauche */}
        <line x1="150" y1="50" x2="70" y2="220" stroke="var(--primary, #c4956a)" strokeWidth="1.5" opacity="0.6">
          <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite" />
        </line>
        
        {/* Arête sommet - bas droite */}
        <line x1="150" y1="50" x2="230" y2="220" stroke="var(--primary, #c4956a)" strokeWidth="1.5" opacity="0.6">
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="2s" begin="0.5s" repeatCount="indefinite" />
        </line>
        
        {/* Arête sommet - bas avant */}
        <line x1="150" y1="50" x2="150" y2="240" stroke="var(--primary, #c4956a)" strokeWidth="1.5" opacity="0.6">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" begin="1s" repeatCount="indefinite" />
        </line>
        
        {/* Base - triangle */}
        <line x1="70" y1="220" x2="230" y2="220" stroke="var(--primary, #c4956a)" strokeWidth="1.5" opacity="0.4">
          <animate attributeName="opacity" values="0.2;0.6;0.2" dur="3s" repeatCount="indefinite" />
        </line>
        <line x1="70" y1="220" x2="150" y2="240" stroke="var(--primary, #c4956a)" strokeWidth="1.5" opacity="0.4">
          <animate attributeName="opacity" values="0.6;0.2;0.6" dur="3s" begin="1s" repeatCount="indefinite" />
        </line>
        <line x1="230" y1="220" x2="150" y2="240" stroke="var(--primary, #c4956a)" strokeWidth="1.5" opacity="0.4">
          <animate attributeName="opacity" values="0.4;0.8;0.4" dur="3s" begin="2s" repeatCount="indefinite" />
        </line>
        
        {/* Symbole central */}
        <text x="150" y="160" textAnchor="middle" fontSize="50" fill="url(#tetGrad)" filter="url(#glow)">
          ⚖️
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          <animateTransform attributeName="transform" type="rotate" values="0 150 160;360 150 160" dur="20s" repeatCount="indefinite" />
        </text>
        
        {/* Particules */}
        <circle cx="80" cy="100" r="3" fill="var(--primary, #c4956a)" opacity="0.5">
          <animateMotion dur="6s" repeatCount="indefinite" path="M0,0 Q70,-50 140,0 Q210,50 280,0" />
          <animate attributeName="opacity" values="0.2;0.8;0.2" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="220" cy="180" r="3" fill="var(--primary, #c4956a)" opacity="0.5">
          <animateMotion dur="5s" repeatCount="indefinite" path="M0,0 Q-60,40 -120,0 Q-180,-40 -240,0" />
          <animate attributeName="opacity" values="0.8;0.2;0.8" dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx="150" cy="250" r="2" fill="var(--primary, #c4956a)" opacity="0.4">
          <animate attributeName="opacity" values="0.1;0.6;0.1" dur="3s" repeatCount="indefinite" />
          <animate attributeName="r" values="2;5;2" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}