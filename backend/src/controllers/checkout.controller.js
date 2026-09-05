const { confirmCheckout, verifyCheckout } = require("../services/checkout.service");

// POST /checkout/confirm
// body: { conversationId, cartDraftId, cart_hash, idempotency_key }
async function confirm(req, res, next) {
  try {
    const { conversationId, cartDraftId, cart_hash, idempotency_key } = req.body;

    if (!conversationId || !cartDraftId || !cart_hash) {
      return res.status(400).json({
        ok: false,
        error: "conversationId, cartDraftId, cart_hash are required"
      });
    }

    const { order, isNew, razorpayOrder } = await confirmCheckout({
      conversationId, cartDraftId, cart_hash, idempotency_key
    });

    res.status(isNew ? 201 : 200).json({
      ok: true,
      isNew,
      order: {
        id: order._id,
        razorpay_order_id: order.razorpay_order_id,
        amount_paise: order.amount_paise,
        status: order.status
      },
      // client needs this to open Razorpay Checkout
      razorpay: razorpayOrder
        ? { key_id: require("../config/env").razorpay.keyId, order_id: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency }
        : null
    });
  } catch (error) {
    next(error);
  }
}

// POST /checkout/verify
// body: { conversationId, razorpay_order_id, razorpay_payment_id, razorpay_signature }
async function verify(req, res, next) {
  try {
    const { conversationId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!conversationId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        ok: false,
        error: "conversationId, razorpay_order_id, razorpay_payment_id, razorpay_signature are required"
      });
    }

    const order = await verifyCheckout({
      conversationId, razorpay_order_id, razorpay_payment_id, razorpay_signature
    });

    res.json({
      ok: true,
      order: { id: order._id, status: order.status, razorpay_payment_id: order.razorpay_payment_id }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { confirm, verify };