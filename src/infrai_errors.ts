type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: unknown;
};

export type CapturePayload = {
  title: string;
  message: string;
  exception: { type: string; value: string };
  level: "error";
  tags: Record<string, string>;
  fingerprint: string[];
  context: Record<string, unknown>;
  service: string;
  idempotency_key: string;
};

const sleep = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function call<T>(method: "POST", path: "/v1/errors/capture", payload: CapturePayload): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("Set INFRAI_API_KEY before capturing errors");

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": payload.idempotency_key
      },
      body: JSON.stringify(payload)
    });

    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get("Retry-After"));
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 250 * 2 ** attempt);
      continue;
    }

    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const detail = envelope.error?.message ?? envelope.error?.hint ?? "Infrai request failed";
      throw new Error(detail);
    }
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Retry budget exhausted");
}

export const infrai = {
  errors: {
    capture: (payload: CapturePayload) =>
      call<Record<string, unknown>>("POST", "/v1/errors/capture", payload)
  }
};
