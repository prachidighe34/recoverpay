// features/chat/presentation/message_bubble.dart
import 'package:flutter/material.dart';
import '../../../core/config/theme.dart';
import '../data/chat_model.dart';

class MessageBubble extends StatelessWidget {
  final ChatMessage message;
  const MessageBubble({super.key, required this.message});

  @override
  Widget build(BuildContext context) {
    final isCustomer = message.sender == MessageSender.customer;

    return Align(
      alignment: isCustomer ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4, horizontal: 16),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
        constraints: BoxConstraints(
          maxWidth: MediaQuery.of(context).size.width * 0.78,
        ),
        decoration: BoxDecoration(
          color: isCustomer ? AppColors.basil : AppColors.surface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(14),
            topRight: const Radius.circular(14),
            bottomLeft: Radius.circular(isCustomer ? 14 : 2),
            bottomRight: Radius.circular(isCustomer ? 2 : 14),
          ),
          border: isCustomer
              ? null
              : Border.all(color: AppColors.ink.withValues(alpha: 0.08)),
        ),
        child: Text(
          message.text,
          style: TextStyle(
            color: isCustomer ? Colors.white : AppColors.ink,
            fontSize: 15,
            height: 1.35,
          ),
        ),
      ),
    );
  }
}
