/*
  Warnings:

  - You are about to drop the `SourceDocument` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SourceDocumentSegment` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SourceDocumentSegment" DROP CONSTRAINT "SourceDocumentSegment_sourceDocumentid_fkey";

-- DropTable
DROP TABLE "SourceDocument";

-- DropTable
DROP TABLE "SourceDocumentSegment";

-- CreateTable
CREATE TABLE "source_documents" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "filename" TEXT,
    "source" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_document_segments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceDocumentid" TEXT,
    "vector" vector,
    "article_number" INTEGER NOT NULL,
    "chunk_index" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "page_number" INTEGER NOT NULL,
    "tags" TEXT[],

    CONSTRAINT "source_document_segments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "source_documents_filename_idx" ON "source_documents"("filename");

-- CreateIndex
CREATE INDEX "source_documents_source_idx" ON "source_documents"("source");

-- CreateIndex
CREATE INDEX "source_document_segments_sourceDocumentid_idx" ON "source_document_segments"("sourceDocumentid");

-- CreateIndex
CREATE INDEX "source_document_segments_tags_idx" ON "source_document_segments"("tags");

-- AddForeignKey
ALTER TABLE "source_document_segments" ADD CONSTRAINT "source_document_segments_sourceDocumentid_fkey" FOREIGN KEY ("sourceDocumentid") REFERENCES "source_documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
