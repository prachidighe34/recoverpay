import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// StoreChat design tokens.
/// Direction: a grocery-market paper-ticket motif — fitting for a chat
/// checkout app where every money step gets logged. Prices and the audit
/// trail are set in monospace, like a receipt printer; headlines use a
/// characterful serif to feel like a market stall sign, not a fintech app.
class AppColors {
  static const ink = Color(0xFF1B2B23); // near-black, green-black text
  static const paper = Color(0xFFF1F4EC); // pale sage paper background
  static const marigold = Color(0xFFE8A33D); // primary — market warmth
  static const basil = Color(0xFF2F6B4F); // secondary — trust, "paid"
  static const chili = Color(0xFFC1442E); // errors only
  static const surface = Color(0xFFFFFFFF);
  static const inkFaded = Color(0xFF5C6B61);
}

class AppTheme {
  static TextTheme _textTheme(TextTheme base) {
    return base.copyWith(
      displayLarge: GoogleFonts.fraunces(
        fontSize: 34,
        fontWeight: FontWeight.w600,
        color: AppColors.ink,
        height: 1.1,
      ),
      titleLarge: GoogleFonts.fraunces(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        color: AppColors.ink,
      ),
      titleMedium: GoogleFonts.fraunces(
        fontSize: 18,
        fontWeight: FontWeight.w600,
        color: AppColors.ink,
      ),
      bodyLarge: GoogleFonts.publicSans(fontSize: 16, color: AppColors.ink),
      bodyMedium: GoogleFonts.publicSans(fontSize: 14, color: AppColors.ink),
      bodySmall:
          GoogleFonts.publicSans(fontSize: 12, color: AppColors.inkFaded),
      labelLarge:
          GoogleFonts.publicSans(fontSize: 14, fontWeight: FontWeight.w600),
    );
  }

  /// Monospace style for anything money- or log-related: prices, cart
  /// ledger lines, audit trail timestamps. This is the ticket-printer voice.
  static TextStyle ledger(
      {double size = 14, FontWeight weight = FontWeight.w500, Color? color}) {
    return GoogleFonts.ibmPlexMono(
        fontSize: size, fontWeight: weight, color: color ?? AppColors.ink);
  }

  static ThemeData get theme {
    final base = ThemeData(useMaterial3: true, brightness: Brightness.light);

    return base.copyWith(
      scaffoldBackgroundColor: AppColors.paper,
      colorScheme: base.colorScheme.copyWith(
        primary: AppColors.marigold,
        onPrimary: AppColors.ink,
        secondary: AppColors.basil,
        onSecondary: Colors.white,
        error: AppColors.chili,
        surface: AppColors.surface,
        onSurface: AppColors.ink,
      ),
      textTheme: _textTheme(base.textTheme),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.paper,
        foregroundColor: AppColors.ink,
        elevation: 0,
        centerTitle: false,
        titleTextStyle: GoogleFonts.fraunces(
          fontSize: 20,
          fontWeight: FontWeight.w600,
          color: AppColors.ink,
        ),
      ),
      cardTheme: const CardThemeData(
        color: AppColors.surface,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        margin: EdgeInsets.zero,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: AppColors.ink.withValues(alpha: 0.12)),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide(color: AppColors.ink.withValues(alpha: 0.12)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: AppColors.basil, width: 1.5),
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.basil,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          textStyle:
              GoogleFonts.publicSans(fontSize: 15, fontWeight: FontWeight.w600),
          elevation: 0,
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: SegmentedButton.styleFrom(
          selectedBackgroundColor: AppColors.marigold,
          selectedForegroundColor: AppColors.ink,
        ),
      ),
    );
  }
}
