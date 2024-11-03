# Quiz Game - Getting Started Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Building Docker Images](#building-docker-images)
5. [Running the Application](#running-the-application)
6. [Development](#development)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software
- Docker Desktop (latest version)
- Docker Compose v2.0+
- Git
- Node.js v16+ (for local development)

### System Requirements
- Minimum 4GB RAM
- Port availability: 3000, 5001, 27017, 6379

## Installation

### 1. Clone Repository
```bash
git clone git@github.com:huynk05/coding-challenges.git
cd coding-challenges
```

### 2. Project Structure
```
quiz-game/
├── client/                 # React frontend
│   ├── src/               # Source code
│   ├── Dockerfile         # Client container config
│   └── package.json       # Dependencies
├── server/                # Node.js backend
│   ├── src/              # Source code
│   ├── Dockerfile        # Server container config
│   └── package.json      # Dependencies
├── docker-compose.yml     # Container orchestration
└── docs/                 # Documentation
```

## Running the Application

### 1. Start Services
```bash
# Build and start
docker-compose up --build

# Run in detached mode
docker-compose up -d
```
