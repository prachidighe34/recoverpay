import 'package:dio/dio.dart';
import '../../../core/network/api_client.dart';
import 'chat_model.dart';

class ChatApiException implements Exception {
  final String message;
  final int? statusCode;
  ChatApiException(this.message, {this.statusCode});
  @override
  String toString() => message;
}

class ChatApi {
  final Dio _dio = ApiClient().dio;

  /// POST /agent/turn — no charge. Returns a plain reply (e.g. catalog
  /// listing or clarification) or a priced cart draft, depending on intent.
  Future<ChatMessage> sendTurn(String conversationId, String message) async {
    try {
      final res = await _dio.post("/agent/turn", data: {
        "conversationId": conversationId,
        "message": message,
      });

      final data = res.data;
      final cartJson = data["cart"];

      // cart is only present when the message resolved to actual items —
      // catalog-listing replies and clarification replies both have cart: null
      if (cartJson == null) {
        return ChatMessage(
          sender: MessageSender.assistant,
          text: data["reply"] ?? "Sorry, I didn't understand that.",
        );
      }

      final cart = CartDraft.fromJson(cartJson);
      final outOfStock = List<String>.from(data["outOfStock"] ?? []);

      return ChatMessage(
        sender: MessageSender.assistant,
        text: data["reply"] ??
            "Here's your cart — ₹${cart.totalRupees.toStringAsFixed(2)}. Confirm to proceed.",
        cart: cart,
        outOfStock: outOfStock,
      );
    } on DioException catch (e) {
      throw ChatApiException(
        e.response?.data?["error"] ?? "Failed to reach assistant",
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// POST /checkout/confirm — gated by cart_hash + idempotency_key.
  /// Returns the Razorpay order details needed to open Checkout.
  Future<Map<String, dynamic>> confirmCheckout({
    required String conversationId,
    required String cartDraftId,
    required String cartHash,
    required String idempotencyKey,
  }) async {
    try {
      final res = await _dio.post("/checkout/confirm", data: {
        "conversationId": conversationId,
        "cartDraftId": cartDraftId,
        "cart_hash": cartHash,
        "idempotency_key": idempotencyKey,
      });
      return res.data;
    } on DioException catch (e) {
      throw ChatApiException(
        e.response?.data?["error"] ?? "Checkout failed — not charged",
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// POST /checkout/verify — after Razorpay Checkout success callback
  Future<Map<String, dynamic>> verifyPayment({
    required String conversationId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    try {
      final res = await _dio.post("/checkout/verify", data: {
        "conversationId": conversationId,
        "razorpay_order_id": razorpayOrderId,
        "razorpay_payment_id": razorpayPaymentId,
        "razorpay_signature": razorpaySignature,
      });
      return res.data;
    } on DioException catch (e) {
      throw ChatApiException(
        e.response?.data?["error"] ??
            "Payment verification failed — not charged",
        statusCode: e.response?.statusCode,
      );
    }
  }

  /// GET /audit/:conversationId
  Future<List<Map<String, dynamic>>> getAuditTrail(
      String conversationId) async {
    try {
      final res = await _dio.get("/audit/$conversationId");
      return List<Map<String, dynamic>>.from(res.data["trail"]);
    } on DioException catch (e) {
      throw ChatApiException(
        e.response?.data?["error"] ?? "Failed to load audit trail",
        statusCode: e.response?.statusCode,
      );
    }
  }
}
