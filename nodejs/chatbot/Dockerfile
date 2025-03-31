ARG nodeVersion=20
FROM node:${nodeVersion}-alpine AS builder

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json package-lock.json ./
COPY resources ./resources
COPY templates ./templates
COPY contexts ./contexts
COPY server.js .

RUN npm install --production

ARG account=chatbot
RUN addgroup -S ${account} && adduser -S ${account} -G ${account}

USER ${account}

CMD ["node", "server.js"]