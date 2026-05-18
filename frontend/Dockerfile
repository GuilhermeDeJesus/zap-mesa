FROM node:22

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]

# Convert next.config.ts to next.config.js
RUN npx ts-node next.config.ts > next.config.js