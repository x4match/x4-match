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
    description: 'Período de prueba para clubes nuevos.',
    features: ['Hasta 6 canchas', '2 usuarios gerente', 'Matchmaking y turnos', 'Mercado Pago del club'],
    highlighted: false,
  },
  {
    name: 'Club',
    price: '$49.900',
    period: '+ IVA / mes',
    description: 'Todo lo necesario para operar tu sede.',
    features: [
      'Hasta 6 canchas',
      '3 usuarios gerente',
      'Torneos y tienda',
      'Ranking y clientes',
      'Soporte por email y WhatsApp',
    ],
    highlighted: true,
  },
  {
    name: 'Club Pro',
    price: 'Próximamente',
    period: '',
    description: 'Multi-sede y analytics avanzados.',
    features: ['Canchas ilimitadas', 'Circuitos', 'Export CSV', 'Soporte prioritario'],
    highlighted: false,
  },
] as const;
