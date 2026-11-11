"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FileDown, FileSpreadsheet, Printer, RefreshCw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyError } from "@/lib/error-messages";
import { exportarPlanillaOficial, type FilaPlanilla } from "@/lib/export/planilla-oficial";
import { exportarPlanillaVisualPDF } from "@/lib/export/planilla-pdf-visual";
import { Alert, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { PayrollPreviewModal, type PreviewInfo } from "@/components/payroll-preview-modal";
import { TripPicker } from "@/components/trip-picker";
import { IssuedPayrolls, type Documento } from "@/components/issued-payrolls";
import { EditIssuedPayroll, type EdicionPlanilla } from "@/components/edit-issued-payroll";
import { crearFilasPlanilla, descripcionViajes } from "@/lib/payroll-data";

type Row = { id: string; [key: string]: any };
type PlanillaVinculo = { planilla_id: string; viaje_id: string };
type ExportMode = "pdf" | "excel" | "print";
type Emission = { id: string; numero: string; key: string };

const todayLocal = () => {
  const today = new Date();
  const offset = today.getTimezoneOffset() * 60000;
  return new Date(today.getTime() - offset).toISOString().slice(0, 10);
};

export function Payroll({ mode = "create" }: { mode?: "create" | "issued" }) {
  const supabase = useMemo(() => createClient(), []);
  const params = useSearchParams();
  const viajeParam = params.get("viaje");

  const [trips, setTrips] = useState<Row[]>([]);
  const [allTrips, setAllTrips] = useState<Row[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [hotelDocs, setHotelDocs] = useState<Row[]>([]);
  const [directions, setDirections] = useState<Row[]>([]);
  const [issued, setIssued] = useState<Documento[]>([]);
  const [links, setLinks] = useState<PlanillaVinculo[]>([]);
  const [historyPreview, setHistoryPreview] = useState<PreviewInfo | null>(null);
  const [editIssued, setEditIssued] = useState<EdicionPlanilla | null>(null);
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

  const refreshIssued = useCallback(async () => {
    const {data: docs, error: err} = await supabase.from('planillas')
      .select('*,direcciones(siglas,nombre,color)').order('created_at', {ascending:false});
    if(err) {setError(friendlyError(err));return;}
    const {data: refs,error: refsError}=await supabase.from('planilla_viajes').select('planilla_id,viaje_id');
    if(refsError) {setError(friendlyError(refsError));return;}
    setIssued(docs??[]);
    setLinks(refs??[]);
  }, [supabase]);
  useEffect(()=>{void refreshIssued()},[refreshIssued]);
  const assigned = useMemo(()=>{
    const result:Record<string,string[]>={};
    const byId=new Map(issued.map(p=>[p.id,p]));
    for(const link of links){const p=byId.get(link.planilla_id);if(!p)continue;
      (result[link.viaje_id]??=[]).push(`${p.direcciones?.siglas??'DOC'} N.º ${p.nro_daf}/${p.gestion}`);
    }
    return result;
  },[issued,links]);

  async function buildIssuedPreview(p:any):Promise<PreviewInfo> {
    if(p.snapshot?.filas?.length && p.snapshot?.gestion && p.snapshot?.daf){
      return p.snapshot as PreviewInfo;
    }
    const ids=links.filter(l=>l.planilla_id===p.id).map(l=>l.viaje_id);
    if(!ids.length)throw new Error('La planilla no tiene viajes vinculados.');
    const {data: dias,error: errD}=await supabase.from('viaje_dias').select('*').in('viaje_id',ids).order('fecha');
    if(errD)throw errD;
    if(!dias?.length)throw new Error('Los viajes vinculados no tienen detalle diario.');
    const {data: docs,error:errC}=await supabase.from('comprobantes').select('*').eq('tipo','hospedaje').in('viaje_dia_id',dias.map(d=>d.id));
    if(errC)throw errC;
    const selected=allTrips.filter(t=>ids.includes(t.id));
    if(selected.length!==ids.length)throw new Error('No se encuentran todos los viajes de la planilla.');
    const dir=directions.find(d=>d.id===p.direccion_id);
    return {gestion:String(p.gestion),daf:String(p.nro_daf),fecha:p.fecha,
      descripcion:p.descripcion||descripcionViajes(selected),siglas:dir?.siglas??p.direcciones?.siglas??'GAMU',
      color:dir?.color??p.direcciones?.color??'#CCD0CF',filas:crearFilasPlanilla(selected,dias,docs??[])};
  }
  async function prepareHistory(p:any, mode:ExportMode) {
    setBusy(true);setError('');
    try{const info=await buildIssuedPreview(p);setHistoryPreview(info);setPreview(mode);}
    catch(e){setError(friendlyError(e));}finally{setBusy(false)}
  }
  async function startHistoricalEdit(p:any) {
    setError('');
    const ids=links.filter(l=>l.planilla_id===p.id).map(l=>l.viaje_id);
    setEditIssued({id:p.id,direccion_id:p.direccion_id,gestion:String(p.gestion),numero:String(p.nro_daf),fecha:p.fecha,viajes:ids});
  }
  async function saveHistoricalEdit(ed:EdicionPlanilla) {
    if(!ed.direccion_id || !/^\d{4}$/.test(ed.gestion) || !/^[1-9]\d{0,8}$/.test(ed.numero) || !ed.fecha || !ed.viajes.length){setError('Completa todos los campos y selecciona viajes válidos.');return;}
    setBusy(true);setError('');
    try {
      const data=allTrips.filter(t=>ed.viajes.includes(t.id));
      const {error:err}=await supabase.rpc('editar_planilla_emitida',{
        p_planilla:ed.id,p_direccion_id:ed.direccion_id,p_gestion:Number(ed.gestion),
        p_numero:ed.numero,p_fecha:ed.fecha,p_viajes:ed.viajes,p_descripcion:descripcionViajes(data),
      });
      if(err)throw err;
      setEditIssued(null);
      await refreshIssued();
    }catch(e){setError(friendlyError(e));}
    finally{setBusy(false)}
  }

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
  const exportRows: FilaPlanilla[] = useMemo(() => crearFilasPlanilla(trips,rows,hotelDocs),[trips,rows,hotelDocs]);

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
    const snapshot = {...previewInfo,daf:numero};
    const {error: snapshotError}=await supabase.from('planillas').update({snapshot}).eq('id',result.planilla_id);
    if(snapshotError)throw new Error('El documento se emitió, pero no se pudo guardar su copia histórica. Recarga el historial antes de reintentar: '+friendlyError(snapshotError));
    await refreshIssued();
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
      const numero = historyPreview?.daf ?? await ensureEmitted();
      const fileInfo = historyPreview ?? { ...previewInfo, daf: numero };
      const blob = preview === "excel"
        ? await exportarPlanillaOficial(fileInfo)
        : await exportarPlanillaVisualPDF(fileInfo.daf);
      if (preview === "print") {
        const url = URL.createObjectURL(blob);
        printWindow!.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 120000);
      } else {
        downloadBlob(blob, `planilla-${fileInfo.siglas || "GAMU"}-${fileInfo.gestion}-${numero}.${preview === "pdf" ? "pdf" : "xlsx"}`);
      }
      setPreview(null);setHistoryPreview(null);
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
      {mode === "create" && <><PageHeader
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
          <TripPicker trips={trips} chosen={chosen} onChange={setChosen} planillasPorViaje={assigned} />
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

      </>}
      {mode === "issued" && <>
        <PageHeader title="Planillas emitidas" description="Consulta, visualiza, edita, descarga o reimprime documentos registrados" />
        {error && !preview && <Alert error>{error}</Alert>}
        <IssuedPayrolls documentos={issued} busy={busy} onView={p=>{void prepareHistory(p,'pdf')}} onEdit={p=>{void startHistoricalEdit(p)}} onPdf={p=>{void prepareHistory(p,'pdf')}} onPrint={p=>{void prepareHistory(p,'print')}} />
      </>}
      {editIssued && <EditIssuedPayroll key={editIssued.id} base={editIssued} directions={directions} trips={trips} busy={busy} onCancel={()=>{if(!busy)setEditIssued(null)}} onSave={saveHistoricalEdit}/>}
      {preview && (
        <PayrollPreviewModal
          type={preview}
          info={historyPreview ?? previewInfo}
          busy={busy}
          error={error}
          onClose={() => { if (!busy) {setPreview(null);setHistoryPreview(null);} }}
          onDownload={confirmDownload}
        />
      )}
    </>
  );
}
