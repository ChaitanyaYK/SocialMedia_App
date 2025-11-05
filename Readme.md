# 🌐 Social Media App Backend

![Node.js](https://img.shields.io/badge/Node.js-5FA04E?style=for-the-badge&logo=node.js&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-4EA94B?style=for-the-badge&logo=mongodb&logoColor=white)
![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)
![Prettier](https://img.shields.io/badge/Code%20Style-Prettier-F7B93E?style=for-the-badge&logo=prettier&logoColor=white)

---

### 🧾 Overview
A **Node.js + Express** backend built with a modular, scalable structure.  
It powers a social media app with features like authentication, media uploads, Redis caching, and Cloudinary integration.  

Designed for **performance, security, and scalability** — ready for production use or as a starter backend template.

---

## 🚀 Features

- 🔐 **JWT Authentication** & secure password hashing (bcrypt)
- ☁️ **Cloudinary Integration** for image uploads
- 🧠 **Redis Caching** using ioredis
- 🍪 **Cookie Parsing** for secure session handling
- 🌍 **CORS** enabled for frontend-backend communication
- ⚙️ **Mongoose ORM** with aggregation pagination
- 🧩 **Modular Folder Structure**
- 🧹 **Prettier** for code consistency
- 🔄 **Auto Reloading** in development via Nodemon

---

## 📦 Tech Stack

| Technology | Purpose |
|-------------|----------|
| **Node.js** | JavaScript runtime for backend |
| **Express.js** | Web application framework |
| **MongoDB + Mongoose** | NoSQL database and schema modeling |
| **JWT + bcrypt** | Authentication & encryption |
| **Cloudinary** | Cloud image storage |
| **ioredis** | In-memory caching |
| **Multer** | File uploads |
| **dotenv** | Environment variable management |

---

## 📁 Folder Structure


---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/ChaitanyaYK/social_media_app.git
cd social_media_app
```
2️⃣ Install Dependencies
```bash
Copy code
npm install
```
3️⃣ Configure Environment Variables
```
Create a .env file in the root directory and add your credentials:

env
Copy code
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_secret_key
CLOUDINARY_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
REDIS_URL=your_redis_url
You can use .env.example as a template.
```

4️⃣ Start the Development Server
```bash
Copy code
npm run dev
Starts the server with nodemon and dotenv.
Default port: http://localhost:5000
```