// Catálogo de servicios y cupos de agenda (compartido por el portal).
const SERVICIOS = [
  'Cambio de aceite y filtros',
  'Revisión completa',
  'Cambio de pastillas de freno',
  'Kit de transmisión (cadena y piñones)',
  'Diagnóstico electrónico',
  'Cambio de neumáticos',
];

// Horas agendables: de 8:00 a 16:00, una por hora.
const HORAS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];

// Máximo de citas por franja horaria.
const MAX_POR_HORA = 2;

module.exports = { SERVICIOS, HORAS, MAX_POR_HORA };
