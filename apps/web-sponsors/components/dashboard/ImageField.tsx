'use client';

import { useRef } from 'react';
import { Upload } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export type ImageKind = 'logo' | 'banner' | 'favicon' | 'product';

const MAX_BYTES = 5 * 1024 * 1024;

export function ImageField({
  id,
  label,
  kind,
  sponsorId,
  value,
  onChange,
  successMessage = 'Imagen subida. Guardá los cambios para publicarla.',
}: {
  id: string;
  label: string;
  kind: ImageKind;
  sponsorId: string | null;
  value: string;
  onChange: (v: string) => void;
  successMessage?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = useMutation({
    mutationFn: async (file: File) => {
      const body = new FormData();
      body.append('image', file);
      const res = await api.post(`/sponsors/me/${sponsorId}/images/${kind}`, body);
      return res.data as { url: string };
    },
    onSuccess: (data) => {
      onChange(data.url);
      toast.success(successMessage);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'No se pudo subir la imagen');
    },
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt=""
            className={cn(
              'size-11 shrink-0 rounded-lg border border-border bg-surface-2',
              kind === 'banner' || kind === 'product' ? 'object-cover' : 'object-contain',
            )}
          />
        ) : null}
        <Input
          id={id}
          className="min-h-11"
          placeholder="https://… o subí una imagen"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (file.size > MAX_BYTES) {
              toast.error('La imagen supera 5 MB');
              return;
            }
            upload.mutate(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="min-h-11 shrink-0 gap-2"
          disabled={!sponsorId || upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {upload.isPending ? 'Subiendo…' : 'Subir imagen'}
        </Button>
      </div>
    </div>
  );
}
