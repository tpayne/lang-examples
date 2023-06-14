# Image builder...
ARG alpineVersion=3.18
FROM node:alpine${alpineVersion} AS imagebuilder

# Set up APK repositories and upgrade
RUN apk add --no-cache --virtual --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

WORKDIR /source

COPY src/*.js .
COPY src/*.json .

# Install application dependencies
RUN npm install -g pkg
RUN npm install properties-reader pg sprintf-js
RUN pkg -t node16 *.js -o nodeexe

# Image runner...
FROM node:lts-alpine${alpineVersion} AS runner

# Set up APK repositories and upgrade
RUN apk add --no-cache --virtual --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

ARG account=nodejs
RUN addgroup --system ${account} && adduser ${account} --system
RUN adduser ${account} ${account}

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./
COPY files/html ./html
COPY files/config ./config

USER ${account}:${account}

CMD ["./nodeexe"]
EXPOSE 8080
