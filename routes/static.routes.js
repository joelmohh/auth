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
Router.get('/dashboard/app/:id', (req, res) => {
    res.render('dashboard/app');
})
Router.get('/dashboard/app/:id/users', (req, res) => {
    res.render('dashboard/app.users');
})
Router.get('/dashboard/app/:id/settings', (req, res) => {
    res.render('dashboard/app.settings');
})
Router.get('/dashboard/app/:id/analytics', (req, res) => {
    res.render('dashboard/app.analytics');
})

Router.get('/dashboard/profile', (req, res) => {
    res.render('dashboard/profile');
})
Router.get('/dashboard/settings', (req, res) => {
    res.render('dashboard/settings');
})




module.exports = Router;