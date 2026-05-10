FROM node:20

# Install dependencies for mediasoup
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

EXPOSE 5000
# Mediasoup ports
EXPOSE 10000-11000/udp

CMD ["npm", "run", "start:prod"]
