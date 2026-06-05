import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validation stricte des champs
    if (
      typeof body.role !== "string" ||
      typeof body.content !== "string" ||
      body.content.trim() === ""
    ) {
      return NextResponse.json(
        { error: "Invalid or missing fields" },
        { status: 400 }
      );
    }

    let convId = body.conversationId;

    // Si pas de conversation, on en crée une
    if (!convId) {
      const newConv = await prisma.chat.create({
        data: {
          title: body.content.slice(0, 20) + "...",
        },
      });
      convId = newConv.id;
    } else {
      // Vérifie que la conversation existe
      const exists = await prisma.chat.findUnique({
        where: { id: convId },
      });
      if (!exists) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
    }

    // Sauvegarde du message et mise à jour de la date de la conversation
    const message = await prisma.message.create({
  data: {
    role: body.role.toUpperCase(),
    content: body.content.trim(),
    parts: [],
    chat: {
      connect: { id: convId }
    }
  },
});


    await prisma.chat.update({
      where: { id: convId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ conversationId: convId, message });
  } catch (err) {
    console.error("POST /api/messages error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
