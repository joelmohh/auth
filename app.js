const express = require('express');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const { generalLimiter, apiLimiter } = require('./modules/rateLimit');
const { validationModule } = require('./modules/validator')
const { logError } = require('./modules/logs')

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Connected to MongoDB'))
    .catch((err) => console.error('[ERROR] MongoDB connection error:', err));

const app = express();
app.use(express.json());
app.use((req, res, next) => {
    req.body ??= {}
    next()
})
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

app.use('/', generalLimiter, require('./routes/static.routes'));
app.use('/oauth', apiLimiter, require('./routes/oauth.routes'));
app.use('/api/auth', apiLimiter, validationModule, require('./routes/auth.api.routes'));
app.use('/api/apps', apiLimiter, validationModule, require('./routes/apps.api.routes'));
app.use('/api/me', apiLimiter, validationModule, require('./routes/user.api.routes'));

app.get('/teapot', (req, res) => {
    res.status(418).json({success: true, message:"I am a healthy teapot"})
})

app.use((req, res) => {
    if(req.path.startsWith('/api/') || req.path.startsWith('/oauth/')){
        return res.status(404).json({ success: false, message: "Route not found"})
    }
    // TO improve later 
    return res.status(404).send('<!doctype html><html><body><h1>Page not found</h1></body></html>')
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
    res.status(500).send('<!doctype html><html><body><h1>Internal server error</h1></body></html>');
});

app.listen(PORT, () => {
    console.log(`[INFO] Server is running on port ${PORT}`);
});