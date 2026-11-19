
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

// GET API: Retrieve all lessons from MongoDB
app.get("/lessons", async (req, res) => {

    try {

        // Access the lessons collection
        const collection = req.app.locals.db.collection("lessons");

        // Retrieve lessons ordered by ID
        const lessons = await collection
            .find({})
            .project({ _id: 0 })
            .sort({ id: 1 })
            .toArray();

        // Send lessons to the frontend as JSON
        res.json(lessons);

    } catch (error) {

        console.error("Error retrieving lessons:", error.message);

        res.status(500).json({
            message: "Failed to retrieve lessons"
        });

    }

});

// POST API: Save customer bookings to MongoDB
app.post("/orders", async (req, res) => {

    try {

        // Get customer details from the request
        const { name, phone, lessonIds } = req.body;

        // Validate customer information
        if (
            typeof name !== "string" ||
            !/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name.trim()) ||
            typeof phone !== "string" ||
            !/^[0-9]+$/.test(phone.trim()) ||
            !Array.isArray(lessonIds) ||
            lessonIds.length === 0 ||
            !lessonIds.every(Number.isInteger)
        ) {

            return res.status(400).json({
                message: "Invalid booking information"
            });

        }

        // Access MongoDB
        const db = req.app.locals.db;

        // Find the lessons selected by the customer
        const lessons = await db.collection("lessons")
            .find({
                id: { $in: lessonIds }
            })
            .toArray();

        // Check that all requested lessons exist
        if (lessons.length !== new Set(lessonIds).size) {

            return res.status(400).json({
                message: "One or more lessons do not exist"
            });

        }

        // Calculate the cart total using MongoDB prices
        const total = lessonIds.reduce((sum, id) => {

            const lesson = lessons.find(item => {
                return item.id === id;
            });

            return sum + lesson.price;

        }, 0);

        // Create the order document
        const order = {

            name: name.trim(),

            phone: phone.trim(),

            lessonIds: lessonIds,

            total: total,

            createdAt: new Date()

        };

        // Save the order in MongoDB
        const result = await db.collection("orders")
            .insertOne(order);

        // Send booking confirmation
        res.status(201).json({

            message: "Order saved successfully",

            orderId: result.insertedId,

            total: total

        });

    } catch (error) {

        console.error("Order error:", error.message);

        res.status(500).json({
            message: "Failed to save order"
        });

    }

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
