// controllers/auth.controller.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    env.jwtSecret,
    { expiresIn: "7d" }
  );
}

// POST /auth/register
async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        ok: false,
        error: "name, email, password are required"
      });
    }
    if (role && !["customer", "merchant"].includes(role)) {
      return res.status(400).json({ ok: false, error: "invalid role" });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Email already registered" });
    }

    const password_hash = await User.hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password_hash,
      role: role || "customer"
    });

    const token = signToken(user);

    res.status(201).json({
      ok: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
}

// POST /auth/login
async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ ok: false, error: "email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ ok: false, error: "Invalid credentials" });
    }

    const token = signToken(user);

    res.status(200).json({
      ok: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { register, login };