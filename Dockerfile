FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY stencil.config.ts tsconfig.json ./
COPY src/ ./src/
RUN npx stencil build
RUN ls -la www/ && ls -la www/build/

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/www ./www
COPY serve.mjs ./
RUN ls -la www/ && ls -la www/build/
EXPOSE 3333
CMD ["node", "serve.mjs"]
