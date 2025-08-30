# Apollo Server
Apollo Server is a community-driven open-source GraphQL server for Node.js. It provides a complete GraphQL server implementation that can be used to build a GraphQL server for apps.

## Features
- GraphQL server implementation
- Schema definition
- Resolvers
- Data sources
- Caching
- Authentication
- Authorization
- File upload
- Error handling
- Logging

## Installation
```bash
npm install apollo-server-express
```

## Usage
```javascript
const { ApolloServer, gql } = require('apollo-server-express');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { resolvers } = require('./resolvers');
const { typeDefs } = require('./typeDefs');

const schema = makeExecutableSchema({ typeDefs, resolvers });

const server = new ApolloServer({ schema });

server.applyMiddleware({ app });
```

## Type Definitions
```javascript
const typeDefs = gql`
    type Query {
        hello: String
    }
`;
```

## Resolvers
```javascript
const resolvers = {
    Query: {
        hello: () => 'Hello World!',
    },
};
```

## Data Sources
```javascript
const dataSources = () => ({
    usersAPI: new UsersAPI(),
});
```

## Caching
```javascript
const cache = new InMemoryCache();
```

## Authentication
```javascript
const server = new ApolloServer({
    typeDefs,
    resolvers,
    dataSources,
    cache,
    context: ({ req }) => ({
        user: req.user,
    }),
});
```

---

## Study / Mental Notes

- Apollo Server = GraphQL server implementation
- Schema = type definitions
- Resolvers = resolve queries and mutations
- Data sources = external data sources
- Caching = cache data
- Authentication = authentication middleware
- Authorization = authorization middleware
- File upload = file upload middleware
- Error handling = error handling middleware
- Logging = logging middleware
