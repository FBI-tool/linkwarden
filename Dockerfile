# Stage: monolith-builder
# Purpose: Uses the Rust image to build monolith
# Notes:
#  - Fine to leave extra here, as only the resulting binary is copied out
FROM docker.io/rust:1.86-bullseye AS monolith-builder

RUN set -eux && cargo install --locked monolith

# Stage: main-app
# Purpose: Compiles the frontend and
# Notes:
#  - Nothing extra should be left here.  All commands should cleanup
FROM node:20.19.6-bullseye-slim AS main-app

ENV YARN_HTTP_TIMEOUT=10000000

ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0

ENV PRISMA_HIDE_UPDATE_MESSAGE=1

ARG DEBIAN_FRONTEND=noninteractive

WORKDIR /data

RUN corepack enable

# Copy the compiled monolith binary from the builder stage
COPY --from=monolith-builder /usr/local/cargo/bin/monolith /usr/local/bin/monolith

# Install curl for healthcheck, and ca-certificates to prevent monolith from failing to retrieve resources due to invalid certificates
RUN set -eux && \
    apt-get update && \
    apt-get install -yqq --no-install-recommends curl ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

COPY . .

# Install deps, build, prune devDependencies
RUN --mount=type=cache,sharing=locked,target=/root/.yarn/berry/cache set -eux && \
    yarn workspaces focus linkwarden @linkwarden/web @linkwarden/worker && \
    yarn prisma:generate && \
    yarn web:build && \
    yarn workspaces focus --production linkwarden @linkwarden/web @linkwarden/worker && \
    rm -rf apps/web/.next/cache && \
    yarn cache clean

HEALTHCHECK --interval=30s \
            --timeout=5s \
            --start-period=10s \
            --retries=3 \
            CMD [ "/usr/bin/curl", "--silent", "--fail", "http://127.0.0.1:3000/" ]

EXPOSE 3000

CMD ["sh", "-c", "export PATH=/data/node_modules/.bin:$PATH && prisma migrate deploy --schema=/data/packages/prisma/schema.prisma && exec concurrently -k -n web,worker \"cd /data/apps/web && exec next start\" \"cd /data/apps/worker && exec tsx worker.ts\""]
