// const Question = require('../models/Question');
// const Redis = require('ioredis');
// const redis = new Redis(process.env.REDIS_URL);
// const GameHistory = require('../models/GameHistory');
// const PlayerStats = require('../models/PlayerStats');

class GameService {
  constructor() {
    this.games = new Map();
    this.defaultQuestions = [
      {
        question: 'Thủ đô của Việt Nam là gì?',
        options: ['Hà Nội', 'HCM', 'Đà Nẵng', 'Hải Phòng'],
        correctAnswer: 'Hà Nội',
        points: 10
      },
      {
        question: '1 + 1 = ?',
        options: ['1', '2', '3', '4'],
        correctAnswer: '2',
        points: 10
      }
      // Add more questions here
    ];
  }

  async createGame(roomId, settings = {}) {
    const game = {
      roomId,
      players: new Map(),
      currentQuestionIndex: 0,
      status: 'waiting',
      questions: this.defaultQuestions,
      settings: {
        questionsCount: settings.questionsCount || 10,
        timePerQuestion: settings.timePerQuestion || 30,
      }
    };

    this.games.set(roomId, game);
    return game;
  }

  async startGame(roomId) {
    console.log('Starting game for room:', roomId);
    const game = this.games.get(roomId);
    console.log('Current game state:', JSON.stringify(game, null, 2));
    
    if (!game) {
      console.error('Game not found for room:', roomId);
      throw new Error('Game not found');
    }

    game.status = 'playing';
    game.currentQuestionIndex = 0;
    game.startTime = Date.now();

    const result = {
      question: this.getCurrentQuestion(roomId),
      players: Array.from(game.players.keys())
    };
    console.log('Game started with:', JSON.stringify(result, null, 2));
    return result;
  }

  getCurrentQuestion(roomId) {
    const game = this.games.get(roomId);
    if (!game) throw new Error('Game not found');

    const question = game.questions[game.currentQuestionIndex];
    if (!question) return null;

    // Return only the necessary information, excluding the answer
    return {
        question: question.question,
        options: question.options,
        timePerQuestion: game.settings.timePerQuestion,
        points: question.points
    };
  }

  async nextQuestion(roomId) {
    const game = this.games.get(roomId);
    if (!game) throw new Error('Game not found');

    // Check if all players have answered the current question
    const allAnswered = Array.from(game.players.values())
        .every(p => p.answers.some(a => a.questionIndex === game.currentQuestionIndex));
    
    if (!allAnswered) {
        throw new Error('Not all players have answered the current question');
    }

    game.currentQuestionIndex++;
    
    // Check if the game is finished
    if (game.currentQuestionIndex >= game.questions.length) {
        game.status = 'finished';
        await this.finishGame(roomId);
        return { 
            status: 'finished', 
            leaderboard: this.getLeaderboard(roomId),
            question: null,
            totalQuestions: game.questions.length,
            currentQuestionIndex: game.currentQuestionIndex
        };
    }

    // Reset the time for the new question
    game.startTime = Date.now();

    // Get the next question and necessary information
    return {
        status: 'playing',
        question: this.getCurrentQuestion(roomId),
        leaderboard: this.getLeaderboard(roomId),
        totalQuestions: game.questions.length,
        currentQuestionIndex: game.currentQuestionIndex + 1 // +1 for display purposes
    };
  }

  async addPlayer(roomId, username, socketId) {
    let game = this.games.get(roomId);
    
    // Automatically create a new game if the room doesn't exist
    if (!game) {
        game = await this.createGame(roomId);
    }

    if (game.status !== 'waiting') {
        throw new Error('Game already started');
    }

    // Check if the username already exists
    if (game.players.has(username)) {
        throw new Error('Username already exists in this room');
    }

    game.players.set(username, {
        socketId,
        score: 0,
        answers: []
    });

    return Array.from(game.players.keys());
  }

  async submitAnswer(roomId, username, answer) {
    const game = this.games.get(roomId);
    if (!game) throw new Error('Game not found');

    const player = game.players.get(username);
    if (!player) throw new Error('Player not found');

    // Check if the player has answered the current question
    const hasAnsweredCurrent = player.answers.some(
        a => a.questionIndex === game.currentQuestionIndex
    );
    
    if (hasAnsweredCurrent) {
        throw new Error('You have already answered this question');
    }

    const currentQuestion = game.questions[game.currentQuestionIndex];
    const isCorrect = answer === currentQuestion.correctAnswer;
    
    const timeSpent = (Date.now() - game.startTime) / 1000;
    const timeBonus = Math.max(0, game.settings.timePerQuestion - timeSpent);
    const points = isCorrect ? Math.round(currentQuestion.points + timeBonus) : 0;

    // Save the answer with timestamp
    player.answers.push({
        questionIndex: game.currentQuestionIndex,
        answer,
        isCorrect,
        points,
        timeSpent,
        timestamp: Date.now()
    });

    player.score += points;

    // Log for debugging
    console.log(`Player ${username} answered question ${game.currentQuestionIndex + 1}`);
    console.log(`Answer: ${answer}, Correct: ${isCorrect}, Points: ${points}`);

    // Check if all players have answered
    const allPlayersAnswered = Array.from(game.players.values())
        .every(p => p.answers.some(a => a.questionIndex === game.currentQuestionIndex));

    return {
        isCorrect,
        points,
        leaderboard: this.getLeaderboard(roomId),
        shouldMoveNext: allPlayersAnswered,
        message: isCorrect ? 'Correct answer!' : 'Wrong answer!'
    };
  }

  getLeaderboard(roomId) {
    const game = this.games.get(roomId);
    if (!game) return [];

    return Array.from(game.players.entries())
      .map(([username, data]) => ({
        username,
        score: data.score,
        answers: data.answers
      }))
      .sort((a, b) => b.score - a.score);
  }

  async removePlayer(roomId, username) {
    const game = this.games.get(roomId);
    if (!game) throw new Error('Game not found');

    game.players.delete(username);

    // If no one is left in the room, delete the room
    if (game.players.size === 0) {
      this.games.delete(roomId);
      return { players: [], roomDeleted: true };
    }

    return {
      players: Array.from(game.players.keys()),
      leaderboard: this.getLeaderboard(roomId),
      roomDeleted: false
    };
  }

  async getGame(roomId) {
    return this.games.get(roomId);
  }

  async finishGame(roomId) {
    const game = this.games.get(roomId);
    if (!game) throw new Error('Game not found');

    // Save game history
  }
}

module.exports = new GameService(); 