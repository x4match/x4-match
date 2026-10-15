import type { LegalDocument } from '@/lib/legal-types';

const updated = '15 de octubre de 2026';

export const termsPlayers: LegalDocument = {
  slug: 'terminos',
  title: 'Términos y Condiciones — Jugadores',
  updated,
  summary:
    'Reglas de uso de la app x4 match para jugadores. La plataforma conecta personas y clubes; no organiza partidos ni custodia pagos.',
  sections: [
    {
      title: '1. Identificación',
      paragraphs: [
        `${'x4 match'} (en adelante, la "Plataforma") es un servicio tecnológico operado por x4 match S.A.S. (o la sociedad / persona humana que figure como responsable fiscal mientras se completa la constitución societaria), con domicilio en Ciudad Autónoma de Buenos Aires, Argentina. CUIT: pendiente de publicación. Contacto: legal@x4match.com.`,
        'Al registrarte o usar la app, aceptás estos Términos y Condiciones en su totalidad.',
      ],
    },
    {
      title: '2. Naturaleza del servicio',
      paragraphs: [
        'x4 match es una plataforma tecnológica que facilita el encuentro entre jugadores de pádel, la publicación de partidos abiertos, rankings y la reserva de turnos en clubes adheridos.',
        'x4 match no es un club deportivo, no organiza partidos en nombre propio ni garantiza la disponibilidad de canchas. El contrato de juego y de reserva es entre vos y el club.',
      ],
    },
    {
      title: '3. Registro y elegibilidad',
      paragraphs: [
        'Debés proporcionar información veraz y mantenerla actualizada. Sos responsable de la confidencialidad de tu cuenta.',
        'La edad mínima para usar la Plataforma es 16 años. Si tenés entre 16 y 18 años, declarás contar con autorización de tu madre, padre o tutor.',
        'Está prohibido crear múltiples cuentas para manipular rankings, resultados o matchmaking.',
      ],
    },
    {
      title: '4. Pagos y reembolsos',
      paragraphs: [
        'Los pagos de turnos, inscripciones o productos del club se procesan a través de Mercado Pago u otros medios configurados por cada club. El precio lo fija el club.',
        'Cada jugador puede pagar su parte del turno o uno solo puede pagarlo completo. La reserva de la cancha queda confirmada cuando el turno está pago en su totalidad.',
        'Los pagos online se acreditan directamente en la cuenta de Mercado Pago del club. x4 match puede percibir del club una comisión sobre esos cobros; esa comisión no se suma al precio que pagás.',
        'x4 match no custodia los fondos de los jugadores. Reclamos por cobros, cancelaciones o reembolsos deben dirigirse al club correspondiente según su política.',
        'El uso de la app para jugadores es gratuito. Podemos ofrecer funciones premium en el futuro con aviso previo.',
      ],
    },
    {
      title: '5. Conducta del usuario',
      paragraphs: [
        'Te comprometés a un trato respetuoso con otros jugadores y con el personal de los clubes.',
        'Queda prohibido: acoso, discriminación, publicar resultados falsos, fraude en pagos, uso automatizado no autorizado o cualquier actividad que perjudique la comunidad.',
        'x4 match puede advertir, suspender o eliminar cuentas ante incumplimientos, sin perjuicio de acciones legales.',
      ],
    },
    {
      title: '6. Rankings y datos deportivos',
      paragraphs: [
        'Tu nivel, historial de partidos y estadísticas pueden mostrarse a otros usuarios y clubes para matchmaking y rankings.',
        'Los resultados cargados deben reflejar partidos reales. El sistema puede aplicar revisiones o sanciones ante disputas reiteradas.',
      ],
    },
    {
      title: '7. Propiedad intelectual',
      paragraphs: [
        'La marca, software, diseño y contenidos de x4 match son propiedad de la sociedad operadora o sus licenciantes.',
        'No podés copiar, descompilar ni explotar comercialmente la Plataforma sin autorización escrita.',
      ],
    },
    {
      title: '8. Limitación de responsabilidad',
      paragraphs: [
        'La Plataforma se ofrece "tal cual". No garantizamos disponibilidad ininterrumpida ni ausencia de errores.',
        'x4 match no responde por lesiones, daños o conflictos derivados de partidos, reservas o relaciones con clubes u otros jugadores, salvo disposición legal imperativa en contrario.',
      ],
    },
    {
      title: '9. Modificaciones y terminación',
      paragraphs: [
        'Podemos actualizar estos términos. Te notificaremos por la app o por email ante cambios relevantes.',
        'Podés dejar de usar la Plataforma en cualquier momento. Podemos suspender el servicio ante incumplimiento grave.',
      ],
    },
    {
      title: '10. Ley aplicable y jurisdicción',
      paragraphs: [
        'Estos términos se rigen por las leyes de la República Argentina.',
        'Para cualquier controversia, las partes se someten a los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, con renuncia a cualquier otro fuero.',
      ],
    },
  ],
};

export const termsClubs: LegalDocument = {
  slug: 'terminos-clubes',
  title: 'Términos y Condiciones — Clubes',
  updated,
  summary:
    'Contrato de uso de la plataforma entre x4 match y clubes o gestores deportivos. Modelo por comisión sobre cobros online, sin abono mensual.',
  sections: [
    {
      title: '1. Objeto',
      paragraphs: [
        'x4 match otorga al Club una licencia no exclusiva, revocable y limitada para usar el panel de gestión, publicación de turnos, torneos, tienda y herramientas asociadas ("Software").',
        'El Club actúa como responsable frente a sus jugadores por horarios, precios, cancelaciones y cumplimiento fiscal de sus ventas.',
      ],
    },
    {
      title: '2. Precio: comisión por cobro',
      paragraphs: [
        'El uso del Software no tiene abono mensual. Como contraprestación, x4 match percibe una comisión porcentual sobre cada cobro online que el Club procese a través de la Plataforma con Mercado Pago (por ejemplo, el pago de turnos).',
        'El porcentaje de comisión se acuerda con cada Club y se informa en el panel del Club, en la sección Pagos. Los cobros registrados manualmente (efectivo, transferencia o pago en recepción) no generan comisión.',
        'x4 match puede modificar el porcentaje con un aviso previo de 30 días. El nuevo porcentaje se aplica solo a los cobros posteriores a su entrada en vigencia. Si el Club no está de acuerdo, puede dar por terminado el contrato antes de esa fecha.',
        'x4 match no percibe comisión sobre los montos que se reembolsen al jugador.',
        'x4 match puede ofrecer condiciones promocionales, como una comisión reducida por un período determinado, que se informarán por escrito.',
      ],
    },
    {
      title: '3. Facturación de la comisión',
      paragraphs: [
        'Los importes se expresan en pesos argentinos. Cuando x4 match sea Responsable Inscripto, la comisión incluye o adiciona IVA según corresponda; en etapa de monotributo, la comisión es el importe final.',
        'x4 match emitirá al Club los comprobantes fiscales correspondientes a las comisiones percibidas en cada período.',
        'Si en el futuro se ofrecen planes con abono, se informarán con aviso previo y requerirán la aceptación expresa del Club. No se cobran planes mediante compras dentro de la aplicación iOS de la App Store.',
      ],
    },
    {
      title: '4. Mercado Pago y cobros a jugadores',
      paragraphs: [
        'El Club conecta su propia cuenta de Mercado Pago para cobrar turnos, inscripciones y ventas de tienda. Los fondos se acreditan directamente en la cuenta del Club.',
        'Al conectar su cuenta, el Club autoriza a que, en cada cobro online, Mercado Pago descuente la comisión de x4 match y la acredite en la cuenta de Mercado Pago de x4 match. El Club recibe el monto cobrado menos esa comisión y menos los cargos propios de Mercado Pago, que son a cargo del Club.',
        'Fuera de esa comisión, x4 match no custodia fondos de jugadores ni realiza pagos a terceros en nombre del Club.',
        'El Club es único responsable de facturar al jugador, cumplir normativa fiscal y atender reclamos de cobro.',
      ],
    },
    {
      title: '5. Datos y contenidos del Club',
      paragraphs: [
        'El Club garantiza tener derecho a publicar logos, fotos, precios y datos de contacto cargados en la Plataforma.',
        'Los datos de clientes generados en el Club son de titularidad del Club. x4 match actúa como encargado del tratamiento para prestar el servicio.',
        'Al finalizar la relación, el Club puede solicitar exportación de datos durante 30 días; luego se aplicará baja lógica según política de retención.',
      ],
    },
    {
      title: '6. Nivel de servicio',
      paragraphs: [
        'El Software se provee con esfuerzo comercial razonable ("best effort"). En fase beta o pilot no se garantiza uptime del 100%.',
        'Mantenimientos programados serán comunicados con antelación razonable cuando sea posible.',
      ],
    },
    {
      title: '7. Confidencialidad y propiedad intelectual',
      paragraphs: [
        'Cada parte mantendrá confidencial la información comercial no pública de la otra.',
        'x4 match retiene todos los derechos sobre el Software. El Club no adquiere propiedad sobre el código ni la marca.',
      ],
    },
    {
      title: '8. Limitación de responsabilidad',
      paragraphs: [
        'La responsabilidad total de x4 match frente al Club por cualquier concepto no excederá el monto de las comisiones percibidas por x4 match de ese Club en los últimos 12 meses.',
        'No respondemos por lucro cesante, pérdida de datos por causas ajenas a nuestra negligencia grave, ni por actos del Club frente a jugadores.',
      ],
    },
    {
      title: '9. Terminación',
      paragraphs: [
        'Cualquiera de las partes puede rescindir con un preaviso de 30 días. x4 match puede suspender de inmediato ante incumplimiento grave o uso fraudulento.',
        'Tras la terminación, cesan los derechos de uso del Software y se desconecta la integración con Mercado Pago. Las comisiones devengadas por cobros anteriores subsisten.',
      ],
    },
    {
      title: '10. Ley aplicable',
      paragraphs: [
        'Este acuerdo se rige por las leyes de la República Argentina. Jurisdicción: tribunales de la Ciudad Autónoma de Buenos Aires.',
        'Consultas comerciales: clubes@x4match.com · Consultas legales: legal@x4match.com.',
      ],
    },
  ],
};

export const privacyPolicy: LegalDocument = {
  slug: 'privacidad',
  title: 'Política de Privacidad',
  updated,
  summary: 'Cómo recopilamos, usamos y protegemos tus datos personales.',
  sections: [
    {
      title: '1. Responsable del tratamiento',
      paragraphs: [
        'El responsable del tratamiento de datos personales es x4 match S.A.S. (CUIT pendiente de publicación), o la persona humana/sociedad que opere la Plataforma durante la constitución societaria, con domicilio en Ciudad Autónoma de Buenos Aires, Argentina.',
        'Contacto para ejercer derechos: legal@x4match.com.',
      ],
    },
    {
      title: '2. Datos que recopilamos',
      paragraphs: [
        'Jugadores: nombre, email, teléfono, foto de perfil, nivel deportivo, historial de partidos, preferencias de juego y, si lo autorizás, ubicación aproximada para mostrar clubes y partidos cercanos.',
        'Clubes: razón social, CUIT, datos de contacto del gerente, información de canchas, horarios, precios e identificadores de integración con Mercado Pago (tokens cifrados, nunca en texto plano).',
        'Datos técnicos: dirección IP, tipo de dispositivo, logs de uso y cookies estrictamente necesarias o analíticas según tu consentimiento.',
      ],
    },
    {
      title: '3. Finalidades',
      paragraphs: [
        'Prestar el servicio de matchmaking, reservas, torneos, rankings y panel de club.',
        'Gestionar soporte, seguridad, prevención de fraude y mejora del producto.',
        'Enviar comunicaciones operativas y, con tu consentimiento, novedades comerciales.',
      ],
    },
    {
      title: '4. Base legal',
      paragraphs: [
        'Ejecución del contrato (cuenta y uso de la app), interés legítimo (seguridad y mejora del servicio) y consentimiento cuando la ley lo exija (marketing, cookies no esenciales, geolocalización).',
      ],
    },
    {
      title: '5. Compartición de datos',
      paragraphs: [
        'Compartimos datos con clubes donde reservás o jugás, para que puedan gestionar turnos y cobros.',
        'Utilizamos proveedores de infraestructura (hosting, email, analítica) que actúan como encargados del tratamiento bajo contrato.',
        'Los pagos entre jugador y club los procesa Mercado Pago en la cuenta del club; x4 match solo recibe la información necesaria para confirmar la reserva y calcular su comisión, y no accede a datos completos de tarjetas.',
      ],
    },
    {
      title: '6. Transferencias internacionales',
      paragraphs: [
        'Algunos proveedores pueden alojar datos fuera de Argentina (por ejemplo, Estados Unidos). Adoptamos cláusulas contractuales y medidas técnicas razonables para proteger tu información.',
      ],
    },
    {
      title: '7. Conservación',
      paragraphs: [
        'Conservamos los datos mientras tu cuenta esté activa y el tiempo adicional necesario para obligaciones legales, reclamos o auditoría.',
        'Podés solicitar la eliminación de tu cuenta; eliminaremos o anonimizaremos datos salvo retención legal obligatoria.',
      ],
    },
    {
      title: '8. Tus derechos',
      paragraphs: [
        'Tenés derecho de acceso, rectificación, actualización, supresión y oposición, conforme a la Ley 25.326 de Protección de Datos Personales.',
        'Para ejercerlos, escribinos a legal@x4match.com indicando tu email registrado. Responderemos en un plazo razonable.',
      ],
    },
    {
      title: '9. Menores',
      paragraphs: [
        'No recopilamos intencionalmente datos de menores de 16 años. Si detectamos una cuenta de menor sin autorización, podremos suspenderla y eliminar los datos.',
      ],
    },
    {
      title: '10. Seguridad',
      paragraphs: [
        'Aplicamos medidas técnicas y organizativas acordes al riesgo: cifrado en tránsito (HTTPS), control de acceso, y almacenamiento seguro de credenciales de integración.',
        'Ningún sistema es 100% seguro; te recomendamos usar contraseñas fuertes y no compartir tu cuenta.',
      ],
    },
  ],
};

export const cookiesPolicy: LegalDocument = {
  slug: 'cookies',
  title: 'Política de Cookies',
  updated,
  summary: 'Información sobre cookies y tecnologías similares en x4match.com.',
  sections: [
    {
      title: '1. ¿Qué son las cookies?',
      paragraphs: [
        'Las cookies son archivos pequeños que se guardan en tu dispositivo cuando visitás un sitio web. Nos ayudan a recordar preferencias y entender cómo se usa el sitio.',
      ],
    },
    {
      title: '2. Cookies que utilizamos',
      paragraphs: [
        'Estrictamente necesarias: sesión, seguridad y preferencias básicas. No requieren consentimiento.',
        'Analíticas (opcionales): nos permiten medir visitas y mejorar la landing. Solo se activan si aceptás el banner de cookies.',
      ],
    },
    {
      title: '3. Cómo gestionarlas',
      paragraphs: [
        'Podés configurar tu navegador para bloquear o eliminar cookies. Algunas funciones del sitio pueden dejar de funcionar correctamente.',
        'En la app móvil, revisá los permisos del sistema operativo para notificaciones y ubicación.',
      ],
    },
    {
      title: '4. Más información',
      paragraphs: [
        'Para consultas sobre privacidad y cookies: legal@x4match.com.',
        'Consultá también nuestra Política de Privacidad.',
      ],
    },
  ],
};

export const accountDeletion: LegalDocument = {
  slug: 'eliminar-cuenta',
  title: 'Eliminación de cuenta — x4 match',
  updated,
  summary:
    'Cómo solicitar la eliminación de tu cuenta y qué datos se borran o conservan en la app x4 match.',
  sections: [
    {
      title: '1. Cómo solicitar la eliminación',
      paragraphs: [
        'Podés pedir la eliminación de tu cuenta de x4 match en cualquier momento enviando un email a legal@x4match.com desde la dirección asociada a tu cuenta.',
        'En el mensaje indicá: (a) que querés eliminar tu cuenta, (b) el email con el que te registraste y (c) tu nombre completo tal como figura en el perfil.',
        'Por seguridad, podemos pedirte información adicional para verificar que sos el titular de la cuenta antes de procesar la solicitud.',
        'Procesamos las solicitudes en un plazo de hasta 30 días hábiles y te confirmamos por email cuando la eliminación se haya completado.',
      ],
    },
    {
      title: '2. Datos que se eliminan',
      paragraphs: [
        'Al eliminar tu cuenta, borramos o anonimizamos tu perfil (nombre, email, teléfono, foto, preferencias de juego, ubicación guardada y credenciales de acceso).',
        'También eliminamos tus seguidores/seguidos, conversaciones privadas, notificaciones y tokens de sesión activos.',
        'Si tenías una cuenta de club (gerente), se desvincula tu acceso; los datos operativos del club pueden conservarse según el contrato con la sede.',
      ],
    },
    {
      title: '3. Datos que podemos conservar',
      paragraphs: [
        'Podemos conservar de forma anonimizada o agregada información necesaria para estadísticas, rankings históricos o integridad de torneos ya disputados.',
        'Conservamos registros de facturación, pagos y comunicaciones cuando la ley lo exija (por ejemplo, obligaciones fiscales o reclamos).',
        'Los backups de seguridad pueden retener datos eliminados por un período limitado hasta su rotación automática.',
      ],
    },
    {
      title: '4. Alternativa: desactivar sin eliminar',
      paragraphs: [
        'Si solo querés dejar de usar la app temporalmente, podés cerrar sesión desde Perfil → Cerrar sesión. Tu cuenta seguirá existiendo hasta que solicites su eliminación.',
      ],
    },
  ],
};

export const LEGAL_PAGES = [termsPlayers, termsClubs, privacyPolicy, cookiesPolicy, accountDeletion] as const;
