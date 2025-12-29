# StudyBuddy – AI-Powered Adaptive Learning & Quiz Platform

Live Demo:
https://studybuddy-kc2m.onrender.com/

---

## Overview

StudyBuddy is an AI-powered adaptive learning platform designed to improve student learning through personalized study modules, intelligent quizzes, gamification, real-time doubt solving, and exam-oriented question paper prediction.

The platform automates syllabus understanding, adapts quizzes based on learner performance, and motivates users using rewards and leaderboards — all in one unified system.

---

## Objectives

- Automate syllabus breakdown using AI
- Provide adaptive quizzes with multiple difficulty levels
- Improve learning engagement through gamification
- Enable real-time doubt solving using AI and chat
- Assist exam preparation via Question Paper Prediction (QPP)
- Build a scalable modern EdTech platform

---

## Features

### Authentication
- Email and password login
- Google OAuth 2.0 authentication
- Secure JWT-based session management

### Module Management
- Upload syllabus (PDF / DOC / Text)
- AI-generated structured modules (topics and subtopics)
- Auto-generated study content
- Module sharing and import using unique code (Google Classroom-like)

### Adaptive Quiz Engine
- Four difficulty levels (Beginner, Intermediate, Advanced, Expert)
- AI-generated quiz questions
- Time-based bonus scoring
- Performance-based progression

### Gamification & Leaderboard
- Points calculation: 10 × correct answers + time bonus
- Random game unlocks using earned points
- Global leaderboard for competition
- Game play limited to 10 minutes per hour

### Chat & AI Doubt Solver
- Global chatroom for all users
- Module-specific chatrooms
- AI doubt solver with chat history
- Real-time messaging using Socket.IO

### Question Paper Predictor (QPP)
- Upload syllabus and previous year papers
- AI-generated predicted question paper
- Useful for exam practice and revision

---

## Technology Stack

Frontend:
- React.js
- Normal CSS (No Tailwind)
- Responsive mobile-first UI

Backend:
- Node.js
- Express.js
- REST APIs
- JWT authentication

Database:
- MongoDB

AI:
- Google 4.0 Mini Model (via GitHub token)
  - Module generation
  - Quiz generation
  - Doubt solving
  - Question paper prediction

Real-Time:
- Socket.IO (chat system)

---

## System Architecture (High Level)

User
- Authentication (JWT + Google OAuth)
- Dashboard
  - Modules
  - Quizzes
  - Games
  - Chat
  - AI Doubts
  - QPP
- AI Engine (Google 4.0 Mini)
- MongoDB Database

---

## Mobile Friendly Design

- Fully responsive across mobile, tablet, and desktop
- Bottom navigation for mobile users
- Touch-friendly UI components
- Smooth animations and transitions

---

## Security

- JWT-based authentication
- OAuth 2.0 for Google sign-in
- Encrypted password storage
- Secure API communication
- Token-based AI request handling

---

## Academic Details

Degree:
- Master of Computer Applications (MCA)

Project Type:
- Mini Project

Team Members:
- Shravankumar Bhavrlal Patel
- Gayatri Shinde

---

## Future Enhancements

- Payment gateway for premium features
- Advanced analytics dashboard
- Offline module access
- Personalized learning recommendations
- Institution-level dashboards
- AI-based exam performance prediction

---

## Conclusion

StudyBuddy combines AI, adaptive learning, and gamification to create a modern digital learning platform. The project demonstrates strong technical feasibility, scalability, and real-world applicability in the EdTech domain.

---

If you like this project, feel free to star the repository and contribute.
