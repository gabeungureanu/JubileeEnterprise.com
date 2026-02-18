import { Platform, TextStyle } from 'react-native';

const fontFamily = Platform.select({
  ios: 'System',
  android: 'Roboto',
  default: 'System',
});

export const Typography = {
  fontFamily,

  // Heading styles
  h1: {
    fontFamily,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    letterSpacing: -0.5,
  } as TextStyle,

  h2: {
    fontFamily,
    fontSize: 22,
    fontWeight: '600',
    lineHeight: 28,
    letterSpacing: -0.3,
  } as TextStyle,

  h3: {
    fontFamily,
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 24,
  } as TextStyle,

  // Body styles
  bodyLarge: {
    fontFamily,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  } as TextStyle,

  body: {
    fontFamily,
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
  } as TextStyle,

  bodySmall: {
    fontFamily,
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 16,
  } as TextStyle,

  // Label styles
  label: {
    fontFamily,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  } as TextStyle,

  labelSmall: {
    fontFamily,
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 16,
    letterSpacing: 0.3,
  } as TextStyle,

  // Caption
  caption: {
    fontFamily,
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 14,
    letterSpacing: 0.2,
  } as TextStyle,

  // Button
  button: {
    fontFamily,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: 0.3,
  } as TextStyle,

  buttonSmall: {
    fontFamily,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.3,
  } as TextStyle,
} as const;
