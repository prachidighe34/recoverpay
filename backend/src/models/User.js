const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
 
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password_hash: { type: String, required: true },
    role: { type: String, enum: ["customer", "merchant"], default: "customer" }
  },
  { timestamps: true }
);
 
userSchema.methods.comparePassword = function (plainPassword) {
  return bcrypt.compare(plainPassword, this.password_hash);
};
 
userSchema.statics.hashPassword = function (plainPassword) {
  return bcrypt.hash(plainPassword, 10);
};
 
module.exports = mongoose.model("User", userSchema);
 