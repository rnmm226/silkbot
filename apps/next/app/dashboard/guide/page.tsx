"use client"
import {
  HelpCircleIcon,
  MessageSquareIcon,
  SearchIcon,
  FileTextIcon,
  ScaleIcon,
  AlertTriangleIcon,
} from "lucide-react"

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
]

export default function GuidePage() {
  return (
    <div className="min-h-full w-full bg-background">
      <div className="max-w-2xl mx-auto px-6 py-10 md:py-14">

        {/* Header */}
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

        {/* Sections */}
        <div className="space-y-4 mb-6">
          {sections.map((s) => (
            <section
              key={s.title}
              className="border border-border/60 rounded-xl p-5 bg-card"
            >
              <div className="flex items-center gap-2.5 mb-2.5 text-foreground">
                {s.icon}
                <h2 className="text-sm font-medium">{s.title}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.body}
              </p>
            </section>
          ))}
        </div>

        {/* Avertissement légal */}
        <section className="border border-amber-500/30 rounded-xl p-5 bg-amber-500/5 flex gap-3">
          <AlertTriangleIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground leading-relaxed">
            Les réponses fournies ont une vocation informative et ne constituent pas un avis juridique.
            Pour toute décision engageante, consultez un avocat habilité à exercer en Tunisie.
          </p>
        </section>

      </div>
    </div>
  )
}