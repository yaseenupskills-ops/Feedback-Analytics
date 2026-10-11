const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Return first validation error with consistent JSON structure { error: "message" }
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

module.exports = validate;
