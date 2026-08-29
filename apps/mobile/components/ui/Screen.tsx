import { ReactNode } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSwipeBack } from '@/lib/use-swipe-back';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/contexts/AuthContext';
import { isPlayer } from '@/lib/roles';
import { resolveSkillScore } from '@/lib/skill';
import { ui } from '@/theme/tokens';
import { Avatar } from './Avatar';
import { PressableScale } from './PressableScale';

type AppHeaderProps = {
  title?: string;
  showBack?: boolean;
  showNotifications?: boolean;
  showUserGreeting?: boolean;
  rightAction?: ReactNode;
  large?: boolean;
};

export function AppHeader({
  title,
  showBack,
  showNotifications,
  showUserGreeting,
  rightAction,
  large,
}: AppHeaderProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  return (
    <LinearGradient
      colors={[ui.colors.bg, ui.colors.bgElevated]}
      style={{
        paddingTop: insets.top + 8,
        paddingHorizontal: ui.spacing.lg,
        paddingBottom: large ? 20 : 12,
        marginBottom: ui.spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          {showBack ? (
            <PressableScale onPress={() => router.back()} style={{ marginRight: 8, padding: 4 }}>
              <Ionicons name="chevron-back" size={26} color={ui.colors.textPrimary} />
            </PressableScale>
          ) : null}
          {showUserGreeting && user ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Avatar name={user.name} photo={user.photo} size={large ? 'lg' : 'md'} />
              <View>
                <Text style={[ui.typography.caption, { color: ui.colors.textMuted }]}>Hola,</Text>
                <Text style={[ui.typography.h3, { color: ui.colors.textPrimary }]}>
                  {(user.name || 'Jugador').split(' ')[0]}
                </Text>
              </View>
            </View>
          ) : title ? (
            <Text style={[ui.typography.h2, { color: ui.colors.textPrimary }]}>{title}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {showUserGreeting && user && isPlayer(user.role) ? (
            <View
              style={{
                backgroundColor: ui.colors.surface1,
                borderRadius: ui.radius.md,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderWidth: 1,
                borderColor: ui.colors.border,
              }}
            >
              <Text style={[ui.typography.caption, { color: ui.colors.textMuted }]}>Skill</Text>
              <Text style={[ui.typography.label, { color: ui.colors.accent }]}>
                {resolveSkillScore(user.skillScore, user.rating)}
                {user.levelCategory ? ` · ${user.levelCategory}` : ''}
              </Text>
            </View>
          ) : null}
          {showNotifications ? (
            <TouchableOpacity
              onPress={() => router.push('/notifications' as any)}
              style={{
                padding: 10,
                backgroundColor: ui.colors.surface1,
                borderRadius: ui.radius.sm,
                borderWidth: 1,
                borderColor: ui.colors.border,
              }}
            >
              <Ionicons name="notifications-outline" size={20} color={ui.colors.textPrimary} />
            </TouchableOpacity>
          ) : null}
          {rightAction}
        </View>
      </View>
    </LinearGradient>
  );
}

export function StackHeader({ title, rightAction }: { title: string; rightAction?: ReactNode }) {
  return <AppHeader title={title} showBack rightAction={rightAction} />;
}

export function Screen({
  children,
  padded = false,
  swipeBack = false,
}: {
  children: ReactNode;
  padded?: boolean;
  swipeBack?: boolean;
}) {
  const swipeHandlers = useSwipeBack(swipeBack);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: ui.colors.bg,
        paddingHorizontal: padded ? ui.spacing.lg : 0,
      }}
      {...swipeHandlers}
    >
      {children}
    </View>
  );
}
