FROM node:10
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN rm -rf src
RUN rm -rf .tsbuild
RUN rm -rf node_modules
RUN npm install --production
CMD [ "npm", "start" ]