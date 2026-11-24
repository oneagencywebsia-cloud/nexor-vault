// Alertas de seguridad priorizadas. Corre 100 % en el cliente (el servidor no
// ve contraseñas), combina varias señales y ordena qué arreglar primero.

export type AlertKind = 'pwned' | 'reused' | 'weak' | 'old';
export type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface AlertInput {
  id: string;
  title: string;
  password: string;
  hasTotp: boolean;
  /** ISO de la última modificación del item (proxy de "última vez que se cambió"). */
  updatedAt: string;
  strength: 'weak' | 'fair' | 'strong';
  /** ids de otros items con la misma contraseña (sin incluir este). */
  reusedWith: string[];
  /** nº de filtraciones (HIBP); null = aún no comprobado. */
  pwnedCount: number | null;
}

export interface SecurityAlert {
  id: string;
  title: string;
  kinds: AlertKind[];
  severity: Severity;
  priority: number;
  headline: string; // qué pasa
  action: string; // qué hacer
  details: string[];
}

const DAY = 24 * 60 * 60 * 1000;

export function ageInDays(iso: string, now = Date.now()): number {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY)) : 0;
}

export function humanAge(days: number): string {
  if (days >= 365) {
    const y = Math.floor(days / 365);
    return `${y} ${y === 1 ? 'año' : 'años'}`;
  }
  if (days >= 60) return `${Math.floor(days / 30)} meses`;
  return `${days} días`;
}

/**
 * Prioridad = suma ponderada de señales:
 *  filtrada (lo peor: ya está en listas de atacantes) > reutilizada (un fallo
 *  tumba varias cuentas) > débil > antigua. El 2FA activo reduce la urgencia
 *  porque, aunque la contraseña caiga, hace falta el segundo factor.
 */
export function buildAlerts(items: AlertInput[], titleById: Map<string, string>, now = Date.now()): SecurityAlert[] {
  const alerts: SecurityAlert[] = [];

  for (const it of items) {
    const kinds: AlertKind[] = [];
    const details: string[] = [];
    let priority = 0;

    if ((it.pwnedCount ?? 0) > 0) {
      kinds.push('pwned');
      priority += 150 + Math.min(20, Math.log10((it.pwnedCount ?? 0) + 1) * 4);
      details.push(`Aparece ${it.pwnedCount!.toLocaleString('es-ES')} veces en filtraciones conocidas.`);
    }
    if (it.reusedWith.length > 0) {
      kinds.push('reused');
      priority += 55 + Math.min(20, it.reusedWith.length * 5);
      const names = it.reusedWith.slice(0, 3).map((id) => titleById.get(id) ?? '—');
      const more = it.reusedWith.length > 3 ? ` y ${it.reusedWith.length - 3} más` : '';
      details.push(`La misma contraseña se usa en: ${names.join(', ')}${more}.`);
    }
    if (it.strength === 'weak') {
      kinds.push('weak');
      priority += 45;
      details.push('Es corta o previsible: se adivina con facilidad.');
    }
    const days = ageInDays(it.updatedAt, now);
    if (days >= 365 && it.password) {
      kinds.push('old');
      priority += days >= 730 ? 28 : 18;
      details.push(`Sin modificar desde hace ${humanAge(days)}.`);
    } else if (days >= 180 && it.password && kinds.length > 0) {
      // la antigüedad solo suma si ya hay otra señal de riesgo
      kinds.push('old');
      priority += 8;
      details.push(`Sin modificar desde hace ${humanAge(days)}.`);
    }

    if (kinds.length === 0) continue;
    if (it.hasTotp) {
      priority *= 0.75;
      details.push('Tiene 2FA activado, lo que reduce el riesgo.');
    }

    const severity: Severity = kinds.includes('pwned') ? 'critical' : priority >= 90 ? 'high' : priority >= 45 ? 'medium' : 'low';
    alerts.push({
      id: it.id,
      title: it.title,
      kinds,
      severity,
      priority: Math.round(priority),
      headline: headlineFor(kinds, severity),
      action: actionFor(kinds),
      details,
    });
  }

  return alerts.sort((a, b) => b.priority - a.priority);
}

function headlineFor(kinds: AlertKind[], severity: Severity): string {
  if (kinds.includes('pwned')) return 'Contraseña filtrada: cámbiala ya';
  if (kinds.includes('reused') && kinds.includes('weak')) return 'Débil y repetida en varias cuentas';
  if (kinds.includes('reused')) return 'Misma contraseña en varias cuentas';
  if (kinds.includes('weak')) return 'Contraseña débil';
  return severity === 'low' ? 'Conviene renovarla' : 'Lleva mucho sin cambiarse';
}

function actionFor(kinds: AlertKind[]): string {
  if (kinds.includes('pwned')) return 'Genera una nueva y cámbiala en el sitio hoy mismo.';
  if (kinds.includes('reused')) return 'Usa una contraseña distinta en cada cuenta; empieza por esta.';
  if (kinds.includes('weak')) return 'Genera una de 20+ caracteres con el generador.';
  return 'Renueva la contraseña cuando puedas.';
}

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'Crítica',
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};
