'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ImagePlus, Megaphone, Trash2 } from 'lucide-react';
import {
  createClubNews,
  deleteNews,
  getNewsSettings,
  listClubNews,
  newsErrorMessage,
  type NewsPost,
} from '@/lib/news-api';
import { formatFullDate, formatShortDate } from '@/lib/format';
import { useClub } from '@/contexts/ClubContext';
import { PageHeader } from '@/components/layout/AppSidebar';
import { DashboardSkeleton, EmptyState } from '@/components/club/DashboardCards';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TITLE_MAX = 80;
const BODY_MAX = 1000;

function statusBadge(post: NewsPost) {
  if (post.status === 'APPROVED' && post.isLive) {
    return { label: 'Publicada', className: 'bg-success/15 text-success' };
  }
  if (post.status === 'APPROVED') return { label: 'Vencida', className: 'bg-muted text-muted-foreground' };
  if (post.status === 'PENDING') return { label: 'Pendiente', className: 'bg-warning/15 text-warning' };
  return { label: 'Rechazada', className: 'bg-destructive/15 text-destructive' };
}

export default function NoticiasPage() {
  const { activeClubId, activeClub } = useClub();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [linkUrl, setLinkUrl] = useState('');

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const { data: settings } = useQuery({ queryKey: ['news-settings'], queryFn: getNewsSettings });
  const durationDays = settings?.defaultDurationDays ?? 7;

  const { data: posts = [], isLoading, isError } = useQuery({
    queryKey: ['club-news', activeClubId],
    queryFn: () => listClubNews(activeClubId!),
    enabled: !!activeClubId,
  });

  const resetForm = () => {
    setImage(null);
    setPreview(null);
    setTitle('');
    setBody('');
    setLinkUrl('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const publish = useMutation({
    mutationFn: () => createClubNews(activeClubId!, { image: image!, title, body, linkUrl }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-news', activeClubId] });
      toast.success(`Noticia publicada por ${durationDays} días`);
      resetForm();
    },
    onError: (err) => toast.error(newsErrorMessage(err, 'No se pudo publicar')),
  });

  const remove = useMutation({
    mutationFn: deleteNews,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['club-news', activeClubId] });
      toast.success('Noticia eliminada');
    },
    onError: (err) => toast.error(newsErrorMessage(err, 'No se pudo eliminar')),
  });

  function onPickFile(file?: File | null) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Elegí una imagen JPG, PNG o WEBP');
      return;
    }
    setImage(file);
    setPreview(URL.createObjectURL(file));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!image) {
      toast.error('Subí la imagen del banner');
      return;
    }
    if (title.trim().length < 3) {
      toast.error('El título debe tener al menos 3 caracteres');
      return;
    }
    publish.mutate();
  }

  if (!activeClubId) return <EmptyState title="Seleccioná un club" />;

  const live = posts.filter((p) => p.status === 'APPROVED' && p.isLive);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Noticias"
        subtitle={`Banners en el inicio de la app · ${activeClub?.name || ''}`}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone className="size-4 text-primary" aria-hidden />
              Nueva noticia
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Se publica al instante en Novedades y queda visible {durationDays} días. El equipo de
              x4 elige cuáles destacar en el carrusel del inicio.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Imagen del banner</Label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden rounded-xl border bg-surface-1 transition-colors hover:border-primary/60',
                    !preview && 'border-dashed',
                  )}
                  aria-label={preview ? 'Cambiar imagen' : 'Elegir imagen'}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
                      <ImagePlus className="size-6 text-primary" aria-hidden />
                      Elegir imagen
                      <span className="text-xs">Horizontal · se recorta a 1200×525</span>
                    </span>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onPickFile(e.target.files?.[0])}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="news-title">Título</Label>
                <Input
                  id="news-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej: Torneo suma 12 este sábado"
                />
                <p className="text-right text-xs text-muted-foreground">
                  {title.length}/{TITLE_MAX}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="news-body">Descripción (opcional)</Label>
                <Textarea
                  id="news-body"
                  value={body}
                  maxLength={BODY_MAX}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Fecha, horario, cómo anotarse…"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="news-link">Link (opcional)</Label>
                <Input
                  id="news-link"
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>

              <Button type="submit" className="min-h-11 w-full rounded-xl" disabled={publish.isPending}>
                {publish.isPending ? 'Publicando…' : 'Publicar noticia'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Publicadas por el club</h3>
            <span className="text-xs text-muted-foreground">{live.length} vigentes</span>
          </div>

          {isLoading ? (
            <DashboardSkeleton />
          ) : isError ? (
            <EmptyState title="No se pudieron cargar las noticias" />
          ) : posts.length === 0 ? (
            <EmptyState
              title="Todavía no publicaste noticias"
              description="Tus banners aparecen en el inicio de todos los jugadores."
            />
          ) : (
            posts.map((post) => {
              const badge = statusBadge(post);
              return (
                <Card key={post.id} className="overflow-hidden">
                  <div className="aspect-[16/7] w-full bg-surface-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={post.imageUrl} alt="" className="size-full object-cover" />
                  </div>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{post.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {post.isLive && post.expiresAt
                            ? `Visible hasta ${formatFullDate(post.expiresAt)}`
                            : post.expiresAt
                              ? `Venció el ${formatShortDate(post.expiresAt)}`
                              : `Creada el ${formatShortDate(post.createdAt)}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge className={badge.className}>{badge.label}</Badge>
                        {post.isFeatured && post.isLive ? (
                          <Badge className="bg-primary/15 text-primary">★ En el carrusel</Badge>
                        ) : null}
                      </div>
                    </div>
                    {post.body ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">{post.body}</p>
                    ) : null}
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 text-destructive"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar "${post.title}"? Deja de mostrarse en la app.`)) {
                            remove.mutate(post.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Eliminar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
