// features/auth/login_screen.dart
import 'package:flutter/material.dart';
import '../../core/config/routes.dart';
import '../../core/config/theme.dart';
import 'auth_api.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _authApi = AuthApi();

  bool _loading = false;
  String? _error;

  Future<void> _login() async {
    if (_loading) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await _authApi.login(
        email: _emailController.text.trim(),
        password: _passwordController.text,
      );
      final conversationId = await _authApi.createConversation();

      if (!mounted) return;
      Navigator.of(context)
          .pushReplacementNamed(Routes.chat, arguments: conversationId);
    } on AuthApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 28),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 40),
                // --- wordmark ---
                Text(
                  "StoreChat",
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.displayLarge,
                ),
                const SizedBox(height: 6),
                Text(
                  "chat.  confirm.  paid.",
                  textAlign: TextAlign.center,
                  style: AppTheme.ledger(size: 13, color: AppColors.inkFaded)
                      .copyWith(letterSpacing: 2),
                ),
                const SizedBox(height: 48),

                TextField(
                  controller: _emailController,
                  decoration: const InputDecoration(labelText: "Email"),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordController,
                  decoration: const InputDecoration(labelText: "Password"),
                  obscureText: true,
                  onSubmitted: (_) => _login(),
                ),

                if (_error != null) ...[
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Icon(Icons.error_outline,
                          size: 16, color: AppColors.chili),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(_error!,
                            style: TextStyle(
                                color: AppColors.chili, fontSize: 13)),
                      ),
                    ],
                  ),
                ],

                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _loading ? null : _login,
                  child: _loading
                      ? const SizedBox(
                          height: 18,
                          width: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Text("Log in"),
                ),
                const SizedBox(height: 14),
                Center(
                  child: TextButton(
                    onPressed: () =>
                        Navigator.of(context).pushNamed(Routes.register),
                    child: Text(
                      "Don't have an account? Register",
                      style: TextStyle(
                          color: AppColors.basil, fontWeight: FontWeight.w600),
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
