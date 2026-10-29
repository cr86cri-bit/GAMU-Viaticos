import { clsx, type ClassValue } from 'clsx';import { twMerge } from 'tailwind-merge';
export const cn=(...v:ClassValue[])=>twMerge(clsx(v));
export const bs=(n:number|string|null|undefined)=>new Intl.NumberFormat('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n??0));
export const dateBO=(s:string)=>s?new Date(s+'T12:00:00').toLocaleDateString('es-BO'):'';
export const money=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
