import { useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { safeMapCircuit } from '@/lib/mappers';
import {
  CIRCUIT_ROLE_DESCRIPTIONS,
  CIRCUIT_ROLE_LABELS,
  NO_CIRCUIT_ACCESS,
  apiErrorMessage,
  assignableRolesFor,
  canManageMember,
  circuitBrand,
  defaultCircuitTitle,
  hasCircuitPermission,
  type AssignableCircuitRole,
  type CircuitStaffMember,
} from '@/lib/circuits/staff';
import { ui } from '@/theme/tokens';
import {
  AppCard,
  Avatar,
  EmptyState,
  InputField,
  PrimaryButton,
  Screen,
  SectionHeader,
  Sheet,
  StackHeader,
  withCircuitsEnabled,
} from '@/components/x4match';
import { PlayerSearchField, type PickedPlayer } from '@/components/challenge/PlayerSearchField';

function RoleChips({
  roles,
  value,
  onChange,
}: {
  roles: AssignableCircuitRole[];
  value: AssignableCircuitRole | null;
  onChange: (role: AssignableCircuitRole) => void;
}) {
  return (
    <View style={{ gap: 8, marginBottom: 12 }}>
      {roles.map((role) => {
        const selected = value === role;
        return (
          <TouchableOpacity
            key={role}
            onPress={() => onChange(role)}
            style={{
              padding: 12,
              borderRadius: ui.radius.md,
              backgroundColor: selected ? 'rgba(20,184,166,0.12)' : ui.colors.cardMuted,
              borderWidth: 1,
              borderColor: selected ? ui.colors.primary : ui.colors.border,
            }}
          >
            <Text style={{ fontWeight: '700', color: selected ? ui.colors.primary : ui.colors.textPrimary }}>
              {CIRCUIT_ROLE_LABELS[role]}
            </Text>
            <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
              {CIRCUIT_ROLE_DESCRIPTIONS[role]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MemberRow({ member, onPress }: { member: CircuitStaffMember; onPress: () => void }) {
  const pending = member.status === 'PENDING';
  return (
    <AppCard onPress={onPress} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Avatar name={member.userName} photo={member.photoUrl} size="md" />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: ui.colors.textPrimary }}>{member.userName}</Text>
          <Text style={{ fontSize: 12, color: ui.colors.textSecondary, marginTop: 2 }}>
            {member.displayTitle}
          </Text>
        </View>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: ui.radius.pill,
            backgroundColor: pending ? ui.colors.cardMuted : 'rgba(20,184,166,0.12)',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              color: pending ? ui.colors.textMuted : ui.colors.primary,
            }}
          >
            {pending ? 'Pendiente' : CIRCUIT_ROLE_LABELS[member.role]}
          </Text>
        </View>
      </View>
    </AppCard>
  );
}

export default withCircuitsEnabled(CircuitStaffScreen);

function CircuitStaffScreen() {
  const { id: rawId } = useLocalSearchParams<{ id: string }>();
  const circuitId = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [invitee, setInvitee] = useState<PickedPlayer | null>(null);
  const [inviteRole, setInviteRole] = useState<AssignableCircuitRole | null>(null);
  const [inviteTitle, setInviteTitle] = useState('');
  const [editing, setEditing] = useState<CircuitStaffMember | null>(null);
  const [editRole, setEditRole] = useState<AssignableCircuitRole | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['circuit', circuitId],
    queryFn: async () => (await api.get(`/circuits/${circuitId}`)).data,
    enabled: !!circuitId,
  });
  const circuit = useMemo(() => safeMapCircuit(data), [data]);
  const access = circuit?.viewer ?? NO_CIRCUIT_ACCESS;
  const brand = circuit ? circuitBrand(circuit) : 'Circuito';
  const canManageStaff = hasCircuitPermission(access, 'circuit.staff.manage');
  const assignable = assignableRolesFor(access);
  const staff = circuit?.staff ?? [];
  const active = staff.filter((m) => m.status === 'ACTIVE');
  const pending = staff.filter((m) => m.status === 'PENDING');

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['circuit', circuitId] });
    queryClient.invalidateQueries({ queryKey: ['circuit-roles-user'] });
    queryClient.invalidateQueries({ queryKey: ['organizer-circuits-mine'] });
  };
  const onError = (fallback: string) => (error: unknown) =>
    Alert.alert('Error', apiErrorMessage(error, fallback));

  const invite = useMutation({
    mutationFn: async () =>
      api.post(`/circuits/${circuitId}/staff`, {
        userId: invitee!.userId,
        role: inviteRole,
        title: inviteTitle.trim() || undefined,
      }),
    onSuccess: () => {
      Alert.alert('Invitación enviada', `${invitee?.name} va a recibir una notificación para aceptar.`);
      setInvitee(null);
      setInviteRole(null);
      setInviteTitle('');
      invalidate();
    },
    onError: onError('No se pudo enviar la invitación'),
  });

  const updateMember = useMutation({
    mutationFn: async (payload: { memberId: string; role?: AssignableCircuitRole; title: string }) =>
      api.patch(`/circuits/${circuitId}/staff/${payload.memberId}`, {
        role: payload.role,
        title: payload.title,
      }),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
    onError: onError('No se pudo actualizar el miembro'),
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => api.delete(`/circuits/${circuitId}/staff/${memberId}`),
    onSuccess: (_res, memberId) => {
      setEditing(null);
      invalidate();
      if (memberId === access.memberId) router.back();
    },
    onError: onError('No se pudo quitar al miembro'),
  });

  const transfer = useMutation({
    mutationFn: async (memberId: string) =>
      api.post(`/circuits/${circuitId}/staff/transfer-presidency`, { memberId }),
    onSuccess: () => {
      setEditing(null);
      Alert.alert('Presidencia transferida', 'Ahora sos Organizador del circuito.');
      invalidate();
    },
    onError: onError('No se pudo transferir la presidencia'),
  });

  const openMember = (member: CircuitStaffMember) => {
    const isSelf = member.userId === user?.id;
    const manageable = canManageMember(access, member);
    if (!manageable && !(isSelf && member.status === 'ACTIVE')) {
      router.push(`/player/${member.userId}` as any);
      return;
    }
    setEditing(member);
    setEditRole(member.role === 'PRESIDENT' ? null : (member.role as AssignableCircuitRole));
    setEditTitle(member.title ?? '');
  };

  const confirmRemove = (member: CircuitStaffMember) => {
    const isSelf = member.userId === user?.id;
    const pendingInvite = member.status === 'PENDING';
    Alert.alert(
      isSelf ? 'Salir del staff' : pendingInvite ? 'Cancelar invitación' : 'Quitar del staff',
      isSelf
        ? `Vas a dejar de ser ${member.displayTitle}.`
        : `${member.userName} dejará de ser ${member.displayTitle}.`,
      [
        { text: 'Volver', style: 'cancel' },
        {
          text: isSelf ? 'Salir' : pendingInvite ? 'Cancelar invitación' : 'Quitar',
          style: 'destructive',
          onPress: () => removeMember.mutate(member.id),
        },
      ],
    );
  };

  const confirmTransfer = (member: CircuitStaffMember) => {
    Alert.alert(
      'Transferir presidencia',
      `${member.userName} pasará a ser ${defaultCircuitTitle('PRESIDENT', brand)} y vos quedás como Organizador. Esta acción solo la puede deshacer el nuevo Presidente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Transferir', style: 'destructive', onPress: () => transfer.mutate(member.id) },
      ],
    );
  };

  if (!circuit) {
    return (
      <Screen>
        <StackHeader title="Staff" />
        <View style={{ padding: ui.spacing.lg }}>
          {isLoading ? (
            <Text style={{ color: ui.colors.textMuted }}>Cargando...</Text>
          ) : (
            <EmptyState
              icon={<Ionicons name="people-outline" size={32} color={ui.colors.textMuted} />}
              title="Circuito no encontrado"
            />
          )}
        </View>
      </Screen>
    );
  }

  const editingIsSelf = editing?.userId === user?.id;
  const editingManageable = editing ? canManageMember(access, editing) : false;

  return (
    <Screen>
      <StackHeader title={`Staff ${brand}`} />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{ padding: ui.spacing.lg, paddingBottom: 120 }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={ui.colors.primary} />
        }
      >
        <SectionHeader title="Equipo" subtitle={`${active.length} miembro${active.length !== 1 ? 's' : ''}`} />
        {active.map((member) => (
          <MemberRow key={member.id} member={member} onPress={() => openMember(member)} />
        ))}

        {canManageStaff && pending.length > 0 ? (
          <>
            <SectionHeader title="Invitaciones pendientes" subtitle={`${pending.length}`} />
            {pending.map((member) => (
              <MemberRow key={member.id} member={member} onPress={() => openMember(member)} />
            ))}
          </>
        ) : null}

        {canManageStaff && assignable.length > 0 ? (
          <>
            <SectionHeader title="Invitar al staff" subtitle="La persona tiene que aceptar" />
            <AppCard>
              <PlayerSearchField
                value={invitee}
                onChange={setInvitee}
                excludeUserIds={staff.map((m) => m.userId)}
                placeholder="Buscar jugador de X4Match"
              />
              <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textPrimary, marginBottom: 8 }}>
                Rol
              </Text>
              <RoleChips roles={assignable} value={inviteRole} onChange={setInviteRole} />
              <InputField
                label="Título en el perfil (opcional)"
                value={inviteTitle}
                onChangeText={setInviteTitle}
                maxLength={60}
                placeholder={defaultCircuitTitle(inviteRole ?? assignable[0], brand)}
                hint="Si lo dejás vacío se usa el título automático."
              />
              <PrimaryButton
                label="Enviar invitación"
                fullWidth
                style={{ marginTop: 8 }}
                loading={invite.isPending}
                disabled={!invitee || !inviteRole || invite.isPending}
                onPress={() => invite.mutate()}
              />
            </AppCard>
          </>
        ) : null}

        {access.memberId && access.role !== 'PRESIDENT' ? (
          <PrimaryButton
            label="Salir del staff"
            variant="ghost"
            fullWidth
            style={{ marginTop: ui.spacing.lg }}
            onPress={() => {
              const me = active.find((m) => m.id === access.memberId);
              if (me) confirmRemove(me);
            }}
          />
        ) : null}
      </ScrollView>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.userName}>
        {editing ? (
          <View>
            <Text style={{ fontSize: 13, color: ui.colors.textSecondary, marginBottom: 12 }}>
              {editing.status === 'PENDING' ? 'Invitación pendiente · ' : ''}
              {editing.displayTitle}
            </Text>

            {editingManageable && editing.role !== 'PRESIDENT' ? (
              <>
                <Text style={{ fontSize: 13, fontWeight: '600', color: ui.colors.textPrimary, marginBottom: 8 }}>
                  Rol
                </Text>
                <RoleChips roles={assignable} value={editRole} onChange={setEditRole} />
              </>
            ) : null}

            {editingManageable || editingIsSelf ? (
              <InputField
                label="Título en el perfil"
                value={editTitle}
                onChangeText={setEditTitle}
                maxLength={60}
                placeholder={defaultCircuitTitle(editRole ?? editing.role, brand)}
                hint="Vacío = título automático."
              />
            ) : null}

            <PrimaryButton
              label="Guardar cambios"
              fullWidth
              style={{ marginTop: 8 }}
              loading={updateMember.isPending}
              onPress={() =>
                updateMember.mutate({
                  memberId: editing.id,
                  role:
                    editingManageable && editRole && editRole !== editing.role ? editRole : undefined,
                  title: editTitle,
                })
              }
            />

            <PrimaryButton
              label="Ver perfil"
              variant="outline"
              fullWidth
              style={{ marginTop: 8 }}
              onPress={() => {
                setEditing(null);
                router.push(`/player/${editing.userId}` as any);
              }}
            />

            {hasCircuitPermission(access, 'circuit.transfer') &&
            editing.status === 'ACTIVE' &&
            editing.role !== 'PRESIDENT' ? (
              <PrimaryButton
                label="Transferir presidencia"
                variant="outline"
                fullWidth
                style={{ marginTop: 8 }}
                loading={transfer.isPending}
                onPress={() => confirmTransfer(editing)}
              />
            ) : null}

            {editing.role !== 'PRESIDENT' && (editingManageable || editingIsSelf) ? (
              <PrimaryButton
                label={
                  editingIsSelf
                    ? 'Salir del staff'
                    : editing.status === 'PENDING'
                      ? 'Cancelar invitación'
                      : 'Quitar del staff'
                }
                variant="ghost"
                fullWidth
                style={{ marginTop: 8 }}
                loading={removeMember.isPending}
                onPress={() => confirmRemove(editing)}
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
