'use client';

import { FormEvent, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { registerStorefrontCustomer, setStorefrontCustomer } from '@/lib/storefront-api';
import { toast } from 'sonner';

export default function CustomerRegisterPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await registerStorefrontCustomer(slug, { name, email, password });
      setStorefrontCustomer(slug, res.token, res.customer);
      toast.success('Cuenta creada');
      router.push(`/${slug}/cuenta/pedidos`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo registrar');
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md space-y-3 px-4 py-10">
      <h1 className="text-2xl font-bold">Crear cuenta</h1>
      <input className="w-full rounded border px-3 py-2" placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required />
      <input className="w-full rounded border px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="w-full rounded border px-3 py-2" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button type="submit" className="w-full rounded-full bg-teal-700 py-2.5 font-semibold text-white">
        Registrarme
      </button>
    </form>
  );
}
