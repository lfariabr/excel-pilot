Codespaces Terminal

# Start MongoDB Docker container 
docker start mongodb || docker run -d --name mongodb -p 27017:27017 -v mongodata:/data/db mongo:7