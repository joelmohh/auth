const { validationResult, body } = require('express-validator');

const ALLOWED_SCOPES = ['username', 'email', 'profile', 'phone', 'address', 'birthDate']
const ALLOWED_PROVIDERS = []


const fieldRules = {
  email: body('email').isEmail().notEmpty().withMessage('Invalid or missing email.').normalizeEmail().isString(),
  username: body('username').notEmpty().isString().trim().isLength({ max: 32, min: 3 }).withMessage('Invalid or empty username').toLowerCase(),

  password: body('password').notEmpty().isString().isLength({ min: 8, max: 128 }).withMessage('Invalid password length'),
  newPassword: body('newPassword').notEmpty().isLength({ min: 8, max: 128 }).withMessage('Invalid password length'),
  confirmPassword: body('confirmPassword').notEmpty().isLength({ min: 8, max: 128 }).withMessage('Invalid password length'),

  termsAccepted: body('termsAccepted').isBoolean({ loose: true }).notEmpty().withMessage('Invalid value'),

  otp: body('otp').isInt().isLength({ min: 6, max: 6 }).notEmpty().withMessage('Invalid or missing field'),
  code: body('code').isString().isLength({ min: 32, max: 128 }).matches(/^[A-Za-z0-9_-]+$/).notEmpty().withMessage('Invalid or missing OAuth code'),

  purpose: body('purpose').isIn(["verify_email", "login", "password_reset"]).notEmpty().withMessage('Invalid or missing field'),

  avatarUrl: body('avatarUrl').isURL({ require_tld: false }).notEmpty(),
  bannerUrl: body('bannerUrl').isURL({ require_tld: false }).notEmpty(),
  profilePicture: body('profilePicture').isURL({ require_tld: false }).notEmpty(),

  bio: body('bio').notEmpty().isLength({ max: 280 }),

  birthday: body('birthday').isDate().notEmpty(),
  birthDate: body('birthDate').isDate().notEmpty(),

  phone: body('phone').isMobilePhone().notEmpty(),

  page: body('page').isInt(),

  userId: body('userId').isMongoId(),

  currentPassword: body('currentPassowrd').notEmpty().isString().isLength({ max: 128 }).withMessage('Invalid password length'),

  remember: body('remember').optional({ values: 'falsy' }).isBoolean({ loose: true }).withMessage("Invalid value"),

  appId: body('appId').optional({ values: 'falsy' }).isString().matches(/^([a-f0-9]{24}|[a-f0-9]{32})$/i).withMessage('Invalid app id'),
  sessionId: body('sessionId').optional({ values: 'falsy' }).isMongoId(),
  grantId: body('grantId').optional({ values: "falsy" }).isMongoId(),

  redirectUrl: body('redirectURL').optional({ values: 'falsy' }).isString().isLength({ max: 2048 }).custom(v => /^\/(?![\/\\])\S*$/.test(v) || /^https?:\/\/\S+$/i.test(v)).withMessage('Invalid redirect url'),

  displayName: body('displayName').optional({ values: 'falsy' }).isString().trim().isLength({ max: 64 }),
  locale: body('locale').optional({ values: 'falsy' }).isString().matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/),
  profile: body('profile').optional({ values: 'null' }).isObject().withMessage('Invalid profile'),
  'profile.displayName': body('profile.displayName').optional({ values: 'falsy' }).isString().trim().isLength({ max: 64 }),
  'profile.avatarUrl': body('profile.avatarUrl').optional({ values: 'falsy' }).isURL({ require_tld: false }).isLength({ max: 512 }),
  'profile.bannerUrl': body('profile.bannerUrl').optional({ values: 'falsy' }).isURL({ require_tld: false }).isLength({ max: 512 }),
  'profile.bio': body('profile.bio').optional({ values: 'falsy' }).isString().isLength({ max: 280 }),
  'profile.locale': body('profile.locale').optional({ values: 'falsy' }).isString().matches(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,3}$/),

  address: body('address').optional({ values: 'falsy' }).isObject().withMessage('Invalid address'),
  'address.street': body('address.street').optional({ values: 'falsy' }).isString().trim().isLength({ max: 128 }),
  'address.number': body('address.number').optional({ values: 'falsy' }).isString().trim().isLength({ max: 16 }),
  'address.complement': body('address.complement').optional({ values: 'falsy' }).isString().trim().isLength({ max: 64 }),
  'address.city': body('address.city').optional({ values: 'falsy' }).isString().trim().isLength({ max: 64 }),
  'address.state': body('address.state').optional({ values: 'falsy' }).isString().trim().isLength({ max: 64 }),
  'address.zip': body('address.zip').optional({ values: 'falsy' }).isString().trim().isLength({ max: 16 }),
  'address.country': body('address.country').optional({ values: 'falsy' }).isString().trim().isLength({ max: 64 }),

  name: body('name').isString().trim().isLength({ min: 1, max: 64 }).withMessage('Invalid name'),
  description: body('description').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
  redirectUris: body('redirectUris').isArray({ max: 20 }).withMessage('Invalid redirectUris').customSanitizer((value) => {
      if (!value) return value;
      const lowerVal = value.trim().toLowerCase();
      if (lowerVal.startsWith('javascript:') || lowerVal.startsWith('data:')) {
        return ''; 
      }
      return value.trim();
    }),
  'redirectUris.*': body('redirectUris.*').isString().trim().isURL({ require_tld: false, require_protocol: true, protocols: ['http', 'https'] }).withMessage('Invalid redirect URI'),
  scopes: body('scopes').isArray({ max: ALLOWED_SCOPES.length }).withMessage('Invalid scopes'),
  'scopes.*': body('scopes.*').isString().isIn(ALLOWED_SCOPES).withMessage('Invalid scope'),
  providers: body('providers').isArray({ max: 20 }).withMessage('Invalid providers'),
  'providers.*.provider': body('providers.*.provider').optional({ values: 'falsy' }).isString().isIn(ALLOWED_PROVIDERS),
  'providers.*.enabled': body('providers.*.enabled').optional({ values: 'null' }).isBoolean(),
  'providers.*.clientId': body('providers.*.clientId').optional({ values: 'falsy' }).isString().isLength({ max: 256 }),
  'providers.*.clientSecret': body('providers.*.clientSecret').optional({ values: 'falsy' }).isString().isLength({ max: 1024 }),
  theme: body('theme').optional({ values: 'falsy' }).isObject().withMessage('Invalid theme'),
  'theme.primaryColor': body('theme.primaryColor').optional({ values: 'falsy' }).isHexColor(),
  'theme.logoUrl': body('theme.logoUrl').optional({ values: 'falsy' }).isURL({ require_tld: false }),
  'theme.bannerUrl': body('theme.bannerUrl').optional({ values: 'falsy' }).isURL({ require_tld: false }),
  'theme.darkMode': body('theme.darkMode').optional({ values: 'null' }).isBoolean(),
  status: body('status').isIn(['active', 'disabled']),

  provider: body('provider').optional({ values: 'falsy' }).isString().isIn(ALLOWED_PROVIDERS),
  client_id: body('client_id').optional({ values: 'falsy' }).isString().matches(/^[a-f0-9]{32}$/i),
  response_type: body('response_type').optional({ values: 'falsy' }).isIn(['code']),
  scope: body('scope').optional({ values: 'falsy' }).isString().isLength({ max: 256 })
    .custom(v => v.trim().split(/\s+/).every(s => ALLOWED_SCOPES.includes(s))).withMessage('Invalid scope'),
  state: body('state').optional({ values: 'falsy' }).isString().matches(/^[\x21-\x7E]{1,512}$/),
  code_challenge: body('code_challenge').optional({ values: 'falsy' }).isString().matches(/^[A-Za-z0-9_-]{43,128}$/),
  code_challenge_method: body('code_challenge_method').optional({ values: 'falsy' }).isIn(['S256']),
  grant_type: body('grant_type').optional({ values: 'falsy' }).isIn(['authorization_code', 'refresh_token']),
  code_verifier: body('code_verifier').optional({ values: 'falsy' }).isString().matches(/^[A-Za-z0-9._~-]{43,128}$/),
  client_secret: body('client_secret').optional({ values: 'falsy' }).isString().isLength({ max: 512 }),
  token: body('token').optional({ values: 'falsy' }).isString().isLength({ max: 512 }),
  refresh_token: body('refresh_token').optional({ values: 'falsy' }).isString().isLength({ max: 512 }),
  token_type_hint: body('token_type_hint').optional({ values: 'falsy' }).isIn(['access_token', 'refresh_token']),

  limit: body('limit').optional({ values: 'falsy' }).isInt({ min: 1, max: 100 })
}

async function validationModule(req, res, next) {

  if (!req.body || Object.keys(req.body).length === 0) {
    return next()
  }

  const validations = []

  for (const field of Object.keys(req.body)) {
    for (const [key, rule] of Object.entries(fieldRules)) {
      if (key === field || key.startsWith(field + '.')) {
        validations.push(rule)
      }
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