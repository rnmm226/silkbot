declare module "@themaximalist/embeddings.js" {
  export default function embeddings(input: string): Promise<number[]>;
}

declare module "scribe.js-ocr" {
  type SortedInputFiles = {
    pdfFiles?: Array<ArrayBuffer>;
    imageFiles?: Array<ArrayBuffer>;
    ocrFiles?: Array<ArrayBuffer>;
    scribeFiles?: Array<ArrayBuffer>;
  };
  type ScribeDoc = typeof import('scribe.js-ocr/js/containers/scribeDoc')

  type Scribe = {
    extractText(
      files: SortedInputFiles,
      langs?: string[],
      outputFormat?: "txt" | "text",
      options?: Record<string, unknown>,
    ): Promise<string | ArrayBuffer>;
    terminate(): Promise<void>;
    init(params: any): Promise<void>
    openDocument(files: SortedInputFiles, options: any): Promise<ScribeDoc>
  };

  const scribe: Scribe;
  export default scribe;
}
