import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, StyleProp, StyleSheet, TextStyle, ViewStyle, ImageStyle } from 'react-native';

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  input: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  icon: string;
  primary: string;
  primarySoft: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
  shadow: string;
}

export const lightColors: ThemeColors = {
  background: '#dfe2ec',
  backgroundSecondary: '#d7dbe7',
  surface: '#f4f4f5',
  surfaceElevated: '#ffffff',
  input: '#f0f2f7',
  border: '#d0d5e0',
  borderStrong: '#aeb5c7',
  text: '#151922',
  textSecondary: '#5f6875',
  textMuted: '#7d818b',
  icon: '#2a2f38',
  primary: '#2f5ada',
  primarySoft: '#dbe4ff',
  success: '#2f7a40',
  warning: '#8a6810',
  danger: '#b9463b',
  overlay: 'rgba(15, 18, 28, 0.44)',
  shadow: '#000000',
};

export const darkColors: ThemeColors = {
  background: '#11151c',
  backgroundSecondary: '#171c25',
  surface: '#1d232d',
  surfaceElevated: '#252c38',
  input: '#202733',
  border: '#343d4d',
  borderStrong: '#4a566a',
  text: '#f4f6fb',
  textSecondary: '#bac2d0',
  textMuted: '#929cad',
  icon: '#d8deea',
  primary: '#4f70d8',
  primarySoft: '#26375f',
  success: '#70d184',
  warning: '#e5bd57',
  danger: '#ff8278',
  overlay: 'rgba(0, 0, 0, 0.68)',
  shadow: '#000000',
};

const THEME_STORAGE_KEY = '@marketsync/theme-mode';

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  isHydrating: boolean;
  setMode: (mode: ThemeMode) => Promise<void>;
  resolveColor: (color: string) => string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const darkColorMap: Record<string, string> = {
  '#dfe2ec': darkColors.background,
  '#d8dbe7': darkColors.backgroundSecondary,
  '#d7dbe7': darkColors.backgroundSecondary,
  '#f0f2ff': darkColors.background,
  '#eef0f5': darkColors.backgroundSecondary,
  '#eef0f6': darkColors.backgroundSecondary,
  '#f1f1f1': darkColors.surface,
  '#f1f1f2': darkColors.surface,
  '#f2f2f3': darkColors.surface,
  '#f3f3f3': darkColors.surface,
  '#f3f5fa': darkColors.surface,
  '#f4f4f5': darkColors.surface,
  '#f5f5f5': darkColors.surface,
  '#f5f5f8': darkColors.surface,
  '#f7f7f8': darkColors.surfaceElevated,
  '#f8f8f8': darkColors.surfaceElevated,
  '#f8f9fc': darkColors.surfaceElevated,
  '#fbfbfb': darkColors.surfaceElevated,
  '#ffffff': darkColors.surfaceElevated,
  '#fff': darkColors.surfaceElevated,
  '#eee': darkColors.input,
  '#ececec': darkColors.input,
  '#edf0f6': darkColors.input,
  '#f0f2f7': darkColors.input,
  '#e4e4e5': darkColors.input,
  '#dedfe5': darkColors.input,
  '#d5dbe8': darkColors.border,
  '#d0d4df': darkColors.border,
  '#d0d5e0': darkColors.border,
  '#d1d4de': darkColors.border,
  '#d1d5df': darkColors.border,
  '#d2d5de': darkColors.border,
  '#d3d7e1': darkColors.border,
  '#d6dae4': darkColors.border,
  '#d7dbe5': darkColors.border,
  '#d9dde8': darkColors.border,
  '#c7ccd9': darkColors.border,
  '#c8ccd8': darkColors.border,
  '#cfd4df': darkColors.border,
  '#b7bbc5': darkColors.borderStrong,
  '#b8b8be': darkColors.borderStrong,
  '#b9bdc8': darkColors.borderStrong,
  '#c1c6d3': darkColors.borderStrong,
  '#c2c7d3': darkColors.borderStrong,
  '#c3c8d8': darkColors.borderStrong,
  '#c4c9d5': darkColors.borderStrong,
  '#aeb3bf': darkColors.borderStrong,
  '#aeb5c7': darkColors.borderStrong,
  '#9ea4b3': darkColors.borderStrong,
  '#0f1014': darkColors.text,
  '#0f1118': darkColors.text,
  '#11131a': darkColors.text,
  '#11151b': darkColors.text,
  '#11151f': darkColors.text,
  '#12141a': darkColors.text,
  '#12151a': darkColors.text,
  '#141925': darkColors.text,
  '#151923': darkColors.text,
  '#151922': darkColors.text,
  '#171b22': darkColors.text,
  '#1c2028': darkColors.text,
  '#1c2029': darkColors.text,
  '#1d2128': darkColors.text,
  '#1d222a': darkColors.text,
  '#1f2530': darkColors.text,
  '#20242d': darkColors.text,
  '#20252c': darkColors.text,
  '#212328': darkColors.text,
  '#242830': darkColors.text,
  '#242a32': darkColors.text,
  '#252a32': darkColors.text,
  '#252a33': darkColors.text,
  '#272c33': darkColors.icon,
  '#2a2d34': darkColors.icon,
  '#2a2f38': darkColors.icon,
  '#2b2f36': darkColors.icon,
  '#2e3138': darkColors.icon,
  '#333': darkColors.textSecondary,
  '#333844': darkColors.icon,
  '#40444f': darkColors.textSecondary,
  '#475067': darkColors.textSecondary,
  '#4d5666': darkColors.textSecondary,
  '#4d5668': darkColors.textSecondary,
  '#575e6d': darkColors.textSecondary,
  '#5f6875': darkColors.textSecondary,
  '#5f6878': darkColors.textSecondary,
  '#626976': darkColors.textSecondary,
  '#626a7b': darkColors.textSecondary,
  '#626b7b': darkColors.textSecondary,
  '#666': darkColors.textSecondary,
  '#666d7c': darkColors.textSecondary,
  '#687085': darkColors.textSecondary,
  '#687285': darkColors.textSecondary,
  '#6a6e77': darkColors.textSecondary,
  '#6a7182': darkColors.textSecondary,
  '#6b7280': darkColors.textSecondary,
  '#6c707a': darkColors.textSecondary,
  '#6d7280': darkColors.textSecondary,
  '#6f737c': darkColors.textSecondary,
  '#737579': darkColors.textMuted,
  '#747b8a': darkColors.textMuted,
  '#777': darkColors.textMuted,
  '#7a808e': darkColors.textMuted,
  '#7c8089': darkColors.textMuted,
  '#7d818b': darkColors.textMuted,
  '#80848e': darkColors.textMuted,
  '#858b98': darkColors.textMuted,
  '#898989': darkColors.textMuted,
  '#8a93a5': darkColors.textMuted,
  '#8d919a': darkColors.textMuted,
  '#8d929d': darkColors.textMuted,
  '#8e939e': darkColors.textMuted,
  '#8f8f93': darkColors.textMuted,
  '#8f9196': darkColors.textMuted,
  '#8f939c': darkColors.textMuted,
  '#9aa0ac': darkColors.textMuted,
  '#a1a6b1': darkColors.textMuted,
  '#a2a6af': darkColors.textMuted,
  '#2f5ada': darkColors.primary,
  '#315bd7': darkColors.primary,
  '#2f58cc': darkColors.primary,
  '#2448a4': darkColors.primary,
  '#2849a9': darkColors.primary,
  '#1f61e8': darkColors.primary,
  '#1f63e6': darkColors.primary,
  '#e4ebff': darkColors.primarySoft,
  '#e9efff': darkColors.primarySoft,
  '#eef2ff': darkColors.primarySoft,
  '#eef4ff': darkColors.primarySoft,
  '#dbe4ff': darkColors.primarySoft,
  '#dce4f7': '#273653',
  '#cbd8f4': '#304161',
  '#ccd9f6': '#304161',
  '#cbd6fa': '#30466f',
  '#a9beef': '#30466f',
  '#a9bdee': '#30466f',
  '#b8c8fa': '#3a5388',
  '#d9f1dc': '#203d2a',
  '#ddf4e4': '#203d2a',
  '#a3e2a6': '#264b30',
  '#8ce09d': '#264b30',
  '#fff2cc': '#4a3c19',
  '#f7ebc1': '#493e20',
  '#fde4e1': '#4b2928',
  '#fde8e6': '#4b2928',
  '#f7dddd': '#4b2928',
  '#f0dcdd': '#4b2928',
  '#fcefed': '#452a29',
  '#ef8f8f': '#673638',
  '#cf5a53': '#c85f58',
  '#d4463e': '#e2665e',
  '#d85647': '#ed786d',
  '#d95b57': '#e06d67',
  '#b3261e': darkColors.danger,
  '#a33': darkColors.danger,
  '#a33d36': darkColors.danger,
  '#a23b32': darkColors.danger,
  '#9a352f': darkColors.danger,
  '#9a3f38': darkColors.danger,
  '#a33b35': darkColors.danger,
  '#8f302a': darkColors.danger,
  '#7c443f': '#f0a19a',
  '#5b1e1e': '#ffaaa4',
  '#2f7a36': darkColors.success,
  '#2f7a40': darkColors.success,
  '#27723a': darkColors.success,
  '#44aa58': darkColors.success,
  '#56b764': darkColors.success,
  '#8a6810': darkColors.warning,
  '#d8b83d': darkColors.warning,
  '#000000': darkColors.shadow,
  '#000': darkColors.shadow,
  'rgba(15, 18, 28, 0.44)': darkColors.overlay,
  'rgba(0, 0, 0, 0.35)': darkColors.overlay,
};

function parseHex(color: string): [number, number, number] | null {
  const normalized = color.toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    return [
      parseInt(normalized[1] + normalized[1], 16),
      parseInt(normalized[2] + normalized[2], 16),
      parseInt(normalized[3] + normalized[3], 16),
    ];
  }
  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return [
      parseInt(normalized.slice(1, 3), 16),
      parseInt(normalized.slice(3, 5), 16),
      parseInt(normalized.slice(5, 7), 16),
    ];
  }
  return null;
}

function rgbToHex(red: number, green: number, blue: number): string {
  return `#${[red, green, blue].map((value) => Math.round(value).toString(16).padStart(2, '0')).join('')}`;
}

function mapDarkColor(color: string, property?: string): string {
  const normalized = color.toLowerCase();
  const rgb = parseHex(normalized);

  // White text is normally placed on a brand or destructive button and should stay white.
  if (property === 'color' && rgb && Math.min(...rgb) >= 225) return color;

  const mapped = darkColorMap[normalized];
  if (mapped) return mapped;
  if (!rgb) return color;

  const [red, green, blue] = rgb;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  const saturation = max === 0 ? 0 : (max - min) / max;

  if (property === 'color') {
    if (luminance < 0.22 && saturation < 0.28) return darkColors.text;
    if (luminance < 0.55 && saturation < 0.2) return darkColors.textSecondary;
    if (luminance < 0.58 && saturation >= 0.2) {
      return rgbToHex(red * 0.62 + 97, green * 0.62 + 97, blue * 0.62 + 97);
    }
    return color;
  }

  if (property?.toLowerCase().includes('border')) {
    if (luminance > 0.58) return darkColors.border;
    return color;
  }

  if (property === 'backgroundColor' || property === undefined) {
    if (luminance > 0.72 && saturation < 0.16) return darkColors.surface;
    if (luminance > 0.62) {
      // Preserve the hue of category/status pastels while making them suitable for a dark surface.
      return rgbToHex(red * 0.34, green * 0.34, blue * 0.34);
    }
    if (property === undefined && luminance < 0.58 && saturation >= 0.2) {
      return rgbToHex(red * 0.62 + 97, green * 0.62 + 97, blue * 0.62 + 97);
    }
    if (property === undefined && luminance < 0.4) return darkColors.textSecondary;
  }

  return color;
}

export function ThemeProvider({ children }: React.PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [isHydrating, setIsHydrating] = useState(true);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((stored) => {
        const nextMode: ThemeMode = stored === 'dark' ? 'dark' : 'light';
        if (active) {
          setModeState(nextMode);
          Appearance.setColorScheme(nextMode);
        }
      })
      .catch(() => {
        if (active) Appearance.setColorScheme('light');
      })
      .finally(() => {
        if (active) setIsHydrating(false);
      });
    return () => { active = false; };
  }, []);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    setModeState(nextMode);
    Appearance.setColorScheme(nextMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode);
    } catch {
      // Keep the in-memory preference active even if device storage is temporarily unavailable.
    }
  }, []);

  const isDark = mode === 'dark';
  const resolveColor = useCallback((color: string) => isDark ? mapDarkColor(color) : color, [isDark]);
  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    isDark,
    colors: isDark ? darkColors : lightColors,
    isHydrating,
    setMode,
    resolveColor,
  }), [isDark, isHydrating, mode, resolveColor, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}

type NamedStyles = Record<string, StyleProp<ViewStyle | TextStyle | ImageStyle>>;

export function useThemedStyles<T extends NamedStyles>(source: T): T {
  const { isDark, resolveColor } = useTheme();
  return useMemo(() => {
    if (!isDark) return source;
    return Object.fromEntries(Object.entries(source).map(([name, value]) => {
      const flattened = StyleSheet.flatten(value) as Record<string, unknown> | undefined;
      if (!flattened) return [name, value];
      const themed = { ...flattened };
      for (const [property, propertyValue] of Object.entries(themed)) {
        if (typeof propertyValue === 'string' && (property === 'color' || property.toLowerCase().endsWith('color'))) {
          themed[property] = mapDarkColor(propertyValue, property);
        }
      }
      return [name, themed];
    })) as T;
  }, [isDark, resolveColor, source]);
}
