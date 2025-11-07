# Docker Containerization
This is a Docker setup for the excel-pilot project.

## Features
- Build a Node image with all dependencies
- Run the app in development mode (npm run dev) so you get live reload
- Expose the Express/Apollo server on port 4000
- Use a .env file for secrets (Mongo, Redis, OpenAI key, …)
- Optionally mount the source code for hot-reload in dev

## 1. Directory Layout
```bash
excel-pilot/
├─ src/
│   └─ … (app's code)
├─ .dockerignore
├─ .env.example
├─ Dockerfile
├─ docker-compose.yml   #(optional but recommended)
└─ package.json
```

## 2. How to run it

1. **Build and run the container:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - The server will be available at `http://localhost:4000`
   - GraphQL endpoint: `http://localhost:4000/graphql`

3. **Development mode with hot-reload:**
   - The container will automatically restart when code changes are detected
   - Source code is mounted for live updates during development

## 3. Environment Variables

An `.env` file in the project root with your secrets:

```env
MONGO_URI=mongodb://mongo:27017/excel-pilot
REDIS_URL=redis://redis:6379
OPENAI_API_KEY=your-openai-api-key
```

## 4. Useful Commands

```bash
# Build and start containers
docker-compose up --build

# Start containers in detached mode
docker-compose up -d

# View container logs
docker-compose logs -f

# Stop containers
docker-compose down

# Rebuild and restart
docker-compose up --build --force-recreate
```

