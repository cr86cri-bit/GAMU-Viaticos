# GAMU · Sistema de Pasajes y Viáticos

Proyecto web **Next.js App Router + TypeScript + Tailwind CSS 4 + Supabase**, adaptable a iPhone, Android y escritorio. Uso institucional.

## Configuración desde cero

1. Instalar Node.js LTS reciente y ejecutar `npm install` (se genera `package-lock.json`, conservarlo en Git).
2. Se usa el proyecto Supabase existente **Viaticos** (`xsasnkxkharmwcabstiz`).
3. La migración inicial **ya está aplicada** al proyecto remoto. No volver a ejecutar el SQL inicial.
4. Crear manualmente el **primer usuario** en Supabase Authentication → Users.
5. Consultar el UUID de ese usuario y ejecutar en SQL Editor (solo administrador con acceso de consola):
   ```sql
   insert into public.perfiles(id,nombre,rol,activo)
   values ('UUID_DEL_USUARIO','Administrador','admin',true);
   ```
6. La URL y la clave pública ya están configuradas en `.env.local` y `.env.example`. Nunca colocar `service_role` o claves secretas en el frontend.
7. Ejecutar `npm run dev`, abrir `http://localhost:3000/login`.
8. Registrar categorías (1-4), cargos, destinos, funcionarios y **tarifas oficiales** (no incluidas). Registrar viajes y un día por fila. Emitir planilla con impresión del navegador (destino «Guardar como PDF») o Excel.
9. Para producción: HTTPS, dominio, política de contraseñas/MFA, copias de seguridad, pruebas de RLS, revisión de cálculos/tributos y homologación de plantilla antes de usar para pagos.

## Qué incluye

- Login con Supabase Auth y sesiones SSR.
- RLS para acceso por perfil `admin`, `operador` y `consulta`.
- CRUD de funcionarios, cargos, categorías, destinos, tarifas y presupuestos.
- Registro de viajes, detalle por día y liquidación calculada **en PostgreSQL** (trigger).
- Separación de factura/recibo en pasajes, retenciones ilustrativas 13% y 3% tomadas del formato facilitado, parametrización de porcentajes del viático.
- Planilla imprimible en horizontal desde navegador y exportación Excel.
- Dashboard, reportes básicos, navegación responsive y manifest PWA.

## Advertencias y decisiones pendientes

- **No usar para liquidaciones reales** hasta validar el reglamento de viáticos y las fórmulas oficiales con la entidad. En particular, el ejemplo tiene un valor negativo de RC-IVA; se incluyó `rciva_ajuste` **manual** (positivo o negativo), no un algoritmo fiscal inventado.
- El campo `rciva_ajuste` se captura sin documentación automática; validar y auditar su aprobación antes de producción.
- Las retenciones de pasajes con recibo se calculan usando los porcentajes del ejemplo (13% IUE y 3% IT) y requieren validación jurídica/tributaria.
- La impresión es una **reproducción estructural funcional**, no una copia pixel-perfect con escudo institucional. El PDF oficial debe homologarse con la oficina del GAMU.
- El panel de planillas permite combinar viajes para exportar, pero **no persiste** la selección como expediente aprobado. Ya existen tablas `planillas` y `planilla_viajes` para completar ese flujo.
- El presupuesto es CRUD inicial; faltan conciliación y vínculo automático de movimientos con aprobaciones, sin dobles cargos.
- Se creó un bucket privado para comprobantes, pero aún falta el módulo de adjuntos y sus reglas de Storage. No se concede acceso abierto al bucket.
- El reporte resume hasta 3000 filas: para volumen alto, implementar agregación SQL y paginación.
- Manifest PWA disponible; para funcionamiento sin internet falta service worker, caché y sincronización (no se promete offline).
- Antes de producción: protección de acciones por rol en frontend, inmutabilidad integral de viajes aprobados, auditoría con triggers, validación de solapamientos de tarifas, tests y cobertura de casos contables.

## Organización

- `src/app` páginas y rutas
- `src/components` layout, interfaz, tablas y formularios
- `src/lib/supabase` clientes SSR y navegador
- `src/lib/catalogs.ts` definiciones de CRUD reutilizables
- `supabase/migrations` esquema, reglas y RLS
- `public` manifest e icono

## Verificación local

```bash
npm install
npm run typecheck
npm run build
npm run dev
```

Los datos reales y el proyecto de Supabase deben ser proporcionados/configurados por el responsable institucional. El código es una **base funcional avanzada**, no una implantación certificada de producción.
