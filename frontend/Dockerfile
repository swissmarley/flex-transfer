FROM node:23-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY . .
RUN npm run build

FROM nginx:1.28-alpine
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 3000