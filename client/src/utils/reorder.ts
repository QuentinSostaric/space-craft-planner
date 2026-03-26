export function areStringArraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

export function synchronizeOrderedIds(order: string[], ids: string[]): string[] {
  const validIds = new Set(ids);
  const next = order.filter((id) => validIds.has(id));

  for (const id of ids) {
    if (!next.includes(id)) {
      next.push(id);
    }
  }

  return next;
}

export function moveIdBefore(order: string[], draggedId: string, targetId: string): string[] {
  if (!draggedId || !targetId || draggedId === targetId) {
    return order;
  }

  const next = order.filter((id) => id !== draggedId);
  const targetIndex = next.indexOf(targetId);

  if (targetIndex === -1) {
    next.push(draggedId);
    return next;
  }

  next.splice(targetIndex, 0, draggedId);
  return next;
}
