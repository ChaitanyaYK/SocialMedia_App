import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"
import { DATA_LIMIT } from "./constants.js";

const app = express()

app.use(cors({
    origin: ["http://localhost:8000", "http://localhost:5173"],
    // origin: process.env.CORS_ORIGIN,
    credentials: true,
    optionsSuccessStatus: 200
}))

// Here we write some configuration as follow
// app.use() used to give middleware or configuration
app.use(express.json({limit: DATA_LIMIT})) // This is use to take form or json file & limit the size of json file or we can say middleware to parse JSON body
app.use(express.urlencoded({extended: true, limit: DATA_LIMIT})) // this use to take url data & limit the size of json file
app.use("public", express.static("public")) // This is used to store file in which folder of local server
app.use(cookieParser()) // THis is used to store cookie in local server


//routes import
import userRouter from './routes/user.routes.js'
// import healthcheckRouter from "./routes/healthcheck.routes.js"
import tweetRouter from "./routes/tweet.routes.js"
import subscriptionRouter from "./routes/subscription.routes.js"
import videoRouter from "./routes/video.routes.js"
import commentRouter from "./routes/comment.routes.js"
import likeRouter from "./routes/like.routes.js"
import playlistRouter from "./routes/playlist.routes.js"
import dashboardRouter from "./routes/dashboard.routes.js"

//routes declaration
// app.use("/api/v1/healthcheck", healthcheckRouter)
app.use("/api/v1/user", userRouter)
app.use("/api/v1/tweets", tweetRouter)
app.use("/api/v1/subscriptions", subscriptionRouter)
app.use("/api/v1/videos", videoRouter)
app.use("/api/v1/comments", commentRouter)
app.use("/api/v1/likes", likeRouter)
app.use("/api/v1/playlist", playlistRouter)
app.use("/api/v1/dashboard", dashboardRouter)

// http://localhost:8000/api/v1/user/register

export default app