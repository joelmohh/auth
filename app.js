const express = require('express');
require('dotenv').config();

const app = express();
app.use(express.json());
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.set('trust proxy', true);

const PORT = process.env.PORT || 3000;

app.use('/api/auth', require('./routes/auth.api.routes'));

app.get('/', (req, res) => {
    res.render('index');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});