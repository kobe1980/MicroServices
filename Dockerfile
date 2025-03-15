FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Expose port for REST worker (if used)
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production

# Command to run depends on which component to start
# Override this at runtime with your specific component
CMD ["node", "SystemManager.js"]