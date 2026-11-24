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
    res.redirect('/login');
})
Router.get('/terms', (req, res) => {
    res.render('terms');
})
Router.get('/privacy', (req, res) => {
    res.render('privacy');
})

const { load, helpers } = require('../modules/dashboard/render');

function dashboard(view) {
    return async (req, res, next) => {
        try {
            const data = await load(req);
            if (!data) return res.redirect('/login');
            res.set('Cache-Control', 'private, no-store');
            res.set('Vary', 'Cookie');
            if (data.notFound) return res.status(404).render('error', { status: 404, title: 'App not found', message: 'The application does not exist or is not yours.' });
            res.render(view, { dashboard: data, h: helpers(), currentPath: req.path, origin: `${req.protocol}://${req.get('host')}` });
        } catch (error) { next(error); }
    };
}

Router.get('/dashboard', loggedIn, dashboard('dashboard/index'));
Router.get('/dashboard/apps', loggedIn, dashboard('dashboard/apps'));
Router.get('/dashboard/apps/:id', loggedIn, dashboard('dashboard/app'));
Router.get('/dashboard/apps/:id/users', loggedIn, dashboard('dashboard/app-users'));
Router.get('/dashboard/apps/:id/settings', loggedIn, dashboard('dashboard/app-settings'));
Router.get('/dashboard/account', loggedIn, dashboard('dashboard/profile'));

module.exports = Router;
