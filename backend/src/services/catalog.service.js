const Product = require("../models/Product");
const { NotFoundError, ValidationError } = require("../utils/errors");

async function listAll() {
  return Product.find({}).sort({ name: 1 });
}

async function create({ sku, name, price_paise, stock, unit, image }) {
  if (!sku || !name || price_paise == null) {
    throw new ValidationError("sku, name, price_paise are required");
  }
  if (price_paise < 0 || (stock != null && stock < 0)) {
    throw new ValidationError("price_paise and stock must be non-negative");
  }

  const existing = await Product.findOne({ sku });
  if (existing) {
    throw new ValidationError(`Product with sku ${sku} already exists`);
  }

  return Product.create({ sku, name, price_paise, stock: stock || 0, unit, image });
}

async function update(sku, updates) {
  if (updates.price_paise != null && updates.price_paise < 0) {
    throw new ValidationError("price_paise must be non-negative");
  }
  if (updates.stock != null && updates.stock < 0) {
    throw new ValidationError("stock must be non-negative");
  }

  const product = await Product.findOneAndUpdate(
    { sku },
    { $set: updates },
    { new: true }
  );

  if (!product) throw new NotFoundError(`Product ${sku} not found`);
  return product;
}

async function remove(sku) {
  const result = await Product.findOneAndDelete({ sku });
  if (!result) throw new NotFoundError(`Product ${sku} not found`);
  return result;
}

module.exports = { listAll, create, update, remove };