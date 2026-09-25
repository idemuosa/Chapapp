# ChatApp

A full-stack real-time messaging and social web application with microservice architecture, multi-platform support, and AWS deployment integration.

## Architecture & Features

- **Backend (`backend/`)**: Django & Django REST Framework application handling user authentication (JWT), profiles, social feed posts, comments, likes, stories, notifications, friendships, and group chats.
- **Real-time Engine (`realtime/`)**: Node.js & Socket.io server with Redis pub/sub for real-time messaging, presence tracking (online status, last seen), typing indicators, and WebRTC signaling for video calls.
- **Frontend (`frontend/`)**: React single-page application supporting chat rooms, social feed, WebRTC video calling, user search, friend requests, notifications, user profiles, and group chats.
- **Mobile App (`mobile/`)**: Flutter application codebase supporting cross-platform mobile connectivity.
- **Containerization & Reverse Proxy (`docker/`, `docker-compose.yml`)**: Nginx reverse proxy routing traffic to backend API, realtime Socket.io, and frontend React app. Docker Compose setups for development and production environments.
- **Deployment (`deploy.sh`, `aws-deployment.yml`)**: Automated ECR image build & push script and AWS CloudFormation template.

## Getting Started

### Local Development with Docker Compose

1. Copy `.env.example` to `.env` if custom variables are needed.
2. Build and start services:
   ```bash
   docker-compose up --build
   ```
3. Access the web interface at `http://localhost`.

### Running Tests

To run Django backend tests locally:
```bash
cd backend
python manage.py test
```

## License
MIT
