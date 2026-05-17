import QRCode from "qrcode";

function normalizePublicUrl(rawValue: string | undefined, fallback: string): string {
  const candidate = (rawValue || "").trim();
  if (!candidate) return fallback;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:"].includes(parsed.protocol)) return fallback;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export function buildPublicTableUrl(qrPath: string): string {
  const appUrl = normalizePublicUrl(process.env.APP_URL, "http://localhost:3000");
  return `${appUrl}${qrPath.startsWith("/") ? qrPath : `/${qrPath}`}`;
}

export async function buildTableQrCodeDataUrl(qrPath: string): Promise<string> {
  const fullUrl = buildPublicTableUrl(qrPath);
  return QRCode.toDataURL(fullUrl, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 260,
  });
}
