const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const errorMiddleware = require("./middleware/error.middleware");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "storechat-api"
  });
});

app.use("/auth", require("./routes/auth.routes"));
app.use("/conversations", require("./routes/conversation.routes"));
app.use("/catalog", require("./routes/catalog.routes"));
app.use("/agent", require("./routes/agent.routes"));
app.use("/checkout", require("./routes/checkout.routes"));
app.use("/audit", require("./routes/audit.routes"));

// must be mounted LAST, after all routes
app.use(errorMiddleware);

module.exports = app;