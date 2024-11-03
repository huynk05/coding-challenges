const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const config = require('./config/config');
const GameService = require('./services/GameService');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(config.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('createGame', async ({ roomId, settings }) => {
    try {
      const game = await GameService.createGame(roomId, settings);
      socket.join(roomId);
      io.to(roomId).emit('gameCreated', { game });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('joinGame', async ({ roomId, username }) => {
    try {
      console.log('joinGame', roomId, username);
    
      const players = await GameService.addPlayer(roomId, username, socket.id);
      socket.join(roomId);
      io.to(roomId).emit('playerJoined', {
        players,
        leaderboard: GameService.getLeaderboard(roomId)
      });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('startGame', async ({ roomId }) => {
    try {
      const game = await GameService.startGame(roomId);
      io.to(roomId).emit('gameStarted', { game });
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('submitAnswer', async ({ roomId, username, answer, timeLeft }) => {
    try {
      const result = await GameService.submitAnswer(roomId, username, answer, timeLeft);
      io.to(roomId).emit('answerResult', result);
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('leaveRoom', async ({ roomId, username }) => {
    try {
      const result = await GameService.removePlayer(roomId, username);
      socket.leave(roomId);
      
      if (!result.roomDeleted) {
        // Thông báo cho những người còn lại trong phòng
        io.to(roomId).emit('playerLeft', {
          players: result.players,
          leaderboard: result.leaderboard,
          leftUsername: username
        });
      }
      
      // Thông báo cho người rời phòng
      socket.emit('leftRoom');
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    // Có thể thêm logic xử lý khi user đột ngột mất kết nối
  });
});

server.listen(config.PORT, () => {
  console.log(`Server running on port ${config.PORT}`);
}); 