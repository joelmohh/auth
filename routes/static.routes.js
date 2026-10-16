const Router = require('express').Router();
const { notLoggedIn, loggedIn } = require('../modules/auth/session')

Router.get('/', notLoggedIn, (req, res) => {
    res.render('login');
})
Router.get('/login', notLoggedIn, (req, res) => {
    res.render('login');
})
Router.get('/signup', notLoggedIn, (req, res) => {
    res.render('signup');
})
Router.get('/reset-password', (req, res) => {
    res.render('resetPassword');
})
Router.get('/verify-otp', (req, res) => {
    res.render('verifyOtp');
})

Router.get('/dashboard',loggedIn, (req, res) => {
    res.render('dashboard/index');
})
Router.get('/dashboard/apps', loggedIn, (req, res) => {
    res.render('dashboard/apps');
})
Router.get('/dashboard/apps/:id', loggedIn, (req, res) => {
    res.render('dashboard/app');
})
Router.get('/dashboard/apps/:id/users', loggedIn, (req, res) => {
    res.render('dashboard/app.users');
})
Router.get('/dashboard/apps/:id/settings', loggedIn, (req, res) => {
    res.render('dashboard/app.settings');
})
Router.get('/dashboard/apps/:id/analytics', loggedIn, (req, res) => {
    res.render('dashboard/app.analytics');
})

Router.get('/dashboard/account', loggedIn, (req, res) => {
    res.render('dashboard/profile');
})




module.exports = Router;