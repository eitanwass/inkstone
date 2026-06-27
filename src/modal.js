// ── Confirm dialog ────────────────────────────────────────────
// Generic yes/no modal shared by the context menu (delete), the token
// context menu (remove token), and the Clear All action.

let confirmCallback = null;

export function showConfirm(msg, onConfirm) {
  document.getElementById('modal-message').textContent = msg;
  document.getElementById('modal-overlay').classList.remove('hidden');
  confirmCallback = onConfirm;
}

document.getElementById('modal-confirm').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
  if (confirmCallback) { confirmCallback(); confirmCallback = null; }
});

document.getElementById('modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-overlay').classList.add('hidden');
  confirmCallback = null;
});
