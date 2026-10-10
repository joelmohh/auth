const { validationResult, body } = require('express-validator');

const fieldRules = {
  email: body('email').isEmail().notEmpty().withMessage('Invalid or missing email.').normalizeEmail(),
  username: body('username').notEmpty().trim().isLength({max: 64, min: 3}).withMessage('Invalid or empty username').toLowerCase(),

  password: body('password').notEmpty().isString().isLength({ min: 8, max: 128 }).withMessage('Invalid password length'),
  newPassword: body('newPassword').notEmpty().isLength({ min: 8, max: 128 }).withMessage('Invalid password length'),
  confirmPassword: body('confirmPassword').notEmpty().isLength({ min: 8, max: 128 }).withMessage('Invalid password length'),

  termsAccepted: body('termsAccepted').isBoolean({ loose: true }).notEmpty().withMessage('Invalid value'),

  otp: body('otp').isInt().isLength({ min: 6, max: 6 }).notEmpty().withMessage('Invalid or missing field'),
  code: body('code').isInt().isLength({ min: 6, max: 6 }).notEmpty().withMessage('Invalid or missing field'),

  purpose: body('purpose').isIn(["verify_email", "login", "password_reset"]).notEmpty().withMessage('Invalid or missing field'),

  redirectUrl: body('redirectUrl').isURL().notEmpty(), // TODO 

  avatarUrl: body('avatarUrl').isURL({require_tld: false}).notEmpty(),
  bannerUrl: body('bannerUrl').isURL({require_tld:false}).notEmpty(),
  profilePicture: body('profilePicture').isURL({require_tld: false}).notEmpty(),

  bio: body('bio').notEmpty().isLength({ max: 280 }),

  birthday: body('birthday').isDate().notEmpty(),
  birthDate: body('birthDate').isDate().notEmpty(),

  phone: body('phone').isMobilePhone().notEmpty(),

  //address: to be defined,

  page: body('page').isInt(),

  userId: body('userId').isMongoId()
}

async function validationModule (req, res, next){

  if (!req.body || Object.keys(req.body).length === 0) {
    return next()
  }

  const validations = []

  for (const [field, value] of Object.entries(req.body)) {
    if (fieldRules[field]) {
      validations.push(fieldRules[field])
    }
  }

  if (validations.length === 0) {
    return next()
  }

  await Promise.all(validations.map(validation => validation.run(req)))

  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Missing or invalid fields', data: errors.array() })
  }

  next()

}

module.exports = { validationModule }