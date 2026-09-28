const Router = require('express').Router();

Router.get('/', (req, res) => {
    res.render('login');
})
Router.get('/login', (req, res) => {
    res.render('login');
})
Router.get('/signup', (req, res) => {
    res.render('signup');
})
Router.get('/reset-password', (req, res) => {
    res.render('resetPassword');
})
Router.get('/verify-otp', (req, res) => {
    res.render('verifyOtp');
})

Router.get('/dashboard', (req, res) => {
    res.render('dashboard/index');
})

module.exports = Router;