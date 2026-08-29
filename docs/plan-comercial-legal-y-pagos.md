# x4 match — Plan comercial, legal y flujo de pagos

Documento interno para lanzamiento B2B (clubes).  
**Versión:** 1.0 · **Fecha:** agosto 2026  
**Alcance:** Argentina (ARS). Ajustar montos y jurisdicción si expandís a otro país.

> **No es asesoramiento legal ni contable.** Usar como base operativa y validar con contador y abogado antes de facturar.

---

## 1. Estructura de planes (trial → pago)

### Principios

- **Jugador:** siempre gratis. Sin paywall para reservar, rankear o jugar.
- **Club:** paga por software después del período de prueba.
- **Pagos jugador → club:** siempre por Mercado Pago del club. x4 match no recibe esa plata.



### Planes


|                                          | **Pilot (trial)**  | **Club**                                   | **Club Pro** *(fase 2)*  |
| ---------------------------------------- | ------------------ | ------------------------------------------ | ------------------------ |
| **Duración**                             | 90 días desde alta | Mensual o anual                            | Mensual o anual          |
| **Precio público**                       | $0                 | **$49.900 + IVA / mes**                    | **$89.900 + IVA / mes**  |
| **Precio anual**                         | —                  | **$499.000 + IVA / año** (~2 meses gratis) | **$899.000 + IVA / año** |
| **Canchas incluidas**                    | Hasta 6            | Hasta 6                                    | Ilimitadas               |
| **Usuarios gerente**                     | 2                  | 3                                          | Ilimitados               |
| **Publicación de turnos**                | ✅                  | ✅                                          | ✅                        |
| **Matchmaking / partidos abiertos**      | ✅                  | ✅                                          | ✅                        |
| **Panel de movimientos (señas, tienda)** | ✅                  | ✅                                          | ✅                        |
| **Mercado Pago del club**                | ✅                  | ✅                                          | ✅                        |
| **Torneos**                              | 2 activos          | 5 activos                                  | Ilimitados               |
| **Tienda del club**                      | ✅                  | ✅                                          | ✅                        |
| **Ranking y clientes**                   | ✅                  | ✅                                          | ✅                        |
| **Soporte**                              | Email / WhatsApp   | Email / WhatsApp                           | Prioritario              |
| **Analytics avanzados**                  | Básico             | Básico                                     | Completo + export CSV    |
| **Circuitos / multi-sede**               | ❌                  | ❌                                          | ✅                        |




### Por qué estos precios (Argentina 2026)

Referencia de valor para el club:

- Una cancha ocupada 1 h extra por semana gracias a la app ≈ $15.000–$25.000/mes de ingreso adicional.
- Reemplaza: planilla de turnos + cobros por WhatsApp + seguimiento manual de señas.
- **$49.900 + IVA** (~$60.379 con IVA 21%) es menos que 1 hora de cancha peak en muchos clubes de CABA/GBA.

**Regla de descuento fundador (primeros 10 clubes):**

- Trial 90 días + **50% de descuento los primeros 6 meses pagos** si firman antes de [fecha].
- Precio fundador: **$24.950 + IVA / mes** bloqueado por 12 meses.



### Calendario del trial

```
Día 0    → Club firma acuerdo pilot + conecta MP (opcional pero recomendado)
Día 1–60 → Onboarding activo, sin factura
Día 61   → Email: "Te quedan 30 días de prueba"
Día 75   → Email: "En 15 días empieza tu plan Club — cargá método de pago"
Día 85   → Email: "Últimos 5 días — elegí plan mensual o anual"
Día 90   → Si no hay método de pago: modo solo lectura (ver datos, no publicar turnos nuevos)
Día 97   → Suspensión de panel si no regularizó (datos se conservan 90 días)
```



### Qué cobrás vos (facturable)


| Concepto                           | ¿Lo factura x4 match?                             |
| ---------------------------------- | ----------------------------------------------- |
| Suscripción mensual/anual del club | **Sí**                                          |
| Seña de partido                    | **No** (cobro del club)                         |
| Inscripción torneo                 | **No**                                          |
| Venta tienda del club              | **No**                                          |
| Comisión futura por reserva        | **Sí**, pero facturada al club (fase 2, ver §4) |




### Medios de cobro de la suscripción (x4 match ← Club)

Orden de preferencia:

1. **Transferencia / débito automático** + factura mensual (más simple impositivamente al inicio).
2. **Mercado Pago suscripciones** con la cuenta de x4 match (solo para cobrar al club, no mezclar con pagos de jugadores).
3. **Tarjeta vía link de pago** mensual generado por tu contador/MP.

**No uses la misma cuenta MP del club para cobrarles la suscripción a x4 match.** Cuenta de x4 match separada.

---



## 2. Checklist legal



### 2.1 Antes de tener el primer club

- [ ] **Constituir sociedad** (SAS recomendada para startups en AR) o definir monotributo solo si facturación proyectada < techo y clubes no exigen Factura A.
- [ ] **Inscripción AFIP** — Responsable Inscripto si apuntás a B2B con Factura A.
- [ ] **Ingresos Brutos** — inscripción en jurisdicción(s) donde operen los clubes.
- [ ] **Facturación electrónica** habilitada (Factura A y B).
- [ ] **Cuenta bancaria** a nombre de la sociedad (no personal).
- [ ] **Cuenta Mercado Pago de x4 match** — exclusiva para cobrar suscripciones a clubes.
- [ ] Dominio y email corporativo (`hola@x4match.com`, `legal@x4match.com`).
- [ ] Registrar marca en INPI (opcional en MVP, recomendado antes de escalar).



### 2.2 Documentos a publicar (app + web)


| Documento                            | Audiencia         | Dónde vive                   |
| ------------------------------------ | ----------------- | ---------------------------- |
| Términos y Condiciones — Jugador     | Usuarios finales  | App, registro, web           |
| Política de Privacidad               | Todos             | App, registro, web           |
| Términos y Condiciones — Club (SaaS) | Gerentes / dueños | Firma onboarding club        |
| Acuerdo de Período de Prueba         | Clubes nuevos     | Firma digital o PDF          |
| Política de cookies / analytics      | Web               | Solo si hay web con tracking |




### 2.3 Cláusulas mínimas — Jugador (T&C)

Incluir explícitamente:

1. x4 match es **plataforma tecnológica**; no organiza partidos ni es club deportivo.
2. Las **reservas y pagos** son contrato entre jugador y club.
3. **Reembolsos y cancelaciones** según política del club, no de x4 match.
4. Uso de **datos de perfil, nivel y actividad** para matchmaking y rankings.
5. **Edad mínima** (ej. 16 años con consentimiento parental, o 18).
6. Conducta: no acoso, resultados falsos, multis cuentas.
7. x4 match puede **suspender cuentas** por fraude o abuso.
8. Ley aplicable y jurisdicción (ej. tribunales de CABA).
9. Los pagos en la app se procesan por **Mercado Pago del club**; x4 match no es intermediario de fondos del jugador.



### 2.4 Cláusulas mínimas — Club (SaaS)

1. **Objeto:** licencia de uso de software x4 match por suscripción.
2. **Trial:** 90 días, precio $0, conversión automática al plan Club salvo cancelación con 7 días de anticipación al vencimiento.
3. **Precio y facturación:** monto + IVA, periodicidad, medio de pago.
4. **Mercado Pago del club:** el club conecta su cuenta; es único responsable de cobros, facturación al jugador y cumplimiento fiscal de sus ventas.
5. **x4 match no custodia fondos** de jugadores ni realiza pagos a terceros en nombre del club.
6. **Datos:** el club es responsable de la información que publica (horarios, precios, fotos).
7. **SLA:** best-effort, sin garantía de uptime 100% en fase beta/pilot.
8. **Propiedad intelectual:** x4 match retiene el software; el club retiene sus datos de clientes exportables.
9. **Terminación:** qué pasa con datos al cancelar (export 30 días, luego baja lógica).
10. **Limitación de responsabilidad:** tope = monto abonado en últimos 12 meses.
11. **Confidencialidad** de métricas del club.
12. **No exclusividad** salvo acuerdo aparte.



### 2.5 Política de Privacidad — puntos clave

- **Responsable del tratamiento:** [Razón social x4 match], CUIT, domicilio.
- **Datos que recolectás:**
  - Jugador: nombre, email, teléfono, foto, nivel, historial de partidos, ubicación aproximada (si usás geolocalización).
  - Club: razón social, CUIT, contacto gerente, tokens OAuth de MP (ver §3 — no guardar credenciales en claro).
- **Finalidad:** matchmaking, rankings, gestión de turnos, soporte, mejora del producto.
- **Base legal:** ejecución del contrato + consentimiento donde aplique.
- **Compartís datos con:** clubes donde el jugador reserva/juega; proveedores (hosting, MP como procesador del club).
- **Retención:** mientras la cuenta esté activa + plazo legal.
- **Derechos ARCO:** acceso, rectificación, cancelación — email de contacto.
- **Menores:** política clara si aplica.
- **Transferencia internacional:** si el servidor está fuera de AR (ej. Vercel US), declararlo.



### 2.6 Checklist por cada club que entra

- [ ] Acuerdo de trial firmado (PDF o firma electrónica).
- [ ] CUIT y razón social cargados en panel.
- [ ] Condición frente al IVA del club registrada (RI / Monotributo / Exento).
- [ ] Contacto de facturación (email distinto del gerente de turnos si hace falta).
- [ ] MP conectado o marcado "cobro manual en recepción" (modo degradado).
- [ ] Fecha de fin de trial en CRM / base de datos.
- [ ] Método de pago de suscripción cargado antes del día 85.



### 2.7 Plantilla breve — Acuerdo de Período de Prueba

```
ACUERDO DE PERÍODO DE PRUEBA — X4 MATCH

Entre [RAZÓN SOCIAL X4 MATCH], CUIT [___], y [RAZÓN SOCIAL CLUB], CUIT [___].

1. OBJETO
   El Club accede gratuitamente a la plataforma x4 match por 90 (noventa) días
   corridos desde la fecha de activación: [___/___/2026].

2. ALCANCE GRATUITO
   Incluye funcionalidades del plan "Club" según tarifario vigente en la fecha
   de firma. No incluye desarrollos a medida ni integraciones fuera del producto.

3. PAGOS DE JUGADORES
   Los cobros por reservas, señas, torneos y tienda se realizan exclusivamente
   a través de la cuenta Mercado Pago del Club. x4 match no recibe ni administra
   fondos de jugadores.

4. CONVERSIÓN A PLAN PAGO
   Vencido el período de prueba, el servicio continuará automáticamente bajo
   el plan Club a $[___] + IVA mensuales, salvo cancelación con 7 días de
   anticipación al vencimiento del trial, notificada a legal@x4match.com.

5. DATOS
   El Club es titular de los datos de sus clientes. x4 match actúa como
   encargado del tratamiento para prestar el servicio.

6. CONFIDENCIALIDAD Y PROPIEDAD INTELECTUAL
   El software es propiedad de x4 match. El Club no adquiere derechos sobre
   el código ni la marca.

Firmas:
_______________________          _______________________
Por x4 match                       Por el Club
Fecha: ___/___/2026              Fecha: ___/___/2026
```

*(Adaptar con abogado antes de usar.)*

---



## 3. Flujo técnico — Club conecta Mercado Pago



### 3.1 Objetivo

Que **toda plata de jugadores** vaya al **collector = club**, y x4 match solo:

- Crea el checkout en nombre del club (API MP con token del club).
- Recibe webhooks de estado.
- Muestra en el panel si está cobrado o pendiente.

**x4 match nunca recibe dinero del jugador en su cuenta bancaria ni en su MP.**

### 3.2 Arquitectura

```
┌─────────────┐     checkout      ┌──────────────────┐     cobro      ┌─────────────┐
│   Jugador   │ ────────────────► │  API x4 match      │ ─────────────► │ Mercado Pago │
│   (app)     │ ◄── checkoutUrl ──│  (orquestador)   │                │ collector=   │
└─────────────┘                   └────────┬─────────┘                │ club_id      │
                                         │                            └──────┬──────┘
                                         │ webhook                          │
                                         ▼                                  ▼
                                  ┌──────────────┐                  ┌─────────────┐
                                  │   Postgres   │                  │ Cuenta MP   │
                                  │ payment ref  │                  │ del CLUB    │
                                  └──────────────┘                  └─────────────┘

┌─────────────┐   suscripción    ┌──────────────────┐              ┌─────────────┐
│    Club     │ ───────────────► │  MP / transfer   │ ────────────► │ Cuenta MP   │
│  (mensual)  │                  │  (solo SaaS fee) │               │ de x4 match   │
└─────────────┘                  └──────────────────┘               └─────────────┘
```



### 3.3 Onboarding OAuth del club

**Flujo recomendado (Mercado Pago OAuth / Marketplace):**

1. Gerente entra a **Panel → Configuración → Pagos**.
2. Toca **"Conectar Mercado Pago"**.
3. Redirect a `auth.mercadopago.com` con `client_id` de la aplicación x4 match.
4. El club autoriza; MP devuelve `authorization_code`.
5. Backend x4 match intercambia code por:
  - `access_token` (del vendedor/club)
  - `refresh_token`
  - `user_id` (collector_id en MP)
6. Guardás en DB **cifrados** (ver §3.5).
7. UI muestra: **"Mercado Pago conectado · CUIT/Cuenta ·•••1234"**.

**Estados en UI:**


| Estado          | Significado                    | Acción gerente            |
| --------------- | ------------------------------ | ------------------------- |
| `not_connected` | Sin MP                         | Conectar                  |
| `connected`     | Token válido                   | Desconectar / Reautorizar |
| `expired`       | Refresh falló                  | Reconectar                |
| `manual_only`   | Club elige cobrar en recepción | Conectar MP cuando quiera |




### 3.4 Creación de checkout (seña, tienda, torneo)

**Endpoint existente en app (referencia):**

- `POST /matches/:id/deposit/checkout`
- `POST /clubs/:clubId/shop/checkout`
- `POST /tournaments/:id/registrations/:regId/checkout`

**Lógica backend (a implementar / validar):**

```typescript
// Pseudocódigo — no usar token de x4 match como collector
async function createClubCheckout(clubId, amount, metadata) {
  const club = await getClub(clubId);
  const mp = await getMercadoPagoClient(club.mpAccessToken); // token del club

  const preference = await mp.preferences.create({
    items: [{ title: metadata.label, quantity: 1, unit_price: amount }],
    payer: { email: metadata.payerEmail },
    back_urls: {
      success: `${APP_URL}/payments/success`,
      failure: `${APP_URL}/payments/failure`,
      pending: `${APP_URL}/payments/pending`,
    },
    notification_url: `${API_URL}/webhooks/mercadopago/clubs/${clubId}`,
    external_reference: metadata.internalPaymentId, // UUID x4 match
    // collector_id implícito en el access_token del club
  });

  await db.payment.create({
    id: metadata.internalPaymentId,
    clubId,
    amount,
    status: 'PENDING',
    mpPreferenceId: preference.id,
    checkoutUrl: preference.init_point,
    collectorMpUserId: club.mpUserId,
  });

  return { checkoutUrl: preference.init_point, amount };
}
```

**Webhook (**`POST /webhooks/mercadopago/clubs/:clubId`**):**

1. Validar firma / `x-signature` de MP.
2. Consultar pago por `payment_id` con token del club.
3. Actualizar `payment.status` → `APPROVED` | `PENDING` | `REJECTED`.
4. Disparar efectos: confirmar seña de partido, inscripción torneo, venta tienda.
5. Idempotencia: si el webhook llega 2 veces, no duplicar.



### 3.5 Qué guardás en base de datos (y qué NO)

**Tabla** `club_payment_config` **(sugerida):**


| Campo                             | Guardar   | Notas                                            |
| --------------------------------- | --------- | ------------------------------------------------ |
| `club_id`                         | ✅         | FK                                               |
| `mp_user_id`                      | ✅         | Collector ID público                             |
| `mp_access_token`                 | ✅ cifrado | AES-256 o vault (KMS)                            |
| `mp_refresh_token`                | ✅ cifrado | Rotar con refresh job                            |
| `token_expires_at`                | ✅         | Job diario de refresh                            |
| `connected_at`                    | ✅         | Auditoría                                        |
| `status`                          | ✅         | enum                                             |
| `mp_client_secret`                | ❌         | Solo env del servidor x4 match                     |
| `Datos de tarjeta del jugador`    | ❌         | Nunca — MP los tiene                             |
| `Saldo / movimientos MP del club` | ❌         | Consultar API si hace falta, no persistir masivo |


**Tabla** `payments` **(movimientos orquestados):**


| Campo                | Guardar                             |
| -------------------- | ----------------------------------- |
| `id`                 | UUID interno                        |
| `club_id`            | ✅                                   |
| `kind`               | deposit | shop | tournament         |
| `reference_id`       | match_id, sale_id, registration_id  |
| `amount`, `currency` | ✅                                   |
| `status`             | PENDING | APPROVED | ...            |
| `mp_payment_id`      | ✅ cuando confirma webhook           |
| `checkout_url`       | ✅ hasta expirar                     |
| `payer_user_id`      | ✅ jugador x4 match (no datos tarjeta) |




### 3.6 Modo degradado — Cobro manual en recepción

Ya existe parcialmente en la app (`markDepositPaid`, `confirmShopPurchase` en panel billing).

**Cuándo usarlo:**

- Club sin MP conectado.
- Falla temporal de MP.
- Club prefiere efectivo/transferencia y solo quiere tracking en x4 match.

**Flujo:**

1. Se crea `payment` con `status: PENDING`, sin `checkout_url`.
2. Gerente marca **"Cobrado en recepción"** → `status: CONFIRMED` (manual).
3. Queda en reporte de revenue como cobro no-MP.

**Importante:** dejar claro en T&C que x4 match no verifica transferencias bancarias externas.

### 3.7 Seguridad y cumplimiento

- Tokens MP **nunca** al cliente mobile; solo backend.
- Webhooks con verificación de firma.
- Logs sin PAN, CVV ni tokens en claro.
- Rotación de `refresh_token` automática.
- Desconexión MP: borrar tokens, mantener histórico de pagos anonimizado según retención legal.



### 3.8 Pantallas a agregar en producto (backlog)


| Pantalla                                                  | Prioridad |
| --------------------------------------------------------- | --------- |
| Club → Configuración → Pagos (conectar MP)                | 🔴 P0     |
| Banner "Conectá MP para cobrar señas online" en gerente   | 🔴 P0     |
| Estado trial + días restantes + CTA método de pago x4 match | 🔴 P0     |
| Admin interno: fecha fin trial por club                   | 🟠 P1     |
| Job refresh tokens MP                                     | 🔴 P0     |
| Webhook handler producción                                | 🔴 P0     |




### 3.9 Variables de entorno

```bash
# Cuenta aplicación x4 match en Mercado Pago Developers
MP_APP_ID=
MP_CLIENT_SECRET=
MP_REDIRECT_URI=https://api.tudominio.com/clubs/oauth/mercadopago/callback

# Cifrado tokens club en DB
PAYMENT_TOKEN_ENCRYPTION_KEY=

# Deep link de retorno a la app móvil
MOBILE_APP_SCHEME=playtomic

# Webhook global (fallback plataforma)
MERCADOPAGO_ACCESS_TOKEN=
PAYMENTS_MOCK=true   # desarrollo sin MP real
```

**Separado de:**

```bash
# Solo para cobrar SUSCRIPCIÓN del club a x4 match (cuenta x4 match)
X4MATCH_BILLING_MP_ACCESS_TOKEN=
```

### 3.10 Implementación en código (ago 2026)

| Pieza | Ubicación |
|-------|-----------|
| Migración `club_payment_config` | `050_club_payment_config.sql` |
| Migración `club_billing` (trial) | `051_club_billing_trial.sql` |
| OAuth MP por club | `club-payment-config.service.ts` |
| Trial + checklist | `club-trial.service.ts` |
| Backoffice API | `platform-admin/*` → `/platform/*` |
| Backoffice web | `apps/web-admin` → puerto 3002 |
| Banner trial móvil | `gerente.tsx` |

---

## 7. Trial — checklist y modos de activación

### Checklist (6 ítems)

| Ítem | Tipo | Requerido |
|------|------|-----------|
| Acuerdo de trial firmado | Manual | Sí |
| Perfil del club completo | Auto | Sí |
| Mercado Pago conectado | Auto | No |
| Primer turno publicado | Auto | Sí |
| Método de pago x4 match | Manual | No |
| Aprobación interna (ops) | Manual | Sí |

Los ítems **auto** se sincronizan al consultar el estado del trial.

### Modos de trial

| Modo | Comportamiento |
|------|----------------|
| **TIME** | 90 días (configurable) desde `trial_started_at`. Vence en `trial_ends_at`. |
| **MANUAL** | Sin fecha de fin automática. Ops suspende o activa plan pago cuando corresponda. |

### Flujo ops (backoffice)

1. Club nuevo → estado `NOT_STARTED`
2. Completar checklist (manual + auto)
3. **Iniciar trial** → TIME o MANUAL (`POST /platform/clubs/:id/trial/start`)
4. Al vencer TIME → `GRACE` (7 días) o `SUSPENDED` (manual desde ops)
5. **Activar plan pago** → `ACTIVE`

### Acceso club durante trial

Estados con acceso: `TRIAL`, `ACTIVE`, `GRACE`.  
`NOT_STARTED` y `SUSPENDED` muestran banner en el panel gerente.

### Crear SUPER_ADMIN

```sql
UPDATE users SET role = 'SUPER_ADMIN' WHERE email = 'ops@x4match.com';
```

Luego ingresar en `http://localhost:3002/login`.

---

## 4. Fase 2 — Comisión por transacción (sin tocar plata del jugador en x4 match)

Cuando tengas liquidez, podés cobrar **fee variable facturado al club**:

**Opción A — Factura mensual (recomendada primero):**

- Plan Club incluye X reservas/mes.
- Extra: $500 + IVA por reserva completada vía app.
- x4 match factura al club; el jugador sigue pagando 100% al club.

**Opción B — Split MP (marketplace_fee):**

- Al crear preference, `marketplace_fee` = comisión x4 match.
- MP acredita comisión a cuenta x4 match y resto al club en el mismo pago.
- Requiere app MP tipo marketplace y asesoría contable adicional.

**No mezclar Opción B hasta tener volumen y contador alineado.**

---



## 5. Métricas a seguir desde el día 1


| Métrica                                         | Meta pilot (90 días)                 |
| ----------------------------------------------- | ------------------------------------ |
| Clubes activos con turnos publicados            | 10                                   |
| Clubes con MP conectado                         | ≥ 70% de activos                     |
| Reservas / señas por semana (total red)         | Crecimiento 15% semanal              |
| % clubes que cargan método de pago antes día 85 | ≥ 60%                                |
| Churn mes 1 post-trial                          | < 20%                                |
| MRR al mes 4                                    | $500.000 + IVA (10 clubes × $49.900) |


---



## 6. Próximos pasos inmediatos

1. Validar precios con 3 dueños de club (¿pagarían $49.900 + IVA?).
2. Pasar plantillas §2.4 y §2.5 por abogado (1 sesión).
3. Abrir app en [Mercado Pago Developers](https://www.mercadopago.com.ar/developers) → OAuth + Webhooks.
4. Implementar `club_payment_config` + pantalla Conectar MP (§3.8).
5. Armar Excel/Notion CRM con fecha fin trial por club.

---

*Documento generado para x4 match. Actualizar al definir razón social y CUIT.*