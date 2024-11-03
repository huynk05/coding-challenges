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

// Add variable to store mapping between socketId and player information
const socketToPlayer = new Map(); // Map to store socketId -> {username, roomId}

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
      console.log('joinGame event received:', { roomId, username });
      const players = await GameService.addPlayer(roomId, username, socket.id);
      console.log('Players after join:', players);
      
      socket.join(roomId);
      io.to(roomId).emit('playerJoined', {
        players,
        leaderboard: GameService.getLeaderboard(roomId)
      });
      console.log('playerJoined event emitted');
    } catch (error) {
      console.error('Error in joinGame:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('startGame', async ({ roomId }) => {
    try {
      console.log('startGame event received:', { roomId });
      const game = await GameService.startGame(roomId);
      console.log('Game started:', game);
      
      io.to(roomId).emit('gameStarted', { game });
      console.log('gameStarted event emitted');
    } catch (error) {
      console.error('Error in startGame:', error);
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('submitAnswer', async ({ roomId, username, answer }) => {
    try {
      console.log(`Received answer from ${username} in room ${roomId}: ${answer}`);
      
      const result = await GameService.submitAnswer(roomId, username, answer);
      
      // Send the result to the player who answered
      socket.emit('answerSubmitted', {
        isCorrect: result.isCorrect,
        points: result.points,
        message: result.message
      });

      // Send leaderboard update to the room
      io.to(roomId).emit('answerResult', {
        leaderboard: result.leaderboard,
        shouldMoveNext: result.shouldMoveNext
      });

      // If all have answered, move to the next question
      if (result.shouldMoveNext) {
        const nextQuestion = await GameService.nextQuestion(roomId);
        io.to(roomId).emit('nextQuestion', nextQuestion);
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      socket.emit('error', { 
        message: error.message,
        type: 'SUBMIT_ANSWER_ERROR'
      });
    }
  });

  socket.on('leaveRoom', async ({ roomId, username }) => {
    try {
      const result = await GameService.removePlayer(roomId, username);
      socket.leave(roomId);
      
      // Delete the player mapping
      socketToPlayer.delete(socket.id);
      
      if (!result.roomDeleted) {
        io.to(roomId).emit('playerLeft', {
          players: result.players,
          leaderboard: result.leaderboard,
          leftUsername: username
        });
      }
      
      socket.emit('leftRoom');
    } catch (error) {
      socket.emit('error', { message: error.message });
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    try {
      // Get the player info from the mapping
      const playerInfo = socketToPlayer.get(socket.id);
      
      if (playerInfo) {
        const { username, roomId } = playerInfo;
        
        // Remove the player from the game
        const result = await GameService.removePlayer(roomId, username);
        
        // Delete the player mapping
        socketToPlayer.delete(socket.id);
        
        // If the room still exists, notify the remaining players
        if (!result.roomDeleted) {
          io.to(roomId).emit('playerLeft', {
            players: result.players,
            leaderboard: result.leaderboard,
            leftUsername: username,
            reason: 'disconnected'
          });
        }
        
        // Check if the game is running and handle accordingly
        const game = await GameService.getGame(roomId);
        if (game && game.status === 'playing') {
          // Check if we should move to the next question
          const allPlayersAnswered = Array.from(game.players.values())
            .every(p => p.answers.length > game.currentQuestionIndex);
            
          if (allPlayersAnswered) {
            const nextQuestion = await GameService.nextQuestion(roomId);
            io.to(roomId).emit('nextQuestion', nextQuestion);
          }
        }
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    uptime: process.uptime(),
    status: 'OK',
    timestamp: Date.now()
  };
  res.status(200).json(health);
});

const PORT = config.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});