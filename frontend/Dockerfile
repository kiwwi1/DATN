# Build stage
FROM node:18-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ARG VITE_BACKEND_URL=http://localhost:4000
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
ARG VITE_R2_PUBLIC_BASE_URL=
ENV VITE_R2_PUBLIC_BASE_URL=$VITE_R2_PUBLIC_BASE_URL
ARG VITE_R2_BUCKET=
ENV VITE_R2_BUCKET=$VITE_R2_BUCKET
ARG VITE_GOOGLE_CLIENT_ID=
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID

RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"] 