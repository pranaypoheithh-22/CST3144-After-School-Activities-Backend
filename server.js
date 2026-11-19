
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

// POST API: Save bookings and update available spaces
app.post("/orders", async (req, res) => {

    // Get customer information
    const { name, phone, lessonIds } = req.body || {};

    // Validate customer information and selected lessons
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

    // Count how many spaces are requested for each lesson
    const quantities = new Map();

    for (const id of lessonIds) {

        quantities.set(
            id,
            (quantities.get(id) || 0) + 1
        );

    }

    // Start a MongoDB transaction session
    const session = client.startSession();

    try {

        // Access MongoDB collections
        const db = req.app.locals.db;

        const lessonsCollection = db.collection("lessons");

        const ordersCollection = db.collection("orders");

        // Execute all database changes in one transaction
        const booking = await session.withTransaction(async () => {

            // Get unique lesson IDs
            const uniqueIds = [...quantities.keys()];

            // Find selected lessons
            const lessons = await lessonsCollection
                .find(
                    {
                        id: { $in: uniqueIds }
                    },
                    {
                        session
                    }
                )
                .toArray();

            // Check that all lessons exist
            if (lessons.length !== uniqueIds.length) {

                const error = new Error(
                    "One or more lessons do not exist"
                );

                error.status = 400;

                throw error;

            }

            // Create a lookup of lesson prices
            const prices = new Map(
                lessons.map(lesson => [
                    lesson.id,
                    lesson.price
                ])
            );

            // Calculate cart total
            const total = lessonIds.reduce((sum, id) => {

                return sum + prices.get(id);

            }, 0);

            // Reduce available spaces for each selected lesson
            for (const [id, quantity] of quantities) {

                const result = await lessonsCollection.updateOne(

                    {
                        id: id,
                        spaces: { $gte: quantity }
                    },

                    {
                        $inc: { spaces: -quantity }
                    },

                    {
                        session
                    }

                );

                // Prevent bookings when spaces are insufficient
                if (result.matchedCount !== 1) {

                    const error = new Error(
                        `Not enough spaces for lesson ${id}`
                    );

                    error.status = 409;

                    throw error;

                }

            }

            // Create the booking document
            const order = {

                name: name.trim(),

                phone: phone.trim(),

                lessonIds: lessonIds,

                total: total,

                createdAt: new Date()

            };

            // Save the booking in MongoDB
            const result = await ordersCollection.insertOne(
                order,
                {
                    session
                }
            );

            // Return booking information
            return {

                orderId: result.insertedId,

                total: total

            };

        });

        // Send successful booking confirmation
        res.status(201).json({

            message: "Order saved successfully",

            orderId: booking.orderId,

            total: booking.total

        });

    } catch (error) {

        console.error("Booking error:", error.message);

        // Return an appropriate error response
        res.status(error.status || 500).json({

            message: error.status
                ? error.message
                : "Failed to save booking"

        });

    } finally {

        // Close the MongoDB transaction session
        await session.endSession();

    }

});

// PUT API: Update available spaces for a lesson
app.put("/lessons/:id", async (req, res) => {

    try {

        // Get lesson ID from the URL
        const lessonId = Number(req.params.id);

        // Get the requested space change
        const change = req.body?.change;

        // Validate the lesson ID and space change
        if (
            !Number.isInteger(lessonId) ||
            !Number.isInteger(change) ||
            ![-1, 1].includes(change)
        ) {

            return res.status(400).json({
                message: "Invalid lesson ID or space change"
            });

        }

        // Access the lessons collection
        const collection = req.app.locals.db.collection("lessons");

        // Prevent spaces dropping below 0 or exceeding 5
        const spaceCondition = change === -1
            ? { $gt: 0 }
            : { $lt: 5 };

        // Update the lesson's available spaces
        const result = await collection.updateOne(

            {
                id: lessonId,
                spaces: spaceCondition
            },

            {
                $inc: { spaces: change }
            }

        );

        // Check whether the update was possible
        if (result.matchedCount === 0) {

            const lesson = await collection.findOne({
                id: lessonId
            });

            return res.status(lesson ? 409 : 404).json({

                message: lesson
                    ? "Cannot change spaces beyond the allowed limit"
                    : "Lesson not found"

            });

        }

        // Retrieve the updated lesson information
        const updatedLesson = await collection.findOne(

            {
                id: lessonId
            },

            {
                projection: { _id: 0 }
            }

        );

        // Return the updated lesson
        res.json({

            message: "Available spaces updated successfully",

            lesson: updatedLesson

        });

    } catch (error) {

        console.error("Lesson update error:", error.message);

        res.status(500).json({
            message: "Failed to update lesson"
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
