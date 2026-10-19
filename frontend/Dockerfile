# Front de Call Audit en modo http (Next.js standalone, puerto 3000).
# API_URL se fija al construir: Next guarda los rewrites de /api/* en el build.
#   docker build -t call-audit-front --build-arg API_URL=http://api:8000 frontend
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG API_URL=http://api:8000
ENV NEXT_PUBLIC_API_MODE=http API_URL=$API_URL NEXT_OUTPUT=standalone NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
