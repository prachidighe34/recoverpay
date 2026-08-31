// features/chat/presentation/chat_screen.dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../core/config/routes.dart';
import '../../../core/config/theme.dart';
import 'chat_controller.dart';
import 'message_bubble.dart';
import 'cart_card.dart';

class ChatScreen extends StatefulWidget {
  final String conversationId;
  const ChatScreen({super.key, required this.conversationId});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final TextEditingController _inputController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => ChatController(conversationId: widget.conversationId),
      child: Consumer<ChatController>(
        builder: (context, controller, _) {
          _scrollToBottom();

          if (controller.lastError != null) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text(controller.lastError!),
                  backgroundColor: AppColors.chili,
                ),
              );
              controller.lastError = null;
            });
          }

          return Scaffold(
            appBar: AppBar(
              title: const Text("Store Assistant"),
              actions: [
                IconButton(
                  icon: const Icon(Icons.receipt_long_outlined),
                  tooltip: "Audit trail",
                  onPressed: () {
                    Navigator.of(context).pushNamed(
                      Routes.audit,
                      arguments: widget.conversationId,
                    );
                  },
                ),
              ],
            ),
            body: Column(
              children: [
                if (controller.messages.isEmpty)
                  Expanded(child: _buildEmptyState(context))
                else
                  Expanded(
                    child: ListView(
                      controller: _scrollController,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      children: [
                        ...controller.messages.map((msg) {
                          final cart = msg.cart;
                          if (cart != null) {
                            return Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                MessageBubble(message: msg),
                                const SizedBox(height: 4),
                                CartCard(
                                  cart: cart,
                                  outOfStock: msg.outOfStock,
                                  paymentState: controller.paymentState,
                                  onConfirm: controller.confirmCart,
                                ),
                              ],
                            );
                          }
                          return MessageBubble(message: msg);
                        }),
                        if (controller.sending)
                          Padding(
                            padding: const EdgeInsets.all(16),
                            child: Row(
                              children: [
                                const SizedBox(width: 16),
                                SizedBox(
                                  height: 14,
                                  width: 14,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: AppColors.inkFaded,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text("thinking...",
                                    style: AppTheme.ledger(
                                        size: 12, color: AppColors.inkFaded)),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ),
                _buildInputBar(controller),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.storefront_outlined,
                size: 40, color: AppColors.inkFaded),
            const SizedBox(height: 12),
            Text(
              "Tell me what you need",
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 6),
            Text(
              '"2kg rice and 1 oil"',
              style: AppTheme.ledger(size: 13, color: AppColors.inkFaded),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInputBar(ChatController controller) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 12),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _inputController,
                decoration: const InputDecoration(
                  hintText: 'e.g. "2kg rice and 1 oil"',
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                ),
                onSubmitted: (_) => _send(controller),
              ),
            ),
            const SizedBox(width: 8),
            Container(
              decoration: const BoxDecoration(
                  color: AppColors.basil, shape: BoxShape.circle),
              child: IconButton(
                icon: const Icon(Icons.arrow_upward, color: Colors.white),
                onPressed: () => _send(controller),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _send(ChatController controller) {
    final text = _inputController.text;
    if (text.trim().isEmpty) return;
    controller.sendMessage(text);
    _inputController.clear();
  }

  @override
  void dispose() {
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
}
