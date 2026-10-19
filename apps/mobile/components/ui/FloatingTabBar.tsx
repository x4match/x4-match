import { View, Text, Image, Platform, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { PressableScale } from './PressableScale';
import { TourTarget } from '@/components/tour/ScreenTour';
import { useAuth } from '@/contexts/AuthContext';
import { useKeyboardBottomInset } from '@/lib/use-keyboard-bottom-inset';
import { isClub, isPlayer } from '@/lib/roles';
import { useUnreadMessagesCount } from '@/lib/hooks/use-unread-messages';
import { ui, fontFamily } from '@/theme/tokens';

const ICON_HOME = require('../../assets/figma/bottom-bar/home.png');
const ICON_MATCHES = require('../../assets/figma/bottom-bar/partidos.png');
const ICON_MESSAGES = require('../../assets/figma/bottom-bar/message.png');
const ICON_PROFILE = require('../../assets/figma/bottom-bar/profile.png');
const ICON_BALL = require('../../assets/figma/bottom-bar/pelota.png');

const BAR_HEIGHT = 64;
const HIT_SIZE = 44;
const ICON_SIZE = 24;
const CENTER_SIZE = 60;
const BALL_SIZE = 36;
const INACTIVE_TINT = '#808090';

type TabConfig = {
  name: string;
  label: string;
  asset?: ImageSourcePropType;
  icon?: keyof typeof Ionicons.glyphMap;
  iconFocused?: keyof typeof Ionicons.glyphMap;
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
  home: { name: 'home', label: 'Inicio', asset: ICON_HOME },
  matches: { name: 'matches', label: 'Partidos', asset: ICON_MATCHES },
  search: { name: 'search', label: 'Buscar', icon: 'search-outline', iconFocused: 'search' },
  messages: { name: 'messages', label: 'Mensajes', asset: ICON_MESSAGES },
  clubs: { name: 'clubs', label: 'Clubs', icon: 'business-outline', iconFocused: 'business' },
  profile: { name: 'profile', label: 'Perfil', asset: ICON_PROFILE },
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
    return { left: ['home', 'gerente'], center: false, right: ['court-slots', 'shop', 'matches'] };
  }
  return { left: ['home', 'matches'], center: true, right: ['messages', 'profile'] };
}

export function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const keyboardInset = useKeyboardBottomInset();
  const roleTabs = getRoleTabs(user?.role);
  const unreadMessages = useUnreadMessagesCount(!!user && isPlayer(user.role));

  const routeByName: Record<string, TabRoute> = {};
  state.routes.forEach((route) => {
    routeByName[route.name] = route;
  });

  const renderByName = (name: string) => {
    const route = routeByName[name];
    if (!route) return null;
    return renderTab(route, state, navigation, name === 'messages' ? unreadMessages : 0);
  };

  // En Android el teclado tapa la UI; ocultar la tab bar libera espacio y evita solapes.
  if (keyboardInset > 0) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: Math.max(insets.bottom, 12),
      }}
    >
      <View
        style={{
          height: BAR_HEIGHT,
          borderRadius: ui.radius.pill,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: ui.colors.border,
          backgroundColor: '#121212',
          ...Platform.select({
            ios: {
              shadowColor: '#000',
              shadowOpacity: 0.45,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 8 },
            },
            android: { elevation: 10 },
          }),
        }}
      >
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-around',
            paddingHorizontal: 10,
          }}
        >
          {roleTabs.left.map(renderByName)}
          {roleTabs.center ? (
            <PressableScale
              onPress={() => router.push('/(tabs)/search' as any)}
              accessibilityRole="button"
              accessibilityLabel="Jugar, buscar partido"
              style={{
                width: HIT_SIZE + 12,
                height: HIT_SIZE + 12,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TourTarget id="tab.search">
                <View
                  style={{
                    width: CENTER_SIZE,
                    height: CENTER_SIZE,
                    borderRadius: CENTER_SIZE / 2,
                    backgroundColor: ui.colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: ui.colors.primary,
                    shadowOpacity: 0.55,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: 8,
                  }}
                >
                  <Image
                    source={ICON_BALL}
                    style={{ width: BALL_SIZE, height: BALL_SIZE }}
                    resizeMode="contain"
                  />
                </View>
              </TourTarget>
            </PressableScale>
          ) : null}
          {roleTabs.right.map(renderByName)}
        </View>
      </View>
    </View>
  );
}

function renderTab(
  route: TabRoute,
  state: TabBarProps['state'],
  navigation: TabBarProps['navigation'],
  badgeCount = 0,
) {
  const meta = TAB_META[route.name];
  if (!meta) return null;

  const index = state.routes.findIndex((r) => r.key === route.key);
  const focused = state.index === index;
  const color = focused ? ui.colors.primary : INACTIVE_TINT;

  return (
    <PressableScale
      key={route.key}
      accessibilityRole="tab"
      accessibilityLabel={badgeCount > 0 ? `${meta.label}, ${badgeCount} sin leer` : meta.label}
      accessibilityState={{ selected: focused }}
      onPress={() => {
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });
        if (event.defaultPrevented) return;
        // Si ya está activo, el emit de tabPress hace scroll-to-top vía useScrollToTop.
        // Si no, navegamos al tab.
        if (!focused) {
          navigation.navigate(route.name, route.params);
        }
      }}
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: HIT_SIZE,
      }}
    >
      <TourTarget id={`tab.${route.name}`}>
        <View
          style={{
            width: HIT_SIZE,
            height: HIT_SIZE,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: focused ? '#2A2A2A' : 'transparent',
          }}
        >
          {meta.asset ? (
            <Image
              source={meta.asset}
              style={{ width: ICON_SIZE, height: ICON_SIZE, tintColor: color }}
              resizeMode="contain"
            />
          ) : (
            <Ionicons
              name={focused ? (meta.iconFocused ?? meta.icon!) : meta.icon!}
              size={ICON_SIZE}
              color={color}
            />
          )}
          {badgeCount > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: 2,
                right: 0,
                minWidth: 18,
                height: 18,
                paddingHorizontal: 4,
                borderRadius: 9,
                backgroundColor: ui.colors.primary,
                borderWidth: 2,
                borderColor: '#121212',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  lineHeight: 12,
                  color: '#000000',
                  fontFamily: fontFamily.bold,
                  fontWeight: '700',
                }}
              >
                {badgeCount > 9 ? '9+' : badgeCount}
              </Text>
            </View>
          ) : null}
        </View>
      </TourTarget>
    </PressableScale>
  );
}
