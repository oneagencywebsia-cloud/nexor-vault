import { Check, Folder, Home } from 'lucide-react';
import type { FolderNode } from '@/lib/folder-tree';

// Lista plana e indentada de carpetas (excluyendo las pasadas en
// excludeIds, típicamente la carpeta que se está moviendo + sus
// descendientes, para no crear un ciclo), con "Raíz" arriba.
export function FolderPicker({
  folders,
  excludeIds,
  currentParentId,
  onPick,
}: {
  folders: FolderNode[];
  excludeIds: Set<string>;
  currentParentId: string | null;
  onPick: (id: string | null) => void;
}) {
  function depthOf(id: string): number {
    let depth = 0;
    let cur = folders.find((f) => f.id === id);
    while (cur?.parentId) {
      depth++;
      cur = folders.find((f) => f.id === cur!.parentId);
    }
    return depth;
  }

  const options = folders.filter((f) => !excludeIds.has(f.id));

  return (
    <div className="space-y-0.5">
      <button
        onClick={() => onPick(null)}
        className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] font-medium active:bg-surface-2 ${
          currentParentId === null ? 'text-purple' : 'text-foreground'
        }`}
      >
        <Home size={15} /> Raíz {currentParentId === null && <Check size={14} className="ml-auto" />}
      </button>
      {options.map((f) => (
        <button
          key={f.id}
          onClick={() => onPick(f.id)}
          style={{ paddingLeft: `${12 + depthOf(f.id) * 18}px` }}
          className={`flex w-full items-center gap-2 rounded-xl py-2.5 pr-3 text-left text-[14px] font-medium active:bg-surface-2 ${
            currentParentId === f.id ? 'text-purple' : 'text-foreground'
          }`}
        >
          <Folder size={15} /> {f.name} {currentParentId === f.id && <Check size={14} className="ml-auto" />}
        </button>
      ))}
    </div>
  );
}
