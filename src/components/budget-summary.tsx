'use client';
import {useEffect,useMemo,useState} from 'react';
import {createClient} from '@/lib/supabase/client';
import {Card,PageHeader,Select} from '@/components/ui';
import {bs} from '@/lib/utils';
import {friendlyError} from '@/lib/error-messages';
type Budget={id:string;gestion:number;codigo_programa:string;descripcion:string;objeto_gasto:string;monto_asignado:number;gastado:number;ajustes:number;saldo:number};
export function BudgetSummary(){const sb=useMemo(()=>createClient(),[]);const [items,setItems]=useState<Budget[]>([]);const [year,setYear]=useState('2026');const [error,setError]=useState('');
useEffect(()=>{void (async()=>{const {data,error}=await sb.from('resumen_presupuestos').select('*').eq('gestion',Number(year)).order('codigo_programa');setItems(data||[]);setError(error?friendlyError(error):'');})();},[sb,year]);
const total=(k:keyof Budget)=>items.reduce((a,b)=>a+Number(b[k]||0),0);
return <><PageHeader title="Reportes presupuestarios" description="Resumen de los importes presupuestados, ejecutados y disponibles, sin detalle de viajes"/>
<div className="max-w-xs mb-5"><label className="block text-sm font-bold mb-2">Gestión</label><Select value={year} onChange={e=>setYear(e.target.value)}>{Array.from({length:7},(_,i)=>2024+i).map(y=><option key={y}>{y}</option>)}</Select></div>
{error&&<p role="alert" className="text-red-700 mb-4">{error}</p>}
<div className="grid sm:grid-cols-3 gap-4 mb-5">{[['Presupuesto total',total('monto_asignado')],['Total gastado',total('gastado')],['Disponible',total('saldo')]].map(([label,value])=><Card key={String(label)}><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold mt-2">Bs {bs(Number(value))}</p></Card>)}</div>
<Card><h2 className="font-bold text-lg mb-4">Totales por partida</h2><div className="overflow-x-auto"><table className="w-full text-sm min-w-[680px]"><thead><tr className="bg-slate-100 text-left">{['Programa / objeto','Asignado','Gastado','Ajustes','Disponible'].map(x=><th className="p-3" key={x}>{x}</th>)}</tr></thead><tbody>{items.map(p=><tr className="border-t" key={p.id}><td className="p-3"><b>{p.codigo_programa}</b> · {p.objeto_gasto}<div className="text-xs text-slate-500">{p.descripcion}</div></td>{(['monto_asignado','gastado','ajustes','saldo'] as const).map(k=><td key={k} className="p-3 tabular-nums">Bs {bs(Number(p[k]))}</td>)}</tr>)}</tbody></table>{items.length===0&&<p className="p-4 text-sm text-slate-500">No existen presupuestos para esta gestión.</p>}</div></Card></>}
