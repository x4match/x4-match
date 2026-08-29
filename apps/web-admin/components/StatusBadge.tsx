import { badgeTone, getStatusLabel, type LabelCategory } from '@/lib/labels';

type StatusBadgeProps = {
  value?: string | null;
  category: LabelCategory;
  fallback?: string;
};

export function StatusBadge({ value, category, fallback }: StatusBadgeProps) {
  const label = getStatusLabel(category, value, fallback);
  const tone = badgeTone(category, value);
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

type StatusTextProps = {
  value?: string | null;
  category: LabelCategory;
  fallback?: string;
};

export function StatusText({ value, category, fallback }: StatusTextProps) {
  return <>{getStatusLabel(category, value, fallback)}</>;
}
