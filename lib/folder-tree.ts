export interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
}

// Recorre folders y devuelve el propio id + todos sus descendientes (para
// no permitir mover/dejar huérfano un subárbol de carpetas hacia sí mismo).
export function collectDescendants(id: string, all: FolderNode[]): Set<string> {
  const result = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of all) {
      if (f.parentId && result.has(f.parentId) && !result.has(f.id)) {
        result.add(f.id);
        grew = true;
      }
    }
  }
  return result;
}

// Orden top-down de un subárbol (la raíz primero, luego sus hijos, etc.) —
// útil para recrear una jerarquía de carpetas en otro sitio respetando
// parent_id (hay que crear el padre antes que el hijo).
export function topDownOrder(rootId: string, subtree: Set<string>, all: FolderNode[]): string[] {
  const order: string[] = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const f of all) {
      if (f.parentId === cur && subtree.has(f.id)) {
        order.push(f.id);
        queue.push(f.id);
      }
    }
  }
  return order;
}
