function toTitleCase(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function professionalDisplayName(name, email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (normalizedEmail === 'nathanwhittaker141@gmail.com') {
    return 'Nathan Whittaker';
  }
  const normalizedName = toTitleCase(name);
  return normalizedName || String(name || '').trim();
}

function normalizeUserProfile(user) {
  if (!user) return user;
  const normalizedEmail = String(user.email || '').trim().toLowerCase();
  return {
    ...user,
    email: normalizedEmail,
    name: professionalDisplayName(user.name, normalizedEmail)
  };
}

module.exports = {
  toTitleCase,
  professionalDisplayName,
  normalizeUserProfile
};
