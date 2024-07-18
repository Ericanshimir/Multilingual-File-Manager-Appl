const express = require('express');
const bcrypt = require('bcryptjs');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mysql = require('mysql2/promise');
const session = require('express-session');
const bodyParser = require('body-parser');

// Initialize the app
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// MySQL connection pool
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Ac8@nshim',
    database: 'file_manager'
});
// Passport.js configuration
passport.use(new LocalStrategy(
    async (username, password, done) => {
        const [rows] = await db.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length === 0) return done(null, false, { message: 'Incorrect username.' });
        const user = rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) return done(null, false, { message: 'Incorrect password.' });
        return done(null, user);
    }
));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const [rows] = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    if (rows.length === 0) return done(null, false);
    done(null, rows[0]);
});

app.use(session({ secret: 'secret', resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword]);
    res.send('User registered');
});

app.post('/login', passport.authenticate('local', {
    successRedirect: '/dashboard',
    failureRedirect: '/login'
}));

app.get('/dashboard', (req, res) => {
    if (req.isAuthenticated()) {
        res.send('Welcome to your dashboard');
    } else {
        res.redirect('/login');
    }
});

// Authentication middleware
function isAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
      return next();
  }
  res.status(401).send('You need to log in.');
}


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

const multer = require('multer');
const fs = require('fs');
const path = require('path');

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
app.post('/upload', isAuthenticated, upload.single('file'), async (req, res) => {
  const { originalname, filename, size, mimetype } = req.file;
  await db.query('INSERT INTO files (user_id, name, path, size, type) VALUES (?, ?, ?, ?, ?)', [
      req.user.id, originalname, filename, size, mimetype
  ]);
  res.send('File uploaded');
});


// Get all files for the user
app.get('/files', async (req, res) => {
  if (!req.isAuthenticated()) {
      return res.status(401).send('You need to log in.');
  }
  const [rows] = await db.query('SELECT * FROM files WHERE user_id = ?', [req.user.id]);
  res.json(rows);
});

// Update a file name
app.put('/files/:id', async (req, res) => {
  if (!req.isAuthenticated()) {
      return res.status(401).send('You need to log in.');
  }
  const { id } = req.params;
  const { name } = req.body;
  await db.query('UPDATE files SET name = ? WHERE id = ?', [name, id]);
  res.send('File updated');
});

// Delete a file
app.delete('/files/:id', async (req, res) => {
  if (!req.isAuthenticated()) {
      return res.status(401).send('You need to log in.');
  }
  const { id } = req.params;
  const [rows] = await db.query('SELECT * FROM files WHERE id = ?', [id]);
  if (rows.length > 0) {
      const file = rows[0];
      fs.unlinkSync(path.join(__dirname, 'uploads', String(file.user_id), file.path));
      await db.query('DELETE FROM files WHERE id = ?', [id]);
      res.send('File deleted');
  } else {
      res.status(404).send('File not found');
  }
});

