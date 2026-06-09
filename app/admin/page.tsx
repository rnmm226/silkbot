'use client';

import { Input } from "@/components/ui/input";

function splitFile(file: File, chunkSize: number) {
    const chunks = [];
    let start = 0;
    while (start < file.size) {
    const end = Math.min(start + chunkSize, file.size);
    chunks.push(file.slice(start, end));
       start = end;
    }
    return chunks;
}
export default function AdminPage() {
    const onSubmit = async (event: React.SubmitEvent<HTMLFormElement>) => {
        event.preventDefault();
        const fileInput = event.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
        const file = fileInput?.files?.[0];
        if (!file) return;

        const chunks = splitFile(file, 1000000)
        const fileId = crypto.randomUUID();
        const uploads = chunks.map((chunk, index) => {
        const formData = new FormData();
            formData.append("file", chunk);
            formData.append("chunkIndex", String(index));
            formData.append("totalChunks", String(chunks.length));
            formData.append("FileID", fileId)
            return fetch('/api/admin/document-ref', { method: "POST", body: formData });
        });
        await Promise.all(uploads);
    }
    return(
        <form onSubmit={(e)=>onSubmit(e)}>
            <Input type="file" id="fileInput" name="file" accept="application/pdf" />
            <Input type="submit" />
        </form>
    ) 
}
