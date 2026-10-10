const Router = require('express').Router();
const crypto = require('crypto')

const { verifyToken } = require('../modules/auth/session');
const App = require('../models/App');
const User = require('../models/User');
const { logError } = require('../modules/logs');
const { encrypt, decrypt } = require('../modules/crypto')
const { appEditRules } = require('../modules/validator')

Router.get('/', verifyToken, async (req, res) => {
    try {

        if (!req.user) {
            return res.status(403).json({ status: false, message: "Unauthorized" })
        }

        const apps = await App.find({ owner: req.user.id });

        if (!apps) {
            return res.status(200).json({ success: true, message: "No apps found", data: [] })
        }

        res.json({ success: true, message: "User apps fetched successfully", data: apps });

    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
})

Router.get('/:id', verifyToken, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(403).json({ success: false, message: "Unauthorized" })
        }

        const app = await App.findOne({ _id: req.params.id, owner: req.user._id })

        if (!app) {
            return res.status(404).json({ success: false, message: 'App not found.' });
        }
        res.json({ success: true, message: "Data fetched successfully", data: app });
    } catch (error) {
        logError(error);
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
})

Router.post('/', verifyToken, async (req, res) => {
    try {

        if (!req.user || !req.session) {
            return res.status(403).json({ sucess: false, message: "Unauthorized" })
        }

        let clientId = '';
        for (let i = 0; i < 16; i++) {
            clientId += Math.floor(Math.random() * 10);
        }

        let clientSecret = crypto.randomBytes(16).toString('hex');

        const { name, description, logoUrl, banner, darkMode, primaryColor } = req.body;
        const newApp = await App.create({
            name,
            description,
            owner: req.session.userId,
            clientSecret: encrypt(clientSecret),
            clientId: clientId,
            theme: {
                primaryColor: primaryColor || '#ffffff',
                logoUrl: logoUrl,
                bannerUrl: banner,
                darkMode: darkMode
            }
        });

        res.status(200).json({ success: true, message: "App created successfully", data: newApp })

    } catch (error) {
        logError(error);
        if (error.code === 11000) {
            res.status(409).json({ success: false, message: `Duplicate entries in ${Object.keys(error.keyValue || {})}` })
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        res.status(500).json({ success: false, message: 'Internal server error.' });
    }
})

Router.patch('/:id', verifyToken, async (req, res) => {
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
