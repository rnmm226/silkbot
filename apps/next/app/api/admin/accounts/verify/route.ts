import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // 1. Vérifier l'authentification
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      );
    }

    // 2. Vérifier les permissions admin
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json(
        { error: "Accès non autorisé - Administrateur requis" },
        { status: 403 }
      );
    }

    // 3. Récupérer le body
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: "ID du compte manquant" },
        { status: 400 }
      );
    }

    // 4. Vérifier que le compte existe
    const accountToVerify = await prisma.user.findUnique({
      where: { id },
    });

    if (!accountToVerify) {
      return NextResponse.json(
        { error: "Compte non trouvé" },
        { status: 404 }
      );
    }

    // 5. Vérifier que le compte n'est pas déjà vérifié
    if (accountToVerify.emailVerified) {
      return NextResponse.json({
        success: false,
        message: "Ce compte est déjà vérifié",
        account: accountToVerify,
      });
    }

    // 6. Mettre à jour le compte - CORRECTION ICI: utiliser true au lieu de new Date()
    const updatedAccount = await prisma.user.update({
      where: { id },
      data: { 
        emailVerified: true,  // ← Changement ici : true au lieu de new Date()
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        createdAt: true,
        role: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Email vérifié avec succès pour ${updatedAccount.email}`,
      account: updatedAccount,
    });

  } catch (error) {
    console.error("Erreur lors de la vérification:", error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Erreur interne du serveur" },
      { status: 500 }
    );
  }
}