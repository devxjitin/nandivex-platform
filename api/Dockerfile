# Production image for the NandiVex API. Build context is the api/ folder.
FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# Dev dependencies stay: the build needs tsc and prisma, and the container runs
# `prisma migrate deploy` and the admin seed script (tsx) on start.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
