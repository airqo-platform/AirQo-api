const Joi = require("joi");

const paymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  currency: Joi.string().length(3).uppercase().default("USD"),
  customerId: Joi.string().optional(),
  items: Joi.array()
    .items(
      Joi.object({
        priceId: Joi.string().required(),
        quantity: Joi.number().positive().default(1),
      })
    )
    .optional(),
});

const validatePayment = (req, res, next) => {
  const { error, value } = paymentSchema.validate(req.body);

  if (error) {
    return res.status(400).json({
      error: "Invalid payment details",
      details: error.details.map((detail) => detail.message),
    });
  }

  req.validatedPayment = value;
  next();
};

module.exports = validatePayment;
