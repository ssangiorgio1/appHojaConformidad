import { Platform } from 'react-native';

// Matched to the web panel's design tokens (web/src/app/globals.css) so the
// app and the admin panel read as one product.
export const colors = {
  primary: '#7a1630',
  primaryDark: '#570f22',
  accent: '#b7273f',
  ok: '#2da053',
  okBg: '#e3f3e7',
  bad: '#a31c1c',
  badBg: '#fbe4e4',
  warn: '#9a6400',
  warnBg: '#fbeed7',
  bg: '#ece7e3',
  card: '#f8f5f3',
  border: '#ddd2cd',
  text: '#26201f',
  muted: '#8a7d79',
};

export const radius = 18;

// Approximates the web panel's neumorphic "shadow-soft" card — a raised
// surface against the warm greige background, no hard borders.
export const cardShadow = Platform.select({
  ios: {
    shadowColor: '#57423d',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
  },
  android: { elevation: 3 },
  default: {},
});
