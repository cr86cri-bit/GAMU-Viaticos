"use client";

import { useMemo, useState } from 'react';
import { CalendarDays, Check, CheckCheck, ClipboardList, MapPin, Search, X } from 'lucide-react';

type Trip = {
  id: string;
  nro_hoja_ruta?: string | number;
  fecha_inicio?: string;
  fecha_fin?: string;
  estado?: string;
  funcionarios?: { nombres?: string; apellidos?: string } | null;
  destinos?: { nombre?: string } | null;
};

type Props = {
  trips: Trip[];
  chosen: string[];
  onChange: (ids: string[]) => void;
};

function prettyDate(value?: string) {
  if (!value) return 'Sin fecha';
  const [y, m, d] = value.split('-');
  return y && m && d ? `${d}/${m}/${y}` : value;
}

export function TripPicker({ trips, chosen, onChange }: Props) {
  const [query, setQuery] = useState('');
  const [onlySelected, setOnlySelected] = useState(false);
  const normalized = query.toLocaleLowerCase('es').trim();
  const filtered = useMemo(() => trips.filter(t => {
    if (onlySelected && !chosen.includes(t.id)) return false;
    const searchable = [t.funcionarios?.nombres, t.funcionarios?.apellidos, t.destinos?.nombre, t.nro_hoja_ruta, t.fecha_inicio].join(' ').toLocaleLowerCase('es');
    return searchable.includes(normalized);
  }), [trips, chosen, normalized, onlySelected]);
  const selectedVisible = filtered.filter(t => chosen.includes(t.id)).length;
  const allVisibleSelected = filtered.length > 0 && selectedVisible === filtered.length;

  function toggle(id: string) {
    onChange(chosen.includes(id) ? chosen.filter(item => item !== id) : [...chosen, id]);
  }
  function toggleVisible() {
    const ids = filtered.map(t => t.id);
    onChange(allVisibleSelected ? chosen.filter(id => !ids.includes(id)) : [...new Set([...chosen, ...ids])]);
  }

  return <section className="mt-5 overflow-hidden rounded-2xl border gamu-panel" aria-label="Seleccionar viajes para planilla">
    <div className="flex flex-col gap-3 border-b gamu-panel-header px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl gamu-icon-box"><ClipboardList size={22} /></span>
        <div>
          <h3 className="font-bold gamu-text">Seleccionar viajes</h3>
          <p className="text-xs gamu-muted">Elige los viajes que incluirá la planilla</p>
        </div>
      </div>
      <span className="w-fit rounded-full gamu-count px-3 py-1.5 text-xs font-bold" aria-live="polite">{chosen.length} {chosen.length === 1 ? 'viaje seleccionado' : 'viajes seleccionados'}</span>
    </div>
    <div className="space-y-3 p-3 sm:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input aria-label="Buscar viajes" className="min-h-11 w-full rounded-xl border gamu-input py-2 pl-10 pr-9 text-sm outline-none focus:ring-2 focus:ring-emerald-500/30" placeholder="Buscar por funcionario, destino o hoja..." value={query} onChange={e => setQuery(e.target.value)} />
          {query && <button aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={() => setQuery('')} type="button"><X size={16} /></button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" aria-pressed={onlySelected} onClick={() => setOnlySelected(v => !v)} className={`min-h-11 rounded-xl border px-3 text-xs font-semibold transition ${onlySelected ? 'gamu-chip-selected' : 'gamu-chip'}`}>Solo seleccionados</button>
          <button type="button" disabled={!filtered.length} onClick={toggleVisible} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border gamu-chip px-3 text-xs font-semibold transition hover:bg-emerald-50 disabled:opacity-40"><CheckCheck size={15} /> {allVisibleSelected ? 'Deseleccionar visibles' : 'Seleccionar visibles'}</button>
        </div>
      </div>
      <div className="max-h-[365px] space-y-2 overflow-y-auto overscroll-contain pr-2 [scrollbar-color:#9BA8AB_transparent] [scrollbar-width:thin]" role="group" aria-label="Viajes disponibles">
        {filtered.map(t => {
          const checked = chosen.includes(t.id);
          const name = `${t.funcionarios?.apellidos ?? ''} ${t.funcionarios?.nombres ?? ''}`.trim() || 'Funcionario sin nombre';
          return <label key={t.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border min-h-[82px] p-3 shadow-sm transition sm:min-h-[82px] sm:p-3 ${checked ? 'gamu-choice-selected ring-1' : 'gamu-choice'}`}>
            <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${checked ? 'gamu-check-active' : 'gamu-check'}`}>
              <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(t.id)} aria-label={`Seleccionar viaje de ${name}, hoja ${t.nro_hoja_ruta ?? ''}`} />
              {checked && <Check size={16} strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1 space-y-2">
              <span className="flex flex-wrap items-start justify-between gap-2"><span className="break-words text-sm font-bold gamu-text">{name}</span><span className="rounded-md gamu-badge px-2 py-1 text-xs font-semibold">Hoja N.º {t.nro_hoja_ruta || '—'}</span></span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs gamu-muted"><span className="inline-flex items-center gap-1"><MapPin size={14} className="text-emerald-700" />{t.destinos?.nombre || 'Sin destino'}</span><span className="inline-flex items-center gap-1"><CalendarDays size={14} />{prettyDate(t.fecha_inicio)}{t.fecha_fin && t.fecha_fin !== t.fecha_inicio ? ` – ${prettyDate(t.fecha_fin)}` : ''}</span></span>
            </span>
          </label>;
        })}
        {!filtered.length && <div className="rounded-xl border border-dashed gamu-choice px-4 py-9 text-center"><Search size={25} className="mx-auto mb-2 text-slate-400" /><p className="text-sm font-semibold gamu-text">{trips.length ? 'No se encontraron viajes' : 'Todavía no hay viajes registrados'}</p><p className="mt-1 text-xs gamu-muted">{trips.length ? 'Prueba con otro nombre, destino o número de hoja.' : 'Registra un viaje para incluirlo en una planilla.'}</p></div>}
      </div>
      {chosen.length > 0 && <div className="flex items-center justify-between gap-3 rounded-xl gamu-count px-3 py-2.5 text-xs"><span><strong>{chosen.length}</strong> {chosen.length === 1 ? 'viaje listo' : 'viajes listos'} para generar la planilla</span><button type="button" onClick={() => onChange([])} className="shrink-0 font-bold underline underline-offset-2 hover:text-emerald-950">Limpiar selección</button></div>}
    </div>
  </section>;
}
