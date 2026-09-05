export const SITE = {
  name: 'x4 match',
  tagline: 'Pádel competitivo, partidos reales.',
  description:
    'Encontrá partidos, subí de nivel y gestioná tu club. Jugadores gratis. Clubes con trial de 90 días.',
  url: 'https://x4match.com',
  emails: {
    hola: 'hola@x4match.com',
    legal: 'legal@x4match.com',
    clubes: 'clubes@x4match.com',
  },
  company: {
    legalName: 'x4 match S.A.S.',
    cuit: '[CUIT pendiente]',
    address: 'Ciudad Autónoma de Buenos Aires, Argentina',
    note: 'SAS en constitución / alta AFIP. Hasta entonces puede operar un responsable fiscal puente (documentado).',
  },
  links: {
    clubPanel: process.env.NEXT_PUBLIC_CLUB_URL || 'http://localhost:3001',
    appStore: '#',
    playStore: '#',
  },
} as const;

export const CLUB_PLANS = [
  {
    name: 'Pilot',
    price: '$0',
    period: '90 días',
    badge: 'Free Plan',
    description: 'Período de prueba para clubes nuevos.',
    features: [
      'Hasta 6 canchas',
      '2 usuarios gerente',
      'Matchmaking y turnos',
      'Mercado Pago del club',
      'Hasta 2 torneos activos',
      'Tienda y ranking',
    ],
    highlighted: false,
  },
  {
    name: 'Club',
    price: '$49.900',
    period: '+ IVA / mes',
    badge: 'Más elegido',
    description: 'Todo lo necesario para operar tu sede.',
    features: [
      'Hasta 6 canchas',
      '3 usuarios gerente',
      'Hasta 5 torneos activos',
      'Tienda, ranking y clientes',
      'Promos x1.5 en horarios',
      'Soporte por email y WhatsApp',
      'Sin comisión por reserva',
    ],
    highlighted: true,
  },
  {
    name: 'Club Pro',
    price: 'Próximamente',
    period: '',
    badge: 'Próximamente',
    description: 'Multi-sede y analytics avanzados.',
    features: [
      'Canchas ilimitadas',
      'Usuarios gerente ilimitados',
      'Torneos ilimitados',
      'Circuitos y multi-sede',
      'Export CSV',
      'Promos x2',
      'Soporte prioritario',
    ],
    highlighted: false,
  },
] as const;
