const Router = require('express').Router();

const { verifyToken } = require('../modules/auth/session');
const App = require('../models/App');
const User = require('../models/User');
const { logError } = require('../modules/logs');

Router.get('/get', verifyToken, async (req, res) => {
    try {
        const apps = await App.find({ owner: req.user.id });
        res.json({ success: true, apps });
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
})

Router.get('/get/:id', verifyToken, async (req, res) => {
    try {
        const app = await App.findOne({ _id: req.params.id, owner: req.user.id });
        if (!app) {
            return res.status(404).json({ success: false, message: 'App not found.' });
        }
        res.json({ success: true, app });
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
})

Router.post('/create', verifyToken, async (req, res) => {
    try {
        const { name, description, profilePicture, banner, backgroundColor } = req.body;
        const newApp = new App({
            name,
            description,
            profilePicture,
            banner,
            backgroundColor,
            owner: req.user.id
        });
        await newApp.save();
        res.json({ success: true, app: newApp });
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
})

Router.put('/details/update/:id', verifyToken, async (req, res) => {
    try {
        const { name, description, profilePicture, banner, backgroundColor } = req.body;
        const app = await App.findOneAndUpdate(
            { _id: req.params.id, owner: req.user.id },
            { name, description, profilePicture, banner, backgroundColor, updatedAt: Date.now() },
            { new: true }
        );
        if (!app) {
            return res.status(404).json({ success: false, message: 'App not found.' });
        }
        res.json({ success: true, app });
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
})

Router.put('/permissions/update/:id', verifyToken, async (req, res) => {
    try {
        const { permissions } = req.body;
        const app = await App.findOneAndUpdate(
            { _id: req.params.id, owner: req.user.id },
            { permissions, updatedAt: Date.now() },
            { new: true }
        );
        if (!app) {
            return res.status(404).json({ success: false, message: 'App not found.' });
        }
        res.json({ success: true, app });
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
})

Router.delete('/delete/:id', verifyToken, async (req, res) => {
    try {
        const app = await App.findOneAndDelete({ _id: req.params.id, owner: req.user.id });
        if (!app) {
            return res.status(404).json({ success: false, message: 'App not found.' });
        }
        res.json({ success: true, message: 'App deleted successfully.' });
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
})

Router.get('/:appId/user/:id', verifyToken, async (req, res) => {
    try {
        const app = await App.findById(req.params.appId);
        if (!app) {
            return res.status(404).json({ success: false, message: 'App not found.' });
        }

        const user = await User.findOne({ _id: req.params.id, app: app._id });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found for this app.' });
        }

        res.json({ success: true, user });        

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

Router.get('/:appId/users', verifyToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const app = await App.findById(req.params.appId);
        if (!app) {
            return res.status(404).json({ success: false, message: 'App not found.' });
        }

        const users = await User.find({ app: app._id }).skip(skip).limit(limit);
        const totalUsers = await User.countDocuments({ app: app._id });

        res.json({ success: true, users, totalUsers, currentPage: page, totalPages: Math.ceil(totalUsers / limit) });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

Router.post('/:appId/user/update/:id', verifyToken, async (req, res) => {
    try {
        const { name, email, phone, address, birthday, fullName, bio, profilePicture, banner } = req.body;
        const user = await User.findOneAndUpdate(
            { _id: req.params.id, app: req.params.appId },
            { name, email, phone, address, birthday, fullName, bio, profilePicture, banner, updatedAt: Date.now() },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.json({ success: true, user });
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
});

module.exports = Router;
        