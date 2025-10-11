# Express.js
Express.js is a minimal and flexible Node.js web application framework that provides a robust set of features to develop web and mobile applications. It facilitates the rapid development of Node based Web applications.

## Features
- Middleware support
- Routing
- Template engine
- View system
- Database integration
- Session management
- Authentication
- Authorization
- File upload
- Error handling
- Logging

## Installation
```bash
npm install express
```

## Usage
```javascript
const express = require('express');
const app = express();

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.listen(3000, () => {
    console.log('Server started on port 3000');
});
```

## Middleware
Middleware functions are functions that have access to the request object (req), the response object (res), and the next middleware function in the application’s request-response cycle. These functions can execute any code, make changes to the request and the response objects, end the request-response cycle, and call the next middleware function.

```javascript
const logger = (req, res, next) => {
    console.log(`Received ${req.method} request for ${req.url}`);
    next();
};
```

```javascript
app.use(logger);
```

## Routing
Routing refers to how an application's endpoints (URIs) respond to client requests. Each of these endpoints can be mapped to a corresponding set of functions to perform actions such as updating the database or rendering a page.

```javascript
app.get('/', (req, res) => {
    res.send('Hello World!');
});
```

## Session management
Session management refers to the process of managing user sessions and their data. Express.js supports several session management options, including cookies and sessions.

```javascript
const session = require('express-session');

app.use(session({
    secret: 'my-secret-key',
    resave: false,
    saveUninitialized: true,
}));
```

## Authentication
Authentication refers to the process of verifying a user's identity. Express.js supports several authentication options, including cookies and sessions.

```javascript
const passport = require('passport');

app.use(passport.initialize());
app.use(passport.session());
```

---

## Study / Mental Notes

- Express = routing + middleware pipeline (request → middlewares → route handler → error handler).
- CORS = browser security policy handshake; allow frontend origins
- Helmet = secure headers by default
- Health vs Ready = liveness vs dependency checks
- dotenv = environment-driven config, code stays twelve-factor
- Error handling = throw domain errors (AppError) and centralize the response in shape