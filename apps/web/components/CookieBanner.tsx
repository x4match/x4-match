'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'x4match_cookie_consent';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) setVisible(true);
  }, []);

  if (!visible) return null;

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  return (
    <div
      role="dialog"
      aria-label="Consentimiento de cookies"
      style={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        zIndex: 50,
        maxWidth: 520,
        marginInline: 'auto',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 16,
        boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
      }}
    >
      <p style={{ margin: '0 0 12px', fontSize: 14, color: '#d4d4d4' }}>
        Usamos cookies necesarias para el sitio y, si aceptás, analíticas para mejorar la experiencia.{' '}
        <Link href="/cookies" style={{ color: 'var(--primary)', fontWeight: 600 }}>
          Más info
        </Link>
      </p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" type="button" onClick={accept} style={{ padding: '8px 14px', fontSize: 13 }}>
          Aceptar
        </button>
        <button className="btn btn-outline" type="button" onClick={accept} style={{ padding: '8px 14px', fontSize: 13 }}>
          Solo necesarias
        </button>
      </div>
    </div>
  );
}
