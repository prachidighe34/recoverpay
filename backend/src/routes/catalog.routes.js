// routes/catalog.routes.js
const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const requireRole = require("../middleware/role.middleware");
const {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct
} = require("../controllers/catalog.controller");

const router = express.Router();

router.get("/", listProducts); // public — chat UI needs this without auth friction

router.post("/", authMiddleware, requireRole("merchant"), createProduct);
router.patch("/:sku", authMiddleware, requireRole("merchant"), updateProduct);
router.delete("/:sku", authMiddleware, requireRole("merchant"), deleteProduct);

module.exports = router;