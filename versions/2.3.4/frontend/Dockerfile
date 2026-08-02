FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html manifest.webmanifest service-worker.js /usr/share/nginx/html/
COPY icons /usr/share/nginx/html/icons
COPY badges /usr/share/nginx/html/badges
COPY screenshots /usr/share/nginx/html/screenshots

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
