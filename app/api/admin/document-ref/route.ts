import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import embeddings from "@themaximalist/embeddings.js";
import scribe from "scribe.js-ocr";
import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";

export const runtime = "nodejs";
scribe.init({ ocr: true, font: true });
scribe.opt.progressHandler = (message) => {
  console.log(`[Scribe Engine Status]:`, message);
};
type PdfSegment = {
  text: string;
  page: number;
  segmentIndex: number;
};

function getFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function getSafeFileId(formData: FormData) {
  const fileId = getFormValue(formData, "FileID") || crypto.randomUUID();
  return fileId.replace(/[^a-zA-Z0-9_-]/g, "");
}

function parseChunkNumber(formData: FormData, key: string, fallback: number) {
  const value = Number(getFormValue(formData, key));
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  ) as ArrayBuffer;
}

function splitTextIntoSegments(text: string): PdfSegment[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((segment) => segment.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return paragraphs.map((segment, index) => ({
    text: segment,
    page: 1,
    segmentIndex: index,
  }));
}

function vectorToSqlLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

async function getPdfBuffer(formData: FormData) {
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw new Error("A PDF file is required.");
  }

  const totalChunks = parseChunkNumber(formData, "totalChunks", 1);
  const chunkIndex = parseChunkNumber(formData, "chunkIndex", 0);
  const chunkBuffer = Buffer.from(await file.arrayBuffer());

  if (totalChunks <= 1) {
    return { buffer: chunkBuffer, complete: true, fileId: getSafeFileId(formData) };
  }

  const fileId = getSafeFileId(formData);
  const uploadDir = path.join(tmpdir(), "chatbot-document-ref", fileId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, `${chunkIndex}.part`), chunkBuffer);

  const uploadedChunks = (await readdir(uploadDir)).filter((name) =>
    name.endsWith(".part")
  );

  if (uploadedChunks.length < totalChunks) {
    return { buffer: null, complete: false, fileId, received: uploadedChunks.length };
  }

  const chunks = await Promise.all(
    Array.from({ length: totalChunks }, (_, index) =>
      readFile(path.join(uploadDir, `${index}.part`))
    ),
  );

  await rm(uploadDir, { recursive: true, force: true });

  return { buffer: Buffer.concat(chunks), complete: true, fileId };
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const pdf = await getPdfBuffer(formData);
    if (!pdf.complete) {
      return NextResponse.json(
        {
          message: "chunk received",
          fileId: pdf.fileId,
          received: pdf.received,
        },
        { status: 202 },
      );
    }

    if (!pdf.buffer) {
      return NextResponse.json({ error: "Missing PDF content." }, { status: 400 });
    }
    const segments = await extractSegmentsFromPDF(pdf.buffer);

    if (segments.length === 0) {
      return NextResponse.json(
        { error: "No text was extracted from this PDF." },
        { status: 400 },
      );
    }

    const sourceDoc = await prisma.sourceDocument.upsert({
      where: { id: pdf.fileId },
      update: { content: segments.map((segment) => segment.text).join("\n\n") },
      create: {
        id: pdf.fileId,
        content: segments.map((segment) => segment.text).join("\n\n"),
      },
    });

    await prisma.sourceDocumentSegment.deleteMany({
      where: { sourceDocumentid: sourceDoc.id },
    });

    for (const segment of segments) {
      const vector = await embeddings(segment.text);
      const createdSegment = await prisma.sourceDocumentSegment.create({
        data: {
          content: segment.text,
          sourceDocument: { connect: { id: sourceDoc.id } },
        },
      });

      await prisma.$executeRawUnsafe(
        'UPDATE "SourceDocumentSegment" SET "vector" = $1::vector WHERE "id" = $2',
        vectorToSqlLiteral(vector),
        createdSegment.id,
      );
    }

    return NextResponse.json({
      message: "ok",
      documentId: sourceDoc.id,
      segments: segments.length,
    }, {status: 200});
  } catch (error) {
  console.error("DOCUMENT REF ERROR:", error);

  return NextResponse.json(
    {
      error:
        error instanceof Error ? error.message : "Upload failed.",
    },
    { status: 500 },
  );
}
}

async function extractSegmentsFromPDF(pdfBuffer: Buffer) {
  try {
    console.log("extract init", bufferToArrayBuffer(pdfBuffer))
    const doc = await scribe.openDocument({
      pdfFiles: [bufferToArrayBuffer(pdfBuffer)],
    });
    console.log(doc)
    const totalPages = doc.getPageCount();
    console.log('total pages: ',totalPages)


    return splitTextIntoSegments(String(text));
  } catch (err) {
    console.error(err)

  }finally {
    await scribe.terminate();
  }
}
