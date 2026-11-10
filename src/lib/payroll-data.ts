import type { FilaPlanilla, DatosPlanilla } from '@/lib/export/planilla-oficial';

type Rec = Record<string, any>;
export function crearFilasPlanilla(viajes: Rec[], dias: Rec[], comprobantes: Rec[]): FilaPlanilla[] {
  const porViaje = new Map(viajes.map(v => [v.id, v]));
  const hoteles = new Map<string, number>();
  for (const c of comprobantes) {
    if (c.tipo !== 'hospedaje') continue;
    hoteles.set(c.viaje_dia_id, (hoteles.get(c.viaje_dia_id) ?? 0) + Number(c.monto ?? 0));
  }
  return dias.map(d => {
    const viaje = porViaje.get(d.viaje_id);
    const hotel = hoteles.get(d.id) ?? 0;
    return {
      nombre: `${viaje?.funcionarios?.apellidos ?? ''} ${viaje?.funcionarios?.nombres ?? ''}`.trim(),
      cargo: viaje?.funcionarios?.cargos?.nombre ?? '',
      ci: String(viaje?.funcionarios?.ci ?? ''),
      fecha: d.fecha,
      porcentaje: Number(d.porcentaje ?? 0),
      hotelTotal: hotel,
      hojaRuta: String(viaje?.nro_hoja_ruta ?? ''),
      descripcion: `VIAJE A LA CIUDAD DE ${String(viaje?.destinos?.nombre ?? 'DESTINO').toUpperCase()}` + (hotel > 0 ? `\nFACTURAS HOTEL: Bs ${hotel.toFixed(2)}` : ''),
      dias: 1,
      viaticoDia: Number(d.viatico_dia ?? 0),
      totalViatico: Number(d.total_viatico ?? 0),
      rciva: Number(d.rciva_ajuste ?? 0),
      viaticoNeto: Number(d.viatico_neto ?? 0),
      pasajeFactura: Number(d.pasaje_factura ?? 0),
      pasajeRecibo: Number(d.pasaje_recibo ?? 0),
      iue: Number(d.iue_retencion ?? 0),
      it: Number(d.it_retencion ?? 0),
      pasajeNeto: Number(d.pasaje_neto ?? 0),
      liquido: Number(d.liquido_pagable ?? 0),
    };
  });
}
export function descripcionViajes(viajes: Rec[]) {
  return [...new Set(viajes.map(v => v?.destinos?.nombre).filter(Boolean))]
    .map(d => `VIAJE A LA CIUDAD DE ${String(d).toUpperCase()}`).join('; ');
}
export type PlanillaGuardada = DatosPlanilla & { almacenada?: boolean };
