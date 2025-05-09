# Image builder...
ARG nodeVersion=18
ARG alpineVersion=3.18

FROM node:${nodeVersion}-alpine${alpineVersion} AS prebuild
# Combined apk install and upgrade
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

WORKDIR /source

COPY package.json package-lock.json* ./
COPY .*lint* ./

# Copy only necessary source for dependencies and testing
COPY src/ ./src/
COPY contexts ./contexts
COPY resources ./resources
COPY public ./public
COPY templates ./templates

# Combined npm install and test
RUN npm install && npm test

FROM node:${nodeVersion}-alpine${alpineVersion} AS imagebuilder
# Combined apk install and upgrade
RUN apk add --no-cache --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    && apk -U upgrade

WORKDIR /source

COPY src/ ./src/
COPY package.json package-lock.json* ./\nCOPY package.json package-lock.json* ./src/ # Note: This line appears to be a duplicate copy to ./src/
COPY contexts ./src/contexts
COPY resources ./src/resources
COPY templates ./src/templates
COPY public ./src/public

# Combined npm install, pkg install, and pkg build
RUN npm install --omit=dev && \
    npm install -g pkg && \
    pkg -t node18 ./src/ -o nodeexe --no-sign

# Image runner...
FROM node:lts-alpine${alpineVersion} AS runner

# Combined apk install and upgrade
RUN apk add --no-cache memcached supervisor openssl && \
    apk -U upgrade

EXPOSE 11211
EXPOSE 8080
# Expose the HTTPS port
EXPOSE 8443

ARG account=nodejs
# Combined addgroup and adduser commands
RUN addgroup --system ${account} && adduser ${account} --system &&\
    adduser ${account} ${account}

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./
COPY --from=imagebuilder /source/src/contexts ./contexts
COPY --from=imagebuilder /source/src/resources ./resources
COPY --from=imagebuilder /source/src/templates ./templates
COPY --from=imagebuilder /source/src/public ./public

# Combined certificate directory creation and conditional copying
RUN mkdir -p /app/certs && \
    sh -c '[ -f server.key ] && cp server.key /app/certs/' && \
    sh -c '[ -f server.crt ] && cp server.crt /app/certs/'
# If you have a CA certificate:
# RUN sh -c '[ -f ca.crt ] && cp ca.crt /app/certs/'

# Combined log directory creation and ownership change
RUN mkdir -p /app/logs && chown -R ${account}:${account} /app/logs


# Supervisor configuration
COPY supervisord.conf /etc/supervisord.conf

USER ${account}

CMD ["supervisord", "-c", "/etc/supervisord.conf"]