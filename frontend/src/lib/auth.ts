export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
};

function toTitleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeAuthUser(user: AuthUser): AuthUser {
  const normalizedEmail = String(user.email || '').trim().toLowerCase();
  if (normalizedEmail === 'nathanwhittaker141@gmail.com') {
    return { ...user, email: normalizedEmail, name: 'Nathan Whittaker' };
  }

  const normalizedName = toTitleCase(String(user.name || ''));
  return {
    ...user,
    email: normalizedEmail,
    name: normalizedName || user.name
  };
}

export function setAuth(token: string, user: AuthUser) {
  const normalizedUser = normalizeAuthUser(user);
  localStorage.setItem('nf_token', token);
  localStorage.setItem('nf_user', JSON.stringify(normalizedUser));
}

export function clearAuth() {
  localStorage.removeItem('nf_token');
  localStorage.removeItem('nf_user');
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem('nf_user');
  if (!raw) return null;
  try {
    return normalizeAuthUser(JSON.parse(raw) as AuthUser);
  } catch {
    return null;
  }
}

