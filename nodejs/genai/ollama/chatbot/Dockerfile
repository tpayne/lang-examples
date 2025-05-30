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

FROM node:lts-slim AS imagebuilder
# Combined apk install and upgrade
RUN apt-get update

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
# CHANGE: Switch to a glibc-based Node.js slim image (Debian-based)
FROM node:lts-slim AS runner

# CHANGE: Use apt-get for package installation
# memcached, supervisor, openssl, curl, bash are common.
# libstdc++ and libgcc are typically part of glibc or build-essential in Debian.
RUN apt-get update && apt-get install -y \
    memcached \
    supervisor \
    openssl \
    curl \
    bash \
    && rm -rf /var/lib/apt/lists/* # Clean up apt cache to reduce image size

# Expose Ollama's default port
EXPOSE 11211
EXPOSE 8080
EXPOSE 8443
EXPOSE 11434

ARG account=nodejs
# Combined addgroup and adduser commands
RUN addgroup --system ${account} && adduser ${account} --system --home /app --no-create-home && \
     adduser ${account} ${account}

WORKDIR /app

COPY --from=imagebuilder /source/nodeexe ./
COPY --from=imagebuilder /source/src/contexts ./contexts
COPY --from=imagebuilder /source/src/resources ./resources
COPY --from=imagebuilder /source/src/templates ./templates
COPY --from=imagebuilder /source/src/public ./public

# Create directory for certificates, Ollama models, and Ollama's home directory
RUN mkdir -p /app/certs && \
     chown -R ${account}:${account} /app/certs && \
     mkdir -p /app/logs && \
     chown -R ${account}:${account} /app/logs && \
     mkdir -p /app/ollama_models && \
     chown -R ${account}:${account} /app/ollama_models && \
     mkdir -p /app/.ollama && \
     chown -R ${account}:${account} /app/.ollama

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

# --- Ollama Installation and Setup ---
# Set environment variables for Ollama
ENV OLLAMA_HOST=0.0.0.0:11434
ENV OLLAMA_MODELS=/app/ollama_models
ENV OLLAMA_HOME=/app/.ollama

# Download and install Ollama for ARM64 (from the correct .tgz archive)
RUN curl -L https://ollama.com/download/ollama-linux-arm64.tgz -o /tmp/ollama.tgz && \
    mkdir -p /tmp/ollama_extracted && \
    tar -xzf /tmp/ollama.tgz -C /tmp/ollama_extracted && \
    mv $(find /tmp/ollama_extracted -name ollama -type f) /usr/local/bin/ollama && \
    rm -rf /tmp/ollama.tgz /tmp/ollama_extracted && \
    chmod +x /usr/local/bin/ollama

# Ensure Ollama is runnable by the `nodejs` user
RUN chown ${account}:${account} /usr/local/bin/ollama

# Supervisor configuration
COPY supervisord.conf /etc/supervisord.conf

USER ${account}

# HEALTHCHECK for Ollama (optional, but good practice)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
 CMD ["curl", "--fail", "http://localhost:11434/api/tags"]

# Optional: Add HEALTHCHECK for the Node.js app.
# HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
#  CMD ["wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/status"] # Example for HTTP status
# OR for HTTPS (requires openssl in the runner stage)
# HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
#  CMD ["sh", "-c", "openssl s_client -connect localhost:8443 < /dev/null 2>/dev/null | grep -q 'Verify return code: 0'"] # Basic HTTPS check


CMD ["supervisord", "-c", "/etc/supervisord.conf"]