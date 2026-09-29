const express = require('express');
require('dotenv').config();
const cookieParser = require('cookie-parser');
const { generalLimiter, apiLimiter } = require('./modules/rateLimit');

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('[INFO] Connected to MongoDB'))
    .catch((err) => console.error('[ERROR] MongoDB connection error:', err));

const app = express();
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.set('trust proxy', true);
app.use(cookieParser());

const PORT = process.env.PORT || 3000;

app.use('/api/auth', require('./routes/auth.api.routes'), apiLimiter);
app.use('/', require('./routes/static.routes'), generalLimiter);
app.use('/api/apps', require('./routes/apps.api.routes'), apiLimiter);

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});