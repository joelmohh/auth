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
Router.get('/dashboard/apps', (req, res) => {
    res.render('dashboard/apps');
})
Router.get('/dashboard/apps/:id', (req, res) => {
    res.render('dashboard/app');
})
Router.get('/dashboard/apps/:id/users', (req, res) => {
    res.render('dashboard/app.users');
})
Router.get('/dashboard/apps/:id/settings', (req, res) => {
    res.render('dashboard/app.settings');
})
Router.get('/dashboard/apps/:id/analytics', (req, res) => {
    res.render('dashboard/app.analytics');
})

Router.get('/dashboard/account', (req, res) => {
    res.render('dashboard/profile');
})




module.exports = Router;