// MAQUETA de la pantalla de ticket (base de diseño: diseñoOdoo.md). Datos de ejemplo: nada de esto sale de la API ni de Odoo.
// Cuando exista el endpoint (ticket + tarea + subtareas + hojas + notas), estos tipos se reemplazan por los del modelo real.

export type EtapaTicket = 'Sin categorizar' | 'En curso' | 'Coordinado' | 'Resuelto';

export const ETAPAS_TICKET: EtapaTicket[] = ['Sin categorizar', 'En curso', 'Coordinado', 'Resuelto'];

export type EstadoHoja = 'sin_hoja' | 'borrador_pre' | 'pendiente_post' | 'completo';

export type RolCambioUnidad = 'origen' | 'destino';

export type Subtarea = {
  id: number;
  patente: string; // nombre de la subtarea = la unidad
  etapa: 'Nuevo' | 'Coordinado' | 'En curso' | 'Hecho';
  tecnico: string | null;
  planeada: string | null; // planned_date_begin, ya en hora local de texto
  limite: string | null; // date_deadline
  producto: string | null; // línea de venta (producto de la unidad)
  hoja: { estado: EstadoHoja; codigo?: string };
  rol?: RolCambioUnidad; // solo en tareas de cambio de unidad
  parejaId?: number; // id de la subtarea del otro lado del cambio de unidad
};

export type TareaPadre = {
  id: number;
  nombre: string;
  etapa: 'Nuevo' | 'Coordinado' | 'En curso' | 'Hecho';
  planeada: string | null;
  limite: string | null;
  etiquetas: string[];
  esCambioUnidad: boolean;
  subtareas: Subtarea[];
};

export type LineaCotizacion = { codigo: string; producto: string; cantidad: number; precio: number };

export type Nota = { id: number; autor: string; area: string; fecha: string; texto: string; tipo: 'interna' | 'cliente' };

export type Ticket = {
  id: number;
  titulo: string;
  cliente: string;
  telefono: string;
  responsable: string;
  etapa: EtapaTicket;
  planeada: string;
  limite: string;
  tareas: TareaPadre[];
  cotizacion: { numero: string; validez: string; lineas: LineaCotizacion[] } | null;
  notas: Nota[];
};

export const TICKETS: Ticket[] = [
  {
    id: 39088,
    titulo: 'CAMBIO DE UNIDAD PRUEBA 12',
    cliente: 'Distribuidora de Electricidad del Este S.A.',
    telefono: '+54 11 5555-0142',
    responsable: 'Coordinación',
    etapa: 'En curso',
    planeada: '15/10 11:00',
    limite: '16/10 12:00',
    tareas: [
      {
        id: 21062,
        nombre: 'CAMBIO DE UNIDAD PRUEBA 12',
        etapa: 'En curso',
        planeada: '15/10 11:00',
        limite: '16/10 12:00',
        etiquetas: ['cambio de unidad'],
        esCambioUnidad: true,
        subtareas: [
          {
            id: 21063,
            patente: 'IOS 192',
            etapa: 'Hecho',
            tecnico: 'Joaquín Sangiorgio',
            planeada: null,
            limite: null,
            producto: 'DES.103 Desinstalación de GPS',
            hoja: { estado: 'completo', codigo: 'CONF-20261015-1A2B3C4D' },
            rol: 'origen',
            parejaId: 21064,
          },
          {
            id: 21064,
            patente: 'AF 098 HX',
            etapa: 'Coordinado',
            tecnico: 'Joaquín Sangiorgio',
            planeada: '16/10 09:00',
            limite: '16/10 10:00',
            producto: 'INS.001 Instalación GPS',
            hoja: { estado: 'sin_hoja' },
            rol: 'destino',
            parejaId: 21063,
          },
        ],
      },
    ],
    cotizacion: {
      numero: 'S00412',
      validez: '30/10/2026',
      lineas: [
        { codigo: 'DES.103', producto: 'Desinstalación de GPS', cantidad: 1, precio: 18000 },
        { codigo: 'INS.001', producto: 'Instalación GPS', cantidad: 1, precio: 45000 },
        { codigo: 'CAM.001', producto: 'Cambio de unidad (baja y alta en 48hs)', cantidad: 1, precio: 12000 },
      ],
    },
    notas: [
      {
        id: 1,
        autor: 'Mesa de ayuda',
        area: 'Mesa de ayuda',
        fecha: '15/10 10:22',
        tipo: 'interna',
        texto: 'El cliente pide pasar el equipo de IOS 192 a la camioneta nueva AF 098 HX. Recordar: el equipo viejo va al laboratorio y en la nueva se instala uno nuevo.',
      },
      {
        id: 2,
        autor: 'Coordinación',
        area: 'Coordinación',
        fecha: '15/10 12:40',
        tipo: 'interna',
        texto: 'Origen hecho hoy. La instalación en destino queda para mañana 09:00, mismo técnico.',
      },
    ],
  },
  {
    id: 39522,
    titulo: 'Retiro de 3 equipos en base del cliente',
    cliente: 'Transportes del Sur S.R.L.',
    telefono: '+54 351 555-0188',
    responsable: 'Coordinación',
    etapa: 'Coordinado',
    planeada: '17/10 14:00',
    limite: '17/10 18:00',
    tareas: [
      {
        id: 21815,
        nombre: 'Servicio externo (WARA)',
        etapa: 'Coordinado',
        planeada: '17/10 14:00',
        limite: '17/10 18:00',
        etiquetas: ['RETIRO DE EQUIPOS'],
        esCambioUnidad: false,
        subtareas: [
          { id: 21816, patente: 'AD 880 CC', etapa: 'Coordinado', tecnico: 'Renzo González', planeada: null, limite: null, producto: 'DES.001 Desinstalación equipo GPS', hoja: { estado: 'sin_hoja' } },
          { id: 21817, patente: 'AE 410 PL', etapa: 'Coordinado', tecnico: 'Renzo González', planeada: null, limite: null, producto: 'DES.001 Desinstalación equipo GPS', hoja: { estado: 'borrador_pre' } },
          { id: 21818, patente: 'AF 233 KN', etapa: 'Nuevo', tecnico: null, planeada: null, limite: null, producto: 'DES.001 Desinstalación equipo GPS', hoja: { estado: 'sin_hoja' } },
        ],
      },
    ],
    cotizacion: null,
    notas: [
      {
        id: 3,
        autor: 'Coordinación',
        area: 'Coordinación',
        fecha: '14/10 16:05',
        tipo: 'interna',
        texto: 'Coordinado con el encargado de la base. Hay que llevar el acta de retiro.',
      },
    ],
  },
];
