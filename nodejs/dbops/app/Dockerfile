ARG alpineVersion=3.18

# Image builder...
FROM node:18-alpine${alpineVersion} AS imagebuilder

# Set up APK repositories and upgrade
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade
RUN apk add --no-cache curl

WORKDIR /source

COPY src/*.js ./
COPY src/*.json ./

# Install application dependencies
RUN npm install -g pkg
RUN npm install properties-reader pg express body-parser
RUN pkg -t node18 restapi.js -o nodeexe

# Image runner...
FROM node:lts-alpine${alpineVersion} AS runner
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade
RUN apk add --no-cache curl

ARG account=nodejs
RUN addgroup --system ${account} && adduser ${account} --system
RUN adduser ${account} ${account}

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./

COPY files/html ./html

USER ${account}:${account}

CMD ["./nodeexe"]
EXPOSE 8000 8080 3000 
