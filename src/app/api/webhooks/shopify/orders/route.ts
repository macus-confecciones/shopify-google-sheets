import { NextResponse } from "next/server";
import { verifyShopifyWebhook } from "@/lib/shopify";
import { appendRows } from "@/lib/google-sheets";
import { getVariantMapping } from "@/config/product-variants";

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

  // Extract variants using config-based mapping
  let genero = "";
  let color = "";
  let talla = "";

  if (item.variant_title) {
    const mapping = getVariantMapping(prenda);
    const options = item.variant_title.split(" / ");

    if (mapping.genero !== undefined) {
      genero = options[mapping.genero]?.trim() || "";
    }
    if (mapping.color !== undefined) {
      color = options[mapping.color]?.trim() || "";
    }
    if (mapping.talla !== undefined) {
      talla = options[mapping.talla]?.trim() || "";
    }
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
  try {
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
    if (!secret) {
      console.error("SHOPIFY_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // Read raw body for HMAC verification
    const rawBody = Buffer.from(await request.arrayBuffer());
    const hmac = request.headers.get("x-shopify-hmac-sha256");

    if (!hmac || !verifyShopifyWebhook(rawBody, hmac, secret)) {
      console.warn("Webhook signature verification failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const order: ShopifyOrder = JSON.parse(rawBody.toString("utf-8"));

    const rows = order.line_items.map((item) => parseLineItem(order, item));

    console.log(`Processing order ${order.order_number} with ${rows.length} line items`);

    await appendRows(rows);

    console.log(`Successfully appended ${rows.length} rows for order ${order.order_number}`);

    return NextResponse.json({ success: true, rowsAppended: rows.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Webhook processing failed:", errorMessage);

    return NextResponse.json(
      { error: "Failed to process webhook", details: errorMessage },
      { status: 500 }
    );
  }
}
