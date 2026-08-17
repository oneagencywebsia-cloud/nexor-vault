# ---- deps: instala todo (incl. devDependencies, necesarias para el
# prebuild que genera los brand-icons desde simple-icons) ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_VAPID_PUBLIC_KEY se incrusta en el bundle del cliente en build
# time (no es secreta, su nombre lo dice: PUBLIC). El resto de env vars
# (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SESSION_SECRET, VAPID_PRIVATE_KEY)
# solo hacen falta en runtime — configúralas en Easypanel como variables de
# entorno normales del servicio.
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN npm run build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
