import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const PLANS = [
  {
    id: 'BASIC',
    price: 'Consultar',
    desc: 'Gestión de canchas, facturación y clientes',
    perks: ['Panel gerente', 'Turnos y canchas', 'Facturación + CSV', 'Multiplier x1 en promos'],
  },
  {
    id: 'GROWTH',
    price: 'Consultar',
    desc: 'Smart Fill + campañas + más puntos en promos',
    perks: [
      'Todo BASIC',
      'Smart Fill (reglas + auto-partido)',
      'Campañas a segmentos',
      'Multiplier x1.5 en promos',
    ],
    highlight: true,
  },
  {
    id: 'PRO',
    price: 'Consultar',
    desc: 'Máximo empuje competitivo y loyalty',
    perks: [
      'Todo GROWTH',
      'Tienda + rewards intensivos',
      'Ranking y torneos',
      'Multiplier x2 en promos',
    ],
  },
];

export default function PricingPage() {
  return (
    <div className="dark min-h-screen bg-black text-[#FAFAFA]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(245,197,24,0.14),_transparent_50%)]" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="text-sm font-extrabold tracking-tight text-[#F5C518]">
          x4 match
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="rounded-full text-[#A3A3A3] hover:text-[#FAFAFA]" asChild>
            <Link href="/login">Iniciar sesión</Link>
          </Button>
          <Button className="rounded-full bg-[#F5C518] text-[#0A0A0A] hover:bg-[#FFE566]" asChild>
            <Link href="/register">Registrarse</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Planes para clubes
        </h1>
        <p className="mt-3 max-w-2xl text-[#A3A3A3]">
          BASIC / GROWTH / PRO ya existen en el producto. Activamos tu club y trial a medida.
        </p>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <Card
              key={plan.id}
              className={
                plan.highlight
                  ? 'border-[#F5C518]/40 bg-[#161616]'
                  : 'border-white/10 bg-[#111111]'
              }
            >
              <CardHeader>
                <CardTitle className="text-xl text-[#FAFAFA]">{plan.id}</CardTitle>
                <p className="text-2xl font-bold text-[#F5C518]">{plan.price}</p>
                <p className="text-sm text-[#A3A3A3]">{plan.desc}</p>
              </CardHeader>
              <CardContent className="space-y-2">
                {plan.perks.map((perk) => (
                  <p key={perk} className="text-sm text-[#A3A3A3]">
                    · {perk}
                  </p>
                ))}
                <Button
                  className="mt-4 w-full rounded-full bg-[#F5C518] text-[#0A0A0A] hover:bg-[#FFE566]"
                  asChild
                >
                  <Link href="/register">Empezar</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
