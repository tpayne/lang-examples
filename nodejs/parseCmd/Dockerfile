# Image builder...
ARG alpineVersion=3.18

# Image builder...
FROM node:18-alpine${alpineVersion} AS imagebuilder

# Set up APK repositories and upgrade
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

WORKDIR /source

COPY *.js .
COPY package.json .

RUN npm install
RUN npm install -g pkg
RUN pkg -t node18 *.js -o nodeexe 

# Image runner...
FROM node:lts-alpine${alpineVersion} AS runner
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

ARG account=nodejs
RUN addgroup --system ${account} && adduser ${account} --system
RUN adduser ${account} ${account} 

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./

USER ${account}:${account}

CMD ["./nodeexe","--generate-file=/tmp/test.txt","--overwrite"]
EXPOSE 8080
