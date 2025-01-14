const express = require('express');
const mysql = require('mysql2/promise'); // Use mysql2 with promise support
const bodyParser = require('body-parser');
const cors = require('cors');
const app = express();
const port = 3002;

app.use(cors());
app.use(bodyParser.json());

// Configure the MySQL connection pool
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'StrongPassword123!',
    database: 'doctor-way-interactive',
    waitForConnections: true,
    connectionLimit: 10000000000000, // Maximum number of connections in the pool
    queueLimit: 0       // No limit on the queued connection requests
});

// Sample endpoint to test the database connection
app.get('/test-db', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 + 1 AS solution');
        res.json({ message: 'Database connected successfully', solution: rows[0].solution });
    } catch (err) {
        console.error('Database connection error:', err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

// Example query function to retrieve data
async function getSomeData() {
    try {
        const [rows] = await pool.query('SELECT * FROM some_table'); // Replace with your query
        return rows;
    } catch (err) {
        console.error('Database query error:', err);
        throw err;
    }
}

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

module.exports = pool; // Export the pool instead of a single connection


//password: 'StrongPassword123!'
