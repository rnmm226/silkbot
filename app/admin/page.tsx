'use client';

import { useState, useEffect, useRef } from 'react';

interface Document {
  id: string;
  filename: string;
  segmentCount: number;
  createdAt: string;
}

type Modal =
  | { type: 'rename'; doc: Document }
  | { type: 'delete'; doc: Document }
  | { type: 'segments'; doc: Document; segments: string[] }
  | null;

export default function AdminDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [search, setSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch('/api/admin/document-ref');
      const data = await res.json();
      setDocuments(data);
    } catch {
      showToast('Erreur lors du chargement', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocuments(); }, []);

  // ── CREATE ──────────────────────────────────────────────
  const handleUpload = async (file: File) => {
    const allowed = ['application/pdf', 'text/plain', 'text/markdown'];
    if (!allowed.includes(file.type)) {
      showToast('Format non supporté (PDF, TXT, MD uniquement)', 'error');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/admin/document-ref/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      showToast(`✅ ${data.filename} indexé — ${data.chunks} segments`, 'success');
      fetchDocuments();
    } catch (err: any) {
      showToast(err.message || "Erreur lors de l'upload", 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── READ segments ────────────────────────────────────────
  const handleViewSegments = async (doc: Document) => {
    setActionId(doc.id);
    try {
      const res = await fetch(`/api/admin/document-ref/${doc.id}/segments`);
      const data = await res.json();
      setModal({ type: 'segments', doc, segments: data.segments });
    } catch {
      showToast('Erreur lors du chargement des segments', 'error');
    } finally {
      setActionId(null);
    }
  };

  // ── UPDATE ───────────────────────────────────────────────
  const handleRenameOpen = (doc: Document) => {
    setRenameValue(doc.filename);
    setModal({ type: 'rename', doc });
  };

  const handleRenameConfirm = async () => {
    if (modal?.type !== 'rename') return;
    if (!renameValue.trim() || renameValue === modal.doc.filename) {
      setModal(null);
      return;
    }
    setActionId(modal.doc.id);
    try {
      const res = await fetch('/api/admin/document-ref', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modal.doc.id, filename: renameValue }),
      });
      if (!res.ok) throw new Error('Erreur lors du renommage');
      setDocuments(prev =>
        prev.map(d => d.id === modal.doc.id ? { ...d, filename: renameValue } : d)
      );
      showToast('Document renommé', 'success');
      setModal(null);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionId(null);
    }
  };

  // ── DELETE ───────────────────────────────────────────────
  const handleDeleteConfirm = async () => {
    if (modal?.type !== 'delete') return;
    setActionId(modal.doc.id);
    try {
      const res = await fetch('/api/admin/document-ref', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modal.doc.id }),
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      setDocuments(prev => prev.filter(d => d.id !== modal.doc.id));
      showToast(`"${modal.doc.filename}" supprimé`, 'success');
      setModal(null);
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setActionId(null);
    }
  };

  const filtered = documents.filter(d =>
    d.filename.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (s: string) =>
    new Date(s).toLocaleDateString('fr-TN', { day: '2-digit', month: 'short', year: 'numeric' });

  const totalSegments = documents.reduce((a, d) => a + d.segmentCount, 0);

  return (
    <div  className="min-h-screen bg-background text-foreground p-8">

      {/* ── Toast ── */}
      {toast && (
  <div
    className={`
      fixed top-6 right-6 z-50
      rounded-lg border px-5 py-3
      text-sm shadow-lg animate-fadeIn
      ${
        toast.type === 'success'
          ? 'bg-card border-border text-primary'
          : 'bg-destructive/10 border-destructive text-destructive'
      }
    `}
  >
    {toast.message}
  </div>
)}

      {/* ── Modal ── */}
      {modal && (
  <div
    onClick={() => setModal(null)}
    className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 animate-fadeIn"
  >
    <div
      onClick={(e) => e.stopPropagation()}
      className={`
        rounded-xl border border-border bg-card
        p-7 shadow-2xl animate-scaleIn
        max-h-[80vh] max-w-[95vw] overflow-auto
        ${modal.type === 'segments' ? 'w-[680px]' : 'w-[420px]'}
      `}
    >
          
            {/* Rename modal */}
            {modal.type === 'rename' && (
  <>
    <h3 className="mb-5 font-serif text-xl font-semibold text-foreground">
      Renommer le document
    </h3>

    <input
      autoFocus
      value={renameValue}
      onChange={(e) => setRenameValue(e.target.value)}
      onKeyDown={(e) =>
        e.key === 'Enter' && handleRenameConfirm()
      }
      className="
        w-full rounded-lg border border-input
        bg-background px-4 py-3
        text-sm text-foreground
        outline-none transition-colors
        placeholder:text-muted-foreground
        focus:border-ring focus:ring-2 focus:ring-ring/30
      "
    />
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setModal(null)} style={btnStyle('ghost')}>Annuler</button>
                  <button
                    onClick={handleRenameConfirm}
                    disabled={!!actionId}
                    style={btnStyle('primary')}
                  >
                    {actionId ? '...' : 'Renommer'}
                  </button>
                </div>
              </>
            )}

            {/* Delete modal */}
            {modal.type === 'delete' && (
              <>
                <h3 style={{ fontFamily: 'Playfair Display, serif', margin: '0 0 0.75rem', fontSize: '1.2rem' }}>
                  Supprimer le document
                </h3>
                <p style={{ color: '#8a7f72', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
                  Voulez-vous vraiment supprimer <strong style={{ color: '#e8e0d0' }}>"{modal.doc.filename}"</strong> et ses{' '}
                  <strong style={{ color: 'var(--color-primary, #c4956a)' }}>{modal.doc.segmentCount} segments</strong> ?
                  Cette action est irréversible.
                </p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button onClick={() => setModal(null)} style={btnStyle('ghost')}>Annuler</button>
                  <button
                    onClick={handleDeleteConfirm}
                    disabled={!!actionId}
                    style={btnStyle('danger')}
                  >
                    {actionId ? '...' : 'Supprimer'}
                  </button>
                </div>
              </>
            )}

            {/* Segments modal */}
            {modal.type === 'segments' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
                  <div>
                    <h3 style={{ fontFamily: 'Playfair Display, serif', margin: '0 0 0.25rem', fontSize: '1.2rem' }}>
                      Segments indexés
                    </h3>
                    <div style={{ color: '#6b6058', fontSize: '0.85rem' }}>{modal.doc.filename}</div>
                  </div>
                  <span style={{
                    background: 'rgba(196, 149, 106, 0.1)', color: 'var(--color-primary, #c4956a)',
                    padding: '0.2rem 0.7rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600,
                  }}>
                    {modal.segments.length} segments
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {modal.segments.map((seg, i) => (
                    <div key={i} style={{
                      background: '#0f0e0c', border: '1px solid #2a2520', borderRadius: '8px',
                      padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#a09890',
                      lineHeight: 1.6,
                    }}>
                      <span style={{ color: '#4a4540', marginRight: '0.5rem', fontSize: '0.75rem' }}>#{i + 1}</span>
                      {seg}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                  <button onClick={() => setModal(null)} style={btnStyle('ghost')}>Fermer</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Page ── */}
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={{
            fontSize: '0.72rem', letterSpacing: '0.15em', textTransform: 'uppercase',
            color: 'var(--color-primary, #c4956a)', marginBottom: '0.4rem',
          }}>
            Administration · TunisiaLaw
          </div>
          <h1 className="font-serif text-4xl font-bold">
            Base documentaire
          </h1>
          <p style={{ color: '#6b6058', marginTop: '0.4rem', fontSize: '0.9rem' }}>
            Gérez les textes juridiques indexés pour l'assistant.
          </p>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleUpload(f); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? 'var(--color-primary, #c4956a)' : '#2a2520'}`,
            borderRadius: '12px', padding: '2rem', textAlign: 'center',
            cursor: uploading ? 'not-allowed' : 'pointer', marginBottom: '1.5rem',
            transition: 'all 0.2s', background: dragOver ? 'rgba(196,149,106,0.04)' : 'transparent',
            opacity: uploading ? 0.6 : 1,
          }}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.txt,.md"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
          />
          {uploading
            ? <div style={{ color: 'var(--color-primary, #c4956a)' }}>⏳ Indexation en cours...</div>
            : <>
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📄</div>
              <div style={{ fontWeight: 500, marginBottom: '0.2rem' }}>
                Déposer un fichier ou cliquer pour parcourir
              </div>
              <div style={{ color: '#4a4540', fontSize: '0.82rem' }}>PDF · TXT · MD</div>
            </>
          }
        </div>

        {/* Stats + Search */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', alignItems: 'center' }}>
          <div style={{
            display: 'flex', gap: '1.5rem', padding: '0.75rem 1.25rem',
            background: '#1a1815', borderRadius: '10px', border: '1px solid #2a2520',
            flexShrink: 0,
          }}>
            <Stat label="Documents" value={documents.length} />
            <div style={{ width: 1, background: '#2a2520' }} />
            <Stat label="Segments" value={totalSegments} />
          </div>
          <input
            placeholder="Rechercher un document..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"

          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border bg-card">
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 100px 130px 180px',
            padding: '0.65rem 1.25rem', borderBottom: '1px solid #2a2520',
            color: '#4a4540', fontSize: '0.72rem', letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            <div>Fichier</div>
            <div style={{ textAlign: 'center' }}>Segments</div>
            <div style={{ textAlign: 'center' }}>Ajouté le</div>
            <div style={{ textAlign: 'right' }}>Actions</div>
          </div>

          {loading ? (
            <EmptyState text="Chargement..." />
          ) : filtered.length === 0 ? (
            <EmptyState text={search ? 'Aucun résultat' : 'Aucun document indexé'} />
          ) : filtered.map((doc, i) => (
            <div
              key={doc.id}
              style={{
                display: 'grid', gridTemplateColumns: '1fr 100px 130px 180px',
                padding: '0.9rem 1.25rem', alignItems: 'center',
                borderBottom: i < filtered.length - 1 ? '1px solid #1e1c19' : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#1e1c19')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <span style={{ fontSize: '1rem', opacity: 0.75 }}>
                  {doc.filename.endsWith('.pdf') ? '📕' : '📝'}
                </span>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.88rem' }}>{doc.filename}</div>
                  <div style={{ fontSize: '0.72rem', color: '#4a4540' }}>{doc.id.slice(0, 10)}...</div>
                </div>
              </div>

              {/* Segments badge */}
              <div style={{ textAlign: 'center' }}>
                <span style={{
                  background: 'rgba(196,149,106,0.1)', color: 'var(--color-primary,#c4956a)',
                  padding: '0.15rem 0.55rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 600,
                }}>
                  {doc.segmentCount}
                </span>
              </div>

              {/* Date */}
              <div style={{ textAlign: 'center', color: '#4a4540', fontSize: '0.82rem' }}>
                {formatDate(doc.createdAt)}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                <ActionBtn
                  label="Voir"
                  loading={actionId === doc.id}
                  onClick={() => handleViewSegments(doc)}
                  color="#6b9acf"
                />
                <ActionBtn
                  label="Renommer"
                  onClick={() => handleRenameOpen(doc)}
                  color="#c4956a"
                />
                <ActionBtn
                  label="Supprimer"
                  onClick={() => setModal({ type: 'delete', doc })}
                  color="#cf6b6b"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
        input:focus { border-color: var(--color-primary,#c4956a) !important; }
      `}</style>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div style={{ color: '#4a4540', fontSize: '0.72rem' }}>{label}</div>
      <div style={{ color: 'var(--color-primary,#c4956a)', fontWeight: 700, fontSize: '1.2rem', lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#4a4540' }}>{text}</div>
  );
}

function ActionBtn({ label, onClick, color, loading }: {
  label: string; onClick: () => void; color: string; loading?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? `${color}22` : 'transparent',
        border: `1px solid ${color}55`,
        color, padding: '0.3rem 0.6rem', borderRadius: '6px',
        cursor: loading ? 'not-allowed' : 'pointer',
        fontSize: '0.78rem', transition: 'all 0.15s',
        opacity: loading ? 0.5 : 1,
      }}
    >
      {loading ? '...' : label}
    </button>
  );
}

function btnStyle(variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: '0.5rem 1.1rem', borderRadius: '8px',
    fontSize: '0.88rem', cursor: 'pointer', border: '1px solid',
    transition: 'all 0.15s',
  };
  if (variant === 'primary') return { ...base, background: 'var(--color-primary,#c4956a)', color: '#0f0e0c', borderColor: 'transparent', fontWeight: 600 };
  if (variant === 'danger') return { ...base, background: '#3a1a1a', color: '#cf6b6b', borderColor: '#6a2d2d' };
  return { ...base, background: 'transparent', color: '#8a7f72', borderColor: '#2a2520' };
}