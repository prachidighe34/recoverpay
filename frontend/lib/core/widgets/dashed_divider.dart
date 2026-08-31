// core/widgets/dashed_divider.dart
import 'package:flutter/material.dart';
import '../config/theme.dart';

class DashedDivider extends StatelessWidget {
  final double dashWidth;
  final double dashGap;
  final double thickness;
  final Color color;

  const DashedDivider({
    super.key,
    this.dashWidth = 5,
    this.dashGap = 4,
    this.thickness = 1.2,
    this.color = AppColors.ink,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: thickness,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final dashCount =
              (constraints.maxWidth / (dashWidth + dashGap)).floor();
          return Row(
            children: List.generate(dashCount, (_) {
              return Padding(
                padding: EdgeInsets.only(right: dashGap),
                child: Container(
                  width: dashWidth,
                  height: thickness,
                  color: color.withValues(alpha: 0.25),
                ),
              );
            }),
          );
        },
      ),
    );
  }
}
