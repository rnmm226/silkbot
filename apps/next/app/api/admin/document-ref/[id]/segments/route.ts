import { NextRequest, NextResponse } from "next/server";

// Exemple de données en mémoire (à remplacer par votre base de données)
const mockSegments: Record<string, string[]> = {
  "doc_1": ["Contrat de vente article 1", "Contrat de vente article 2", "Signature"],
  "doc_2": ["Conditions générales", "Clause de confidentialité"],
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    // Récupération des segments depuis votre base de données
    // Exemple avec une base de données fictive
    const segments = mockSegments[id] || [];
    
    return NextResponse.json({ 
      segments,
      count: segments.length,
      documentId: id
    });
    
  } catch (error) {
    console.error("Erreur récupération segments:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des segments" },
      { status: 500 }
    );
  }
}