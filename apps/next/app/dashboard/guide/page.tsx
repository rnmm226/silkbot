// app/dashboard/guide/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  HelpCircleIcon,
  MessageSquareIcon,
  SearchIcon,
  FileTextIcon,
  ScaleIcon,
  AlertTriangleIcon,
} from "lucide-react";

const sections = [
  {
    icon: <MessageSquareIcon className="w-4 h-4" />,
    title: "Poser une question",
    body:
      "Écrivez votre question juridique en français dans la zone de conversation, comme vous le feriez avec un confrère. Plus la question est précise (loi visée, contexte, date), plus la réponse sera ciblée.",
  },
  {
    icon: <SearchIcon className="w-4 h-4" />,
    title: "Comment la réponse est construite",
    body:
      "Chaque question déclenche une analyse en plusieurs étapes : une ébauche de réponse, une recherche dans la base documentaire tunisienne indexée, puis une vérification croisée entre les deux avant de produire la réponse finale. Cet enchaînement est visible sous forme d'indicateur animé pendant le traitement.",
  },
  {
    icon: <FileTextIcon className="w-4 h-4" />,
    title: "Sources et documents",
    body:
      "Lorsque la réponse s'appuie sur un texte officiel, les extraits utilisés apparaissent sous forme de sources cliquables. Vous pouvez ouvrir le document correspondant pour consulter le passage exact dans son contexte.",
  },
  {
    icon: <ScaleIcon className="w-4 h-4" />,
    title: "Quand la base documentaire ne suffit pas",
    body:
      "Si aucun document pertinent n'est trouvé, la plateforme peut répondre à partir de ses connaissances générales pour les questions de portée générale — la réponse est alors signalée comme non vérifiée par un document précis. Pour les questions très spécifiques nécessitant une référence exacte, elle vous l'indiquera plutôt que de l'inventer.",
  },
];

function GuideSection({
  icon,
  title,
  body,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={ref}
      className="border border-border/60 rounded-xl p-5 bg-card transition-colors duration-300"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(10px)",
        transition: `opacity 0.45s ease ${delay}ms, transform 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}ms, border-color 0.3s ease`,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "color-mix(in oklch, var(--primary) 35%, transparent)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
      }}
    >
      <div className="flex items-center gap-2.5 mb-2.5 text-foreground">
        {icon}
        <h2 className="text-sm font-medium">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
    </section>
  );
}

export default function GuidePage() {
  return (
    <div className="min-h-full w-full bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10 md:py-14">
        <div className="flex items-center gap-2.5 mb-1">
          <HelpCircleIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
            Aide
          </span>
        </div>
        <h1 className="font-serif text-2xl md:text-3xl text-foreground mb-2">
          Guide d'utilisation
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Comprendre comment l'assistant analyse vos questions et vérifie ses réponses.
        </p>

        <div className="space-y-4 mb-6">
          {sections.map((s, i) => (
            <GuideSection
              key={s.title}
              icon={s.icon}
              title={s.title}
              body={s.body}
              delay={i * 80}
            />
          ))}
        </div>

        <section className="border border-amber-500/30 rounded-xl p-5 bg-amber-500/5 flex gap-3">
          <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les réponses fournies ont une vocation informative et ne constituent pas un avis juridique.
            Pour toute décision engageante, consultez un avocat habilité à exercer en Tunisie.
          </p>
        </section>
      </div>
    </div>
  );
}