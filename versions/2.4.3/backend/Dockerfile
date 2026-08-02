FROM node:22-alpine

WORKDIR /app
COPY server.js ./server.js

ENV PORT=3000 \
    DATA_DIR=/data \
    NODE_OPTIONS=--no-warnings

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
