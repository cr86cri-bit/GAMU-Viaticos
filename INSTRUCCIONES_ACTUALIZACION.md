# Actualización de Planillas (PDF, literal y porcentajes)

Cambios en `src/components/payroll.tsx`, `src/lib/export/planilla-oficial.ts`, más los nuevos `src/lib/export/planilla-pdf.ts` y `src/lib/export/monto-literal.ts`. Agregados `jspdf` y `jspdf-autotable` a package.json.

1. Copiar el código conservando `.env.local`.
2. Ejecutar `npm install` para instalar las nuevas dependencias.
3. Ejecutar `npm run dev`.
4. En Planillas, seleccionar viajes y descargar PDF o Excel.

El monto literal refleja el total líquido pagable (redondeado a centavos) y el porcentaje aparece en la descripción de cada día, manteniendo las 18 columnas oficiales. Los PDF son A3 horizontal. No se modificó la base de datos ni los cálculos aprobados.

**Pendiente de verificación:** la instalación de paquetes expiró en el entorno de preparación, por lo que se debe validar `npm run typecheck` y `npm run build` al instalar localmente. El PDF se construye con jsPDF y conserva la estructura del documento, pero la coincidencia pixel a pixel con el Excel no está garantizada.
