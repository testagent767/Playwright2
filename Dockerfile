FROM node:20-bookworm

RUN apt-get update && apt-get install -y \
    libglib2.0-0 \
    libx11-6 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxrender1 \
    libxinerama1 \
    libxi6 \
    libxext6 \
    libxcursor1 \
    libxss1 \
    libxcomposite1 \
    libxtst6 \
    libxkbcommon0 \
    libxkbcommon-x11-0 \
    libasound2 \
    libpangoft2-1.0-0 \
    libpango-1.0-0 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgl1-mesa-glx \
    libnspr4 \
    libnss3 \
    libfontconfig1 \
    libfreetype6 \
    libharfbuzz0b \
    libffi8 \
    libgcc-s1 \
    libstdc++6 \
    ca-certificates \
    fonts-liberation \
    xdg-utils \
    wget \
    ffmpeg \
    zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install

RUN npx playwright install --with-deps chromium

COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
