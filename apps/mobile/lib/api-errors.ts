/** Prefer Nest `message` over axios generic "Request failed with status code …". */
export function getApiErrorMessage(err: unknown, fallback = 'Something went wrong.'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { message?: string | string[] } } }).response?.data;
    if (data?.message != null) {
      const m = data.message;
      if (Array.isArray(m)) return m.join('\n');
      if (typeof m === 'string') return m;
    }
  }
  if (err instanceof Error && err.message && !err.message.startsWith('Request failed with status code')) {
    return err.message;
  }
  return fallback;
}
