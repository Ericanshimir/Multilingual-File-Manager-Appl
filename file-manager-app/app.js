const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mysql = require('mysql2/promise');
const session = require('express-session');
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

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Ac8@nshim',
    database: 'file_manager'
});

// Initialize session and passport
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    cookie: { httpOnly: true }
}));
app.use(passport.initialize());
app.use(passport.session());

// Configure Passport.js for local authentication
passport.use(new LocalStrategy(
    async (username, password, done) => {
        try {
            const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
            if (rows.length === 0) {
                console.log('Incorrect username.');
                return done(null, false, { message: 'Incorrect username.' });
            }
            const user = rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (!match) {
                console.log('Incorrect password.');
                return done(null, false, { message: 'Incorrect password.' });
            }
            console.log('User authenticated:', user);
            return done(null, user);
        } catch (err) {
            console.log('Error during authentication:', err);
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
    if (req.isAuthenticated()) {
        console.log('User is authenticated');
        return next();
    }
    console.log('User is not authenticated, redirecting to login');
    res.redirect('/login');
}

// Serve login form on GET request
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Handle login on POST request
app.post('/login', (req, res, next) => {
    console.log('Login request received');
    passport.authenticate('local', (err, user, info) => {
        if (err) return next(err);
        if (!user) {
            console.log('Authentication failed');
            return res.redirect('/login'); // Adjust as needed
        }
        req.logIn(user, (err) => {
            if (err) return next(err);
            console.log('Authentication successful, redirecting to dashboard');
            return res.redirect('/dashboard'); // Adjust as needed
        });
    })(req, res, next);
});

// Define a route for /dashboard
app.get('/dashboard', ensureAuthenticated, (req, res) => {
    res.send('Welcome to your dashboard!');
});

// User registration endpoint
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    res.send('User registered');
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
    // Process the file (e.g., save to disk, perform operations)
    console.log(`Processing file: ${file}`);
});

// Configure Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!req.user || !req.user.id) {
            console.log('User not authenticated for file upload');
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
    console.log('Upload route hit');
    if (!req.file) {
        console.log('No file uploaded');
        return res.status(400).send('No file uploaded');
    }

    const { originalname, filename, size, mimetype } = req.file;
    try {
        console.log('Inserting file into database');
        await db.query('INSERT INTO files (user_id, name, path, size, type) VALUES (?, ?, ?, ?, ?)', [
            req.user.id, originalname, filename, size, mimetype
        ]);
        fileQueue.add({ file: filename }); // Add to queue
        console.log('File uploaded and queued for processing');
        res.send('File uploaded and queued for processing');
    } catch (err) {
        console.log('Error inserting file into database:', err);
        res.status(500).send('Server error');
    }
});

// Get all files for the user
app.get('/files', ensureAuthenticated, async (req, res) => {
    try {
        console.log(`Fetching files for user: ${req.user.id}`);
        const [rows] = await db.query('SELECT * FROM files WHERE user_id = ?', [req.user.id]);
        res.json(rows);
    } catch (err) {
        console.log('Error fetching files:', err);
        res.status(500).send('Server error');
    }
});

// Update a file name
app.put('/files/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;

    try {
        console.log(`Updating file with ID: ${id}`);
        const [result] = await db.query('UPDATE files SET name = ? WHERE id = ?', [name, id]);

        if (result.affectedRows === 0) {
            console.log(`File with ID ${id} not found`);
            return res.status(404).send('File not found');
        }

        console.log(`File with ID ${id} updated to ${name}`);
        res.send(`File with ID ${id} updated to ${name}`);
    } catch (err) {
        console.log('Error updating file name:', err);
        res.status(500).send('Server error');
    }
});

// Delete a file
app.delete('/files/:id', ensureAuthenticated, async (req, res) => {
    const { id } = req.params;
    try {
        console.log(`Attempting to delete file with ID: ${id}`);
        const [rows] = await db.query('SELECT * FROM files WHERE id = ?', [id]);

        if (rows.length > 0) {
            const file = rows[0];
            const filePath = path.join(__dirname, 'uploads', String(file.user_id), file.path);

            // Check if file exists before attempting to delete
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                await db.query('DELETE FROM files WHERE id = ?', [id]);
                console.log(`File with ID ${id} deleted`);
                res.send({ message: 'File deleted' });
            } else {
                console.log(`File path does not exist: ${filePath}`);
                res.status(404).send({ message: 'File path not found' });
            }
        } else {
            console.log(`File with ID ${id} not found in database`);
            res.status(404).send({ message: 'File not found in database' });
        }
    } catch (err) {
        console.log('Error deleting file:', err);
        res.status(500).send({ message: 'Server error' });
    }
});

// Start the server only if not in test environment
if (process.env.NODE_ENV !== 'test') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app; // Export app for testing
