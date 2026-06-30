const { listProducts, listProductVariants } = require('./commerce');
const { getMetaCredentials } = require('./metaCredentials');

const defaultGraphVersion = 'v21.0';
const availabilityValues = new Set(['in stock', 'out of stock']);
const conditionValues = new Set(['new', 'refurbished', 'used']);

async function getCatalogSyncPreview(businessId, options = {}) {
  const products = await listProducts(businessId, { status: 'active' });
  const variants = await listProductVariants(businessId);
  const catalogId = resolveCatalogId({ products, explicitCatalogId: options.catalogId });
  const items = buildCatalogItems({ products, variants, includeVariants: options.includeVariants !== false });
  const readiness = catalogReadiness({ catalogId, products, items });

  return {
    mode: catalogMode(),
    catalogId,
    itemCount: items.length,
    ready: readiness.ready,
    checks: readiness.checks,
    items,
    batchPayload: buildItemsBatchPayload(items),
    note: catalogMode() === 'live'
      ? 'Live sync is enabled. Review the payload before pushing changes to Meta.'
      : 'Set META_CATALOG_MODE=live to push this product batch to Meta.'
  };
}

async function syncMetaCatalog(businessId, options = {}) {
  const preview = await getCatalogSyncPreview(businessId, options);
  if (!preview.ready) {
    const error = new Error('Catalog is not ready to sync');
    error.status = 400;
    error.details = preview.checks.filter((check) => !check.ok);
    throw error;
  }

  if (catalogMode() !== 'live') {
    return {
      mode: preview.mode,
      catalogId: preview.catalogId,
      synced: preview.itemCount,
      itemCount: preview.itemCount,
      items: preview.items,
      batchPayload: preview.batchPayload,
      note: 'Mock catalog sync completed. Set META_CATALOG_MODE=live to push to Meta.'
    };
  }

  const credentials = await requireCatalogCredentials(businessId);
  const meta = await graphRequest({
    path: `/${preview.catalogId}/items_batch`,
    method: 'POST',
    accessToken: credentials.accessToken,
    body: preview.batchPayload
  });

  return {
    mode: 'live',
    catalogId: preview.catalogId,
    synced: preview.itemCount,
    itemCount: preview.itemCount,
    items: preview.items,
    batchPayload: preview.batchPayload,
    meta
  };
}

function buildCatalogItems({ products, variants = [], includeVariants = true }) {
  const productItems = products.map((product) => normalizeCatalogItem(product));
  if (!includeVariants) return productItems;

  const variantItems = variants
    .filter((variant) => variant.status === 'active')
    .map((variant) => {
      const parent = products.find((product) => String(product.id) === String(variant.productId));
      if (!parent) return null;
      return normalizeCatalogItem({
        ...parent,
        name: variant.name,
        sku: variant.sku,
        priceCents: variant.priceCents || parent.priceCents,
        inventoryCount: variant.inventoryCount,
        metaProductRetailerId: variant.metaProductRetailerId || variant.sku,
        description: `${parent.description || parent.name} ${variant.optionName || 'Option'}: ${variant.optionValue || variant.name}`.trim()
      });
    })
    .filter(Boolean);

  return [...productItems, ...variantItems];
}

function normalizeCatalogItem(product) {
  const currency = String(product.currency || 'ZAR').trim().toUpperCase();
  const inventoryCount = Number(product.inventoryCount || 0);
  const availability = inventoryCount > 0 ? 'in stock' : 'out of stock';
  const retailerId = String(product.metaProductRetailerId || product.sku || product.id || '').trim();
  const item = {
    retailer_id: retailerId,
    name: String(product.name || '').trim().slice(0, 150),
    description: String(product.description || product.name || '').trim().slice(0, 5000),
    availability: availabilityValues.has(availability) ? availability : 'in stock',
    condition: conditionValues.has(String(product.condition || '').toLowerCase()) ? String(product.condition).toLowerCase() : 'new',
    price: `${(Number(product.priceCents || 0) / 100).toFixed(2)} ${currency}`,
    currency,
    image_url: String(product.imageUrl || '').trim(),
    url: String(product.paymentLinkUrl || product.url || '').trim(),
    inventory: inventoryCount,
    brand: String(product.brand || process.env.META_CATALOG_DEFAULT_BRAND || 'ChatClan Merchant').trim().slice(0, 100),
    meta_catalog_id: String(product.metaCatalogId || '').trim()
  };

  return item;
}

function buildItemsBatchPayload(items) {
  return {
    item_type: 'PRODUCT_ITEM',
    requests: items.map((item) => ({
      method: 'UPDATE',
      retailer_id: item.retailer_id,
      data: {
        name: item.name,
        description: item.description,
        availability: item.availability,
        condition: item.condition,
        price: item.price,
        currency: item.currency,
        image_url: item.image_url,
        url: item.url,
        inventory: item.inventory,
        brand: item.brand
      }
    }))
  };
}

function catalogReadiness({ catalogId, products, items }) {
  const checks = [
    {
      id: 'catalog_id',
      label: 'Meta catalog ID',
      ok: Boolean(catalogId),
      detail: catalogId ? `Using catalog ${catalogId}` : 'Add a Meta Catalog ID to at least one product or pass catalogId.'
    },
    {
      id: 'active_products',
      label: 'Active products',
      ok: products.length > 0,
      detail: products.length ? `${products.length} active product(s) found.` : 'Add at least one active product.'
    },
    {
      id: 'retailer_ids',
      label: 'Retailer IDs',
      ok: items.every((item) => item.retailer_id),
      detail: 'Every synced item needs a stable retailer_id for WhatsApp orders.'
    },
    {
      id: 'images',
      label: 'Product images',
      ok: items.every((item) => item.image_url),
      detail: items.every((item) => item.image_url) ? 'Every item has an image URL.' : 'Add image URLs before live catalog sync.'
    },
    {
      id: 'urls',
      label: 'Product URLs or checkout links',
      ok: items.every((item) => item.url),
      detail: items.every((item) => item.url) ? 'Every item has a product URL.' : 'Add product URLs, checkout links, or payment links before live catalog sync.'
    },
    {
      id: 'prices',
      label: 'Prices and currency',
      ok: items.every((item) => Number(String(item.price).split(' ')[0]) > 0 && item.currency),
      detail: 'Every item must have a positive price and currency.'
    }
  ];

  return {
    ready: checks.every((check) => check.ok),
    checks
  };
}

function resolveCatalogId({ products, explicitCatalogId }) {
  return String(explicitCatalogId || process.env.META_CATALOG_ID || products.find((product) => product.metaCatalogId)?.metaCatalogId || '').trim();
}

async function requireCatalogCredentials(businessId) {
  const credentials = await getMetaCredentials(businessId);
  if (!credentials?.accessToken) {
    const error = new Error('Meta access token is required before live catalog sync');
    error.status = 400;
    throw error;
  }
  return credentials;
}

async function graphRequest({ path, method = 'GET', accessToken, body = null }) {
  const response = await fetch(graphUrl(path), {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || 'Meta catalog API request failed';
    const error = new Error(detail);
    error.status = 502;
    error.meta = payload;
    throw error;
  }

  return payload;
}

function graphUrl(path) {
  const version = process.env.META_GRAPH_API_VERSION || defaultGraphVersion;
  return `https://graph.facebook.com/${version}${path}`;
}

function catalogMode() {
  return process.env.META_CATALOG_MODE === 'live' ? 'live' : 'mock';
}

module.exports = {
  buildCatalogItems,
  buildItemsBatchPayload,
  catalogReadiness,
  getCatalogSyncPreview,
  syncMetaCatalog
};
