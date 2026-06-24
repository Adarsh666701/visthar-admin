FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_ADMIN_API_BASE=http://localhost:4100
ENV VITE_ADMIN_API_BASE=${VITE_ADMIN_API_BASE}

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
