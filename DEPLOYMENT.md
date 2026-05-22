# Khader Factory System - Deployment Guide

This system is built with React (Frontend), Node.js (Backend), and MySQL.

## Prerequisites
- cPanel hosting with Node.js support
- MySQL Database

## 1. Database Setup
1. Create a new MySQL database in cPanel.
2. Create a database user and assign it to the database with all privileges.
3. Import the provided schema or let the system auto-migrate (if configured).

## 2. Backend Deployment
1. Upload the `server` folder content to your server.
2. Run `npm install` in the server directory.
3. Create a `.env` file in the server directory with:
   ```env
   DATABASE_URL=mysql://user:password@localhost:3306/dbname
   SESSION_SECRET=your_random_secret
   ```
4. Start the server using cPanel Node.js Selector or PM2.

## 3. Frontend Deployment
1. Run `npm run build` in the `client` directory.
2. Upload the content of the `dist` folder to your `public_html` or a subdomain folder.
3. Ensure the `.htaccess` file is present in the root to handle React routing.

## 4. Default Credentials
- **Admin**: `admin_m` / `AdminPass123`
- **User**: `fatima_r` / `UserPass123`
