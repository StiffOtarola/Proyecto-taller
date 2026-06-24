// Configuración del taller (fila única en la tabla `configuracion`).
// Centraliza datos del negocio, horarios de atención, capacidad de la agenda y
// preferencias de notificación. El portal lee de aquí los cupos/horas agendables.
const { pool } = require('../db/pool');

// Valores por defecto: idénticos a los antes hardcodeados (utils/servicios.js),
// así el comportamiento inicial no cambia aunque la fila aún no exista.
const DEFAULTS = {
  nombre_taller: 'MS Motos',
  telefono: '',
  email: '',
  direccion: '',
  logo: null,
  max_citas_hora: 2,
  dias_anticipacion: 30,
  duracion_cita_min: 90,
  // Horas mínimas de anticipación para que el cliente cancele/reprograme (0 = sin límite).
  cancelacion_horas_min: 2,
  // 0=Domingo … 6=Sábado.
  horarios: [
    { dia: 0, abre: '08:00', cierra: '13:00', activo: 0 },
    { dia: 1, abre: '08:00', cierra: '17:00', activo: 1 },
    { dia: 2, abre: '08:00', cierra: '17:00', activo: 1 },
    { dia: 3, abre: '08:00', cierra: '17:00', activo: 1 },
    { dia: 4, abre: '08:00', cierra: '17:00', activo: 1 },
    { dia: 5, abre: '08:00', cierra: '17:00', activo: 1 },
    { dia: 6, abre: '08:00', cierra: '13:00', activo: 1 },
  ],
  notif_estado: 1,
  notif_recordatorio: 1,
  notif_cotizacion: 1,
  notif_email_entrega: 0,
  visitas_para_cortesia: 7,
  zona_horaria_offset: -6,
};

// Caché en memoria: /disponibilidad del portal pega seguido; evita leer la BD
// en cada request. Se invalida al guardar (clearCache) y por TTL como respaldo.
let cache = null;
let cacheAt = 0;
const TTL_MS = 30 * 1000;

async function getConfig() {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  let row = {};
  try {
    const [[r]] = await pool.query('SELECT * FROM configuracion WHERE id = 1');
    if (r) row = r;
  } catch (_) {
    // Tabla aún no migrada / sin fila: se usan los DEFAULTS.
  }
  // horarios puede venir parseado (mysql2 → array), como string JSON, o null.
  let horarios = row.horarios;
  if (typeof horarios === 'string') {
    try { horarios = JSON.parse(horarios); } catch { horarios = null; }
  }
  const config = {
    ...DEFAULTS,
    ...row,
    horarios: Array.isArray(horarios) && horarios.length ? horarios : DEFAULTS.horarios,
  };
  cache = config;
  cacheAt = Date.now();
  return config;
}

function clearCache() {
  cache = null;
  cacheAt = 0;
}

// Día de semana (0=Dom … 6=Sáb) de una fecha 'YYYY-MM-DD', estable ante la zona
// horaria del servidor (se ancla al mediodía UTC para no cruzar de día).
function diaSemana(fecha) {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

// Slots por hora disponibles para una fecha, según los horarios configurados.
// Devuelve un array tipo ['08:00','09:00',...]; vacío si ese día está cerrado.
function horasDisponibles(fecha, config) {
  const dow = diaSemana(fecha);
  const h = (config.horarios || []).find((x) => Number(x.dia) === dow);
  if (!h || !Number(h.activo)) return [];
  const abreH = parseInt(String(h.abre).slice(0, 2), 10);
  const cierraH = parseInt(String(h.cierra).slice(0, 2), 10);
  const horas = [];
  for (let x = abreH; x < cierraH; x++) horas.push(`${String(x).padStart(2, '0')}:00`);
  return horas;
}

module.exports = { getConfig, clearCache, horasDisponibles, DEFAULTS };
