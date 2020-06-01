# Base on NodeJS image on Stretch
FROM node:12.17

EXPOSE 3000
WORKDIR /app

# Install Chrome and dependencies
RUN apt-get update \
	&& apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
	&& curl -sSL https://dl.google.com/linux/linux_signing_key.pub | apt-key add - \
	&& echo "deb https://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list \
	&& apt-get update \
	&& apt-get install -y --no-install-recommends \
    google-chrome-stable \
	&& rm -rf /var/lib/apt/lists/*

# Install npm dependencies
COPY package*.json ./
RUN npm ci

# Build application
COPY . .
RUN npm run build

# Add healthcheck
HEALTHCHECK --interval=1m --timeout=5s --start-period=15s \
  CMD curl -fs http://localhost:3000/health || exit 1

CMD ["npm", "start"]
