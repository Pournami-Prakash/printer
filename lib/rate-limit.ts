const bucket = new Map<string, number[]>();

export function allowRequest(id: string, limit = 12, windowMs = 60000): boolean {
  const now = Date.now();
  const arr = bucket.get(id) || [];
  const valid = arr.filter((t) => now - t < windowMs);
  if (valid.length >= limit) {
    bucket.set(id, valid);
    return false;
  }
  valid.push(now);
  bucket.set(id, valid);
  return true;
}
