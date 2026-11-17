
require("dotenv").config();

const { MongoClient } = require("mongodb");

// Connect using the URI stored in .env
const client = new MongoClient(process.env.MONGODB_URI);

// The same 10 lessons used by our Vue frontend
const lessons = [
    { id: 1001, subject: "Art", location: "Curepipe", price: 400, spaces: 5, icon: "fa fa-paint-brush" },
    { id: 1002, subject: "Mathematics", location: "Quatre Bornes", price: 350, spaces: 5, icon: "fa fa-calculator" },
    { id: 1003, subject: "Science", location: "Rose Hill", price: 450, spaces: 5, icon: "fa fa-flask" },
    { id: 1004, subject: "Music", location: "Vacoas", price: 500, spaces: 5, icon: "fa fa-music" },
    { id: 1005, subject: "Football", location: "Moka", price: 300, spaces: 5, icon: "fa fa-futbol-o" },
    { id: 1006, subject: "Computer Science", location: "Port Louis", price: 550, spaces: 5, icon: "fa fa-laptop" },
    { id: 1007, subject: "English", location: "Phoenix", price: 350, spaces: 5, icon: "fa fa-book" },
    { id: 1008, subject: "Photography", location: "Beau Bassin", price: 500, spaces: 5, icon: "fa fa-camera" },
    { id: 1009, subject: "Geography", location: "Curepipe", price: 350, spaces: 5, icon: "fa fa-globe" },
    { id: 1010, subject: "Dance", location: "Quatre Bornes", price: 400, spaces: 5, icon: "fa fa-child" }
];

async function seedLessons() {
    try {
        await client.connect();

        const db = client.db(process.env.DB_NAME);
        const collection = db.collection("lessons");

        // Prevent inserting the lessons twice
        const existingCount = await collection.countDocuments();

        if (existingCount > 0) {
            console.log("Collection already contains lessons. No changes made.");
            return;
        }

        // Insert all 10 lessons into MongoDB
        const result = await collection.insertMany(lessons);

        console.log(`${result.insertedCount} lessons inserted successfully!`);

    } catch (error) {
        console.error("Error inserting lessons:", error.message);

    } finally {
        await client.close();
    }
}

seedLessons();
