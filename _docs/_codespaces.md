Codespaces Terminal setup commands

# Start MongoDB Docker container 
docker start mongodb || docker run -d --name mongodb -p 27017:27017 -v mongodata:/data/db mongo:7

# Start Redis
docker start redis || docker run -d --name redis -p 6379:6379 -v redisdata:/data redis:7