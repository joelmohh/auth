const expressRT = require('express-rate-limit');

const generalLimiter = expressRT({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

const apiLimiter = expressRT({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, 
    message: 'Too many requests from this IP, please try again after 15 minutes'
});

module.exports = { generalLimiter, apiLimiter };