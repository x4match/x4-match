import { Image, View } from 'react-native';

const CALENDAR_PNG = require('../../assets/figma/matches-calendar.png');
const META_DATE_PNG = require('../../assets/figma/matches-meta-date.png');
const META_CLOCK_PNG = require('../../assets/figma/matches-meta-clock.png');
const ARROW_PNG = require('../../assets/figma/matches-arrow.png');

/** Outer asset box from Figma node 106111:857 (21.92 × 23). */
export const MATCHES_CALENDAR_ICON_SIZE = { width: 22, height: 23 } as const;

type IconProps = {
  width?: number;
  height?: number;
};

/**
 * Empty-state calendar from Figma.
 * PNG — SVG stroke paths often render as blank/"U" (Unimplemented) on device.
 */
export function MatchesCalendarIcon({
  width = MATCHES_CALENDAR_ICON_SIZE.width,
  height = MATCHES_CALENDAR_ICON_SIZE.height,
}: IconProps) {
  return (
    <Image
      source={CALENDAR_PNG}
      style={{ width, height }}
      resizeMode="contain"
      accessibilityLabel="Calendario"
    />
  );
}

/** Meta calendar glyph 13×13 from Figma. */
export function MatchesMetaDateIcon({ width = 13, height = 13 }: IconProps) {
  return (
    <View style={{ width, height }}>
      <Image source={META_DATE_PNG} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

/** Meta clock glyph 13×13 from Figma. */
export function MatchesMetaClockIcon({ width = 13, height = 13 }: IconProps) {
  return (
    <View style={{ width, height }}>
      <Image source={META_CLOCK_PNG} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

/** CTA arrow 16×16 from Figma. */
export function MatchesArrowIcon({ width = 16, height = 16 }: IconProps) {
  return (
    <View style={{ width, height }}>
      <Image source={ARROW_PNG} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}
