import { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { isPlayer } from '@/lib/roles';
import { resolveSkillScore } from '@/lib/skill';
import { Avatar } from './Avatar';
import { SkillProgress } from './SkillProgress';
import { ui } from '@/theme/tokens';

type AppHeaderProps = {
  title?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  showUserGreeting?: boolean;
  rightAction?: ReactNode;
};

export function AppHeader({
  title,
  showBack,
  showNotifications,
  showUserGreeting,
  rightAction,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  return (
    <View
      style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: ui.spacing.lg,
        paddingBottom: 12,
        backgroundColor: ui.colors.bg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {showBack ? (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginRight: 8, padding: 4 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="chevron-back" size={26} color={ui.colors.textInverse} />
            </TouchableOpacity>
          ) : null}
          {showUserGreeting && user ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={user.name} photo={user.photo} size="md" />
              <View>
                <Text style={{ fontSize: 13, color: ui.colors.textMuted }}>Hola,</Text>
                <Text style={{ fontSize: 16, fontWeight: '700', color: ui.colors.textInverse }}>
                  {(user.name || 'Jugador').split(' ')[0]}
                </Text>
              </View>
            </View>
          ) : title ? (
            <Text style={{ fontSize: 20, fontWeight: '700', color: ui.colors.textInverse }}>{title}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showUserGreeting && user && isPlayer(user.role) ? (
            <View
              style={{
                backgroundColor: ui.colors.surface,
                borderRadius: ui.radius.md,
                paddingHorizontal: 12,
                paddingVertical: 8,
                minWidth: 128,
              }}
            >
              <SkillProgress
                score={resolveSkillScore(user.skillScore, user.rating)}
                category={user.levelCategory}
                size="sm"
                dark
              />
            </View>
          ) : null}
          {showNotifications ? (
            <TouchableOpacity
              onPress={() => router.push('/notifications' as any)}
              style={{ padding: 8 }}
            >
              <Ionicons name="notifications-outline" size={22} color={ui.colors.textInverse} />
            </TouchableOpacity>
          ) : null}
          {rightAction}
        </View>
      </View>
    </View>
  );
}

export function StackHeader({ title, rightAction }: { title: string; rightAction?: ReactNode }) {
  return <AppHeader title={title} showBack rightAction={rightAction} />;
}

export function Screen({ children }: { children: ReactNode }) {
  return <View style={{ flex: 1, backgroundColor: ui.colors.bg }}>{children}</View>;
}
