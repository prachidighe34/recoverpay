// Loads and validates required environment variables at boot.
// Fails loudly here instead of failing deep inside a controller mid-demo.

const REQUIRED_VARS = [
  "MONGO_URI",
  "JWT_SECRET",
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET"
];

// Only needed once you wire up a real Razorpay webhook endpoint (requires
// a public URL — ngrok or a deployed server). Not required for local dev,
// since /checkout/verify currently uses client-side signature verification
// with RAZORPAY_KEY_SECRET instead.
const OPTIONAL_VARS = ["RAZORPAY_WEBHOOK_SECRET"];

function loadEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `[env] Missing required environment variables: ${missing.join(", ")}`
    );
    console.error("[env] Check your .env file against .env.example");
    process.exit(1);
  }

  const missingOptional = OPTIONAL_VARS.filter((key) => !process.env[key]);
  if (missingOptional.length > 0) {
    console.warn(
      `[env] Optional vars not set (fine for local dev): ${missingOptional.join(", ")}`
    );
  }

  return {
    port: process.env.PORT || 5000,
    mongoUri: process.env.MONGO_URI,
    jwtSecret: process.env.JWT_SECRET,
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      keySecret: process.env.RAZORPAY_KEY_SECRET,
      webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || null
    },
    nodeEnv: process.env.NODE_ENV || "development"
  };
}

module.exports = loadEnv();