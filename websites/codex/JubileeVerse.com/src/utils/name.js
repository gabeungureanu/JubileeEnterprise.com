/**
 * Name helpers
 */

function capitalize(value) {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getFirstNameFromUser(user) {
  if (!user) return '';

  const displayName = (user.displayName || user.name || '').trim();
  if (displayName) {
    return displayName.split(/\s+/)[0];
  }

  const email = (user.email || '').trim();
  if (!email) return '';

  const localPart = email.split('@')[0] || '';
  if (!localPart) return '';

  const cleaned = localPart.replace(/[._-]+/g, ' ').trim();
  if (!cleaned) {
    return capitalize(localPart);
  }

  return capitalize(cleaned.split(/\s+/)[0]);
}

module.exports = {
  getFirstNameFromUser
};
