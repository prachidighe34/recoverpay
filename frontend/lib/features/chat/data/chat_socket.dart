import '../../../core/network/socket_client.dart';
import 'chat_model.dart';

class ChatSocket {
  final SocketClient _client = SocketClient();

  void connect() {
    _client.connect();
  }

  /// Emits a customer message — mirrors the ChatApp "newChat" pattern
  void sendMessage(String conversationId, String message) {
    _client.socket.emit("newChat", {
      "conversationId": conversationId,
      "message": message,
    });
  }

  /// Listens for assistant replies — mirrors ChatApp's "loadNewChat" pattern
  void onAssistantReply(void Function(ChatMessage message) callback) {
    _client.socket.on("loadNewChat", (data) {
      final cartJson = data["cart"];
      callback(
        ChatMessage(
          sender: MessageSender.assistant,
          text: data["text"] ?? "",
          cart: cartJson != null ? CartDraft.fromJson(cartJson) : null,
          outOfStock: List<String>.from(data["outOfStock"] ?? []),
        ),
      );
    });
  }

  void onError(void Function(String error) callback) {
    _client.socket.on("chatError", (data) {
      callback(data["error"] ?? "Something went wrong");
    });
  }

  void dispose() {
    _client.socket.off("loadNewChat");
    _client.socket.off("chatError");
  }
}
