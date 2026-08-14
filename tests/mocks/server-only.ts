// Stub para tests: el paquete real 'server-only' solo sirve para que Next.js
// falle el build si un módulo server-only se cuela en un bundle de cliente.
// Fuera de ese bundler no hace nada — pero Vitest resuelve la condición
// equivocada del package.json real y lanza. Este stub es un no-op.
export {};
