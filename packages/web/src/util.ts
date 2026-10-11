export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function shareLink(code: string): string {
  return `${location.origin}${location.pathname}?code=${code}`;
}
