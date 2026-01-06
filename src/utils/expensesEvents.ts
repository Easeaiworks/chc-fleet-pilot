export const EXPENSES_CHANGED_EVENT = 'expenses:changed';

export function emitExpensesChanged() {
  window.dispatchEvent(new Event(EXPENSES_CHANGED_EVENT));
}
