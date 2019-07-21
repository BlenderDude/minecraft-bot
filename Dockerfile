FROM node:10
WORKDIR /usr/src/app
RUN npm install -g yarn
COPY package.json .
RUN yarn install
COPY . .
RUN npm run build
RUN rm -rf src
RUN rm -rf .tsbuild
RUN rm -rf node_modules
RUN yarn install --production
CMD [ "yarn", "start" ]