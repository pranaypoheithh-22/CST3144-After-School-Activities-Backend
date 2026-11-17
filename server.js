
// Load environment variables from .env
require("dotenv").config();

// Import the required packages
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

// Create the Express application
const app = express();

// Set the server port
const PORT = process.env.PORT || 3000;

// Enable middleware
app.use(cors());
app.use(express.json());

// Create a MongoDB client
const client = new MongoClient(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
});

// Test route
app.get("/", (req, res) => {
    res.json({
        message: "CST3144 Backend API is running"
    });
});

// Connect MongoDB before starting the server
async function startServer() {
    try {
        // Connect to MongoDB Atlas
        await client.connect();

        // Select the coursework database
        const db = client.db(process.env.DB_NAME);

        // Check that the database responds
        await db.command({ ping: 1 });

        // Make the database available to Express routes
        app.locals.db = db;

        console.log("MongoDB connected successfully!");

        // Start the Express server
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error("MongoDB connection failed:", error.message);
        await client.close();
        process.exit(1);
    }
}

// Run the application
startServer();
