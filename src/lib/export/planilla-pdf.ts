'use client';
import type {DatosPlanilla} from './planilla-oficial';
import {montoLiteralBolivianos} from './monto-literal';
const H=['NOMBRES Y\nAPELLIDOS','CARGO','N.º C.I.','FECHA','HOJA DE\nRUTA','DESCRIPCIÓN','DÍAS','VIÁTICO\nPOR DÍA','TOTAL\nVIÁTICOS','RC-IVA\n13%','VIÁTICO\nNETO','PASAJE\nFACTURA','PASAJE\nRECIBO','IUE\n13%','IT\n3%','PASAJE\nNETO','LÍQUIDO\nPAGABLE','FIRMA / SELLO'];
// Proporciones alineadas con la previsualización HTML (firma amplia ~15%).
const widths=[38,31,23,26,23,45,17,20,23,21,23,23,23,14,14,21,23,63];
function dinero(n:number){return Number(n||0).toLocaleString('es-BO',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fecha(s:string){const [y,m,d]=s.split('-');return y&&m&&d?`${d}/${m}/${y}`:s}
function fechaLiteral(s:string){
 const [year,month,day]=s.split('-').map(Number);
 const dt=new Date(Date.UTC(year,month-1,day));
 if(!year||!month||!day||dt.getUTCFullYear()!==year||dt.getUTCMonth()!==month-1||dt.getUTCDate()!==day)return s;
 const dias=['DOMINGO','LUNES','MARTES','MIÉRCOLES','JUEVES','VIERNES','SÁBADO'];
 const meses=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
 return `${dias[dt.getUTCDay()]}, ${day} DE ${meses[month-1]} DE ${year}`;
}
// Carga las fuentes desde public/fonts (no se redistribuyen los archivos .ttf).
// La fuente Regular NO contiene glifos bold: registrar ese mismo archivo como bold
// no produce negritas visibles en el PDF exportado.
async function registrarTwentiethCentury(doc: import('jspdf').jsPDF): Promise<void> {
 const toBase64 = (data: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < data.length; i += 8192) {
   binary += String.fromCharCode(...data.subarray(i, i + 8192));
  }
  return btoa(binary);
 };
 const fonts = [
  {file: 'Twentieth-Century.ttf', style: 'normal'},
  {file: 'Twentieth-Century-Bold.ttf', style: 'bold'},
 ] as const;
 for (const font of fonts) {
  // No volver silenciosamente a Regular: sin Bold, el documento no cumple
  // con el formato institucional solicitado.
  let response: Response;
  try {
   response = await fetch(`/fonts/${font.file}`, {cache: 'no-store'});
  } catch {
   throw new Error(`No se pudo cargar ${font.file}. Comprueba public/fonts y vuelve a desplegar Vercel.`);
  }
  if (!response.ok) {
   throw new Error(`Falta ${font.file} en public/fonts (HTTP ${response.status}). Agrégalo al proyecto y vuelve a desplegar Vercel.`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length) throw new Error(`El archivo ${font.file} está vacío.`);
  doc.addFileToVFS(font.file, toBase64(bytes));
  doc.addFont(font.file, 'Twentieth Century', font.style);
 }
 // Asegurarse de que ambas variantes quedaron registradas en jsPDF.
 const fontsLoaded = doc.getFontList()['Twentieth Century'] ?? [];
 if (!fontsLoaded.includes('normal') || !fontsLoaded.includes('bold')) {
  throw new Error('No se pudieron registrar Twentieth Century Regular y Bold en el PDF.');
 }
}
async function dataUrl(path:string){const r=await fetch(path);if(!r.ok)throw new Error('No se pudo cargar el escudo');const b=await r.blob();return await new Promise<string>((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result as string);f.onerror=reject;f.readAsDataURL(b)});}
export async function exportarPlanillaPDF(info:DatosPlanilla):Promise<Blob>{
 const [{jsPDF},{default:autoTable}]=await Promise.all([import('jspdf'),import('jspdf-autotable')]);
 // Formato amplio para conservar todas las columnas oficiales en una sola página de ancho.
 const doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a3',compress:true});
 await registrarTwentiethCentury(doc);
 const boldFont = 'Twentieth Century';
 const boldStyle = 'bold';
 const pw=doc.internal.pageSize.getWidth();const color=(info.color||'#E2EDD9').replace('#','');
 const rgb=[0,2,4].map(i=>parseInt(color.slice(i,i+2),16));
 const textColor=0;
 const left=8, right=8;
 doc.setFont(boldFont,boldStyle);doc.setFontSize(13.5);
 try{doc.addImage(await dataUrl('/escudo-gamu.png'),'PNG',9,5,19,24);}catch{}
 doc.text('GOBIERNO AUTÓNOMO MUNICIPAL DE UYUNI',31,11);
 doc.setFont('Twentieth Century','normal');doc.setFontSize(10.5);
 doc.text('PRIMERA SECCIÓN - PROVINCIA ANTONIO QUIJARRO',31,16);
 doc.text('POTOSÍ - BOLIVIA',31,21);
 doc.setDrawColor(0);doc.rect(pw-78,7,36,9);doc.rect(pw-42,7,34,9);
 doc.setFont(boldFont,boldStyle);doc.setFontSize(9);doc.text('N° DOCUMENTO',pw-60,13,{align:'center'});doc.text(info.daf||'—',pw-25,13,{align:'center'});
 // Título subrayado con Twentieth Century; Bold genuina cuando está disponible.
 doc.setFont(boldFont,boldStyle);doc.setFontSize(18);
 const titulo=`PLANILLA DE PASAJES Y VIÁTICOS GESTIÓN ${info.gestion}`;
 doc.text(titulo,pw/2,32,{align:'center'});
 const tituloWidth=doc.getTextWidth(titulo);
 doc.setDrawColor(0,0,0);doc.setLineWidth(0.35);
 doc.line((pw-tituloWidth)/2,33.2,(pw+tituloWidth)/2,33.2);
 const rows=info.filas.map(f=>[f.nombre,f.cargo,f.ci,fecha(f.fecha),f.hojaRuta,`${f.descripcion}\nRECONOCIDO: ${f.porcentaje}%`,String(f.dias),dinero(f.viaticoDia),dinero(f.totalViatico),dinero(f.rciva),dinero(f.viaticoNeto),dinero(f.pasajeFactura),dinero(f.pasajeRecibo),dinero(f.iue),dinero(f.it),dinero(f.pasajeNeto),dinero(f.liquido),'']);
 const sum=(k:keyof (typeof info.filas)[number])=>dinero(info.filas.reduce((s,f)=>s+Number(f[k]||0),0));
 const total=['TOTAL','','','','','','',sum('viaticoDia'),sum('totalViatico'),sum('rciva'),sum('viaticoNeto'),sum('pasajeFactura'),sum('pasajeRecibo'),sum('iue'),sum('it'),sum('pasajeNeto'),sum('liquido'),''];
 const totalMoney=info.filas.reduce((s,f)=>s+Number(f.liquido||0),0);
 const available=pw-left-right;const weightSum=widths.reduce((a,b)=>a+b,0);
 const columnStyles=Object.fromEntries(widths.map((w,i)=>[i,{cellWidth:w/weightSum*available}]));
 autoTable(doc,{startY:38,head:[H],body:[...rows,total],theme:'grid',margin:{left,right,top:38,bottom:30},tableWidth:available,
 styles:{font:'Twentieth Century',fontSize:10.4,textColor:[0,0,0],cellPadding:1.5,halign:'center',valign:'middle',lineWidth:.25,lineColor:[0,0,0],overflow:'linebreak'},
 headStyles:{font:boldFont,fillColor:rgb as [number,number,number],textColor,halign:'center',fontStyle:boldStyle,fontSize:9.4,minCellHeight:24,cellPadding:1.1},
 columnStyles,
 didParseCell(data){if(data.section==='body'&&data.row.index<rows.length){data.cell.styles.minCellHeight=44;if(data.column.index===0){data.cell.styles.font=boldFont;data.cell.styles.fontStyle='bold';}if(data.column.index===3){data.cell.styles.fontSize=9.2;}}if(data.section==='body'&&data.row.index===rows.length){if(data.column.index===0)data.cell.styles.halign='right';data.cell.styles.font=boldFont;data.cell.styles.fontStyle=boldStyle;data.cell.styles.fontSize=10.8;data.cell.styles.fillColor=[235,240,242];}if(data.section==='body'&&(data.column.index===11||data.column.index===12))data.cell.styles.fillColor=[242,233,226];},
 didDrawPage(data){const bottom=doc.internal.pageSize.getHeight()-7;doc.setFontSize(7);doc.setFont('Twentieth Century','normal');doc.text(`GAMU · Gestión ${info.gestion} · Página ${data.pageNumber}`,pw-8,bottom,{align:'right'});}
 });
 const last=(doc as typeof doc&{lastAutoTable?:{finalY:number}}).lastAutoTable;
 const pageHeight=doc.internal.pageSize.getHeight();
 const dateY=pageHeight-18; // Fecha al pie de la última página, por encima de la numeración.
 const limit=dateY-14; // Espacio libre para separar notas y fecha.
 let y=(last?.finalY||100)+9;
 const literal=`SON: ${montoLiteralBolivianos(totalMoney)}`;
 doc.setFont(boldFont,boldStyle);doc.setFontSize(11.5);
 const literalLines=doc.splitTextToSize(literal,pw-20);
 doc.setFont('Twentieth Century','normal');doc.setFontSize(10.8);
 const descripcionLines=doc.splitTextToSize(info.descripcion||'—',pw-49);
 const notesHeight=literalLines.length*5+8+Math.max(1,descripcionLines.length)*5+9+9;
 // Si las notas no caben con la fecha, se trasladan juntas a una nueva página.
 if(y+notesHeight>limit){doc.addPage();y=19;}
 doc.setFont(boldFont,boldStyle);doc.setFontSize(11.5);
 doc.text(literalLines,left,y);y+=literalLines.length*5+8;
 doc.setFont(boldFont,boldStyle);doc.setFontSize(9.3);
 doc.text('DESCRIPCIÓN:',left,y);
 doc.setFont('Twentieth Century','normal');doc.setFontSize(10.8);
 doc.text(descripcionLines,39,y);y+=Math.max(1,descripcionLines.length)*5+9;
 doc.text('PORCENTAJES RECONOCIDOS: INDICADOS EN CADA FILA DIARIA',left,y);
 // Último renglón del documento: fecha en palabras, siempre al pie de la última página.
 doc.setFont('Twentieth Century','normal');doc.setFontSize(11);
 doc.text(`UYUNI, ${fechaLiteral(info.fecha)}`,left,dateY);
 return doc.output('blob');
}
