FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies first for better layer cache reuse.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy only runtime files required by the server.
COPY src ./src
COPY bin ./bin
COPY public ./public
COPY README.md ./README.md
COPY function.md ./function.md

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/index.js"]