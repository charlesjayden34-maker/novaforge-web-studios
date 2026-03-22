export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
};

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem('nf_token', token);
  localStorage.setItem('nf_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('nf_token');
  localStorage.removeItem('nf_user');
}

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem('nf_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

