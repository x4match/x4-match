'use client';

import { useEffect, useState } from 'react';
import { toast, type ToastItem } from '@/lib/toast';

export function ToastProvider() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => toast.subscribe(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="toast-stack" aria-live="polite" aria-relevant="additions">
      {items.map((item) => (
        <div key={item.id} className={`toast toast-${item.type}`} role="status">
          <span className="toast-message">{item.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Cerrar"
            onClick={() => toast.dismiss(item.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
