'use client';
import type {DatosPlanilla} from './planilla-oficial';
import {montoLiteralBolivianos} from './monto-literal';
const H=['NOMBRES Y APELLIDOS','CARGO','N° C.I.','FECHA','N° DE HOJA DE RUTA','DESCRIPCIÓN','DÍAS','VIÁTICO POR DÍA','TOTAL VIÁTICOS','RC-IVA 13%','VIÁTICO NETO','PASAJE CON FACTURA','PASAJE CON RECIBO','IUE 13%','IT 3%','PASAJE NETO','LÍQUIDO PAGABLE','FIRMA'];
const widths=[27,31,19,22,18,33,11,18,20,19,20,18,18,18,16,20,22,38];
function dinero(n:number){return Number(n||0).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fecha(s:string){const [y,m,d]=s.split('-');return y&&m&&d?`${d}/${m}/${y}`:s}
async function dataUrl(path:string){const r=await fetch(path);if(!r.ok)throw new Error('No se pudo cargar el escudo');const b=await r.blob();return await new Promise<string>((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result as string);f.onerror=reject;f.readAsDataURL(b)});}
export async function exportarPlanillaPDF(info:DatosPlanilla):Promise<Blob>{
 const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
 // Formato amplio para conservar todas las columnas oficiales en una sola página de ancho.
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
 const pw=doc.internal.pageSize.getWidth();const color=(info.color||'#E2EDD9').replace('#','');
 const rgb=[0,2,4].map(i=>parseInt(color.slice(i,i+2),16));
 const luminosidad=(rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000;
 const textColor=0;
 const left=8, right=8;
 doc.setFont('helvetica','bold');doc.setFontSize(12);
 try{doc.addImage(await dataUrl('/escudo-gamu.png'),'PNG',9,5,19,24);}catch{}
 doc.text('GOBIERNO AUTÓNOMO MUNICIPAL DE UYUNI',31,11);
 doc.setFont('helvetica','normal');doc.setFontSize(10);
 doc.text('PRIMERA SECCIÓN - PROVINCIA ANTONIO QUIJARRO',31,16);
 doc.text('POTOSÍ - BOLIVIA',31,21);
 doc.setDrawColor(0);doc.rect(pw-78,7,36,9);doc.rect(pw-42,7,34,9);
 doc.setFont('helvetica','bold');doc.setFontSize(9);doc.text('N° '+(info.siglas||'DAF'),pw-60,13,{align:'center'});doc.text(info.daf||'—',pw-25,13,{align:'center'});
 doc.setFontSize(17);doc.text(`PLANILLA DE PASAJES Y VIÁTICOS GESTIÓN ${info.gestion}`,pw/2,32,{align:'center'});
 const rows=info.filas.map(f=>[f.nombre,f.cargo,f.ci,fecha(f.fecha),f.hojaRuta,`${f.descripcion}\nRECONOCIDO: ${f.porcentaje}%`,String(f.dias),dinero(f.viaticoDia),dinero(f.totalViatico),dinero(f.rciva),dinero(f.viaticoNeto),dinero(f.pasajeFactura),dinero(f.pasajeRecibo),dinero(f.iue),dinero(f.it),dinero(f.pasajeNeto),dinero(f.liquido),'']);
 const sum=(k:keyof (typeof info.filas)[number])=>dinero(info.filas.reduce((s,f)=>s+Number(f[k]||0),0));
 const total=['TOTAL','','','','','','',sum('viaticoDia'),sum('totalViatico'),sum('rciva'),sum('viaticoNeto'),sum('pasajeFactura'),sum('pasajeRecibo'),sum('iue'),sum('it'),sum('pasajeNeto'),sum('liquido'),''];
 const totalMoney=info.filas.reduce((s,f)=>s+Number(f.liquido||0),0);
 const available=pw-left-right;const weightSum=widths.reduce((a,b)=>a+b,0);
 const columnStyles=Object.fromEntries(widths.map((w,i)=>[i,{cellWidth:w/weightSum*available}]));
 autoTable(doc,{startY:38,head:[H],body:[...rows,total],theme:'grid',margin:{left,right,top:38,bottom:30},tableWidth:available,
 styles:{font:'helvetica',fontSize:8.6,cellPadding:1.8,halign:'center',valign:'middle',lineWidth:.25,lineColor:[0,0,0],overflow:'linebreak'},
 headStyles:{fillColor:rgb as [number,number,number],textColor,halign:'center',fontStyle:'bold',minCellHeight:28},
 columnStyles,
 didParseCell(data){if(data.section==='body'&&data.row.index===rows.length){data.cell.styles.fontStyle='bold';data.cell.styles.fillColor=[245,245,245];}if(data.section==='body'&&(data.column.index===11||data.column.index===12))data.cell.styles.fillColor=[242,233,226];},
 didDrawPage(data){const bottom=doc.internal.pageSize.getHeight()-7;doc.setFontSize(7);doc.setFont('helvetica','normal');doc.text(`GAMU · Gestión ${info.gestion} · Página ${data.pageNumber}`,pw-8,bottom,{align:'right'});}
 });
 const last=(doc as typeof doc&{lastAutoTable?:{finalY:number}}).lastAutoTable;
 let y=(last?.finalY||100)+8;
 if(y>doc.internal.pageSize.getHeight()-48){doc.addPage();y=20;}
 doc.setFont('helvetica','bolditalic');doc.setFontSize(8.7);
 const literal=`SON: ${montoLiteralBolivianos(totalMoney)}`;
 doc.text(doc.splitTextToSize(literal,pw-20),left,y);y+=12;
 doc.setFont('helvetica','bold');doc.text('DESCRIPCIÓN:',left,y);
 doc.setFont('helvetica','normal');doc.text(doc.splitTextToSize(info.descripcion||'—',pw-47),39,y);y+=14;
 doc.text(`UYUNI, ${fecha(info.fecha)}`,left,y);y+=12;
 doc.text('PORCENTAJES RECONOCIDOS: INDICADOS EN CADA FILA DIARIA',left,y);
 return doc.output('blob');
}
