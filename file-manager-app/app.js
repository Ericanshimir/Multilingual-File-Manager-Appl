const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mysql = require('mysql2/promise');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const { createClient } = require('redis');
const bodyParser = require('body-parser');
const i18next = require('i18next');
const i18nextMiddleware = require('i18next-express-middleware');
const Backend = require('i18next-node-fs-backend');
const Queue = require('bull');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Initialize express app
const app = express();

// Middleware setup
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL connection pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Ac8@nshim',
    database: 'file_manager'
});

// Create Redis client and connect
const redisClient = createClient({
    url: 'redis://localhost:6379'
});
redisClient.connect().catch(err => console.error('Redis connection error:', err));

// Initialize session and passport
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: 'secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 1 day
}));
app.use(passport.initialize());
app.use(passport.session());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Configure Passport.js for local authentication
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
            if (rows.length === 0) {
                return done(null, false, { message: 'Incorrect username.' });
            }
            const user = rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                return done(null, false, { message: 'Incorrect password.' });
            }
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length === 0) {
            return done(null, false);
        }
        done(null, rows[0]);
    } catch (err) {
        done(err);
    }
});

// Authentication middleware
function ensureAuthenticated(req, res, next) {
    console.log('Checking authentication...');
    console.log('Request Headers:', req.headers);
    console.log('Request Cookies:', req.cookies);
    console.log('Session:', req.session);
    if (req.isAuthenticated()) {
        return next();
    }
    if (req.accepts('html')) {
        res.redirect('/login.html');
    } else {
        res.status(401).json({ message: 'User not authenticated' });
    }
}

// Serve login form on GET request
app.get('/login.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle login on POST request
app.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            if (req.accepts('html')) {
                return res.redirect('/login.html');
            } else {
                return res.status(401).json({ message: 'Incorrect username or password' });
            }
        }
        req.logIn(user, (err) => {
            if (err) return next(err);
            if (req.accepts('html')) {
                return res.redirect('/dashboard.html');
            } else {
                return res.status(200).json({ message: 'Login successful', user: { id: user.id, username: user.username } });
            }
        });
    })(req, res, next);
});

// Define a route for /dashboard
app.get('/dashboard.html', ensureAuthenticated, (req, res) => {
    if (req.accepts('html')) {
        res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
    } else {
        res.status(200).json({ message: 'Welcome to your dashboard', user: { id: req.user.id, username: req.user.username } });
    }
});

// User registration endpoint
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    if (req.accepts('html')) {
        res.redirect('/login.html');
    } else {
        res.status(200).json({ message: 'User registered successfully' });
    }
});

// Initialize i18next for multilingual support
i18next
    .use(Backend)
    .use(i18nextMiddleware.LanguageDetector)
    .init({
        backend: {
            loadPath: path.join(__dirname, '/locales/{{lng}}/{{ns}}.json')
        },
        fallbackLng: 'en',
        preload: ['en', 'fr'],
        detection: {
            order: ['querystring', 'cookie'],
            caches: ['cookie']
        }
    });

app.use(i18nextMiddleware.handle(i18next));

// Multilingual welcome endpoint
app.get('/welcome', (req, res) => {
    res.send(req.t('welcome'));
});

// File queuing system
const fileQueue = new Queue('file-queue', {
    redis: {
        host: '127.0.0.1',
        port: 6379
    }
});

fileQueue.process(async (job) => {
    const { file } = job.data;
    console.log(`Processing file: ${file}`);
});

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!req.user || !req.user.id) {
            return cb(new Error('User not authenticated'));
        }
        const dir = `uploads/${req.user.id}`;
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Upload a file
app.post('/upload', ensureAuthenticated, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const { originalname, filename, size, mimetype } = req.file;
    try {
        console.log(`Uploading file for user ${req.user.id}: ${filename}`);
        await db.query('INSERT INTO files (user_id, name, path, size, type) VALUES (?, ?, ?, ?, ?)', [
            req.user.id, originalname, filename, size, mimetype
        ]);
        fileQueue.add({ file: filename });
        return res.status(200).json({ message: 'File uploaded and queued for processing' });
    } catch (err) {
        console.error('Error uploading file:', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// Get all files for the user
app.get('/files', ensureAuthenticated, async (req, res) => {
    try {
        console.log(`Fetching files for user ${req.user.id}`);
        const [rows] = await db.query('SELECT * FROM files WHERE user_id = ?', [req.user.id]);
        console.log('Files fetched:', rows);
        res.status(200).json(rows);
    } catch (err) {
        console.error('Error fetching files:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update a file name
app.put('/files/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    try {
        const [result] = await db.query('UPDATE files SET name = ? WHERE id = ?', [name, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'File not found' });
        }
        res.status(200).json({ message: `File with ID ${id} updated to ${name}` });
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete a file
app.delete('/files/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        const [rows] = await db.query('SELECT * FROM files WHERE id = ?', [id]);
        if (rows.length > 0) {
            const file = rows[0];
            const filePath = path.join(__dirname, 'uploads', String(file.user_id), file.path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                await db.query('DELETE FROM files WHERE id = ?', [id]);
                res.status(200).json({ message: 'File deleted' });
            } else {
                res.status(404).json({ message: 'File path not found' });
            }
        } else {
            res.status(404).json({ message: 'File not found in database' });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Serve HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/register.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/upload.html', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'upload.html'));
});

app.get('/files.html', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'files.html'));
});

app.get('/update-file.html', ensureAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'update-file.html'));
});

// Logout route
app.post('/logout', (req, res, next) => {
    req.logout(function(err) {
        if (err) {
            return next(err);
        }
        if (req.accepts('html')) {
            res.redirect('/login.html');
        } else {
            res.status(200).json({ message: 'Logout successful' });
        }
    });
});

// Start the server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
