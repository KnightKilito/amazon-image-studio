export function shouldToggleTaskSelection(multiSelectMode: boolean, selectedCount: number, modifierPressed: boolean) {
  return multiSelectMode || selectedCount > 0 || modifierPressed
}
