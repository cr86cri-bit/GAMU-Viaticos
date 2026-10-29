export function friendlyError(input: unknown): string {
  const error = input as { code?: string; message?: string } | null;
  const code = error?.code || '';
  const raw = typeof input === 'string' ? input : error?.message || 'No se pudo completar la operación.';
  const m = raw.toLowerCase();
  if (code === '23505' || m.includes('duplicate key')) {
    if (m.includes('viaje_dias') || m.includes('viaje_id_fecha')) return 'Este día ya está registrado en el viaje. Selecciona otra fecha o modifica el registro existente.';
    if (m.includes('funcionarios_ci')) return 'Ya existe un funcionario registrado con ese carnet de identidad.';
    return 'Ya existe un registro con esos datos. Comprueba la información antes de guardar.';
  }
  if (code === '23503' || m.includes('foreign key')) return 'No se puede eliminar o cambiar este registro porque tiene información relacionada.';
  if (code === '23502' || m.includes('null value in column')) return 'Completa todos los campos obligatorios para continuar.';
  if (code === '42501' || m.includes('permission denied') || m.includes('row-level security')) return 'No tienes permisos para realizar esta operación. Solicita acceso al administrador.';
  if (m.includes('exactamente una tarifa') || m.includes('tarifa vigente')) return 'No existe una tarifa vigente válida para la categoría, el destino y la fecha elegidos. Revisa la configuración de tarifas.';
  if (m.includes('fecha fuera del rango')) return 'La fecha seleccionada debe estar dentro del período del viaje.';
  if (m.includes('viaje bloqueado') || m.includes('viajes en borrador')) return 'Este viaje ya no está en borrador y no permite cambios.';
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('fetch failed')) return 'No se pudo conectar al servidor. Revisa tu conexión a internet e inténtalo nuevamente.';
  if (m.includes('jwt expired') || m.includes('session')) return 'Tu sesión ha caducado. Inicia sesión de nuevo.';
  return raw.length > 180 ? 'No se pudo completar la operación. Revisa los datos o contacta con el administrador.' : raw;
}
