'use client';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Field, Input, Select, Button } from '@/components/ui';
import { TripPicker } from '@/components/trip-picker';

type Row = { id: string; [key: string]: any };
export type EdicionPlanilla = {id:string;direccion_id:string;gestion:string;numero:string;fecha:string;viajes:string[]};
export function EditIssuedPayroll({base,directions,trips,onCancel,onSave,busy}:{base:EdicionPlanilla;directions:Row[];trips:Row[];onCancel:()=>void;onSave:(value:EdicionPlanilla)=>Promise<void>;busy:boolean}) {
 const [form,setForm]=useState(base);
 return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-[#06141B]/75 p-2 sm:p-5" role="dialog" aria-modal="true" aria-label="Editar planilla emitida" onMouseDown={e=>{if(e.currentTarget===e.target&&!busy)onCancel()}}>
  <div className="gamu-dialog w-full max-w-3xl max-h-[94dvh] overflow-y-auto rounded-2xl p-4 sm:p-6 shadow-2xl">
    <div className="flex items-center justify-between gap-3 mb-4"><h2 className="text-lg font-bold">Editar planilla N.º {base.numero}</h2><button type="button" aria-label="Cerrar" disabled={busy} onClick={onCancel}><X/></button></div>
    <p className="mb-4 text-sm gamu-muted">Puedes cambiar datos y viajes vinculados. La edición no modifica los cálculos diarios ni los datos de los viajes. Al guardar, se actualizará la representación de la planilla.</p>
    <form onSubmit={e=>{e.preventDefault();void onSave(form)}} className="space-y-3">
     <div className="grid gap-3 sm:grid-cols-2"><Field label="Dirección"><Select value={form.direccion_id} onChange={e=>setForm(p=>({...p,direccion_id:e.target.value}))}>{directions.map(d=><option key={d.id} value={d.id}>{d.siglas} - {d.nombre}</option>)}</Select></Field>
     <Field label="Gestión"><Input value={form.gestion} maxLength={4} onChange={e=>setForm(p=>({...p,gestion:e.target.value}))} required/></Field>
     <Field label="N.º de documento"><Input value={form.numero} onChange={e=>setForm(p=>({...p,numero:e.target.value.replace(/\D/g,'')}))} required/></Field>
     <Field label="Fecha"><Input type="date" value={form.fecha} onChange={e=>setForm(p=>({...p,fecha:e.target.value}))} required/></Field></div>
     <TripPicker trips={trips} chosen={form.viajes} onChange={v=>setForm(p=>({...p,viajes:v}))}/>
     <div className="flex flex-wrap justify-end gap-2 pt-3"><Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancelar</Button><Button disabled={busy||form.viajes.length===0} type="submit">{busy?'Guardando...':'Guardar cambios'}</Button></div>
    </form>
  </div>
 </div>;
}
