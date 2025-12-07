import Redis from "ioredis";

export const redis = new Redis({
    host: "127.0.0.1",  // your Redis server host
    port: 6379,   // default port
    // password: "your_password_if_any"
})