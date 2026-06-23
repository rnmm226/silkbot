-- AlterTable
ALTER TABLE "chats" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "files" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "pageCount" INTEGER,
    "extractedText" TEXT,
    "metadata" JSONB,
    "userId" TEXT NOT NULL,
    "chatId" TEXT,
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "files_userId_idx" ON "files"("userId");

-- CreateIndex
CREATE INDEX "files_chatId_idx" ON "files"("chatId");

-- CreateIndex
CREATE INDEX "files_messageId_idx" ON "files"("messageId");

-- CreateIndex
CREATE INDEX "files_createdAt_idx" ON "files"("createdAt");

-- CreateIndex
CREATE INDEX "files_mimeType_idx" ON "files"("mimeType");

-- CreateIndex
CREATE INDEX "chats_isPinned_idx" ON "chats"("isPinned");

-- CreateIndex
CREATE INDEX "chats_updated_at_idx" ON "chats"("updated_at");

-- CreateIndex
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
