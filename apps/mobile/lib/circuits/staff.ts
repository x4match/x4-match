import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';

export type CircuitStaffRole = 'PRESIDENT' | 'ADMIN' | 'REFEREE' | 'STAFF';
export type AssignableCircuitRole = Exclude<CircuitStaffRole, 'PRESIDENT'>;

export type CircuitPermission =
  | 'circuit.edit'
  | 'circuit.schedule'
  | 'circuit.results'
  | 'circuit.staff.manage'
  | 'circuit.transfer'
  | 'circuit.view_internal';

export type CircuitViewerAccess = {
  role: CircuitStaffRole | null;
  memberId: string | null;
  isSuperAdmin: boolean;
  permissions: CircuitPermission[];
};

export type CircuitStaffMember = {
  id: string;
  circuitId: string;
  userId: string;
  userName: string;
  playerId: string | null;
  nickname: string | null;
  photoUrl: string | null;
  role: CircuitStaffRole;
  title: string | null;
  displayTitle: string;
  status: 'ACTIVE' | 'PENDING' | string;
};

export type CircuitUserRole = {
  memberId: string;
  circuitId: string;
  circuitName: string;
  circuitShortName: string | null;
  circuitLogoUrl: string | null;
  role: CircuitStaffRole;
  title: string | null;
  displayTitle: string;
};

export type CircuitStaffInvitation = {
  id: string;
  circuitId: string;
  circuitName: string;
  circuitShortName: string | null;
  circuitLogoUrl: string | null;
  role: CircuitStaffRole;
  displayTitle: string;
  invitedByName: string | null;
  createdAt: string;
};

export const CIRCUIT_ROLE_LABELS: Record<CircuitStaffRole, string> = {
  PRESIDENT: 'Presidente',
  ADMIN: 'Organizador',
  REFEREE: 'Fiscal',
  STAFF: 'Staff',
};

export const CIRCUIT_ROLE_DESCRIPTIONS: Record<CircuitStaffRole, string> = {
  PRESIDENT: 'Control total del circuito y de su staff.',
  ADMIN: 'Gestiona etapas, sedes, categorías, torneos y staff.',
  REFEREE: 'Arma la grilla y carga resultados en los torneos.',
  STAFF: 'Colabora en las fechas y ve la grilla interna.',
};

/** Roles que cada rol puede asignar. La presidencia solo se transfiere. */
const MANAGEABLE_ROLES: Record<CircuitStaffRole, AssignableCircuitRole[]> = {
  PRESIDENT: ['ADMIN', 'REFEREE', 'STAFF'],
  ADMIN: ['REFEREE', 'STAFF'],
  REFEREE: [],
  STAFF: [],
};

export const NO_CIRCUIT_ACCESS: CircuitViewerAccess = {
  role: null,
  memberId: null,
  isSuperAdmin: false,
  permissions: [],
};

export function mapViewerAccess(raw: any): CircuitViewerAccess {
  if (!raw || typeof raw !== 'object') return NO_CIRCUIT_ACCESS;
  return {
    role: raw.role ?? null,
    memberId: raw.memberId ?? null,
    isSuperAdmin: Boolean(raw.isSuperAdmin),
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
  };
}

export function hasCircuitPermission(access: CircuitViewerAccess | null | undefined, permission: CircuitPermission) {
  return !!access?.permissions.includes(permission);
}

export function assignableRolesFor(access: CircuitViewerAccess): AssignableCircuitRole[] {
  const role: CircuitStaffRole | null = access.isSuperAdmin ? 'PRESIDENT' : access.role;
  return role ? MANAGEABLE_ROLES[role] : [];
}

export function canManageMember(access: CircuitViewerAccess, member: CircuitStaffMember) {
  if (!hasCircuitPermission(access, 'circuit.staff.manage')) return false;
  return assignableRolesFor(access).includes(member.role as AssignableCircuitRole);
}

export function defaultCircuitTitle(role: CircuitStaffRole, brand: string) {
  return `${CIRCUIT_ROLE_LABELS[role]} ${brand}`.trim();
}

export function circuitBrand(circuit: { shortName?: string | null; name?: string | null }) {
  return circuit.shortName?.trim() || circuit.name?.trim() || 'Circuito';
}

export function apiErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message;
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string') return message;
  return fallback;
}

function guessMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) return 'image/heic';
  return 'image/jpeg';
}

export async function pickAndUploadCircuitLogo(circuitId: string): Promise<string | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para el logo del circuito');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });
  const uri = result.canceled ? null : result.assets?.[0]?.uri;
  if (!uri) return null;

  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg';
  const formData = new FormData();
  formData.append('logo', {
    uri,
    name: `circuit-logo.${ext === 'jpeg' ? 'jpg' : ext}`,
    type: guessMimeType(uri),
  } as any);

  try {
    const res = await api.post(`/circuits/${circuitId}/logo`, formData);
    return (res.data?.logo_url as string) ?? null;
  } catch (error) {
    Alert.alert('Error', apiErrorMessage(error, 'No se pudo subir el logo'));
    return null;
  }
}
