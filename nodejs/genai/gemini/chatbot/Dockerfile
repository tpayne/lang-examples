# Image builder...
ARG nodeVersion=18
ARG alpineVersion=3.18

FROM node:${nodeVersion}-alpine${alpineVersion} AS prebuild

WORKDIR /source

COPY package.json package-lock.json* ./

# Copy only necessary source for dependencies and testing
COPY src/ ./src/
COPY contexts ./contexts
COPY resources ./resources
COPY templates ./templates

RUN npm install && npm test

FROM node:${nodeVersion}-alpine${alpineVersion} AS imagebuilder

WORKDIR /source

COPY package.json package-lock.json* ./

# Copy the built node_modules from the prebuild stage
COPY --from=prebuild /source/node_modules ./node_modules
COPY src/ ./src/
COPY contexts ./contexts
COPY resources ./resources
COPY templates ./templates

RUN npm install -g pkg && \
    pkg -t node${nodeVersion} ./src/ -o nodeexe --no-sign

# Image runner...
FROM node:lts-alpine${alpineVersion} AS runner

RUN apk add --no-cache memcached supervisor && \
    apk -U upgrade

EXPOSE 11211
EXPOSE 8080

ARG account=nodejs
RUN addgroup --system ${account} && adduser --system --group ${account} ${account}

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./
COPY --from=imagebuilder /source/contexts ./contexts
COPY --from=imagebuilder /source/resources ./resources
COPY --from=imagebuilder /source/templates ./templates
RUN mkdir -p /app/logs && chown -R ${account}:${account} /app/logs

# Supervisor configuration
COPY supervisord.conf /etc/supervisord.conf

USER ${account}

CMD ["supervisord", "-c", "/etc/supervisord.conf"]