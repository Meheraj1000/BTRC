import "package:flutter/material.dart";

/// Nirapad Transit tokens — same HEX values as `frontend/src/app/globals.css`
/// (Bangladesh national bottle green + civic navy + national red).
class NirapadColors {
  static const primary = Color(0xFF006747);
  static const primaryHover = Color(0xFF2A9B6A);
  static const primaryActive = Color(0xFF004530);
  static const secondary = Color(0xFF0B1F33);
  static const accent = Color(0xFF2A9B6A);
  static const background = Color(0xFFF3F6F4);
  static const surface = Color(0xFFFFFFFF);
  static const surfaceSecondary = Color(0xFFE7F0EB);
  static const textPrimary = Color(0xFF0B1F33);
  static const textSecondary = Color(0xFF3D5160);
  static const textMuted = Color(0xFF5B6B76);
  static const border = Color(0xFFD0DDD6);
  static const success = Color(0xFF006747);
  static const warning = Color(0xFFB45309);
  static const warningBg = Color(0xFFFEF3C7);
  static const error = Color(0xFFDA291C);
  static const info = Color(0xFF00553A);
}

ThemeData nirapadTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: NirapadColors.primary,
    primary: NirapadColors.primary,
    secondary: NirapadColors.secondary,
    tertiary: NirapadColors.accent,
    surface: NirapadColors.surface,
    error: NirapadColors.error,
    brightness: Brightness.light,
  );
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: NirapadColors.background,
    appBarTheme: const AppBarTheme(
      backgroundColor: NirapadColors.secondary,
      foregroundColor: Colors.white,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: NirapadColors.primary,
        foregroundColor: Colors.white,
      ),
    ),
    inputDecorationTheme: const InputDecorationTheme(
      focusedBorder: UnderlineInputBorder(
        borderSide: BorderSide(color: NirapadColors.primary, width: 2),
      ),
    ),
    navigationBarTheme: const NavigationBarThemeData(
      indicatorColor: NirapadColors.surfaceSecondary,
    ),
  );
}
