type Listener = (type: string) => void;

let currentType = '';
const listeners = new Set<Listener>();

export function setDocType(type: string) {
  currentType = type;
  listeners.forEach(fn => fn(type));
}

export function getDocType(): string {
  return currentType;
}

export function onDocTypeChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
