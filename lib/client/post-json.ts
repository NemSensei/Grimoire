export interface JsonResult {
  ok: boolean;
  error?: string;
}

export async function postJson(url: string, method: string, body: unknown): Promise<JsonResult> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: data.error ?? "Erreur" };
}
