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

# Next.js necesita SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en build time
# (lib/supabase-admin.ts falla al importarse si faltan, y Next evalúa todas
# las rutas API durante "Collecting page data"). NEXT_PUBLIC_VAPID_PUBLIC_KEY
# también hace falta en build porque se incrusta en el bundle del cliente.
# En Easypanel: marcar estas variables como disponibles en build time.
ARG SUPABASE_URL
ARG SUPABASE_SERVICE_ROLE_KEY
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV SUPABASE_URL=$SUPABASE_URL
ENV SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY
ENV NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY

RUN npm run build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
