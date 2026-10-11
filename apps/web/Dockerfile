FROM node:22-alpine AS build

WORKDIR /web

COPY package.json package-lock.json ./
COPY .npmrc ./
RUN npm ci --no-audit --no-fund

COPY . .
# In production the API is proxied under the same origin (see nginx template),
# so cookies stay first-party and no CORS is needed.
ARG VITE_API_BASE_URL=/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

FROM nginx:1.27-alpine
# nginx renders /etc/nginx/templates/*.template with envsubst at start-up.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /web/dist /usr/share/nginx/html
ENV PORT=8080
# Internal hostname:port of the API service (Railway private networking).
ENV API_UPSTREAM=api.railway.internal:4000
EXPOSE 8080
