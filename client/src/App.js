import React, { useState, useEffect } from 'react';
import { useGame } from './contexts/GameContext';
import socketService from './services/socketService';
import './App.css';

function App() {
  const { state, dispatch } = useGame();
  const [error, setError] = useState(null);
  const [isJoining, setIsJoining] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const socket = socketService.connect();
    console.log('Socket connected:', socket.connected);

    socket.on('connect', () => {
      console.log('Socket connected successfully');
    });

    socket.on('error', ({ message }) => {
      setError(message);
      setIsJoining(false);
    });

    socket.on('playerJoined', ({ players, leaderboard }) => {
      dispatch({ type: 'UPDATE_PLAYERS', payload: { players } });
      dispatch({ type: 'UPDATE_LEADERBOARD', payload: { leaderboard } });
      dispatch({ type: 'SET_GAME_STATUS', payload: { status: 'waiting' } });
      setIsJoining(false);
    });

    socket.on('gameStarted', ({ game }) => {
      dispatch({ type: 'SET_GAME_STATUS', payload: { status: 'playing' } });
      dispatch({ type: 'SET_QUESTION', payload: { question: game.question } });
    });

    socket.on('answerResult', (result) => {
      dispatch({ type: 'UPDATE_LEADERBOARD', payload: { leaderboard: result.leaderboard } });
      if (result.shouldMoveNext) {
        socketService.getSocket().emit('nextQuestion', { roomId: state.roomId });
      }
    });

    socket.on('nextQuestion', ({ status, question, leaderboard, totalQuestions, currentQuestionIndex }) => {
      if (status === 'finished') {
        dispatch({ type: 'SET_GAME_STATUS', payload: { status: 'finished' } });
        dispatch({ type: 'UPDATE_LEADERBOARD', payload: { leaderboard } });
      } else {
        dispatch({ 
          type: 'SET_QUESTION', 
          payload: { 
            question,
            totalQuestions,
            currentQuestionIndex
          } 
        });
        dispatch({ type: 'UPDATE_LEADERBOARD', payload: { leaderboard } });
        // Reset answer state for new question
        setHasAnswered(false);
        setMessage(null);
      }
    });

    socket.on('playerLeft', ({ players, leaderboard }) => {
      dispatch({ type: 'UPDATE_PLAYERS', payload: { players } });
      dispatch({ type: 'UPDATE_LEADERBOARD', payload: { leaderboard } });
    });

    socket.on('leftRoom', () => {
      dispatch({ type: 'RESET_GAME' });
    });

    socket.on('answerSubmitted', (result) => {
      setHasAnswered(true);
      setMessage({
        text: result.message,
        type: result.isCorrect ? 'success' : 'error'
      });
    });

    return () => {
      socketService.disconnect();
    };
  }, [dispatch]);

  const joinRoom = () => {
    if (!state.username?.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!state.roomId?.trim()) {
      setError('Please enter room ID');
      return;
    }

    setError(null);
    setIsJoining(true);
    socketService.getSocket().emit('joinGame', { 
      roomId: state.roomId, 
      username: state.username 
    });
  };

  const startGame = () => {
    socketService.getSocket().emit('startGame', { roomId: state.roomId });
  };

  const submitAnswer = (answer) => {
    if (hasAnswered) {
      setMessage({
        text: 'You have already answered this question',
        type: 'warning'
      });
      return;
    }

    socketService.getSocket().emit('submitAnswer', {
      roomId: state.roomId,
      username: state.username,
      answer
    });
  };

  const leaveRoom = () => {
    if (state.roomId && state.username) {
      socketService.getSocket().emit('leaveRoom', { 
        roomId: state.roomId, 
        username: state.username 
      });
    }
  };

  // Render game finished state
  if (state.gameStatus === 'finished') {
    return (
      <div className="game-container">
        <h2>Game Finished!</h2>
        <div className="leaderboard">
          <h3>Final Leaderboard</h3>
          {state.leaderboard.map((player, index) => (
            <div key={player.username} className="leaderboard-item">
              <span>{index + 1}. {player.username}</span>
              <span>{player.score} points</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render join form
  if (state.gameStatus === 'initial') {
    return (
      <div className="join-container">
        <h2>Join Quiz Game</h2>
        {error && <div className="error">{error}</div>}
        <input
          type="text"
          placeholder="Your name"
          value={state.username || ''}
          onChange={(e) => dispatch({ 
            type: 'SET_USERNAME', 
            payload: { username: e.target.value } 
          })}
          disabled={isJoining}
        />
        <input
          type="text"
          placeholder="Room ID"
          value={state.roomId || ''}
          onChange={(e) => dispatch({ 
            type: 'SET_ROOM_ID', 
            payload: { roomId: e.target.value } 
          })}
          disabled={isJoining}
        />
        <button onClick={joinRoom} disabled={isJoining}>
          {isJoining ? 'Joining...' : 'Join Room'}
        </button>
      </div>
    );
  }

  // Render waiting room
  if (state.gameStatus === 'waiting') {
    return (
      <div className="waiting-room">
        <h2>Waiting Room</h2>
        <div className="players-list">
          <h3>Players:</h3>
          {state.players.map(player => (
            <div key={player} className="player-item">{player}</div>
          ))}
        </div>
        <div className="button-group">
          <button onClick={startGame}>Start Game</button>
          <button onClick={leaveRoom} className="leave-button">Leave Room</button>
        </div>
      </div>
    );
  }

  // Render game UI
  if (state.gameStatus === 'playing') {
    return (
      <div className="game-container">
        {state.currentQuestion && (
          <div className="question-container">
            <div className="question-header">
              <h3>Question {state.currentQuestionIndex} of {state.totalQuestions}</h3>
              <div className="points">Points: {state.currentQuestion.points}</div>
            </div>
            
            <h2>{state.currentQuestion.question}</h2>
            
            <div className="options-grid">
              {state.currentQuestion.options.map(option => (
                <button
                  key={option}
                  onClick={() => submitAnswer(option)}
                  className={`option-button ${hasAnswered ? 'disabled' : ''}`}
                  disabled={hasAnswered}
                >
                  {option}
                </button>
              ))}
            </div>

            {message && (
              <div className={`message ${message.type}`}>
                {message.text}
              </div>
            )}
          </div>
        )}
        
        <div className="leaderboard">
          <h3>Leaderboard</h3>
          {state.leaderboard.map((player, index) => (
            <div key={player.username} className="leaderboard-item">
              <span>{index + 1}. {player.username}</span>
              <span>{player.score} points</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export default App; 