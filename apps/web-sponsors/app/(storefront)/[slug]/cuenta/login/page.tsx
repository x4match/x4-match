'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { loginStorefrontCustomer, setStorefrontCustomer } from '@/lib/storefront-api';
import { toast } from 'sonner';

export default function CustomerLoginPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await loginStorefrontCustomer(slug, { email, password });
      setStorefrontCustomer(slug, res.token, res.customer);
      toast.success('Sesión iniciada');
      router.push(`/${slug}/cuenta/pedidos`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error al ingresar');
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-3 px-4 py-10">
      <h1 className="text-2xl font-bold">Iniciar sesión</h1>
      <input className="w-full rounded border px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="w-full rounded border px-3 py-2" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit" className="w-full rounded-full bg-teal-700 py-2.5 font-semibold text-white">
        Entrar
      </button>
      <p className="text-sm">
        ¿No tenés cuenta? <Link href={`/${slug}/cuenta/register`}>Crear cuenta</Link>
      </p>
    </form>
  );
}
