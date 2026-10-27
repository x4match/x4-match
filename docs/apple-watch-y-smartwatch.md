# Apple Watch / Smartwatch — plan e implementación

> Estado: **pendiente**. Requiere macOS + Xcode para desarrollar y probar el target del reloj
> (EAS Build puede compilarlo en la nube, pero sin simulador cada prueba exige build + reloj físico).

## Ideas, por prioridad

1. **Marcador en vivo desde la muñeca** (función principal)
   - Dos botones grandes: "Punto Nosotros" / "Punto Ellos", más "Deshacer".
   - Vibración al ganar game / set / partido.
   - Muestra set, game y punto actual (`display` del backend).
   - Al terminar, el resultado queda cargado (lo hace el backend, igual que hoy desde el teléfono).
2. **Notificaciones accionables** (casi gratis)
   - Las push de `expo-notifications` ya se ven en el reloj.
   - Agregar categorías con botones: aceptar/rechazar invitación, desafío, lugar en partido abierto, confirmar asistencia.
3. **Complicación / widget de esfera**: próximo partido (hora, club, cancha) o posición en el ranking.
4. **Live Activity** (iPhone, se refleja en el Watch): marcador en pantalla de bloqueo y Dynamic Island.
5. **Sesión de entrenamiento (HealthKit / Health Connect)**: pulso, calorías y duración guardados en `history/[id]`.
6. **Utilidades rápidas**: partidos del día, check-in en club, alertas del club (`club-alerts`) para gerentes.

**Orden sugerido:** notificaciones accionables + Live Activity → app de Watch con marcador → Wear OS si hay demanda.

## Por qué el marcador es simple de llevar al reloj

El backend ya calcula todo el marcador y usa `version` para control de concurrencia
(ver `apps/mobile/lib/match/live-score.ts`). El reloj es un cliente "tonto":

| Acción     | Endpoint                              | Body                  |
| ---------- | ------------------------------------- | --------------------- |
| Estado     | `GET /matches/:id/live`               | —                     |
| Punto      | `POST /matches/:id/live/point`        | `{ team, version }`   |
| Deshacer   | `POST /matches/:id/live/undo`         | `{ version }`         |

No hay que reimplementar las reglas del pádel en Swift.

## Arquitectura

```
iPhone (React Native)                         Apple Watch (SwiftUI)
─────────────────────                         ─────────────────────
AuthContext (token)  ──WatchConnectivity──▶   PhoneSession (token, apiUrl, matchId)
live.tsx (matchId)                                   │
                                                     ▼
                                              LiveScoreAPI ──HTTP──▶ API /matches/:id/live/*
```

El teléfono **no** reenvía cada punto; el reloj habla directo con la API.

## Paso 1 — Agregar el target al proyecto Expo

```bash
cd apps/mobile
npx expo install @bacons/apple-targets react-native-watch-connectivity
npx create-target watch
```

`targets/watch/expo-target.config.js`:

```js
/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'x4 Match',
  bundleIdentifier: '.watchkitapp',
  deploymentTarget: '10.0',
};
```

Agregar `'@bacons/apple-targets'` en `plugins` de `app.config.ts` y correr `npx expo prebuild`.

## Paso 2 — El teléfono le pasa datos al reloj

Hook (p. ej. `lib/watch/useSyncLiveMatchToWatch.ts`), usado desde `app/match/[id]/live.tsx`:

```ts
import { useEffect } from 'react';
import { updateApplicationContext } from 'react-native-watch-connectivity';
import { useAuth } from '@/contexts/AuthContext';
import { API_URL } from '@/lib/api';

export function useSyncLiveMatchToWatch(matchId?: string, isLive?: boolean) {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    updateApplicationContext({
      token,
      apiUrl: API_URL,
      matchId: isLive ? matchId ?? null : null,
    });
  }, [token, matchId, isLive]);
}
```

`updateApplicationContext` guarda el último estado; el reloj lo recibe aunque esté cerrado.
Verificar el nombre real de la constante de URL base en `lib/api`.

## Paso 3 — Código Swift del reloj

### `targets/watch/PhoneSession.swift`

```swift
import WatchConnectivity

final class PhoneSession: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = PhoneSession()
  @Published var token: String?
  @Published var apiUrl: String?
  @Published var matchId: String?

  override init() {
    super.init()
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func session(_ s: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
    apply(s.receivedApplicationContext)
  }

  func session(_ s: WCSession, didReceiveApplicationContext ctx: [String: Any]) {
    apply(ctx)
  }

  private func apply(_ ctx: [String: Any]) {
    DispatchQueue.main.async {
      self.token = ctx["token"] as? String
      self.apiUrl = ctx["apiUrl"] as? String
      self.matchId = ctx["matchId"] as? String
    }
  }
}
```

### `targets/watch/LiveScoreAPI.swift`

```swift
import Foundation

struct Display: Decodable { let teamA: String; let teamB: String; let label: String? }
struct Pair: Decodable { let teamA: Int; let teamB: Int }
struct LiveScore: Decodable {
  let status: String
  let games: Pair?
  let display: Display?
  let winner: String?
  let canUndo: Bool?
  let version: Int?
}

struct LiveScoreAPI {
  let baseUrl: String, token: String, matchId: String

  private func request(_ path: String, method: String, body: [String: Any]? = nil) async throws -> LiveScore {
    var req = URLRequest(url: URL(string: "\(baseUrl)/matches/\(matchId)/live\(path)")!)
    req.httpMethod = method
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    if let body {
      req.setValue("application/json", forHTTPHeaderField: "Content-Type")
      req.httpBody = try JSONSerialization.data(withJSONObject: body)
    }
    let (data, response) = try await URLSession.shared.data(for: req)
    guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
      throw URLError(.badServerResponse)
    }
    return try JSONDecoder().decode(LiveScore.self, from: data)
  }

  func get() async throws -> LiveScore { try await request("", method: "GET") }
  func point(_ team: String, version: Int?) async throws -> LiveScore {
    try await request("/point", method: "POST", body: ["team": team, "version": version ?? 0])
  }
  func undo(version: Int?) async throws -> LiveScore {
    try await request("/undo", method: "POST", body: ["version": version ?? 0])
  }
}
```

### `targets/watch/ScoreView.swift`

```swift
import SwiftUI
import WatchKit

struct ScoreView: View {
  @EnvironmentObject var phone: PhoneSession
  @State private var live: LiveScore?
  @State private var busy = false

  var api: LiveScoreAPI? {
    guard let t = phone.token, let u = phone.apiUrl, let m = phone.matchId else { return nil }
    return LiveScoreAPI(baseUrl: u, token: t, matchId: m)
  }

  var body: some View {
    if api == nil {
      Text("Iniciá el marcador en el iPhone").multilineTextAlignment(.center)
    } else {
      VStack(spacing: 6) {
        Text(live?.display?.label ?? " ").font(.caption2).foregroundStyle(.yellow)
        HStack {
          Text(live?.display?.teamA ?? "0")
          Text("-")
          Text(live?.display?.teamB ?? "0")
        }
        .font(.title2.bold())
        HStack {
          scoreButton("Nosotros", team: "A", color: .green)
          scoreButton("Ellos", team: "B", color: .blue)
        }
        Button("Deshacer") { run { try await $0.undo(version: live?.version) } }
          .disabled(live?.canUndo != true)
          .font(.footnote)
      }
      .task(id: phone.matchId) { run { try await $0.get() } }
    }
  }

  func scoreButton(_ title: String, team: String, color: Color) -> some View {
    Button(title) { run { try await $0.point(team, version: live?.version) } }
      .tint(color)
      .frame(maxWidth: .infinity, minHeight: 60)
  }

  func run(_ action: @escaping (LiveScoreAPI) async throws -> LiveScore) {
    guard let api, !busy else { return }
    busy = true
    Task {
      defer { busy = false }
      do {
        let next = try await action(api)
        let gameChanged = next.games?.teamA != live?.games?.teamA || next.games?.teamB != live?.games?.teamB
        WKInterfaceDevice.current().play(gameChanged ? .success : .click)
        live = next
      } catch {
        // Conflicto de versión (otro jugador anotó) o error de red: resincronizar.
        WKInterfaceDevice.current().play(.failure)
        live = try? await api.get()
      }
    }
  }
}
```

### `targets/watch/X4MatchWatchApp.swift`

```swift
import SwiftUI

@main
struct X4MatchWatchApp: App {
  @StateObject private var phone = PhoneSession.shared
  var body: some Scene {
    WindowGroup { ScoreView().environmentObject(phone) }
  }
}
```

## Detalles para producción

- **Token**: guardarlo en el Keychain del reloj para que funcione con el iPhone lejos (Watch LTE / Wi-Fi del club).
- **Mantener la app activa**: iniciar `HKWorkoutSession` (tipo pádel/tenis) durante el partido; evita la suspensión y suma pulso/calorías. Requiere permisos de HealthKit.
- **Sincronizar en vivo**: si otro jugador anota desde su teléfono, el reloj se entera al próximo punto (conflicto de `version`). Mejora opcional: polling corto de `GET /live` o reenviar los eventos del socket (`lib/realtime`) vía `sendMessage`.
- **Mapear "Nosotros/Ellos"**: hoy el reloj usa A/B fijo; usar `teams` del backend para saber en qué equipo está el usuario.
- **Wear OS**: misma idea con Kotlin + Compose for Wear + Data Layer API; mismos endpoints.

## Checklist para cuando haya Mac

- [ ] Instalar dependencias y crear target (`npx create-target watch`).
- [ ] Agregar plugin en `app.config.ts` y `npx expo prebuild`.
- [ ] Hook `useSyncLiveMatchToWatch` en `live.tsx`.
- [ ] Archivos Swift y prueba en simulador pareado (iPhone + Watch).
- [ ] Probar conflicto de versión anotando desde teléfono y reloj a la vez.
- [ ] HKWorkoutSession + permisos HealthKit.
- [ ] Configurar bundle id `.watchkitapp` en Apple Developer y build con EAS.
