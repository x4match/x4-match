import { View, Text, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { useAuth } from '@/contexts/AuthContext';
import { isClub } from '@/lib/roles';
import { ui } from '@/theme/tokens';

type TabConfig = {
  name: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconFocused: keyof typeof Ionicons.glyphMap;
};

type TabRoute = {
  key: string;
  name: string;
  params?: object;
};

export type TabBarProps = {
  state: {
    index: number;
    routes: TabRoute[];
  };
  descriptors: Record<
    string,
    {
      options: {
        title?: string;
        href?: string | null;
      };
    }
  >;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault?: boolean }) => { defaultPrevented?: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

const TAB_META: Record<string, TabConfig> = {
  home: { name: 'home', label: 'Inicio', icon: 'home-outline', iconFocused: 'home' },
  matches: { name: 'matches', label: 'Partidos', icon: 'calendar-outline', iconFocused: 'calendar' },
  search: { name: 'search', label: 'Buscar', icon: 'search-outline', iconFocused: 'search' },
  messages: { name: 'messages', label: 'Mensajes', icon: 'chatbubbles-outline', iconFocused: 'chatbubbles' },
  clubs: { name: 'clubs', label: 'Clubs', icon: 'business-outline', iconFocused: 'business' },
  profile: { name: 'profile', label: 'Perfil', icon: 'person-outline', iconFocused: 'person' },
  'court-slots': { name: 'court-slots', label: 'Gestión', icon: 'grid-outline', iconFocused: 'grid' },
  gerente: { name: 'gerente', label: 'Gerente', icon: 'analytics-outline', iconFocused: 'analytics' },
  community: { name: 'community', label: 'Comunidad', icon: 'people-outline', iconFocused: 'people' },
  'club-ranking': { name: 'club-ranking', label: 'Ranking', icon: 'trophy-outline', iconFocused: 'trophy' },
  shop: { name: 'shop', label: 'Tienda', icon: 'storefront-outline', iconFocused: 'storefront' },
  organizer: { name: 'organizer', label: 'Gestión', icon: 'settings-outline', iconFocused: 'settings' },
  history: { name: 'history', label: 'Historial', icon: 'time-outline', iconFocused: 'time' },
};

type RoleTabs = {
  left: string[];
  center: boolean;
  right: string[];
};

function getRoleTabs(role?: string): RoleTabs {
  if (isClub(role)) {
    return { left: ['gerente', 'court-slots'], center: false, right: ['club-ranking', 'shop', 'profile'] };
  }
  // Jugador (y ORGANIZER legacy): mismo shell — organiza desde Perfil / panel
  return { left: ['home', 'matches'], center: true, right: ['messages', 'profile'] };
}

export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const roleTabs = getRoleTabs(user?.role);

  const routeByName: Record<string, TabRoute> = {};
  state.routes.forEach((route) => {
    routeByName[route.name] = route;
  });

  const renderByName = (name: string) => {
    const route = routeByName[name];
    if (!route) return null;
    return renderTab(route, state, navigation);
  };

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: Math.max(insets.bottom, 12),
      }}
    >
      <BlurView
        intensity={Platform.OS === 'ios' ? 50 : 80}
        tint="dark"
        style={{
          borderRadius: ui.radius.xl,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: ui.colors.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            backgroundColor: ui.colors.glass,
            paddingVertical: 10,
            paddingHorizontal: 8,
          }}
        >
          {roleTabs.left.map(renderByName)}
          {roleTabs.center ? <View style={{ width: 64 }} /> : null}
          {roleTabs.right.map(renderByName)}
        </View>
      </BlurView>

      {roleTabs.center ? (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', top: -24, left: 0, right: 0, alignItems: 'center' }}
        >
          <PressableScale
            onPress={() => router.push('/(tabs)/search' as any)}
            accessibilityRole="button"
            accessibilityLabel="Jugar, buscar partido"
          >
            <LinearGradient
              colors={[ui.colors.primary, ui.colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 60,
                height: 60,
                borderRadius: 30,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 4,
                borderColor: ui.colors.bg,
                ...ui.shadow.glow,
              }}
            >
              <Ionicons name="tennisball" size={26} color={ui.colors.bgElevated} />
            </LinearGradient>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

function renderTab(
  route: TabRoute,
  state: TabBarProps['state'],
  navigation: TabBarProps['navigation'],
) {
  const meta = TAB_META[route.name];
  if (!meta) return null;

  const index = state.routes.findIndex((r) => r.key === route.key);
  const focused = state.index === index;
  const color = focused ? ui.colors.primary : ui.colors.textMuted;

  return (
    <PressableScale
      key={route.key}
      accessibilityRole="tab"
      accessibilityLabel={meta.label}
      accessibilityState={{ selected: focused }}
      onPress={() => {
        const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (!focused && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }}
      style={{ alignItems: 'center', flex: 1, minHeight: 44, justifyContent: 'center', paddingVertical: 4 }}
    >
      <Ionicons name={focused ? meta.iconFocused : meta.icon} size={22} color={color} />
      <Text
        style={{
          fontSize: 11,
          marginTop: 4,
          fontFamily: ui.typography.label.fontFamily,
          color,
        }}
      >
        {meta.label}
      </Text>
    </PressableScale>
  );
}
