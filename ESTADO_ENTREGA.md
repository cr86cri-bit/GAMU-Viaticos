# Estado de esta entrega

**Entregado:** código fuente completo de una primera versión modular y ejecutable tras configurar Supabase, dependencias y usuario administrador. Incluye autenticación, CRUD de funcionarios/cargos/categorías/destinos/tarifas/presupuestos, viajes, días, cálculos del servidor, pantalla de planillas, impresión en PDF desde navegador, exportación Excel, dashboard y reportes básicos.

**No implementado aún:** cálculo fiscal oficial del RC-IVA, workflow de aprobación completo, comprobantes adjuntos con Storage, conciliación automática de presupuestos, auditoría exhaustiva, edición avanzada de días, plantillas oficiales homologadas y capacidades offline. Los datos de tarifas NO vienen precargados.

**Pruebas:** se verificó sintaxis de los archivos TypeScript/TSX mediante el parser de TypeScript. No se ejecutó `next build` porque la instalación de dependencias no se pudo completar en este entorno. Debe verificarse localmente con `npm install && npm run typecheck && npm run build`.

**Uso:** prototipo funcional para desarrollo y validación; no usar para pagos oficiales sin revisión de fórmulas, seguridad y reglamentos.
