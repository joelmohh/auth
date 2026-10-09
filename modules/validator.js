const { check } = require('express-validator')
const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array().map(err => ({ field: err.path, message: err.msg })) 
    });
  }
  next();
};

const appEditRules = [
    check('name').trim().isString().notEmpty(),
    check('description').trim().isString().notEmpty(),
    check('logoUrl').trim().isURL().notEmpty(),
    check('banner').trim().isURL().notEmpty(),
    check('darkMode').trim().isBoolean().notEmpty(),
    check('primaryColor').isHexColor().notEmpty(),
    validate
]

module.exports = { appEditRules }