"use client";
import {useState} from 'react';
import {Check, Palette, X} from 'lucide-react';

const COLORS = [
  '#FF7300','#F59E0B','#EAB308','#16A34A','#059669','#0D9488',
  '#0284C7','#2563EB','#4F46E5','#7C3AED','#DB2777','#DC2626',
  '#06141B','#11212D','#253745','#4A5C6A','#9BA8AB','#CCD0CF',
  '#FFFFFF','#111827','#64748B','#0F766E','#B45309','#9333EA',
];
function textOn(hex:string) {
 const x=hex.replace('#',''); if(!/^[0-9a-f]{6}$/i.test(x))return '#FFFFFF';
 const [r,g,b]=[0,2,4].map(i=>parseInt(x.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*r+.7152*g+.0722*b>.35?'#06141B':'#FFFFFF';
}
export function ColorPickerModal({value,onChange}:{value:string;onChange:(value:string)=>void}) {
 const [open,setOpen]=useState(false);
 const [draft,setDraft]=useState(value);
 const valid=/^#[0-9A-Fa-f]{6}$/.test(draft);
 const show=()=>{setDraft(value||'#253745');setOpen(true)};
 const choose=()=>{if(!valid)return;onChange(draft.toUpperCase());setOpen(false)};
 return <>
   <button type="button" onClick={show} className="flex w-full items-center gap-3 rounded-xl border gamu-input p-3 text-left transition hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
     <span className="h-10 w-14 shrink-0 rounded-lg border border-slate-300 shadow-inner" style={{backgroundColor:value}}/>
     <span className="flex-1"><span className="block font-semibold">{value.toUpperCase()}</span><span className="block text-xs gamu-muted">Toca para elegir otro color</span></span>
     <Palette size={20} className="gamu-muted"/>
   </button>
   {open&&<div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-5" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
    <div role="dialog" aria-modal="true" aria-label="Seleccionar color de dirección" className="w-full max-w-lg overflow-y-auto rounded-t-3xl gamu-dialog border p-5 shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl sm:p-7">
      <div className="mb-4 flex items-start justify-between gap-3"><div><h3 className="text-xl font-bold">Color de la dirección</h3><p className="text-sm gamu-muted">Se aplicará a los encabezados de Excel y PDF.</p></div><button type="button" onClick={()=>setOpen(false)} aria-label="Cerrar" className="rounded-lg p-2 hover:bg-[var(--g-row-hover)]"><X size={20}/></button></div>
      <div className="mb-4 flex h-20 items-center justify-center rounded-xl border border-[var(--g-border)] font-bold" style={{backgroundColor:valid?draft:'#253745',color:textOn(valid?draft:'#253745')}}>Vista previa · {valid?draft.toUpperCase():'Color no válido'}</div>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">{COLORS.map(color=><button key={color} type="button" aria-label={`Elegir ${color}`} title={color} onClick={()=>setDraft(color)} className={`relative aspect-square rounded-xl border-2 shadow-sm transition hover:scale-105 ${draft.toUpperCase()===color?'ring-2 ring-blue-600 ring-offset-2 ring-offset-[var(--g-card)]':'border-[var(--g-border)]'}`} style={{backgroundColor:color}}>{draft.toUpperCase()===color&&<Check size={20} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{color:textOn(color)}}/>}</button>)}</div>
      <div className="mt-5 flex items-center gap-3"><label htmlFor="direction-hex" className="shrink-0 text-sm font-semibold">HEX</label><input id="direction-hex" className="min-w-0 flex-1 rounded-lg gamu-input border px-3 py-2" maxLength={7} value={draft} onChange={e=>setDraft(e.target.value)}/><input aria-label="Elegir un color personalizado" type="color" value={valid?draft:'#253745'} onChange={e=>setDraft(e.target.value)} className="h-10 w-12 cursor-pointer"/></div>
      {!valid&&<p className="mt-2 text-sm text-red-600">Usa un valor HEX válido, por ejemplo #FF7300.</p>}
      <div className="mt-6 flex gap-2"><button type="button" onClick={()=>setOpen(false)} className="flex-1 rounded-xl gamu-choice border px-4 py-3 font-semibold">Cancelar</button><button type="button" disabled={!valid} onClick={choose} className="flex-1 rounded-xl gamu-btn-primary px-4 py-3 font-semibold disabled:opacity-50">Seleccionar color</button></div>
    </div>
   </div>}
 </>;
}
