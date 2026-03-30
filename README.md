# Shopify → Google Sheets Webhook

Automatically append Shopify order line items to a Google Spreadsheet in real-time.

## How it works

1. **Shopify creates an order** → sends webhook to your app
2. **App verifies the webhook** using HMAC-SHA256 signature
3. **App extracts line item data** using intelligent variant pattern matching
4. **App appends a row** to the `NOTAS` sheet in Google Sheets per line item

## Spreadsheet columns (NOTAS sheet)

| Column | Header | Source |
|--------|--------|--------|
| A | NOTA DE VENTA | Order number |
| B | CLIENTE | Company name (or customer name) |
| C | PRENDA | Product name |
| D | GENERO | Gender/category (auto-detected from variants) |
| E | MANGA | Sleeve type (from product title after ` - `) |
| F | COLOR | Color (auto-detected from variants) |
| G | TALLA | Size (auto-detected from variants) |
| H | CANTIDAD | Quantity ordered |

## Setup

### 1. Deploy to Vercel

The app is already deployed at: `https://shopify-google-sheets.vercel.app`

### 2. Environment variables

Set these in Vercel dashboard (**Settings → Environment Variables**):

```
SHOPIFY_WEBHOOK_SECRET      = Your Shopify signing secret
GOOGLE_SPREADSHEET_ID       = Your Google Sheet ID
GOOGLE_SHEET_NAME           = NOTAS
GOOGLE_SERVICE_ACCOUNT_KEY  = JSON key from Google Cloud
```

### 3. Create Shopify webhook

In your Shopify admin:

**Settings → Notifications → Create webhook**

- **Event**: Orders → Order creation
- **Format**: JSON
- **URL**: `https://shopify-google-sheets.vercel.app/api/webhooks/shopify/orders`
- **API version**: Latest available

### 4. Share spreadsheet

Share your Google Spreadsheet with the service account email:
- Found in the JSON key file as `client_email`
- Set to **Editor** access

---

## Variant auto-detection

The app automatically detects variant types based on value patterns. No configuration needed for standard products.

### How it works

For a product with variant_title like `"Hombre / Azul Marino / M"`:

1. Split by ` / ` → `["Hombre", "Azul Marino", "M"]`
2. Analyze each value:
   - "Hombre" → matches GENERO patterns → D column
   - "Azul Marino" → matches COLOR patterns → F column
   - "M" → matches TALLA patterns → G column
3. Extract to spreadsheet

**This works regardless of variant order:**
- `"M / Azul / Hombre"` also works (extracts correctly)
- `"Azul / L"` also works (GENERO stays empty)
- Any variant order or combination is handled automatically

---

## Custom variant patterns

If your products use custom variant values not in the built-in patterns, **add them to the detector**.

### Example: Your products use "Unisex (Oversize)" and it's not recognized

**File**: `src/lib/variant-detector.ts`

Find the section with pattern arrays and add your values:

```typescript
const GENERO_PATTERNS = [
  "hombre",
  "mujer",
  "niño",
  "unisex",
  "unisex (oversize)",  // ← ADD THIS
  "masculino",
  "femenino",
  // ... rest of patterns
];
```

**For colors**, add to `COLOR_PATTERNS`:

```typescript
const COLOR_PATTERNS = [
  "negro",
  "blanco",
  "azul",
  "turquesa",
  "turquesa neon",  // ← ADD THIS for custom colors
  // ... rest of patterns
];
```

**For sizes**, add to `TALLA_PATTERNS`:

```typescript
const TALLA_PATTERNS = [
  "xs",
  "s",
  "m",
  "l",
  "talla unica",      // ← ADD THIS
  "one size",         // ← ADD THIS
  // ... rest of patterns
];
```

### Normalize values

The detector automatically:
- Converts to lowercase
- Removes accents (ñ → n, á → a)
- Trims whitespace

So:
- `"AZUL MARINO"` matches `"azul marino"`
- `"Café"` matches `"cafe"`
- `" M "` matches `"m"`

### Steps to add new patterns

1. Open `src/lib/variant-detector.ts`
2. Find the relevant `*_PATTERNS` array
3. Add your custom values (lowercase, without accents)
4. Push to GitHub
5. Vercel auto-deploys
6. Done — new products use the updated patterns

---

## Troubleshooting

### Rows aren't appearing in the spreadsheet

1. **Check Vercel logs** (Dashboard → Deployments → function logs)
2. **Verify webhook signature** — wrong secret = 401 Unauthorized
3. **Check Google auth** — service account email must be shared on the spreadsheet
4. **Check variant detection** — if GENERO/COLOR/TALLA are empty, add the values to `variant-detector.ts`

### A variant isn't being detected

Example: Your product has `variant_title: "Modelo A / Azul Marino / M"` but "Modelo A" isn't being extracted.

**Solution**: Add "modelo a" (lowercase) to the appropriate pattern array in `variant-detector.ts`:

```typescript
const GENERO_PATTERNS = [
  "hombre",
  "mujer",
  "modelo a",  // ← ADD
  "modelo b",
];
```

### Getting "Unauthorized" webhook errors

1. Go to Shopify admin → Settings → Notifications → Webhooks
2. Copy the signing secret from the bottom of the page
3. Update `SHOPIFY_WEBHOOK_SECRET` in Vercel dashboard
4. Redeploy (Vercel will auto-trigger on env var change)

---

## Adding new variant types

If you want to extract more than GENERO, COLOR, TALLA, you can extend the detector:

```typescript
// Add a new pattern type
const MATERIAL_PATTERNS = [
  "algodon",
  "poliester",
  "mezcla",
  "lino",
];

export function detectVariantType(value: string): VariantType {
  if (matchesPattern(value, GENERO_PATTERNS)) return "genero";
  if (matchesPattern(value, COLOR_PATTERNS)) return "color";
  if (matchesPattern(value, TALLA_PATTERNS)) return "talla";
  if (matchesPattern(value, MATERIAL_PATTERNS)) return "material"; // ← NEW
  return "unknown";
}
```

Then in `route.ts`, extract to a new spreadsheet column:

```typescript
let material = "";
if (positions.material !== undefined) {
  material = options[positions.material]?.trim() || "";
}

return [
  String(order.order_number),
  getCustomerName(order),
  prenda,
  genero,
  manga,
  color,
  talla,
  material,  // ← NEW COLUMN
  String(item.quantity),
];
```

Update your spreadsheet columns accordingly (I → MATERIAL).

---

## Product title format: Manga (sleeve type)

The app extracts sleeve type from product title using the format:

```
"Product Name - Manga Type"
```

Examples:
- `"Buzo Basico - Manga Corta"` → MANGA = "Manga Corta"
- `"Camisa Social - Manga Larga"` → MANGA = "Manga Larga"
- `"Remera Clasica"` → MANGA = "" (empty, no ` - `)

If your product doesn't use this format, MANGA will always be empty. To use it, add ` - ` to your Shopify product titles.

---

## Architecture

```
Shopify Webhook
    ↓
POST /api/webhooks/shopify/orders
    ├─ Verify HMAC signature (crypto)
    ├─ Parse JSON payload
    ├─ Extract variants using variant-detector.ts
    └─ Append rows to Google Sheets
```

**Files:**

- `src/app/api/webhooks/shopify/orders/route.ts` — Main webhook handler
- `src/lib/variant-detector.ts` — Pattern matching for variant detection
- `src/lib/shopify.ts` — HMAC verification
- `src/lib/google-sheets.ts` — Google Sheets API integration

---

## Costs

**Completely free:**

- Vercel free tier covers webhooks + serverless functions
- Google Sheets is free
- Google Cloud service account is free (no API charges)

No credit card required, no usage-based fees.

---

## Need help?

Check the logs in Vercel dashboard for error messages. The webhook handler logs:

```
Processing order 1234 with 5 line items
Successfully appended 5 rows for order 1234
```

If something fails:

```
Webhook processing failed: Error message here
```

Contact your developer with the error message and order number.
