const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize Database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Error opening database:', err);
    else {
        console.log('Connected to SQLite database.');
        createTables();
    }
});

function createTables() {
    db.serialize(() => {
        // Products Table
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            niche TEXT,
            status TEXT DEFAULT 'testing',
            price REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Sales Table
        db.run(`CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER,
            amount REAL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(product_id) REFERENCES products(id)
        )`);

        // Agent Logs Table
        db.run(`CREATE TABLE IF NOT EXISTS agent_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_name TEXT,
            task TEXT,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

// API Routes
app.get('/api/status', (req, res) => {
    res.json({ system: 'SCALE V2', status: 'operational', timestamp: new Date() });
});

// Get Products
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Add Log Entry
app.post('/api/logs', (req, res) => {
    const { agent, task, status } = req.body;
    db.run("INSERT INTO agent_logs (agent_name, task, status) VALUES (?, ?, ?)", [agent, task, status], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`SCALE V2 Backend running on http://localhost:${PORT}`);
});
