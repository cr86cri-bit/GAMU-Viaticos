/** Convierte un importe en Bs a texto, redondeando a centavos. */
const unidades=['','UN','DOS','TRES','CUATRO','CINCO','SEIS','SIETE','OCHO','NUEVE','DIEZ','ONCE','DOCE','TRECE','CATORCE','QUINCE','DIECISÉIS','DIECISIETE','DIECIOCHO','DIECINUEVE'];
const decenas=['','','VEINTE','TREINTA','CUARENTA','CINCUENTA','SESENTA','SETENTA','OCHENTA','NOVENTA'];
const centenas=['','CIENTO','DOSCIENTOS','TRESCIENTOS','CUATROCIENTOS','QUINIENTOS','SEISCIENTOS','SETECIENTOS','OCHOCIENTOS','NOVECIENTOS'];
function menorMil(n:number):string{
 if(n===0)return '';
 if(n===100)return 'CIEN';
 const c=Math.floor(n/100),r=n%100;
 const pref=c?centenas[c]+(r?' ':''):'';
 if(r<20)return pref+unidades[r];
 if(r<30)return pref+(r===20?'VEINTE':`VEINTI${unidades[r-20].toLowerCase()}`.toUpperCase());
 const d=Math.floor(r/10),u=r%10;
 return pref+decenas[d]+(u?' Y '+unidades[u]:'');
}
function entero(n:number):string{
 if(n===0)return 'CERO';
 const millones=Math.floor(n/1000000),miles=Math.floor(n%1000000/1000),resto=n%1000;
 const a=millones?(millones===1?'UN MILLÓN':entero(millones)+' MILLONES'):'';
 const b=miles?(miles===1?'MIL':menorMil(miles)+' MIL'):'';
 return [a,b,menorMil(resto)].filter(Boolean).join(' ');
}
export function montoLiteralBolivianos(importe:number):string{
 if(!Number.isFinite(importe)||importe<0)throw new Error('Monto inválido para conversión literal');
 const centavosTotales=Math.round((importe+Number.EPSILON)*100);
 const enteros=Math.floor(centavosTotales/100),centavos=centavosTotales%100;
 // La planilla oficial expresa los centavos como XX/100, independientemente del singular.
 const texto=entero(enteros).replace(/VEINTIUN(?![A-ZÁÉÍÓÚ])/g,'VEINTIÚN').replace(/ Y UN$/,' Y UN');
 return `${texto} ${String(centavos).padStart(2,'0')}/100 BOLIVIANOS`;
}
