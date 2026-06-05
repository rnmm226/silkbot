import { prisma } from "@/lib/prisma";

export default async function ChatPage({ params }: { params: { id: string } }) {
  const messages = await prisma.message.findMany({
    where: { chatId: params.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="p-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`mb-2 ${
            msg.role === "USER" ? "text-blue-600" : "text-green-600"
          }`}
        >
          <strong>{msg.role}:</strong> {msg.content}
        </div>
      ))}
    </div>
  );
}
