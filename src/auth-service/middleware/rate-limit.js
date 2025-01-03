const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each token to 100 requests per windowMs
  keyGenerator: (req) => {
    const { token } = req.params; // Assuming token is passed in params
    return token; // Use token as the key
  },
  handler: (req, res) => {
    return res.status(429).json({ message: "Too many requests" });
  },
});

module.exports = limiter;
