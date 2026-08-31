import 'package:dio/dio.dart';
import '../../core/network/api_client.dart';

class AuthApiException implements Exception {
  final String message;
  AuthApiException(this.message);
  @override
  String toString() => message;
}

class AuthUser {
  final String id;
  final String name;
  final String email;
  final String role;

  AuthUser(
      {required this.id,
      required this.name,
      required this.email,
      required this.role});

  factory AuthUser.fromJson(Map<String, dynamic> json) => AuthUser(
        id: json["id"],
        name: json["name"],
        email: json["email"],
        role: json["role"],
      );
}

class AuthApi {
  final Dio _dio = ApiClient().dio;

  Future<AuthUser> register({
    required String name,
    required String email,
    required String password,
    String role = "customer",
  }) async {
    try {
      final res = await _dio.post("/auth/register", data: {
        "name": name,
        "email": email,
        "password": password,
        "role": role,
      });
      await ApiClient().setToken(res.data["token"]);
      return AuthUser.fromJson(res.data["user"]);
    } on DioException catch (e) {
      throw AuthApiException(
          e.response?.data?["error"] ?? "Registration failed");
    }
  }

  Future<AuthUser> login(
      {required String email, required String password}) async {
    try {
      final res = await _dio.post("/auth/login", data: {
        "email": email,
        "password": password,
      });
      await ApiClient().setToken(res.data["token"]);
      return AuthUser.fromJson(res.data["user"]);
    } on DioException catch (e) {
      throw AuthApiException(e.response?.data?["error"] ?? "Login failed");
    }
  }

  Future<String> createConversation() async {
    try {
      final res = await _dio.post("/conversations");
      return res.data["conversation"]["id"];
    } on DioException catch (e) {
      throw AuthApiException(
          e.response?.data?["error"] ?? "Could not start a new chat");
    }
  }

  Future<void> logout() async {
    await ApiClient().clearToken();
  }
}
