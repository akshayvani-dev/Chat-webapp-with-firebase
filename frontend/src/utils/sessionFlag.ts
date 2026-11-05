export const SESSION_FLAG_KEY = "isLoggedIn";

export function setSessionFlag(): void {
  window.localStorage.setItem(SESSION_FLAG_KEY, "true");
}

export function clearSessionFlag(): void {
  window.localStorage.removeItem(SESSION_FLAG_KEY);
}

export function hasSessionFlag(): boolean {
  return window.localStorage.getItem(SESSION_FLAG_KEY) === "true";
}
