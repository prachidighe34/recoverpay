const mongoose = require("mongoose");
const env = require("./env");
 
async function connectDB() {
  mongoose.set("strictQuery", true);
 
  try {
    await mongoose.connect(env.mongoUri);
    console.log("[db] MongoDB connected");
  } catch (error) {
    console.error("[db] MongoDB connection failed:", error.message);
    process.exit(1);
  }
 
  mongoose.connection.on("disconnected", () => {
    console.warn("[db] MongoDB disconnected");
  });
}
 
module.exports = connectDB;
 