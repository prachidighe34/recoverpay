const Razorpay = require("razorpay");
const env = require("./env");
 
// Single shared instance, test-mode keys come from env.
const razorpayClient = new Razorpay({
  key_id: env.razorpay.keyId,
  key_secret: env.razorpay.keySecret
});
 
module.exports = razorpayClient;
 