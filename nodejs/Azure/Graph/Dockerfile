# hadolint global ignore=DL3018,DL3059
ARG alpineVersion=3.18

# Image builder...
FROM node:18-alpine${alpineVersion} AS imagebuilder

# Set up APK repositories and upgrade
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

WORKDIR /source

COPY src/*.js ./
COPY src/*.json ./

# Install application dependencies
RUN npm install -g pkg@5.8.1
RUN npm install properties-reader@2.2.0 \
    @azure/arm-resourcegraph \
    @azure/core-auth@1.5.0 \
    @azure/identity@3.2.4 \
    express@4.18.2 body-parser@1.20.2 \
    os @azure/logger
RUN pkg -t node18 restapi.js -o nodeexe

# Image runner...
FROM node:lts-alpine${alpineVersion} AS runner
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

RUN apk add --no-cache curl

ARG account=nodejs
RUN addgroup --system ${account} && adduser ${account} --system
RUN adduser ${account} ${account}

WORKDIR /

COPY --from=imagebuilder /source/nodeexe ./

COPY files/html ./html
COPY files/config ./config
COPY files/config/app.properties.default ./config/app.properties
COPY files/scripts ./scripts
COPY files/sql ./sql

USER ${account}:${account}

CMD ["./nodeexe"]
EXPOSE 8000 8080 3000
