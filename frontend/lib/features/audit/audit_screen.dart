import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../chat/data/chat_api.dart';
import '../../core/config/theme.dart';
import '../../core/widgets/loading_view.dart';
import '../../core/widgets/error_view.dart';
import '../../core/widgets/dashed_divider.dart';

class AuditScreen extends StatefulWidget {
  final String conversationId;
  const AuditScreen({super.key, required this.conversationId});

  @override
  State<AuditScreen> createState() => _AuditScreenState();
}

class _AuditScreenState extends State<AuditScreen> {
  final ChatApi _api = ChatApi();
  late Future<List<Map<String, dynamic>>> _trailFuture;

  @override
  void initState() {
    super.initState();
    _trailFuture = _api.getAuditTrail(widget.conversationId);
  }

  void _reload() {
    setState(() {
      _trailFuture = _api.getAuditTrail(widget.conversationId);
    });
  }

  IconData _iconForEvent(String event) {
    switch (event) {
      case "message_received":
        return Icons.chat_bubble_outline;
      case "intent_parsed":
        return Icons.psychology_outlined;
      case "intent_parse_failed":
        return Icons.help_outline;
      case "cart_drafted":
        return Icons.receipt_long_outlined;
      case "checkout_confirmed":
        return Icons.check_circle_outline;
      case "razorpay_order_created":
        return Icons.confirmation_number_outlined;
      case "payment_verified":
        return Icons.verified_outlined;
      case "payment_failed":
        return Icons.error_outline;
      case "duplicate_confirm_blocked":
        return Icons.block_outlined;
      case "cart_expired":
        return Icons.timer_off_outlined;
      default:
        return Icons.circle_outlined;
    }
  }

  Color _colorForEvent(String event) {
    switch (event) {
      case "payment_verified":
      case "checkout_confirmed":
        return AppColors.basil;
      case "payment_failed":
      case "cart_expired":
      case "duplicate_confirm_blocked":
        return AppColors.chili;
      default:
        return AppColors.inkFaded;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Audit Trail")),
      body: FutureBuilder<List<Map<String, dynamic>>>(
        future: _trailFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LoadingView(message: "Loading audit trail...");
          }
          if (snapshot.hasError) {
            return ErrorView(
                message: "Failed to load: ${snapshot.error}", onRetry: _reload);
          }

          final trail = snapshot.data ?? [];
          if (trail.isEmpty) {
            return Center(
              child: Text(
                "No events yet for this conversation.",
                style: TextStyle(color: AppColors.inkFaded),
              ),
            );
          }

          return ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            itemCount: trail.length,
            itemBuilder: (context, index) {
              final entry = trail[index];
              final event = entry["event"] as String;
              final payload = Map<String, dynamic>.from(entry["payload"] ?? {});
              final at = DateTime.tryParse(entry["at"] ?? "");
              final isLast = index == trail.length - 1;

              return _TrailRow(
                icon: _iconForEvent(event),
                color: _colorForEvent(event),
                event: event,
                detail: payload.entries
                    .map((e) => "${e.key}: ${e.value}")
                    .join("  ·  "),
                time: at != null ? DateFormat.Hms().format(at) : null,
                isLast: isLast,
              );
            },
          );
        },
      ),
    );
  }
}

class _TrailRow extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String event;
  final String detail;
  final String? time;
  final bool isLast;

  const _TrailRow({
    required this.icon,
    required this.color,
    required this.event,
    required this.detail,
    required this.time,
    required this.isLast,
  });

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // --- ledger rail: icon + connecting line ---
          Column(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 16, color: color),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 1.5,
                    margin: const EdgeInsets.symmetric(vertical: 4),
                    color: AppColors.ink.withValues(alpha: 0.08),
                  ),
                ),
            ],
          ),
          const SizedBox(width: 12),

          // --- entry content ---
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(bottom: 18, top: 2),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        event.replaceAll("_", " ").toUpperCase(),
                        style: AppTheme.ledger(
                                size: 12,
                                weight: FontWeight.w700,
                                color: AppColors.ink)
                            .copyWith(letterSpacing: 0.5),
                      ),
                      if (time != null)
                        Text(time!,
                            style: AppTheme.ledger(
                                size: 11, color: AppColors.inkFaded)),
                    ],
                  ),
                  if (detail.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      detail,
                      style: TextStyle(
                          fontSize: 12.5,
                          color: AppColors.inkFaded,
                          height: 1.4),
                    ),
                  ],
                  const SizedBox(height: 8),
                  if (!isLast)
                    DashedDivider(color: AppColors.ink.withValues(alpha: 0.4)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
