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
  String? lastError;
  bool sending = false;

  // Payment state is scoped PER CART (keyed by cartDraftId), not shared
  // across the whole conversation — otherwise, once one order is paid,
  // every other cart card (past or future) would incorrectly show as
  // "Paid" too, since they'd all be reading the same global flag.
  final Map<String, PaymentUiState> _cartPaymentStates = {};
  final Map<String, String> _idempotencyKeys = {};

  // Tracks which cart the currently-open Razorpay checkout belongs to,
  // since Razorpay's success/error callbacks don't carry that context
  // themselves — only one checkout can be open at a time, so this is safe.
  String? _activeCartDraftId;

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

  PaymentUiState stateFor(String cartDraftId) =>
      _cartPaymentStates[cartDraftId] ?? PaymentUiState.idle;

  void _handleAssistantMessage(ChatMessage msg) {
    messages.add(msg);
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

  String _idempotencyKeyFor(String cartDraftId) {
    return _idempotencyKeys.putIfAbsent(cartDraftId, _newIdempotencyKey);
  }

  /// User tapped "Confirm ₹X" on a specific cart card. Each card passes
  /// its OWN cart in, so confirming an older card in the scroll history
  /// (rather than only ever the latest one) works correctly too.
  Future<void> confirmCart(CartDraft cart) async {
    final cartDraftId = cart.cartDraftId;

    if (cart.isExpired) {
      lastError = "This cart has expired — please ask again.";
      notifyListeners();
      return;
    }

    _activeCartDraftId = cartDraftId;
    _cartPaymentStates[cartDraftId] = PaymentUiState.confirming;
    lastError = null;
    notifyListeners();

    // Reused across retries of the SAME cart (covers the double-tap-Pay
    // case) — but each distinct cartDraftId gets its own key.
    final idempotencyKey = _idempotencyKeyFor(cartDraftId);

    try {
      final result = await _api.confirmCheckout(
        conversationId: conversationId,
        cartDraftId: cartDraftId,
        cartHash: cart.cartHash,
        idempotencyKey: idempotencyKey,
      );

      final razorpay = result["razorpay"];
      if (razorpay == null) {
        throw ChatApiException("No payment order returned");
      }

      _cartPaymentStates[cartDraftId] = PaymentUiState.awaitingPayment;
      notifyListeners();

      final options = {
        'key': razorpay["key_id"] ?? Env.razorpayKeyId,
        'amount': razorpay["amount"],
        'currency': razorpay["currency"] ?? "INR",
        'order_id': razorpay["order_id"],
        'name': 'RecoverPay',
        'description': 'Order confirmation',
      };

      _razorpay.open(options);
    } on ChatApiException catch (e) {
      _cartPaymentStates[cartDraftId] = PaymentUiState.failed;
      lastError = e.message;
      // On a 409/410 (hash mismatch / expired), this specific cart is
      // stale — clear its idempotency key. The cart itself can't be
      // retried (it's fixed data from a past message), so the customer
      // needs to ask again for a fresh one.
      if (e.statusCode == 409 || e.statusCode == 410) {
        _idempotencyKeys.remove(cartDraftId);
      }
      notifyListeners();
    }
  }

  Future<void> _onPaymentSuccess(PaymentSuccessResponse response) async {
    final cartDraftId = _activeCartDraftId;
    if (cartDraftId == null) return;

    _cartPaymentStates[cartDraftId] = PaymentUiState.verifying;
    notifyListeners();

    try {
      await _api.verifyPayment(
        conversationId: conversationId,
        razorpayOrderId: response.orderId!,
        razorpayPaymentId: response.paymentId!,
        razorpaySignature: response.signature!,
      );

      _cartPaymentStates[cartDraftId] = PaymentUiState.paid;
      messages.add(ChatMessage(
        sender: MessageSender.assistant,
        text: "Payment confirmed ✅ Your order is on its way!",
      ));
    } on ChatApiException catch (e) {
      _cartPaymentStates[cartDraftId] = PaymentUiState.failed;
      lastError =
          "${e.message} — not charged if this failed before confirmation.";
    }
    notifyListeners();
  }

  void _onPaymentError(PaymentFailureResponse response) {
    final cartDraftId = _activeCartDraftId;
    if (cartDraftId == null) return;

    // Razorpay itself reports failure/cancellation — order stays "created"
    // (unpaid) in our DB. User can retry THIS cart with the same
    // idempotency key, since it's still the same attempt.
    _cartPaymentStates[cartDraftId] = PaymentUiState.failed;
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
