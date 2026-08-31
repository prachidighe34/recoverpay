// features/chat/presentation/cart_card.dart
import 'package:flutter/material.dart';
import '../../../core/config/theme.dart';
import '../../../core/widgets/ticket_notch_row.dart';
import '../data/chat_model.dart';
import 'chat_controller.dart';

/// The confirm-cart card — styled as a paper ticket stub. This is the
/// screen the pitch is built around: items + total, one clear action,
/// nothing ambiguous about what's about to be charged.
class CartCard extends StatelessWidget {
  final CartDraft cart;
  final List<String> outOfStock;
  final PaymentUiState paymentState;
  final VoidCallback onConfirm;

  const CartCard({
    super.key,
    required this.cart,
    required this.outOfStock,
    required this.paymentState,
    required this.onConfirm,
  });

  bool get _isBusy =>
      paymentState == PaymentUiState.confirming ||
      paymentState == PaymentUiState.awaitingPayment ||
      paymentState == PaymentUiState.verifying;

  String get _buttonLabel {
    switch (paymentState) {
      case PaymentUiState.confirming:
        return "Confirming...";
      case PaymentUiState.awaitingPayment:
        return "Waiting for payment...";
      case PaymentUiState.verifying:
        return "Verifying payment...";
      case PaymentUiState.paid:
        return "Paid";
      default:
        return "Confirm  ₹${cart.totalRupees.toStringAsFixed(2)}";
    }
  }

  @override
  Widget build(BuildContext context) {
    final expired = cart.isExpired;
    final paid = paymentState == PaymentUiState.paid;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(4),
        boxShadow: [
          BoxShadow(
            color: AppColors.ink.withValues(alpha: 0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // --- ticket header ---
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 14, 18, 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  "ORDER TICKET",
                  style: AppTheme.ledger(
                    size: 11,
                    weight: FontWeight.w600,
                    color: AppColors.inkFaded,
                  ).copyWith(letterSpacing: 1.5),
                ),
                if (paid)
                  Text(
                    "PAID",
                    style: AppTheme.ledger(
                      size: 11,
                      weight: FontWeight.w700,
                      color: AppColors.basil,
                    ).copyWith(letterSpacing: 1.5),
                  ),
              ],
            ),
          ),

          // --- items, receipt-style rows ---
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Column(
              children: cart.items.map((item) {
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          "${item.name} ×${item.qty}",
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                      Text(
                        "₹${(item.lineTotalPaise / 100).toStringAsFixed(2)}",
                        style: AppTheme.ledger(size: 14),
                      ),
                    ],
                  ),
                );
              }).toList(),
            ),
          ),

          if (outOfStock.isNotEmpty)
            Padding(
              padding: const EdgeInsets.fromLTRB(18, 6, 18, 0),
              child: Text(
                "Out of stock, skipped: ${outOfStock.join(', ')}",
                style: TextStyle(color: AppColors.chili, fontSize: 12),
              ),
            ),

          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: TicketNotchRow(),
          ),

          // --- total ---
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("TOTAL",
                    style: AppTheme.ledger(size: 13, weight: FontWeight.w600)
                        .copyWith(letterSpacing: 1.2)),
                Text(
                  "₹${cart.totalRupees.toStringAsFixed(2)}",
                  style: AppTheme.ledger(size: 18, weight: FontWeight.w700),
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // --- action ---
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 0, 18, 18),
            child: expired && !paid
                ? Row(
                    children: [
                      Icon(Icons.timer_off_outlined,
                          size: 16, color: AppColors.chili),
                      const SizedBox(width: 6),
                      Text(
                        "This ticket has expired — please ask again.",
                        style: TextStyle(color: AppColors.chili, fontSize: 13),
                      ),
                    ],
                  )
                : SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed:
                          (_isBusy || expired || paid) ? null : onConfirm,
                      style: paid
                          ? ElevatedButton.styleFrom(
                              backgroundColor:
                                  AppColors.basil.withValues(alpha: 0.5))
                          : null,
                      child: _isBusy
                          ? const SizedBox(
                              height: 18,
                              width: 18,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white),
                            )
                          : Text(_buttonLabel),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
