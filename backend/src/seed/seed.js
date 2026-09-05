// Safe to re-run — upserts by sku instead of duplicating.

// Polyfill global crypto for older Node versions — see server.js for why.
if (!global.crypto) {
  global.crypto = require("crypto").webcrypto;
}

require("dotenv").config();
const mongoose = require("mongoose");
const env = require("../config/env");
const Product = require("../models/Product");
const products = require("./products.json");

async function seed() {
  await mongoose.connect(env.mongoUri);
  console.log("[seed] connected");

  let upserted = 0;
  for (const product of products) {
    await Product.updateOne(
      { sku: product.sku },
      { $set: product },
      { upsert: true }
    );
    upserted += 1;
  }

  console.log(`[seed] upserted ${upserted} products`);
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((error) => {
  console.error("[seed] failed:", error);
  process.exit(1);
});