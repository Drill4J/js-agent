FROM node:16.13.0-alpine

# Create app directory
WORKDIR /usr/src/app

# Install dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied where available (npm@5+)
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .
RUN npm run build

# Setup process.env
ENV DRILL_ADMIN_PROTOCOL=$DRILL_ADMIN_PROTOCOL
ENV DRILL_ADMIN_HOST=$DRILL_ADMIN_HOST
ENV MONGO_HOST=$DRILL_ADMIN_HOST
ENV MONGO_DBNAME=$DRILL_ADMIN_HOST
ENV SOURCE_MAP_FOLDER ./sourceMaps

# Setup wait utility
ADD https://github.com/ufoscout/docker-compose-wait/releases/download/2.7.3/wait /wait
RUN chmod +x /wait

# Launch
EXPOSE 8080
CMD /wait && node .