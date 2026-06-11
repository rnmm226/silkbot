import { useEffect, useState } from 'react';

export function PDFViewer({
  filename,
  initialPage = 1,
}: {
  filename?: string;
  initialPage?: number;
}) {
  const [page, setPage] = useState(initialPage);

  // 🔥 reset page si changement doc
  useEffect(() => {
    setPage(initialPage);
  }, [initialPage, filename]);

  if (!filename) {
    return (
      <div className="text-red-500">
        Document introuvable
      </div>
    );
  }

  const pdfUrl = `${process.env.NEXT_PUBLIC_API_URL}/document/${encodeURIComponent(
    filename
  )}#page=${page}`;

  return (
    <div className="pdf-viewer w-full h-[600px]">
      <iframe
        src={pdfUrl}
        width="100%"
        height="100%"
        className="rounded-md border"
      />
    </div>
  );
}