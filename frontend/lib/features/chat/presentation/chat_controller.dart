import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import '../data/chat_api.dart';
import '../data/chat_socket.dart';
import '../data/chat_model.dart';
import '../../../core/config/env.dart';

enum PaymentUiState {
  idle,
  confirming,
  awaitingPayment,
  verifying,
  paid,
  failed
}

class ChatController extends ChangeNotifier {
  final String conversationId;
  final ChatApi _api = ChatApi();
  final ChatSocket _socket = ChatSocket();
  final Razorpay _razorpay = Razorpay();

  final List<ChatMessage> messages = [];
  CartDraft? pendingCart;
  PaymentUiState paymentState = PaymentUiState.idle;
  String? lastError;
  bool sending = false;

  // Generated once per confirm attempt — a NEW key each time the user
  // taps Confirm on a NEW cart, but reused if they retry the SAME cart
  // after a failure, so a retry doesn't double-charge either.
  String? _currentIdempotencyKey;

  ChatController({required this.conversationId}) {
    _socket.connect();
    _socket.onAssistantReply(_handleAssistantMessage);
    _socket.onError((error) {
      lastError = error;
      notifyListeners();
    });

    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onPaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _onPaymentError);
  }

  void _handleAssistantMessage(ChatMessage msg) {
    messages.add(msg);
    if (msg.cart != null) {
      pendingCart = msg.cart;
    }
    sending = false;
    notifyListeners();
  }

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    messages.add(ChatMessage(sender: MessageSender.customer, text: text));
    sending = true;
    lastError = null;
    notifyListeners();

    // Socket path is primary; REST is the fallback if socket isn't connected.
    try {
      _socket.sendMessage(conversationId, text);
    } catch (_) {
      final reply = await _api.sendTurn(conversationId, text);
      _handleAssistantMessage(reply);
    }
  }

  String _newIdempotencyKey() {
    final rand = Random().nextInt(999999);
    return "$conversationId-${DateTime.now().millisecondsSinceEpoch}-$rand";
  }

  /// User tapped "Confirm ₹X" on the cart card.
  Future<void> confirmCart() async {
    final cart = pendingCart;
    if (cart == null) return;

    if (cart.isExpired) {
      lastError = "This cart has expired — please ask again.";
      notifyListeners();
      return;
    }

    paymentState = PaymentUiState.confirming;
    lastError = null;
    notifyListeners();

    // Only mint a new key if we don't already have one in flight for
    // this exact cart (covers the double-tap-Pay case).
    _currentIdempotencyKey ??= _newIdempotencyKey();

    try {
      final result = await _api.confirmCheckout(
        conversationId: conversationId,
        cartDraftId: cart.cartDraftId,
        cartHash: cart.cartHash,
        idempotencyKey: _currentIdempotencyKey!,
      );

      final razorpay = result["razorpay"];
      if (razorpay == null) {
        throw ChatApiException("No payment order returned");
      }

      paymentState = PaymentUiState.awaitingPayment;
      notifyListeners();

      final options = {
        'key': razorpay["key_id"] ?? Env.razorpayKeyId,
        'amount': razorpay["amount"],
        'currency': razorpay["currency"] ?? "INR",
        'order_id': razorpay["order_id"],
        'name': 'StoreChat',
        'description': 'Order confirmation',
      };

      _razorpay.open(options);
    } on ChatApiException catch (e) {
      paymentState = PaymentUiState.failed;
      lastError = e.message;
      // On a 409/410 (hash mismatch / expired), the cart itself is stale —
      // clear the idempotency key so a fresh cart gets a fresh one.
      if (e.statusCode == 409 || e.statusCode == 410) {
        _currentIdempotencyKey = null;
        pendingCart = null;
      }
      notifyListeners();
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    paymentState = PaymentUiState.verifying;
    notifyListeners();

    try {
      await _api.verifyPayment(
        conversationId: conversationId,
        razorpayOrderId: response.orderId!,
        razorpayPaymentId: response.paymentId!,
        razorpaySignature: response.signature!,
      );

      paymentState = PaymentUiState.paid;
      pendingCart = null;
      _currentIdempotencyKey = null;
      messages.add(ChatMessage(
        sender: MessageSender.assistant,
        text: "Payment confirmed ✅ Your order is on its way!",
      ));
    } on ChatApiException catch (e) {
      paymentState = PaymentUiState.failed;
      lastError =
          "${e.message} — not charged if this failed before confirmation.";
    }
    notifyListeners();
  }

  void _onPaymentError(PaymentFailureResponse response) {
    // Razorpay itself reports failure/cancellation — order stays "created"
    // (unpaid) in our DB. User can retry with the SAME idempotency key,
    // since it's still the same cart attempt.
    paymentState = PaymentUiState.failed;
    lastError =
        "Payment not completed — you were not charged. You can try again.";
    notifyListeners();
  }

  @override
  void dispose() {
    _socket.dispose();
    _razorpay.clear();
    super.dispose();
  }
}
