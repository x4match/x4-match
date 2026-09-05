import Link from 'next/link';
import {
  Calendar,
  CreditCard,
  Trophy,
  Users,
} from 'lucide-react';
import { Hero } from '@/components/Hero';
import { PlansSection } from '@/components/PlansSection';
import { PlayersSection } from '@/components/PlayersSection';
import { SITE } from '@/content/site';

const CLUB_FEATURES = [
  { icon: Calendar, title: 'Turnos y ocupación', text: 'Publicá horarios, reducí huecos muertos y llená canchas.' },
  { icon: CreditCard, title: 'Tu Mercado Pago', text: 'Cobrá señas con la cuenta del club. x4 match no retiene tu dinero.' },
  { icon: Trophy, title: 'Torneos y tienda', text: 'Inscripciones, extras y productos desde el mismo panel.' },
  { icon: Users, title: 'Clientes y ranking', text: 'Conocé quién juega en tu sede y fidelizá con datos reales.' },
];

export default function HomePage() {
  return (
    <>
      <Hero />
      <PlayersSection />
      <PlansSection />
    </>
  );
}
