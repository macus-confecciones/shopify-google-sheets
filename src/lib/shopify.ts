import { createHmac } from "crypto";

export function verifyShopifyWebhook(
  rawBody: Buffer,
  hmacHeader: string,
  secret: string
): boolean {
  const digest = createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  return digest === hmacHeader;
}
