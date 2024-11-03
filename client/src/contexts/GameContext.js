import React, { createContext, useContext, useReducer } from 'react';

const GameContext = createContext();

// Initial state for the game
const initialState = {
  roomId: null,
  username: null,
  players: [],
  currentQuestion: null,
  totalQuestions: 0,
  currentQuestionIndex: 0,
  leaderboard: [],
  gameStatus: 'initial',
  timeLeft: 0,
  settings: {
    questionsCount: 10,
    timePerQuestion: 30,
    category: 'all',
    difficulty: 'medium'
  }
};

function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_USERNAME':
      return {
        ...state,
        username: action.payload.username
      };
    case 'SET_ROOM_ID':
      return {
        ...state,
        roomId: action.payload.roomId
      };
    case 'SET_GAME_STATUS':
      return {
        ...state,
        gameStatus: action.payload.status
      };
    case 'UPDATE_PLAYERS':
      return {
        ...state,
        players: action.payload.players
      };
    case 'UPDATE_LEADERBOARD':
      return {
        ...state,
        leaderboard: action.payload.leaderboard
      };
    case 'SET_QUESTION':
      return {
        ...state,
        currentQuestion: action.payload.question,
        totalQuestions: action.payload.totalQuestions,
        currentQuestionIndex: action.payload.currentQuestionIndex
      };
    case 'RESET_GAME':
      return {
        ...initialState
      };
    default:
      return state;
  }
}

export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  return (
    <GameContext.Provider value={{ state, dispatch }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  return useContext(GameContext);
} 