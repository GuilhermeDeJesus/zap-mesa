FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npx prisma generate && npm run build

EXPOSE 3333

CMD ["node", "dist/server.js"]