import {montoLiteralBolivianos} from './monto-literal';
import type ExcelJS from 'exceljs';

export type FilaPlanilla = {
  nombre: string; cargo: string; ci: string; fecha: string; porcentaje: number; hotelTotal?: number;
  hojaRuta: string; descripcion: string; dias: number;
  viaticoDia: number; totalViatico: number; rciva: number;
  viaticoNeto: number; pasajeFactura: number; pasajeRecibo: number;
  iue: number; it: number; pasajeNeto: number; liquido: number;
};
export type DatosPlanilla = { gestion: string; daf: string; descripcion: string; fecha: string; filas: FilaPlanilla[]; siglas?:string; color?:string };

const WHITE='FFFFFFFF', PEACH='FFF8E2D4', GRID='FF000000', BLACK='FF000000';
const widths=[14.5,21,12,15,11.2,15.3,6,8.6,12.6,11.3,11.2,9.6,9.4,11.2,11.2,12,11.2,34];
const headers=['NOMBRES Y\nAPELLIDOS','CARGO','N° C.I.','FECHA','N° DE\nHOJA DE\nRUTA','DESCRIPCIÓN','DÍAS','VIÁTICO\nPOR DÍA','TOTAL\nVIÁTICOS','RC-IVA\n13%','VIÁTICO\nNETO','PASAJE CON FACTURA','PASAJE CON RECIBO','IUE 13%','IT 3%','PASAJE\nNETO','LÍQUIDO\nPAGABLE','FIRMA'];
const literals=['','','','','','','A','B','C=A*B','D=C*13%','E=C-D','F','H','I=H*13%','J=H*3%','K=F+(H-I-J)','L=E+K',''];
const thin={style:'thin' as const,color:{argb:BLACK}};
const thick={style:'medium' as const,color:{argb:BLACK}};
function boDate(s:string){const [y,m,d]=s.split('-');return y&&m&&d?`${d}/${m}/${y}`:s;}
function boLong(s:string){const [y,m,d]=s.split('-');if(!y||!m||!d)return s;const meses=['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];return `${Number(d)} DE ${meses[Number(m)-1]||m} DE ${y}`;}
export async function exportarPlanillaOficial(info:DatosPlanilla){
 const ExcelJS=(await import('exceljs')).default;const heading=(info.color||'#F8E2D4').replace('#','').toUpperCase();const HEADER='FF'+heading;
 const workbook=new ExcelJS.Workbook();workbook.creator='GAMU - Sistema de Pasajes y Viáticos';
 const sheet=workbook.addWorksheet('Planilla oficial',{views:[{state:'normal',showGridLines:true}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:.13,right:.13,top:.22,bottom:.22,header:.05,footer:.05}}});
 widths.forEach((w,i)=>sheet.getColumn(i+1).width=w);
 [20,20,20,23,50,68,22].forEach((height,i)=>sheet.getRow(i+1).height=height);
 const center={vertical:'middle' as const,horizontal:'center' as const,wrapText:true};
 sheet.mergeCells('A1:A4');sheet.mergeCells('B1:E1');sheet.mergeCells('B2:E2');sheet.mergeCells('B3:E3');sheet.mergeCells('G4:P4');sheet.mergeCells('P1:Q1');
 sheet.getCell('B1').value='GOBIERNO AUTÓNOMO MUNICIPAL DE UYUNI';sheet.getCell('B1').font={name:'Twentieth Century',size:12,bold:true};
 sheet.getCell('B2').value='PRIMERA SECCIÓN - PROVINCIA ANTONIO QUIJARRO';sheet.getCell('B2').font={name:'Twentieth Century',size:9,italic:true};
 sheet.getCell('B3').value='POTOSÍ - BOLIVIA';sheet.getCell('B3').alignment=center;sheet.getCell('B3').font={name:'Twentieth Century',size:9};
 sheet.getCell('P1').value=`N.º DOCUMENTO`;sheet.getCell('P1').alignment=center;
 sheet.getCell('R1').value=info.daf||'';sheet.getCell('R1').alignment=center;
 for(const a of ['P1','R1']){const c=sheet.getCell(a);c.border={top:thick,bottom:thick,left:thick,right:thick};c.fill={type:'pattern',pattern:'solid',fgColor:{argb:a==='R1'?PEACH:WHITE}};c.font={name:'Twentieth Century',bold:true,size:10};}
 sheet.getCell('G4').value=`PLANILLA DE PASAJES Y VIÁTICOS GESTION ${info.gestion}`;sheet.getCell('G4').font={name:'Twentieth Century',size:16,bold:true,underline:true};sheet.getCell('G4').alignment=center;
 for(let i=1;i<=18;i++){
  const letter=sheet.getColumn(i).letter;
  if(i<=6 || i===18){sheet.mergeCells(`${letter}5:${letter}7`);}else{sheet.mergeCells(`${letter}5:${letter}6`);}
  const top=sheet.getCell(`${letter}5`);top.value=headers[i-1];top.font={name:'Twentieth Century',bold:true,size:i===12||i===13?10:11};top.alignment={...center,textRotation:i===6?45:i===8||i===12||i===13?90:0};
  if(i>6&&i<18){const sub=sheet.getCell(`${letter}7`);sub.value=literals[i-1];sub.font={name:'Twentieth Century',size:12,bold:true};sub.alignment=center;}
 }
 for(let r=5;r<=7;r++)for(let col=1;col<=18;col++){const c=sheet.getRow(r).getCell(col);c.fill={type:'pattern',pattern:'solid',fgColor:{argb:HEADER}};c.border={top:thick,bottom:thick,left:thick,right:thick};}
 const base=8;const rows=info.filas.length||1;
 for(let i=0;i<rows;i++){
  const r=base+i;sheet.getRow(r).height=info.filas.length?96:90;const f=info.filas[i];
  if(f){const vals:any[]=[f.nombre,f.cargo,f.ci,boDate(f.fecha),f.hojaRuta,`${f.descripcion}\nSE PAGA EL ${f.porcentaje}%`,f.dias,f.viaticoDia,0,f.rciva,0,f.pasajeFactura,f.pasajeRecibo,0,0,0,0,''];
   vals.forEach((v,j)=>sheet.getRow(r).getCell(j+1).value=v);
   sheet.getCell(`I${r}`).value={formula:`G${r}*H${r}`,result:f.totalViatico};sheet.getCell(`J${r}`).value={formula:`MAX(0,ROUND(I${r}*13%,2)-ROUND(${Number(f.hotelTotal||0)}*13%,2))`,result:f.rciva};sheet.getCell(`K${r}`).value={formula:`I${r}-J${r}`,result:f.viaticoNeto};
   sheet.getCell(`N${r}`).value={formula:`ROUND(M${r}*13%,2)`,result:f.iue};sheet.getCell(`O${r}`).value={formula:`ROUND(M${r}*3%,2)`,result:f.it};
   sheet.getCell(`P${r}`).value={formula:`L${r}+M${r}-N${r}-O${r}`,result:f.pasajeNeto};sheet.getCell(`Q${r}`).value={formula:`K${r}+P${r}`,result:f.liquido};
  }
  for(let c=1;c<=18;c++){const cell=sheet.getRow(r).getCell(c);cell.border={top:thin,bottom:thin,left:thin,right:thin};cell.alignment=center;cell.font={name:'Twentieth Century',size:12,color:{argb:'FF000000'}};if(c>=8&&c<=17)cell.numFmt='#,##0.00;[Red]-#,##0.00';}
  for(let c of [12,13])sheet.getRow(r).getCell(c).fill={type:'pattern',pattern:'solid',fgColor:{argb:PEACH}};
 }
 const end=base+rows-1;const total=end+1;sheet.getRow(total).height=20;sheet.mergeCells(`A${total}:G${total}`);sheet.getCell(`A${total}`).value='TOTAL';sheet.getCell(`A${total}`).alignment={horizontal:'right'};
 for(let c=8;c<=17;c++){const letter=sheet.getColumn(c).letter;sheet.getCell(`${letter}${total}`).value={formula:`SUM(${letter}${base}:${letter}${end})`,result:info.filas.reduce((a,f)=>a+Number(({H:f.viaticoDia,I:f.totalViatico,J:f.rciva,K:f.viaticoNeto,L:f.pasajeFactura,M:f.pasajeRecibo,N:f.iue,O:f.it,P:f.pasajeNeto,Q:f.liquido} as Record<string,number>)[letter]||0),0)};sheet.getCell(`${letter}${total}`).numFmt='#,##0.00;[Red]-#,##0.00';}
 for(let c=1;c<=18;c++){let cell=sheet.getRow(total).getCell(c);cell.border={top:thick,bottom:thick,left:thick,right:thick};cell.font={name:'Twentieth Century',bold:true,size:9};cell.alignment={vertical:'middle',horizontal:c===1?'right':'center'};}
 sheet.mergeCells(`A${total+2}:R${total+2}`);sheet.getRow(total+2).height=22;sheet.getCell(`A${total+2}`).value=`SON: ${montoLiteralBolivianos(info.filas.reduce((a,f)=>a+Number(f.liquido||0),0))}`;sheet.getCell(`A${total+2}`).font={name:'Twentieth Century',bold:true,italic:true,size:9};
 sheet.mergeCells(`B${total+3}:R${total+3}`);sheet.getCell(`A${total+3}`).value='DESCRIPCIÓN:';sheet.getCell(`A${total+3}`).font={name:'Twentieth Century',bold:true,size:9,underline:true};sheet.getCell(`B${total+3}`).value=info.descripcion.toUpperCase();sheet.getCell(`B${total+3}`).font={name:'Twentieth Century',size:9};sheet.getRow(total+3).height=24;
 sheet.mergeCells(`A${total+5}:E${total+5}`);sheet.getCell(`A${total+5}`).value=`UYUNI, ${boLong(info.fecha)}`;sheet.getCell(`A${total+5}`).alignment=center;sheet.getCell(`A${total+5}`).font={name:'Twentieth Century',size:9};
 sheet.mergeCells(`A${total+7}:F${total+7}`);sheet.getCell(`A${total+7}`).value='PORCENTAJE RECONOCIDO: VER DETALLE DE CADA DÍA';sheet.getCell(`A${total+7}`).font={name:'Twentieth Century',size:9};
 sheet.pageSetup.printArea=`A1:R${total+8}`;
 // Escudo oficial proporcionado por el usuario.
 try {const resp=await fetch('/escudo-oficial-uyuni.png');if(resp.ok){const img=await resp.arrayBuffer();const imageId=workbook.addImage({buffer:img,extension:'png'});sheet.addImage(imageId,{tl:{col:0.02,row:0.05},ext:{width:102,height:126}});}}catch{}
 const data=await workbook.xlsx.writeBuffer();return new Blob([data as BlobPart],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
