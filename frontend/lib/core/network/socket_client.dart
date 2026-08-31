import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config/env.dart';

class SocketClient {
  static final SocketClient _instance = SocketClient._internal();
  factory SocketClient() => _instance;
  SocketClient._internal();

  io.Socket? _socket;

  io.Socket connect() {
    _socket ??= io.io(
      Env.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .build(),
    );

    if (_socket!.disconnected) {
      _socket!.connect();
    }

    return _socket!;
  }

  void disconnect() {
    _socket?.disconnect();
  }

  io.Socket get socket {
    if (_socket == null) {
      throw StateError("SocketClient.connect() must be called first");
    }
    return _socket!;
  }
}
