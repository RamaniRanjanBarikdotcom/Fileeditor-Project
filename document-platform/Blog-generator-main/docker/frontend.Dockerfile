# Build the SPA, then serve it with nginx (which also proxies /api and /ws).
FROM node:20-alpine AS build
WORKDIR /app
# Copy package manifests AND the scripts dir first: the `postinstall` hook
# (scripts/copy-tinymce.js) runs during `npm install`, so the script must exist
# before that step or the install fails.
COPY frontend/package.json frontend/package-lock.json ./
COPY frontend/scripts ./scripts
RUN npm install
COPY frontend/ ./
# Sub-path deploy: this build is served behind Apache at http://host/blog-app/.
# - VITE_BASE_PATH makes Vite emit asset URLs under /blog-app/ (e.g. /blog-app/assets/..).
# - VITE_API_BASE_URL prefixes API + WS calls so they become /blog-app/api and /blog-app/ws.
# Apache strips the /blog-app prefix before forwarding to this container's nginx (which
# still serves at root and proxies /api + /ws to the backend). Override via build args
# for a domain-root deploy: --build-arg VITE_BASE_PATH=/ --build-arg VITE_API_BASE_URL=""
ARG VITE_BASE_PATH=/blog-app/
ARG VITE_API_BASE_URL=/blog-app
ENV VITE_BASE_PATH=${VITE_BASE_PATH}
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:alpine
COPY docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
