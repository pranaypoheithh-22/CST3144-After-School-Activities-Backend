
 // Load environment variables
require("dotenv").config();

// Import Express and CORS
const express = require("express");
const cors = require("cors");

// Create Express application
const app = express();

// Set the port
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Allow JSON requests
app.use(express.json());

// Test the backend
app.get("/", (req, res) => {

    res.json({
        message: "CST3144 Backend API is running"
    });

});

// Start the server
app.listen(PORT, () => {

    console.log(`Server running at http://localhost:${PORT}`);

});
