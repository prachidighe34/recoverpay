const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    sku: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    price_paise: { type: Number, required: true },
    stock: { type: Number, required: true, default: 0 },
    unit: { type: String, default: "unit" }, // e.g. "kg", "litre", "unit"
    image: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);