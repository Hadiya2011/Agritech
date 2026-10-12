// AquaCrop AI theme — filled from /app/design_guidelines.json (dark-first earthy).
import { useMemo } from "react";
import { Appearance, StyleSheet, useColorScheme } from "react-native";

export type ColorScheme = "light" | "dark";

const dark = {
  surface: "#0E140D",
  onSurface: "#F3F4F0",
  surfaceSecondary: "#1A2318",
  onSurfaceSecondary: "#E1E4DB",
  surfaceTertiary: "#263322",
  onSurfaceTertiary: "#D3D9CA",
  surfaceInverse: "#F3F4F0",
  onSurfaceInverse: "#0E140D",
  muted: "#9CA3AF",

  brand: "#D97706",
  onBrand: "#FFFFFF",
  brandPrimary: "#EA580C",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#F59E0B",
  onBrandSecondary: "#3D1F00",
  brandTertiary: "#3E2A12",
  onBrandTertiary: "#FCD34D",

  success: "#22C55E",
  onSuccess: "#000000",
  warning: "#F59E0B",
  onWarning: "#000000",
  error: "#EF4444",
  onError: "#FFFFFF",
  info: "#A8A29E",
  onInfo: "#000000",

  border: "#263322",
  borderStrong: "#44593C",
  divider: "#1A2318",
};

export type ThemeColors = typeof dark;

export const defaultScheme = "dark" satisfies ColorScheme;
export const themes: { light?: ThemeColors; dark: ThemeColors } = { dark };

export function setColorScheme(scheme: ColorScheme | null) {
  Appearance.setColorScheme?.(scheme);
}
setColorScheme?.(defaultScheme);

export const colors = dark;

export function useTheme(): { scheme: ColorScheme; colors: ThemeColors } {
  const system = useColorScheme();
  const scheme: ColorScheme = system === "light" ? "light" : "dark";
  return { scheme, colors: themes[scheme] ?? themes.dark };
}

export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  factory: (colors: ThemeColors) => T & StyleSheet.NamedStyles<any>,
): () => T {
  return function useStyles(): T {
    const { colors: c } = useTheme();
    return useMemo(() => StyleSheet.create(factory(c)), [c]);
  };
}
