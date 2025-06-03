# Image builder...
ARG nodeVersion=18
ARG alpineVersion=3.18
ARG testbuild=

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
COPY package.json package-lock.json* ./
COPY package.json package-lock.json* ./src/
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
RUN apk add --no-cache memcached supervisor openssl terraform && \
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

# Create directory for certificates
RUN mkdir -p /app/certs && \
     chown -R ${account}:${account} /app/certs && \
     mkdir -p /app/logs && \
     chown -R ${account}:${account} /app/logs

# --- Conditional Certificate Handling ---
# If testbuild ARG is set, generate a test certificate.
# Otherwise, conditionally copy certificates from the build context if they exist.
ARG testbuild
RUN if [ "$testbuild" = "true" ]; then \
      echo "Generating test SSL certificates..."; \
      openssl req -newkey rsa:2048 -nodes -keyout /app/certs/server.key \
      -x509 -days 365 -out /app/certs/server.crt \
      -subj "/CN=localhost"; \
    else \
      echo "Attempting to copy SSL certificates from build context..."; \
      sh -c '[ -f server.key ] && cp server.key /app/certs/ || true'; \
      sh -c '[ -f server.crt ] && cp server.crt /app/certs/ || true'; \
      # If you have a CA certificate:
      # sh -c '[ -f ca.crt ] && cp ca.crt /app/certs/ || true'; \
    fi
# --- End Conditional Certificate Handling ---

RUN chown -R ${account}:${account} /app/certs && \
     chmod -R o+rwx /app/certs

# Supervisor configuration
COPY supervisord.conf /etc/supervisord.conf

USER ${account}

# Optional: Add HEALTHCHECK. Adjust the command and port based on your app's config
# HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
#  CMD ["wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/status"] # Example for HTTP status
# OR for HTTPS (requires openssl in the runner stage, which you already have)
# HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
#  CMD ["sh", "-c", "openssl s_client -connect localhost:8443 < /dev/null 2>/dev/null | grep -q 'Verify return code: 0'"] # Basic HTTPS check


CMD ["supervisord", "-c", "/etc/supervisord.conf"]