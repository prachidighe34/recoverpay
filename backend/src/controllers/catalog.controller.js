// controllers/catalog.controller.js
const catalogService = require("../services/catalog.service");

async function listProducts(req, res, next) {
  try {
    const products = await catalogService.listAll();
    res.json({ ok: true, products });
  } catch (error) {
    next(error);
  }
}

async function createProduct(req, res, next) {
  try {
    const product = await catalogService.create(req.body);
    res.status(201).json({ ok: true, product });
  } catch (error) {
    next(error);
  }
}

async function updateProduct(req, res, next) {
  try {
    const product = await catalogService.update(req.params.sku, req.body);
    res.json({ ok: true, product });
  } catch (error) {
    next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    await catalogService.remove(req.params.sku);
    res.json({ ok: true, deleted: req.params.sku });
  } catch (error) {
    next(error);
  }
}

module.exports = { listProducts, createProduct, updateProduct, deleteProduct };