'use client';

import { useMemo, useState } from 'react';
import { FileText, Eye, Pencil, Printer, Download, Search } from 'lucide-react';
import { dateBO } from '@/lib/utils';

export type Documento = { id: string; gestion: number; nro_daf: string; fecha: string; created_at: string; descripcion?: string; direcciones?: {siglas?: string; nombre?: string} | null };
export function IssuedPayrolls({ documentos, onView, onEdit, onPrint, onPdf, busy }: {
  documentos: Documento[]; onView: (p: Documento) => void; onEdit: (p: Documento) => void;
  onPrint: (p: Documento) => void; onPdf: (p: Documento) => void; busy: boolean;
}) {
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<'newest'|'oldest'>('newest');
  const filtered = useMemo(() => documentos.filter(p => `${p.nro_daf} ${p.gestion} ${p.direcciones?.siglas ?? ''} ${p.descripcion ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a,b) => order==='newest' ? b.created_at.localeCompare(a.created_at) : a.created_at.localeCompare(b.created_at)), [documentos,query,order]);
  return <section className="gamu-card rounded-2xl border border-[var(--g-border)] p-4 sm:p-5 mb-4">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4"><h2 className="flex items-center gap-2 font-bold"><FileText size={19}/> Documentos registrados ({documentos.length})</h2><span className="text-xs gamu-muted">Historial de impresión y edición</span></div>
    <div className="space-y-3">
      <div className="grid sm:grid-cols-[1fr_auto] gap-2"><label className="relative"><Search className="absolute left-3 top-3 text-[var(--g-muted)]" size={18}/><input className="gamu-input w-full rounded-xl p-2.5 pl-10 text-sm" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar por número, dirección o gestión..." /></label><select aria-label="Ordenar planillas" className="gamu-input rounded-xl p-2.5 text-sm" value={order} onChange={e=>setOrder(e.target.value as 'newest'|'oldest')}><option value="newest">Más recientes</option><option value="oldest">Más antiguas</option></select></div>
      {filtered.map(p=><div key={p.id} className="gamu-choice rounded-xl border border-[var(--g-border)] p-3 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
        <div className="min-w-0"><p className="font-bold gamu-text">N.º {p.nro_daf} · {p.direcciones?.siglas??'Dirección'} · {p.gestion}</p><p className="text-xs gamu-muted">Fecha de planilla: {dateBO(p.fecha)} · Creada: {new Date(p.created_at).toLocaleDateString('es-BO')}</p></div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={()=>onView(p)} className="gamu-button-outline rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><Eye size={15}/> Ver</button>
          <button type="button" disabled={busy} onClick={()=>onEdit(p)} className="gamu-button-outline rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><Pencil size={15}/> Editar</button>
          <button type="button" disabled={busy} onClick={()=>onPdf(p)} className="gamu-button-outline rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><Download size={15}/> PDF</button>
          <button type="button" disabled={busy} onClick={()=>onPrint(p)} className="gamu-button-outline rounded-lg px-3 py-2 text-xs font-semibold inline-flex items-center gap-1"><Printer size={15}/> Imprimir</button>
        </div>
      </div>)}
      {filtered.length===0&&<p className="text-sm gamu-muted">No hay planillas que coincidan con el filtro.</p>}
      <p className="text-xs gamu-muted">Las planillas antiguas sin una copia de datos guardada se reconstruyen con el detalle actual de sus viajes.</p>
    </div>
  </section>;
}
