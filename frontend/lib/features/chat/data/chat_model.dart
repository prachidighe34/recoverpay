class CartItem {
  final String sku;
  final String name;
  final num qty;
  final int pricePaise;

  CartItem({
    required this.sku,
    required this.name,
    required this.qty,
    required this.pricePaise,
  });

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
        sku: json["sku"],
        name: json["name"],
        qty: json["qty"],
        pricePaise: json["price_paise"],
      );

  int get lineTotalPaise => (pricePaise * qty).round();
}

class CartDraft {
  final String cartDraftId;
  final List<CartItem> items;
  final int totalPaise;
  final String cartHash;
  final DateTime expiresAt;

  CartDraft({
    required this.cartDraftId,
    required this.items,
    required this.totalPaise,
    required this.cartHash,
    required this.expiresAt,
  });

  factory CartDraft.fromJson(Map<String, dynamic> json) => CartDraft(
        cartDraftId: json["cartDraftId"],
        items:
            (json["items"] as List).map((i) => CartItem.fromJson(i)).toList(),
        totalPaise: json["total_paise"],
        cartHash: json["cart_hash"],
        expiresAt: DateTime.parse(json["expires_at"]),
      );

  bool get isExpired => DateTime.now().isAfter(expiresAt);
  double get totalRupees => totalPaise / 100;
}

enum MessageSender { customer, assistant }

class ChatMessage {
  final MessageSender sender;
  final String text;
  final CartDraft? cart;
  final List<String> outOfStock;

  ChatMessage({
    required this.sender,
    required this.text,
    this.cart,
    this.outOfStock = const [],
  });
}
