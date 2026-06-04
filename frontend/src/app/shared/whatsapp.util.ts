// Utilidad para notificar al cliente por WhatsApp (click-to-send, sin API ni costo).
// Arma un mensaje según la etapa de la orden y abre wa.me con el teléfono del cliente.

export interface WaContexto {
  nombre: string;
  marca?: string;
  modelo?: string;
  numero_orden?: string;
  total?: number;
  portalLink?: string;
}

export interface WaMensaje {
  key: string;
  label: string;
  build: (c: WaContexto) => string;
}

const moto = (c: WaContexto) => `${c.marca || ''} ${c.modelo || ''}`.trim();
const colones = (n?: number) => `₡${(n || 0).toLocaleString('es-CR')}`;

export const WA_MENSAJES: WaMensaje[] = [
  {
    key: 'recibida',
    label: 'Moto recibida',
    build: c => `Hola ${c.nombre}, recibimos tu ${moto(c)} en el taller (orden ${c.numero_orden}). Te iremos avisando del avance. ¡Gracias!`,
  },
  {
    key: 'diagnostico',
    label: 'Diagnóstico listo',
    build: c => `Hola ${c.nombre}, ya revisamos tu ${moto(c)} y tenemos el diagnóstico. En breve te enviamos el presupuesto para tu aprobación.`,
  },
  {
    key: 'aprobacion',
    label: 'Presupuesto para aprobar',
    build: c => `Hola ${c.nombre}, el presupuesto de tu ${moto(c)} está listo${c.total ? ` (total ${colones(c.total)})` : ''}. Podés revisarlo y aprobarlo desde el portal: ${c.portalLink || ''}`,
  },
  {
    key: 'repuestos',
    label: 'Esperando repuestos',
    build: c => `Hola ${c.nombre}, estamos a la espera de repuestos para tu ${moto(c)}. Apenas lleguen, continuamos con la reparación y te avisamos.`,
  },
  {
    key: 'reparacion',
    label: 'En reparación',
    build: c => `Hola ${c.nombre}, ya estamos trabajando en la reparación de tu ${moto(c)}. Te avisamos cuando esté lista.`,
  },
  {
    key: 'lista',
    label: 'Lista para entrega',
    build: c => `Hola ${c.nombre}, ¡buenas noticias! Tu ${moto(c)} ya está lista para retirar (orden ${c.numero_orden}). Te esperamos en el taller. 🎉`,
  },
  {
    key: 'entregada',
    label: 'Entrega / factura',
    build: c => `Hola ${c.nombre}, gracias por confiar en nosotros. La factura de tu ${moto(c)}${c.total ? ` por ${colones(c.total)}` : ''} está lista. ¡Que disfrutes tu moto!`,
  },
];

// Mensaje sugerido según el estado actual de la orden.
const ESTADO_A_MENSAJE: Record<string, string> = {
  recepcion: 'recibida',
  diagnostico: 'diagnostico',
  esperando_aprobacion: 'aprobacion',
  esperando_repuestos: 'repuestos',
  en_reparacion: 'reparacion',
  lista_entrega: 'lista',
  entregada: 'entregada',
};

export function mensajeSugerido(estado?: string): string {
  return (estado && ESTADO_A_MENSAJE[estado]) || 'recibida';
}

export function abrirWhatsApp(telefono: string, mensaje: string) {
  const tel = (telefono || '').replace(/\D/g, '');
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(mensaje)}`, '_blank');
}
