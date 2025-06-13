import connectDB from "./db/index.js";
// require('dotenv').config({path: './env'})
        // or code to import dotenv
import dotenv from "dotenv";
import app from "./app.js"

dotenv.config({
    path: './.env'
})

connectDB()
.then(() => {
    app.on("error", () => {
            console.log("Error before Listen ", error);
            throw error
    })

    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port ${process.env.PORT}`);        
    })
})
.catch((error) => {
    console.log("MONGO db connection failed !!! ", error);
    process.exit(1)
})



















/*
import express from "express";
const app = express()

;(
    async () => {
        try {
            const dbconection = await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)

            // app.on used to listen on event
            app.on("error", (error) => {
                console.log("ERRR: ", error);
                throw error
            })

            app.listen(process.env.PORT, () => {
                console.log(`App is listening on port ${process.env.PORT}`);
                
            })
        } catch (error) {
            console.error("ERROR: ", error)
            throw err
        }
    }
)()
*/