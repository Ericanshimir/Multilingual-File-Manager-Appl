# Multilingual File Manager Application

## Overview

This project is a multilingual file manager application built using Node.js, Redis, and MySQL. The application supports user registration, login, file upload, file management, and multilingual support using i18n.

## Features

- User registration and login with secure password storage
- CRUD operations on files (create, read, update, delete) within a user's designated directory structure
- Multilingual support for user interface elements (English and French)
- Queuing system using Redis for handling asynchronous tasks like file processing
- Unit tests for core functionalities

## Prerequisites

- Node.js and npm installed
- MySQL installed and running
- Redis installed and running
- Postman (for API testing)

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/file-manager.git
cd file-manager




 2. Install Dependencies

```bash
npm install

3.Setup Environment Variables

```bash 
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=file_manager
SESSION_SECRET=your_secret
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

4. Setup the Database

  1. Log in to MySQL:
  
  ```bash 
  mysql -u root -p

  2. Create the database and tables:

  ```bash 
  CREATE DATABASE file_manager;

USE file_manager;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    language VARCHAR(10) DEFAULT 'en'
);

CREATE TABLE files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(255) NOT NULL,
    size INT,
    type VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id)
);


5. Start the Server
   
   ```bash
   npm start

6. Running Tests
   
   ```bash
   npm test

