class Env {
  // Android emulator uses 10.0.2.2 to reach host machine's localhost.
  // iOS simulator / physical device on same network: use your machine's
  // LAN IP instead (e.g. http://192.168.1.5:5000).
  static const String apiBaseUrl = "http://192.168.29.82:5000";
  static const String socketUrl = "http://192.168.29.82:5000";

  // Razorpay test key — same as backend's RAZORPAY_KEY_ID
  static const String razorpayKeyId = "rzp_test_TTrz1Kg92UBysI";
}
