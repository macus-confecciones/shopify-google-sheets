import { NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify";
import { appendRows } from "@/lib/google-sheets";

interface LineItem {
  title: string;
  variant_title: string | null;
  quantity: number;
}

interface ShopifyAddress {
  company: string | null;
}

interface ShopifyCustomer {
  first_name: string | null;
  last_name: string | null;
}

interface ShopifyOrder {
  order_number: number;
  customer: ShopifyCustomer | null;
  billing_address: ShopifyAddress | null;
  shipping_address: ShopifyAddress | null;
  line_items: LineItem[];
}

function getCustomerName(order: ShopifyOrder): string {
  // Prefer company name, fall back to customer name
  const company =
    order.billing_address?.company || order.shipping_address?.company;
  if (company) return company;

  const first = order.customer?.first_name || "";
  const last = order.customer?.last_name || "";
  return `${first} ${last}`.trim();
}

function parseLineItem(
  order: ShopifyOrder,
  item: LineItem
): string[] {
  // Title format: "Product Name - Manga" or just "Product Name"
  const titleParts = item.title.split(" - ");
  const prenda = titleParts[0].trim();
  const manga = titleParts.length > 1 ? titleParts.slice(1).join(" - ").trim() : "";

  // variant_title format: "Genero / Color / Talla"
  let genero = "";
  let color = "";
  let talla = "";
  if (item.variant_title) {
    const options = item.variant_title.split(" / ");
    genero = options[0]?.trim() || "";
    color = options[1]?.trim() || "";
    talla = options[2]?.trim() || "";
  }

  return [
    String(order.order_number), // A: NOTA DE VENTA
    getCustomerName(order),     // B: CLIENTE
    prenda,                     // C: PRENDA
    genero,                     // D: GENERO
    manga,                      // E: MANGA
    color,                      // F: COLOR
    talla,                      // G: TALLA
    String(item.quantity),      // H: CANTIDAD
  ];
}

export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  // Read raw body for HMAC verification
  const rawBody = Buffer.from(await request.arrayBuffer());
  const hmac = request.headers.get("x-shopify-hmac-sha256");

  if (!hmac || !verifyShopifyWebhook(rawBody, hmac, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const order: ShopifyOrder = JSON.parse(rawBody.toString("utf-8"));

  const rows = order.line_items.map((item) => parseLineItem(order, item));

  await appendRows(rows);

  return NextResponse.json({ success: true, rowsAppended: rows.length });
}
