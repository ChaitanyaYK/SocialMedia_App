import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"
import { DATA_LIMIT } from "./constants";

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    optionsSuccessStatus: 200
}))

// Here we write some configuration as follow
// app.use() used to give middleware or configuration
app.use(express.json({limit: DATA_LIMIT})) // This is use to take form or json file & limit the size of json file
app.use(express.urlencoded({extended: true, limit: DATA_LIMIT})) // this use to take url data & limit the size of json file
app.use(express.static("public")) // This is used to store file in which folder of local server
app.use(cookieParser()) // THis is used to store cookie in local server


// Routes
import userRouter from "./routes/user.routes.js"

app.post("/user", userRouter)

export {app}