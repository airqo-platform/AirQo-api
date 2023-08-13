const userRateLimits = {}; // Store user rate limits here

const rateLimitMiddleware = (getUserLimit) => {
  return (req, res, next) => {
    const userId = req.user.id; // Assuming you have user details available
    const userLimit = getUserLimit(req.user); // Get user limit dynamically

    if (userRateLimits[userId] >= userLimit) {
      return res.status(429).json({ message: "Rate limit exceeded" });
    }

    // Update request count and proceed
    userRateLimits[userId] = (userRateLimits[userId] || 0) + 1;
    next();
  };
};

module.exports = rateLimitMiddleware;
