// components/PDFViewer.tsx
import { useState } from 'react';

export function PDFViewer({ filename, initialPage }: { filename: string; initialPage?: number }) {
  const [page, setPage] = useState(initialPage || 1);
  
  return (
    <div className="pdf-viewer">
      <embed
        src={`${process.env.NEXT_PUBLIC_API_URL}/document/${encodeURIComponent(filename)}#page=${page}`}
        type="application/pdf"
        width="100%"
        height="600px"
      />
    </div>
  );
}