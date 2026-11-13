"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AvatarUploadProps {
  currentAvatar: string | null;
  initials: string;
  onAvatarUpdate: (newUrl: string) => void;
}

export function AvatarUpload({ currentAvatar, initials, onAvatarUpdate }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentAvatar);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Upload échoué");
      const { url } = await res.json();
      onAvatarUpdate(url);
      toast.success("Photo de profil mise à jour");
    } catch (err) {
      toast.error("Erreur lors de l'upload");
      setPreview(currentAvatar);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="relative group">
        <div className="w-16 h-16 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center ring-2 ring-border">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xl font-bold text-primary">{initials}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : (
            <Camera className="w-5 h-5 text-white" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
      <div>
        <p className="text-sm font-medium">Photo de profil</p>
        <p className="text-xs text-muted-foreground">JPG, PNG ou GIF — max 2 MB</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="mt-1 text-xs text-primary hover:underline disabled:opacity-50"
        >
          {uploading ? "Upload en cours…" : "Modifier la photo"}
        </button>
      </div>
    </div>
  );
}
