const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const redis = require('redis');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'django-insecure-chatapp-secret-key';

// Middleware to authenticate socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers['authorization'];

  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }

  const cleanToken = token.replace('Bearer ', '');

  jwt.verify(cleanToken, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error: Invalid token'));
    }
    socket.user = decoded; // Contains user_id, etc.
    next();
  });
});

// Redis client for caching/pubsub
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

const subscriber = redisClient.duplicate();

redisClient.on('error', (err) => console.log('Redis Client Error', err));
subscriber.on('error', (err) => console.log('Redis Subscriber Error', err));

const axios = require('axios');
const DJANGO_API_URL = process.env.DJANGO_API_URL || 'http://backend:8000/api/messages/';

async function startServer() {
  await redisClient.connect();
  await subscriber.connect();

  io.on('connection', async (socket) => {
    const userId = socket.user.user_id.toString();
    console.log(`User connected: ${userId} (${socket.id})`);

    // Join a personal room named after the userId for targeted messaging
    socket.join(userId);

    // Presence: Mark user as online in Redis
    await redisClient.sAdd('online_users', userId);
    io.emit('user_status', { user_id: userId, status: 'online' });

    // Send the current list of online users to the newly connected user
    const onlineUsers = await redisClient.sMembers('online_users');
    socket.emit('online_users_list', onlineUsers);

    socket.on('join_room', (room) => {
      socket.join(room);
      console.log(`User ${userId} joined room ${room}`);
    });

    socket.on('typing', (data) => {
      // data: { room }
      socket.to(data.room).emit('user_typing', {
        user_id: userId,
        username: socket.user.username || 'Someone',
        room: data.room
      });
    });

    socket.on('stop_typing', (data) => {
      socket.to(data.room).emit('user_stop_typing', {
        user_id: userId,
        room: data.room
      });
    });

    // WebRTC Signaling for Video Calls (using userId)
    socket.on('call-user', (data) => {
      // data: { to (userId), offer }
      socket.to(data.to.toString()).emit('call-made', {
        offer: data.offer,
        from: userId,
        username: socket.user.username
      });
    });

    socket.on('make-answer', (data) => {
      // data: { to (userId), answer }
      socket.to(data.to.toString()).emit('answer-made', {
        from: userId,
        answer: data.answer
      });
    });

    socket.on('ice-candidate', (data) => {
      // data: { to (userId), candidate }
      socket.to(data.to.toString()).emit('ice-candidate', {
        candidate: data.candidate,
        from: userId
      });
    });

    socket.on('message_read', async (data) => {
      // data: { message_id, room }
      socket.to(data.room).emit('message_read_update', {
        message_id: data.message_id,
        user_id: userId
      });

      // Update in DB via Django API
      try {
        await axios.post(`${DJANGO_API_URL}${data.message_id}/mark_read/`);
      } catch (err) {
        console.error('Error marking message read:', err.message);
      }
    });

    socket.on('send_message', async (data) => {
      // data: { room, content, group_id }
      try {
        const messageData = {
          ...data,
          sender_id: socket.user.user_id, // From JWT
          username: socket.user.username // If available in JWT
        };

        // Publish to Redis
        await redisClient.publish('CHAT_MESSAGES', JSON.stringify(messageData));

        // PERSISTENCE: Save to Django
        await axios.post(DJANGO_API_URL, {
          room: data.room,
          content: data.content,
          sender: socket.user.user_id,
          group: data.group_id || null
        });

      } catch (err) {
        console.error('Error in message flow:', err.message);
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${userId}`);

      // Presence: Check if user has other active connections
      const sockets = await io.in(userId.toString()).fetchSockets();
      if (sockets.length === 0) {
        await redisClient.sRem('online_users', userId.toString());
        io.emit('user_status', { user_id: userId, status: 'offline' });

        // Update last_seen in Django
        try {
          await axios.post(`http://backend:8000/api/profile/update_last_seen/`, {}, {
            headers: { 'X-Internal-User-ID': userId }
          });
        } catch (err) {
          console.error('Error updating last_seen:', err.message);
        }
      }
    });
  });

  // Subscribe to Redis channel to broadcast messages across instances
  await subscriber.subscribe('CHAT_MESSAGES', (message) => {
    const data = JSON.parse(message);
    io.to(data.room).emit('receive_message', data);
  });

  server.listen(PORT, () => {
    console.log(`Real-time server listening on port ${PORT}`);
  });
}

startServer();
