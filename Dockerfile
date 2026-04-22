FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY stencil.config.ts tsconfig.json ./
COPY src/ ./src/
RUN npx stencil build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/www ./www
COPY serve.mjs ./
EXPOSE 3333
CMD ["node", "serve.mjs"]
