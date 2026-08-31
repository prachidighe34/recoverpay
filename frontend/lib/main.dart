import 'package:flutter/material.dart';
import 'core/network/api_client.dart';
import 'app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiClient().loadToken();
  runApp(const StoreChatApp());
}
