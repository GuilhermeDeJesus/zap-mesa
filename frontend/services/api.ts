const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
  });

  if (!res.ok) {
    let message = `Erro na requisição (${res.status})`;

    try {
      const payload = (await res.json()) as { message?: string; error?: string };
      if (payload.message) message = payload.message;
      if (!payload.message && payload.error) message = payload.error;
    } catch {
      // mantém mensagem padrão quando a API não retorna JSON
    }

    throw new Error(message);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}
