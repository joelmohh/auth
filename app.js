const express = require('express');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const { generalLimiter, apiLimiter } = require('./modules/rateLimit');
const { validationModule } = require('./modules/validator')
const { logError } = require('./modules/logs')

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('[INFO] Connected to MongoDB')
    })
    .catch((err) => console.error('[ERROR] MongoDB connection error:', err));

const app = express();
app.disable('x-powered-by')
app.use(express.json());
app.use(express.urlencoded({ extended: false}))
app.use((req, res, next) => {
    req.body ??= {}
    next()
})
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

app.use('/', generalLimiter, require('./routes/static.routes'));
app.use('/oauth', apiLimiter, validationModule, require('./routes/oauth.routes'));
app.use('/api/auth', apiLimiter, validationModule, require('./routes/auth.api.routes'));
app.use('/api/apps', apiLimiter, validationModule, require('./routes/apps.api.routes'));
app.use('/api/me', apiLimiter, validationModule, require('./routes/user.api.routes'));
app.use('/api/analytics', apiLimiter, require('./routes/analytics.api.routes'));
app.use('/api/images', apiLimiter, require('./routes/images.api.routes'));

app.get('/teapot', (req, res) => {
    res.status(418).json({success: true, message:"I am a healthy teapot"})
})

app.use((req, res) => {
    if(req.path.startsWith('/api/') || req.path.startsWith('/oauth/')){
        return res.status(404).json({ success: false, message: "Route not found"})
    }
    return res.status(404).render('error', { status: 404, title: 'Page not found', message: 'The page you are looking for does not exist.' })
})

app.use((error, req, res, next) => {
    if (error instanceof SyntaxError && error.status === 400) {
        return res.status(400).json({ success: false, message: 'Malformed JSON body.' });
    }
    if (error.type === 'entity.too.large') {
        return res.status(413).json({ success: false, message: 'Request body is too large.' });
    }
    logError(error);
    if (res.headersSent) return next(error);
    if (req.path.startsWith('/api/') || req.path.startsWith('/oauth/')) {
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
    res.status(500).render('error', { status: 500, title: 'Something went wrong', message: 'An unexpected error occurred. Please try again.' });
});

app.listen(PORT, () => {
    console.log(`[INFO] Server is running on port ${PORT}`);
});
