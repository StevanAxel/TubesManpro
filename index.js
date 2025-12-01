// index.js (Sprint 1 Commit: Setup and Foundation)

// 1. CORE MODULE IMPORTS
const express = require('express');
const path = require('path');
const db = require('./db'); // Assuming db.js handles the connection logic

// 2. INITIALIZE APPLICATION
const app = express();
// Use environment variable for port, default to 3000
const PORT = process.env.PORT || 3000; 

// 3. DATABASE CONNECTION (Call the function from db.js)
db.connect(); 

// 4. ESSENTIAL MIDDLEWARE
// Middleware to parse incoming request bodies
// Handles JSON payloads
app.use(express.json());
// Handles form data payloads
app.use(express.urlencoded({ extended: true }));

// 5. STATIC FILES AND VIEW ENGINE SETUP
// Serve static files (CSS, client-side JS, images) from the 'public' directory
// The frontend team will put their assets here
app.use(express.static(path.join(__dirname, 'public'))); 

// Set the view engine (assuming a common one like EJS, Pug, or Handlebars)
// This enables the server to render files from the 'views' folder
app.set('view engine', 'ejs'); 
app.set('views', path.join(__dirname, 'views'));

// 6. HEALTH CHECK / ROOT ROUTE
// A basic route to confirm the server is running and rendering views
app.get('/', (req, res) => {
    // The frontend team is responsible for creating a 'home.ejs' or similar file
    res.render('home', { title: 'Welcome to the App', message: 'Server is running and views are configured!' });
});

// --- Remaining 1100+ lines of authentication, CRUD, and error handling 
// --- will be added in Sprints 2, 3, and 4 below this line.

// 7. START SERVER
app.listen(PORT, () => {
    console.log(`Server successfully started and listening on http://localhost:${PORT}`);
});
