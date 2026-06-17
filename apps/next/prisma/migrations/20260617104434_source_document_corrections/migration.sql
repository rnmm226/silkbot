/*
  Warnings:

  - You are about to drop the column `created_at` on the `SourceDocumentSegment` table. All the data in the column will be lost.
  - Added the required column `article_number` to the `SourceDocumentSegment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `chunk_index` to the `SourceDocumentSegment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `page_number` to the `SourceDocumentSegment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SourceDocumentSegment" DROP COLUMN "created_at",
ADD COLUMN     "article_number" INTEGER NOT NULL,
ADD COLUMN     "chunk_index" INTEGER NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "page_number" INTEGER NOT NULL,
ADD COLUMN     "tags" TEXT[];
