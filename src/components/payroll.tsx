"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/error-messages";
import { exportarPlanillaOficial, type FilaPlanilla } from "@/lib/export/planilla-oficial";
import { exportarPlanillaPDF } from "@/lib/export/planilla-pdf";
import { Alert, Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
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
  const [chosen, setChosen] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [directions, setDirections] = useState<Row[]>([]);
  const [direction, setDirection] = useState("");
  const [gestion, setGestion] = useState(String(new Date().getFullYear()));
  const [description, setDescription] = useState("");
  const [fecha, setFecha] = useState(todayLocal);
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
      else setTrips(data ?? []);
    })();
    return () => { active = false; };
  }, [supabase]);

  useEffect(() => {
    if (viajeParam) setChosen(old => old.includes(viajeParam) ? old : [viajeParam]);
  }, [viajeParam]);

  useEffect(() => {
    let active = true;
    if (!chosen.length) { setRows([]); setLoadingRows(false); return; }
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
      else setRows(data ?? []);
      setLoadingRows(false);
    })();
    return () => { active = false; };
  }, [chosen, supabase]);

  const emitKey = JSON.stringify({ direction, gestion, description, fecha, chosen: [...chosen].sort() });
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
      hojaRuta: String(t?.nro_hoja_ruta ?? ""),
      descripcion: t?.motivo ?? "",
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
  }), [rows, infoByTrip]);

  const dir = directions.find(d => d.id === direction);
  const previewInfo: PreviewInfo = {
    gestion,
    daf: currentNumber || nextNumber,
    fecha,
    descripcion: description,
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
    setPreview(mode);
  };

  const ensureEmitted = async (): Promise<string> => {
    if (emitted?.key === emitKey) return emitted.numero;
    const { data, error: err } = await supabase.rpc("emitir_planilla_correlativa", {
      p_direccion_id: direction,
      p_gestion: Number(gestion),
      p_fecha: fecha,
      p_descripcion: description,
      p_viajes: chosen,
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
          <Field label="N.º de documento (correlativo)">
            <Input readOnly value={currentNumber || nextNumber} title="Número estimado hasta confirmar la primera descarga" />
          </Field>
          <Field label="Fecha de emisión">
            <Input type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
          </Field>
        </div>
        <div className="mt-3">
          <Field label="Descripción">
            <Textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="La presente planilla corresponde..." />
          </Field>
        </div>
        <div className="mt-3">
          <TripPicker trips={trips} chosen={chosen} onChange={setChosen} />
        </div>
        <p className="mt-3 text-xs text-slate-500">
          El número mostrado es provisional hasta confirmar la primera exportación o impresión.
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
