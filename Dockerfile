FROM node:20.16.0-alpine AS builder
WORKDIR /app

# Copy root configurations
COPY package.json package-lock.json turbo.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

# Install dependencies
RUN npm ci

# Build the project
RUN npm run build

FROM node:20.16.0-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy necessary files from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/packages ./packages

# Create an empty .env file so that `node --env-file=../../.env server.js` doesn't crash
RUN touch .env

EXPOSE 4000
CMD ["npm", "start", "--workspace=freelanceos-web"]
