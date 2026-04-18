FROM node:22-alpine AS base

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

RUN npm run prisma:generate
RUN npm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start"]
