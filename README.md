# NounX Community Backend

Unified Backend for the NounX Community Chat Platform. This system supports a hierarchical, single-pane community structure specifically designed for students of the National Open University (NOUN).

## 🚀 Key Features

- **Hybrid Database Architecture**: 
  - **MySQL (via Prisma)**: Manages structured entities like Users, Faculties, Departments, Levels, and Referral relationships.
  - **MongoDB (via Mongoose)**: Handles high-volume, real-time message history.
- **Hierarchical Chat Logic**: Built-in support for Faculty, Department, and Level-specific chat rooms with role-based access control.
- **Agent-Student Privacy Lock**: Real-time referral tracking that protects students from unsolicited DMs unless handled by their referring Agent.
- **Real-time Engine**: Powered by Socket.io for bi-directional communication.

## 🛠 Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Real-time**: Socket.io
- **ORM/ODM**: Prisma (MySQL) & Mongoose (MongoDB)
- **Authentication**: JWT (JSON Web Tokens)

## 📦 Getting Started

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Configure environment**: Copy `.env.example` to `.env` and fill in your credentials.
4. **Initialize MySQL Schema**: `npm run prisma:push`
5. **Start Development Server**: `npm run dev`

---
*Developed as part of the NounX Ecosystem.*
