import 'package:flutter/material.dart';
import 'core/config/routes.dart';
import 'core/config/theme.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/chat/presentation/chat_screen.dart';
import 'features/audit/audit_screen.dart';

class StoreChatApp extends StatelessWidget {
  const StoreChatApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'RecoverPay',
      theme: AppTheme.theme,
      initialRoute: Routes.login,
      onGenerateRoute: (settings) {
        switch (settings.name) {
          case Routes.login:
            return MaterialPageRoute(builder: (_) => const LoginScreen());
          case Routes.register:
            return MaterialPageRoute(builder: (_) => const RegisterScreen());
          case Routes.chat:
            final conversationId = settings.arguments as String;
            return MaterialPageRoute(
              builder: (_) => ChatScreen(conversationId: conversationId),
            );
          case Routes.audit:
            final conversationId = settings.arguments as String;
            return MaterialPageRoute(
              builder: (_) => AuditScreen(conversationId: conversationId),
            );
          default:
            return MaterialPageRoute(
              builder: (_) => const Scaffold(
                body: Center(child: Text("Route not found")),
              ),
            );
        }
      },
    );
  }
}
