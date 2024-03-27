FROM node:16.13.0-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .
RUN npm run build

# Setup process.env
ENV DRILL_ADMIN_ADDRESS=""
ENV DRILL_API_KEY=""
ENV DEBUG="drill:*"
ENV DEBUG_COLORS="true"
ENV FORCE_COLOR="3"
ENV DEBUG_LOG_LEVEL="4"

# Setup wait utility
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.7.3/wait /wait
RUN chmod +x /wait

# Launch
EXPOSE 8080
CMD /wait && node .