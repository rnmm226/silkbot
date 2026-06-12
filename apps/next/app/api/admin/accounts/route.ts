import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function getSession(req: NextRequest) {
  return auth.api.getSession({ headers: req.headers });
}

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          accounts: true,
          chats: true,
          sessions: true,
        },
      },
    },
  });

  return NextResponse.json(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      accountCount: user._count.accounts,
      chatCount: user._count.chats,
      sessionCount: user._count.sessions,
      isCurrentUser: user.id === session.user.id,
    })),
  );
}

export async function PATCH(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id, emailVerified, name } = await req.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  const data: { emailVerified?: boolean; name?: string } = {};
  if (typeof emailVerified === "boolean") data.emailVerified = emailVerified;
  if (typeof name === "string" && name.trim()) data.name = name.trim();

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    emailVerified: user.emailVerified,
  });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  }

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Vous ne pouvez pas supprimer votre propre compte ici" },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.chat.updateMany({
      where: { userId: id },
      data: { userId: null },
    }),
    prisma.user.delete({
      where: { id },
    }),
  ]);

  return NextResponse.json({ success: true });
}
