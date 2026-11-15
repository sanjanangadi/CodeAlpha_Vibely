# CodeAlpha_Vibely

Vibely is a Pinterest-inspired social media platform with a soft pastel design.
Built for **Task 2 (Social Media Platform)** of the CodeAlpha Full Stack Development Internship.

## Features
- Sign up and log in (passwords hashed with bcrypt, sessions with JWT)
- User profiles with bio, post count, followers and following
- Create and delete posts (280 characters max)
- Comments on posts
- Like and unlike posts
- Follow and unfollow users
- Home feed (you and people you follow) and Explore (everyone)
- Search for people
- Pastel masonry layout, post close-up view, mobile-friendly design

## Tech Stack
- **Frontend:** HTML, CSS, JavaScript (single page app)
- **Backend:** Node.js and Express.js (REST API)
- **Database:** SQLite (built into Node.js) with tables for users, posts, comments, likes and follows
- **Security:** bcryptjs, JSON Web Tokens

## Run Locally
Requires Node.js 22.13 or newer.

```
npm install
npm start
```

Then open http://localhost:3000

The database file `social.db` is created automatically.

## Project Structure
```
server.js            Express app entry point
db.js                SQLite database setup
middleware/auth.js   Login token creation and checking
routes/auth.js       Sign up and log in
routes/users.js      Profiles, search, bio, follow
routes/posts.js      Posts, likes, comments
public/              Frontend (index.html, style.css, app.js)
```

## API Endpoints
All routes except `/api/auth/*` need a login token.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Log in |
| GET | /api/users/search?q= | Search users |
| GET | /api/users/:username | Profile and posts |
| PUT | /api/users/me | Update bio |
| POST | /api/users/:username/follow | Follow or unfollow |
| GET | /api/posts?scope=feed or all | Home feed or Explore |
| POST | /api/posts | Create post |
| DELETE | /api/posts/:id | Delete own post |
| POST | /api/posts/:id/like | Like or unlike |
| GET | /api/posts/:id/comments | List comments |
| POST | /api/posts/:id/comments | Add comment |

## Security Notes
- Passwords are hashed, never stored in plain text
- All database queries are parameterized (no SQL injection)
- User content is displayed as text, never HTML (no XSS)
- Only the owner can delete their own posts

## Author
Sanjana M Angadi , CodeAlpha Full Stack Development Intern
