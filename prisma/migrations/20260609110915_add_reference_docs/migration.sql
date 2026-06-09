-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocumentSegment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceDocumentid" TEXT,
    "vector" VECTOR(384),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocumentSegment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "SourceDocumentSegment" ADD CONSTRAINT "SourceDocumentSegment_sourceDocumentid_fkey" FOREIGN KEY ("sourceDocumentid") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
