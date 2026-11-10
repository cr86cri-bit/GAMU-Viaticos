import { Suspense } from "react";
import { Payroll } from "@/components/payroll";
export default function Page() {
  return <Suspense fallback={<p>Cargando planillas emitidas...</p>}><Payroll mode="issued" /></Suspense>;
}
