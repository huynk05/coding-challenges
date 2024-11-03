require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/quiz-app',
  JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379'
}; 