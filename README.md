# 💬 ChatSphere Server

<div align="center">

# ChatSphere Backend

Real-Time Chat Application Backend built with **Node.js**, **Express.js**, **MongoDB**, and **Socket.IO**

![Node.js](https://img.shields.io/badge/Node.js-22-green?logo=node.js)
![Express](https://img.shields.io/badge/Express.js-5-black?logo=express)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green?logo=mongodb)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real--Time-black?logo=socketdotio)
![JWT](https://img.shields.io/badge/JWT-Authentication-orange)
![License](https://img.shields.io/badge/License-MIT-blue)

</div>

---

# 🚀 Overview

ChatSphere Server is the backend API for the ChatSphere real-time messaging application.

It provides secure authentication, REST APIs, real-time communication using Socket.IO, MongoDB database integration, user management, and messaging services.

The backend is designed with a scalable architecture suitable for modern MERN applications.

---

# 🌐 Live API

https://chatsphere-server-ahyx.onrender.com

---

# ✨ Features

## 🔐 Authentication

- User Registration
- User Login
- JWT Authentication
- Password Encryption (bcrypt)
- Protected Routes

---

## 💬 Messaging

- One-to-One Messaging
- Real-Time Socket.IO Events
- Store Messages in MongoDB
- Fetch Conversation History

---

## 👤 User Management

- Get All Users
- User Search Support
- User Profiles

---

## ⚡ Real-Time Features

- Online User Tracking
- Typing Indicator
- Instant Message Delivery
- Socket Connection Management

---

## 🛡 Security

- JWT Authentication
- Password Hashing
- CORS Configuration
- Environment Variables
- Error Handling

---

# 🛠 Tech Stack

- Node.js
- Express.js
- MongoDB Atlas
- Mongoose
- Socket.IO
- JSON Web Token (JWT)
- bcryptjs
- dotenv
- cors

---

# 📁 Project Structure

```text
server/
│
├── config/
├── controllers/
├── middleware/
├── models/
├── routes/
├── socket/
├── app.js
├── server.js
├── package.json
└── README.md
```

---

# ⚙️ Installation

## Clone Repository

```bash
git clone https://github.com/Hafiz7679/ChatSphere-Server.git

cd ChatSphere-Server
```

---

## Install Dependencies

```bash
npm install
```

---

## Create Environment File

Create

```
.env
```

Add

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_secret_key

CLIENT_URL=http://localhost:3000

NODE_ENV=development
```

---

## Run Development Server

```bash
npm run dev
```

or

```bash
npm start
```

Server runs at

```
http://localhost:5000
```

---

# 🌍 Production Environment

```env
PORT=5000

MONGODB_URI=your_mongodb_connection_string

JWT_SECRET=your_secret_key

CLIENT_URL=https://your-frontend.vercel.app

NODE_ENV=production
```

---

# 📡 Socket.IO Events

## Client → Server

- register_user
- send_message
- typing
- stop_typing

---

## Server → Client

- receive_message
- online_users
- typing
- stop_typing

---

# 🔗 REST API

## Authentication

| Method | Endpoint |
|---------|----------|
| POST | /api/auth/register |
| POST | /api/auth/login |

---

## Users

| Method | Endpoint |
|---------|----------|
| GET | /api/users |

---

## Messages

| Method | Endpoint |
|---------|----------|
| POST | /api/messages |
| GET | /api/messages/:senderId/:receiverId |

---

# 🚀 Deployment

## Render

Push code

```bash
git add .

git commit -m "Deploy backend"

git push origin main
```

Set the following Environment Variables:

```env
MONGODB_URI=your_connection_string

JWT_SECRET=your_secret_key

CLIENT_URL=https://your-frontend.vercel.app

NODE_ENV=production
```

Deploy on Render.

---

# 📌 API Response

Successful Response

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

Error Response

```json
{
  "success": false,
  "message": "Something went wrong"
}
```

---

# 🔮 Roadmap

- Group Chat
- Media Uploads
- Voice Messages
- Audio Calls
- Video Calls
- Message Reactions
- Read Receipts
- Push Notifications
- End-to-End Encryption
- Message Search
- Admin Dashboard

---

# 🤝 Contributing

Contributions are welcome.

Fork the repository.

Create a new feature branch.

```bash
git checkout -b feature/YourFeature
```

Commit changes.

```bash
git commit -m "Add new feature"
```

Push changes.

```bash
git push origin feature/YourFeature
```

Open a Pull Request.

---

# 📄 License

This project is licensed under the MIT License.

---

# 👨‍💻 Developer

### Abdul Hafiz Sk

**GitHub**

https://github.com/Hafiz7679

**LinkedIn**

https://www.linkedin.com/in/abdulhafizsk00/
---

<div align="center">

⭐ If you found this project helpful, consider giving it a Star!

Built with ❤️ using Node.js, Express.js, MongoDB & Socket.IO.

</div>
