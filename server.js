// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { ExpressPeerServer } = require("peer");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const peerServer = ExpressPeerServer(server, {
    debug: true,
    path: "/peerjs",
});

app.use("/peerjs", peerServer);
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

const db = new sqlite3.Database(":memory:");

db.serialize(() => {
    db.run(`CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT,
    message TEXT,
    timestamp INTEGER,
    type TEXT,
    fileData TEXT
  )`);
});

const users = new Map();

io.on("connection", (socket) => {
    console.log("New user connected:", socket.id);

    socket.on("user-joined", (data) => {
        const { username, peerId } = data;
        users.set(socket.id, { username, peerId, socketId: socket.id });

        db.all(
            "SELECT * FROM messages ORDER BY timestamp ASC LIMIT 100",
            [],
            (err, rows) => {
                if (!err) {
                    socket.emit("message-history", rows);
                }
            },
        );

        io.emit("user-list", Array.from(users.values()));
        io.emit("user-joined-notification", { username, peerId });

        // Kullanıcı yazıyor / yazmayı bıraktı
        socket.on("typing", (username) => {
            socket.broadcast.emit("user-typing", { username });
        });

        socket.on("stop-typing", (username) => {
            socket.broadcast.emit("user-stop-typing", { username });
        });
    });

    socket.on("send-message", (data) => {
        const timestamp = Date.now();
        const messageData = {
            username: data.username,
            message: data.message,
            timestamp: timestamp,
            type: data.type || "text",
            fileData: data.fileData || null,
        };

        db.run(
            "INSERT INTO messages (username, message, timestamp, type, fileData) VALUES (?, ?, ?, ?, ?)",
            [
                messageData.username,
                messageData.message,
                messageData.timestamp,
                messageData.type,
                messageData.fileData,
            ],
            (err) => {
                if (!err) {
                    io.emit("new-message", messageData);
                }
            },
        );
    });

    socket.on("call-user", (data) => {
        const targetUser = Array.from(users.values()).find(
            (u) => u.peerId === data.targetPeerId,
        );
        if (targetUser) {
            io.to(targetUser.socketId).emit("incoming-call", {
                fromPeerId: data.fromPeerId,
                fromUsername: data.fromUsername,
                callType: data.callType,
            });
        }
    });

    socket.on("call-accepted", (data) => {
        const targetUser = Array.from(users.values()).find(
            (u) => u.peerId === data.targetPeerId,
        );
        if (targetUser) {
            io.to(targetUser.socketId).emit("call-accepted-response", {
                fromPeerId: data.fromPeerId,
            });
        }
    });

    socket.on("call-rejected", (data) => {
        const targetUser = Array.from(users.values()).find(
            (u) => u.peerId === data.targetPeerId,
        );
        if (targetUser) {
            io.to(targetUser.socketId).emit("call-rejected-response", {
                fromPeerId: data.fromPeerId,
            });
        }
    });

    socket.on("end-call", (data) => {
        const targetUser = Array.from(users.values()).find(
            (u) => u.peerId === data.targetPeerId,
        );
        if (targetUser) {
            io.to(targetUser.socketId).emit("call-ended", {
                fromPeerId: data.fromPeerId,
            });
        }
    });

    socket.on("disconnect", () => {
        const user = users.get(socket.id);
        if (user) {
            users.delete(socket.id);
            io.emit("user-list", Array.from(users.values()));
            io.emit("user-left-notification", { username: user.username });
        }
        console.log("User disconnected:", socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
