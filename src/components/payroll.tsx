"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/error-messages";
import { exportarPlanillaOficial, type FilaPlanilla } from "@/lib/export/planilla-oficial";
import { exportarPlanillaPDF } from "@/lib/export/planilla-pdf";
import { Alert, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { PayrollPreviewModal, type PreviewInfo } from "@/components/payroll-preview-modal";
import { TripPicker } from "@/components/trip-picker";

type Row = { id: string; [key: string]: any };
type ExportMode = "pdf" | "excel" | "print";
type Emission = { id: string; numero: string; key: string };

const todayLocal = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

export function Payroll() {
  const supabase = useMemo(() => createClient(), []);
  const params = useSearchParams();
  const viajeParam = params.get("viaje");

  const [trips, setTrips] = useState<Row[]>([]);
  const [allTrips, setAllTrips] = useState<Row[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [hotelDocs, setHotelDocs] = useState<Row[]>([]);
  const [directions, setDirections] = useState<Row[]>([]);
  const [direction, setDirection] = useState("");
  const [gestion, setGestion] = useState(String(new Date().getFullYear()));
  const [fecha, setFecha] = useState(todayLocal);
  const [fechaManual, setFechaManual] = useState(false);
  const [numeroManual, setNumeroManual] = useState("");
  const [numeroEditado, setNumeroEditado] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingRows, setLoadingRows] = useState(false);
  const [preview, setPreview] = useState<ExportMode | null>(null);
  const [nextNumber, setNextNumber] = useState("—");
  const [emitted, setEmitted] = useState<Emission | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: err } = await supabase.from("direcciones").select("*").order("nombre");
      if (!active) return;
      if (err) setError(friendlyError(err));
      else setDirections(data ?? []);
    })();
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: err } = await supabase
        .from("viajes")
        .select("*,funcionarios(nombres,apellidos,ci,cargos(nombre)),destinos(nombre)")
        .order("created_at", { ascending: false });
      if (!active) return;
      if (err) setError(friendlyError(err));
      else setAllTrips(data ?? []);
    })();
    return () => { active = false; };
  }, [supabase]);

  // Se ofrecen solamente viajes con días registrados. Tras eliminar un viaje,
  // su ID deja de formar parte del selector incluso si la URL contenía ?viaje=.
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error: err } = await supabase.from("viaje_dias").select("viaje_id");
      if (!active) return;
      if (err) { setError(friendlyError(err)); return; }
      const validIds = new Set((data ?? []).map(d => d.viaje_id));
      const valid = allTrips.filter(t => validIds.has(t.id));
      setTrips(valid);
      setChosen(old => {
        const kept = old.filter(id => validIds.has(id) && valid.some(t => t.id === id));
        if (viajeParam && validIds.has(viajeParam) && valid.some(t => t.id === viajeParam) && !kept.includes(viajeParam)) return [...kept, viajeParam];
        return kept.length === old.length && kept.every((x,i) => x === old[i]) ? old : kept;
      });
    })();
    return () => { active = false; };
  }, [allTrips, supabase, viajeParam]);

  useEffect(() => {
    let active = true;
    if (!chosen.length) { setRows([]); setHotelDocs([]); setLoadingRows(false); return; }
    setLoadingRows(true);
    setRows([]); // Evita previsualizar los días de otra selección durante la consulta.
    void (async () => {
      const { data, error: err } = await supabase
        .from("viaje_dias")
        .select("*")
        .in("viaje_id", chosen)
        .order("fecha", { ascending: true });
      if (!active) return;
      if (err) { setError(friendlyError(err)); setRows([]); }
      else {
        setRows(data ?? []);
        if (data?.length) {
          const {data:comps,error:compErr}=await supabase.from("comprobantes").select("*").eq("tipo","hospedaje").in("viaje_dia_id",data.map(x=>x.id));
          if(!active)return;
          if(compErr)setError(friendlyError(compErr));
          setHotelDocs(comps??[]);
        }else setHotelDocs([]);
      }
      setLoadingRows(false);
    })();
    return () => { active = false; };
  }, [chosen, supabase]);

  const ultimoDia = chosen.reduce((latest, id) => {
    const t = trips.find(t => t.id === id);
    const fin = String(t?.fecha_fin || t?.fecha_inicio || "");
    return fin > latest ? fin : latest;
  }, rows.reduce((latest, d) => d.fecha > latest ? d.fecha : latest, ""));
  useEffect(() => {
    if (ultimoDia && !fechaManual) setFecha(ultimoDia);
  }, [ultimoDia, fechaManual]);

  const automaticDescription = [...new Set(chosen.map(id=>trips.find(t=>t.id===id)?.destinos?.nombre).filter(Boolean))].map(x=>`VIAJE A LA CIUDAD DE ${String(x).toUpperCase()}`).join("; ");
  const emitKey = JSON.stringify({ direction, gestion, automaticDescription, fecha, numero:numeroEditado?numeroManual:"auto", chosen: [...chosen].sort() });
  const currentNumber = emitted?.key === emitKey ? emitted.numero : "";

  useEffect(() => {
    if (!direction || !/^\d{4}$/.test(gestion)) { setNextNumber("—"); return; }
    let active = true;
    setNextNumber("…");
    void (async () => {
      const { data, error: err } = await supabase.from("planillas")
        .select("nro_daf")
        .eq("direccion_id", direction)
        .eq("gestion", Number(gestion));
      if (!active) return;
      if (err) { setNextNumber("—"); return; }
      const max = (data ?? []).reduce((n, item) => {
        const value = String(item.nro_daf ?? "");
        return /^\d+$/.test(value) ? Math.max(n, Number(value)) : n;
      }, 0);
      setNextNumber(String(max + 1));
    })();
    return () => { active = false; };
  }, [direction, gestion, supabase, emitted]);

  const infoByTrip = useMemo(() => new Map(trips.map(t => [t.id, t])), [trips]);
  const exportRows: FilaPlanilla[] = useMemo(() => rows.map(d => {
    const t = infoByTrip.get(d.viaje_id);
    return {
      nombre: `${t?.funcionarios?.apellidos ?? ""} ${t?.funcionarios?.nombres ?? ""}`.trim(),
      cargo: t?.funcionarios?.cargos?.nombre ?? "",
      ci: String(t?.funcionarios?.ci ?? ""),
      fecha: d.fecha,
      porcentaje: Number(d.porcentaje ?? 0),
      hotelTotal: hotelDocs.filter(c=>c.viaje_dia_id===d.id).reduce((a,c)=>a+Number(c.monto),0),
      hojaRuta: String(t?.nro_hoja_ruta ?? ""),
      descripcion: `VIAJE A LA CIUDAD DE ${String(t?.destinos?.nombre ?? "DESTINO").toUpperCase()}` + (hotelDocs.some(c=>c.viaje_dia_id===d.id)?`\nFACTURAS HOTEL: Bs ${hotelDocs.filter(c=>c.viaje_dia_id===d.id).reduce((a,c)=>a+Number(c.monto),0).toFixed(2)}`:""),
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
  }), [rows, infoByTrip, hotelDocs]);

  const dir = directions.find(d => d.id === direction);
  const previewInfo: PreviewInfo = {
    gestion,
    daf: currentNumber || numeroManual || nextNumber,
    fecha,
    descripcion: automaticDescription,
    siglas: dir?.siglas || "DAF",
    color: dir?.color || "#E2EDD9",
    filas: exportRows,
  };

  const openPreview = (mode: ExportMode) => {
    setError("");
    if (!direction) { setError("Selecciona una dirección."); return; }
    if (!/^\d{4}$/.test(gestion)) { setError("Introduce una gestión válida de cuatro dígitos."); return; }
    if (!chosen.length) { setError("Selecciona al menos un viaje."); return; }
    if (loadingRows) { setError("Todavía se están cargando los días de los viajes."); return; }
    if (!rows.length) { setError("Los viajes seleccionados no tienen días registrados."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) { setError("Selecciona una fecha válida para la planilla."); return; }
    if (numeroEditado && numeroManual && (!/^[1-9]\d{0,8}$/.test(numeroManual) || Number(numeroManual) > 2147483647)) {
      setError("El número de documento debe ser un entero positivo de hasta 9 dígitos."); return;
    }
    setPreview(mode);
  };

  const ensureEmitted = async (): Promise<string> => {
    if (emitted?.key === emitKey) return emitted.numero;
    const { data, error: err } = await supabase.rpc("emitir_planilla_con_numero", {
      p_direccion_id: direction,
      p_gestion: Number(gestion),
      p_fecha: fecha,
      p_descripcion: automaticDescription,
      p_viajes: chosen,
      p_numero_solicitado: numeroEditado ? numeroManual.trim() || null : null,
    });
    if (err) throw err;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.numero_daf) throw new Error("No se pudo asignar el número de documento.");
    const numero = String(result.numero_daf);
    setEmitted({ id: String(result.planilla_id), numero, key: emitKey });
    setNextNumber(numero);
    return numero;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const confirmDownload = async () => {
    if (!preview || busy) return;
    // Abrir durante el clic evita el bloqueo de ventanas emergentes al imprimir.
    const printWindow = preview === "print" ? window.open("about:blank", "_blank") : null;
    if (preview === "print" && !printWindow) {
      setError("Tu navegador bloqueó la ventana de impresión. Permite las ventanas emergentes.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const numero = await ensureEmitted();
      const fileInfo = { ...previewInfo, daf: numero };
      const blob = preview === "excel"
        ? await exportarPlanillaOficial(fileInfo)
        : await exportarPlanillaPDF(fileInfo);
      if (preview === "print") {
        const url = URL.createObjectURL(blob);
        printWindow!.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 120000);
      } else {
        downloadBlob(blob, `planilla-${dir?.siglas || "GAMU"}-${gestion}-${numero}.${preview === "pdf" ? "pdf" : "xlsx"}`);
      }
      setPreview(null);
    } catch (e) {
      printWindow?.close();
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const actions = [
    { mode: "pdf", label: "Exportar PDF", Icon: FileDown },
    { mode: "excel", label: "Exportar Excel", Icon: FileSpreadsheet },
    { mode: "print", label: "Imprimir", Icon: Printer },
  ] as const;

  return (
    <>
      <PageHeader
        title="Planillas de pasajes y viáticos"
        description="Selecciona los viajes y revisa el documento antes de descargarlo"
      />
      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Dirección">
            <Select value={direction} onChange={e => setDirection(e.target.value)}>
              <option value="">Seleccionar dirección</option>
              {directions.map(d => (
                <option key={d.id} value={d.id}>{d.siglas} - {d.nombre}</option>
              ))}
            </Select>
          </Field>
          <Field label="Gestión">
            <Input value={gestion} maxLength={4} onChange={e => setGestion(e.target.value)} />
          </Field>
          <Field label="N.º de documento">
            <Input inputMode="numeric" pattern="[1-9][0-9]*" value={currentNumber || (numeroEditado ? numeroManual : /^\d+$/.test(nextNumber) ? nextNumber : "")}
              placeholder={nextNumber === "—" ? "Selecciona dirección" : `Sugerido: ${nextNumber}`}
              disabled={Boolean(currentNumber)}
              onChange={e => {setNumeroEditado(true);setNumeroManual(e.target.value.replace(/\D/g, ""));}}
              title="Puedes escribir otro número. Si lo dejas vacío, se asignará el siguiente automáticamente." />
            <div className="mt-1 flex items-center justify-between gap-2 text-xs gamu-muted"><span>Siguiente sugerido: <strong>{nextNumber}</strong>. {currentNumber ? 'Número asignado.' : 'Puedes editarlo.'}</span>{numeroEditado && !currentNumber && <button type="button" className="underline" onClick={()=>{setNumeroManual('');setNumeroEditado(false)}}>Usar sugerido</button>}</div>
          </Field>
          <Field label="Fecha de planilla">
            <Input type="date" value={fecha} onChange={e => { setFechaManual(true); setFecha(e.target.value); }} />
            <p className="mt-1 text-xs gamu-muted">Se propone el último día del viaje{ultimoDia ? ` (${ultimoDia.split("-").reverse().join("/")})` : ""}. Puedes modificarla.</p>
          </Field>
        </div>
        <div className="mt-3">
          <TripPicker trips={trips} chosen={chosen} onChange={setChosen} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Si no escribes un número, se usará el siguiente disponible. La fecha de planilla inicia con la fecha final del viaje y puede editarse.
        </p>
      </Card>

      {error && !preview && <Alert error>{error}</Alert>}

      {/* Botones flotantes en columna, de arriba hacia abajo. */}
      <div
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex flex-col items-center gap-3 sm:bottom-6 sm:right-6"
        role="group"
        aria-label="Acciones de planilla"
      >
        {actions.map(({ mode, label, Icon }) => (
          <div className="group relative" key={mode}>
            <button
              type="button"
              aria-label={label}
              title={label}
              disabled={busy || loadingRows || !rows.length}
              onClick={() => openPreview(mode)}
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-[#11212D] text-white shadow-xl transition hover:scale-105 hover:bg-[#253745] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Icon size={24} strokeWidth={2} />
            </button>
            <span className="pointer-events-none absolute right-16 top-1/2 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#06141B] px-3 py-2 text-xs font-semibold text-white shadow-lg group-hover:sm:block">
              {label}
            </span>
          </div>
        ))}
      </div>

      {preview && (
        <PayrollPreviewModal
          type={preview}
          info={previewInfo}
          busy={busy}
          error={error}
          onClose={() => { if (!busy) setPreview(null); }}
          onDownload={confirmDownload}
        />
      )}
    </>
  );
}
