export function isAuthenticated(): boolean {
  return Boolean(localStorage.getItem('access_token'))  // TODO: is this ok?
}
