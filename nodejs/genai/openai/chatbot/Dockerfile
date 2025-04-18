# Image builder...
ARG nodeVersion=18
ARG alpineVersion=3.18
FROM node:${nodeVersion}-alpine${alpineVersion} AS imagebuilder

# Set up APK repositories and upgrade (consider stable)
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

WORKDIR /source

COPY package.json package-lock.json* ./

COPY src/ ./src/
COPY package.json package-lock.json* ./src/
COPY contexts ./src/contexts
COPY resources ./src/resources
COPY templates ./src/templates

RUN npm install --omit=dev && \
    npm install -g pkg && \
    pkg -t node18 ./src/ -o nodeexe --no-sign

# Image runner...
FROM node:lts-alpine${alpineVersion} AS runner
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

ARG account=nodejs
RUN addgroup --system ${account} && adduser ${account} --system &&\
    adduser ${account} ${account}

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./
COPY contexts ./contexts
COPY resources ./resources
COPY templates ./templates
RUN mkdir logs/

USER ${account}:${account}

CMD ["./nodeexe"]
EXPOSE 8080
