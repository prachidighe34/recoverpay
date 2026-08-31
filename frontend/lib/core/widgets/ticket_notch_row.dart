// core/widgets/ticket_notch_row.dart
import 'package:flutter/material.dart';
import '../config/theme.dart';
import 'dashed_divider.dart';

/// The perforation line on a ticket/receipt — a dashed rule with small
/// punched-out circles on each edge, matching the screen's background
/// color so it reads as a cut in the paper. Used in CartCard between
/// the item list and the total.
class TicketNotchRow extends StatelessWidget {
  const TicketNotchRow({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 16,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          const DashedDivider(),
          const Positioned(
            left: -18,
            child: _Notch(),
          ),
          const Positioned(
            right: -18,
            child: _Notch(),
          ),
        ],
      ),
    );
  }
}

class _Notch extends StatelessWidget {
  const _Notch();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 16,
      height: 16,
      decoration: const BoxDecoration(
        color: AppColors.paper, // matches Scaffold background -> looks punched
        shape: BoxShape.circle,
      ),
    );
  }
}
