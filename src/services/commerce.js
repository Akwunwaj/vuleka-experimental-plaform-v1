const crypto = require('crypto');
const { parse } = require('csv-parse/sync');
const { hasDatabaseConfig, query } = require('../db/pool');
const demo = require('../data/demoData');
const { sendInteractiveMessage, sendTemplateMessage, sendTextMessage } = require('./metaClient');
const { enqueueJob } = require('./jobQueue');
const { metaRateConfig } = require('./metaCosts');
const { getContactConsentState } = require('./consent');
const { createTemplate, listTemplates } = require('./templates');
const { submitTemplateToMeta, syncMetaTemplates } = require('./metaTemplates');

const demoProducts = [...(demo.products || [])];
const demoOrders = [...(demo.orders || [])];
const demoVariants = [];
const demoOrderEvents = [];
const demoCollections = [];
const demoCoupons = [];
const demoCouponRedemptions = [];
const demoReturns = [];
const demoAutomationRules = [];
let nextProductId = 1000;
let nextOrderId = 2000;
let nextVariantId = 3000;
let nextOrderEventId = 4000;
let nextCollectionId = 5000;
let nextCouponId = 6000;
let nextCouponRedemptionId = 7000;
let nextReturnId = 8000;

const orderStatuses = new Set([
  'new',
  'confirmed',
  'pending_payment',
  'paid',
  'packed',
  'out_for_delivery',
  'completed',
  'cancelled',
  'refunded'
]);

const returnStatuses = new Set([
  'requested',
  'approved',
  'rejected',
  'item_received',
  'refunded',
  'closed'
]);

const automationDelayUnits = new Set(['minutes', 'hours', 'days']);
const postPurchaseSentEventTypes = [
  'post_purchase.review.sent',
  'post_purchase.reorder.sent',
  'post_purchase.follow_up.sent'
];
const postPurchaseSuppressedEventTypes = [
  'post_purchase.review.suppressed',
  'post_purchase.reorder.suppressed',
  'post_purchase.follow_up.suppressed'
];
const commerceAutomationRuleDefinitions = [
  {
    ruleKey: 'follow_up_after_payment',
    name: 'Follow up after payment',
    description: 'Check in after payment is confirmed so customers can ask for help or recommendations.',
    triggerStatus: 'paid',
    promptType: 'follow_up',
    delayValue: 2,
    delayUnit: 'hours',
    enabled: true
  },
  {
    ruleKey: 'review_after_completion',
    name: 'Review after completion',
    description: 'Ask for feedback after fulfilment is complete.',
    triggerStatus: 'completed',
    promptType: 'review',
    delayValue: 24,
    delayUnit: 'hours',
    enabled: true
  },
  {
    ruleKey: 'reorder_after_completion',
    name: 'Reorder reminder',
    description: 'Invite customers to reorder after the usual repeat-purchase window.',
    triggerStatus: 'completed',
    promptType: 'reorder',
    delayValue: 21,
    delayUnit: 'days',
    enabled: true
  }
];

async function listProducts(businessId, filters = {}) {
  if (!hasDatabaseConfig()) {
    return demoProducts
      .filter((product) => Number(product.businessId || product.business_id || 1) === Number(businessId))
      .filter((product) => !filters.status || product.status === filters.status)
      .map(normalizeProduct);
  }

  const rows = await query(
    `select * from commerce_products
     where business_id = :businessId
       and (:status is null or status = :status)
     order by updated_at desc, id desc`,
    { businessId, status: filters.status || null }
  );
  return rows.map(normalizeProduct);
}

async function createProduct(businessId, payload) {
  const product = validateProduct({ ...payload, businessId });
  if (hasDatabaseConfig()) {
    const result = await query(
      `insert into commerce_products
       (business_id, name, sku, description, price_cents, currency, image_url, inventory_count, status,
        meta_catalog_id, meta_product_retailer_id, payment_link_url)
       values
       (:businessId, :name, :sku, :description, :priceCents, :currency, :imageUrl, :inventoryCount, :status,
        :metaCatalogId, :metaProductRetailerId, :paymentLinkUrl)`,
      product
    );
    return getProductById(businessId, result.insertId);
  }

  const stored = { ...product, id: nextProductId++, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  demoProducts.unshift(stored);
  return normalizeProduct(stored);
}

async function updateProduct(businessId, productId, payload) {
  const current = await getProductById(businessId, productId);
  const product = validateProduct({ ...current, ...payload, businessId });
  if (hasDatabaseConfig()) {
    await query(
      `update commerce_products
       set name = :name,
           sku = :sku,
           description = :description,
           price_cents = :priceCents,
           currency = :currency,
           image_url = :imageUrl,
           inventory_count = :inventoryCount,
           status = :status,
           meta_catalog_id = :metaCatalogId,
           meta_product_retailer_id = :metaProductRetailerId,
           payment_link_url = :paymentLinkUrl,
           updated_at = current_timestamp
       where business_id = :businessId and id = :productId`,
      { ...product, productId }
    );
    return getProductById(businessId, productId);
  }

  const index = demoProducts.findIndex((item) => Number(item.id) === Number(productId) && Number(item.businessId || 1) === Number(businessId));
  if (index === -1) throw notFound('Product not found');
  demoProducts[index] = { ...demoProducts[index], ...product, id: demoProducts[index].id, updatedAt: new Date().toISOString() };
  return normalizeProduct(demoProducts[index]);
}

async function archiveProduct(businessId, productId) {
  if (hasDatabaseConfig()) {
    await query(
      `update commerce_products
       set status = 'archived', updated_at = current_timestamp
       where business_id = :businessId and id = :productId`,
      { businessId, productId }
    );
    return getProductById(businessId, productId);
  }

  const index = demoProducts.findIndex((item) => Number(item.id) === Number(productId) && Number(item.businessId || 1) === Number(businessId));
  if (index === -1) throw notFound('Product not found');
  demoProducts[index] = { ...demoProducts[index], status: 'archived', updatedAt: new Date().toISOString() };
  return normalizeProduct(demoProducts[index]);
}

async function importProducts({ businessId, csvText, commit = false }) {
  if (!csvText || typeof csvText !== 'string') {
    const error = new Error('csvText is required');
    error.status = 400;
    throw error;
  }

  const records = parse(csvText, {
    columns: (headers) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count: true
  });
  const existing = await listProducts(businessId);
  const seenKeys = new Set(existing.flatMap((product) => [
    key(product.sku),
    key(product.metaProductRetailerId)
  ]).filter(Boolean));
  const importKeys = new Set();
  const validRows = [];
  const errors = [];
  let duplicates = 0;

  for (const [index, record] of records.entries()) {
    const rowNumber = index + 2;
    let product;
    try {
      product = validateProduct({ ...csvProductPayload(record), businessId });
    } catch (err) {
      errors.push(rowError(rowNumber, 'product', err.message));
      continue;
    }

    const rowKeys = [key(product.sku), key(product.metaProductRetailerId)].filter(Boolean);
    if (rowKeys.some((item) => seenKeys.has(item) || importKeys.has(item))) {
      duplicates += 1;
      continue;
    }

    rowKeys.forEach((item) => importKeys.add(item));
    validRows.push({ rowNumber, product });
  }

  const importedProducts = [];
  if (commit) {
    for (const row of validRows) {
      try {
        importedProducts.push(await createProduct(businessId, row.product));
      } catch (err) {
        if (isDuplicateProductError(err)) {
          duplicates += 1;
        } else {
          errors.push(rowError(row.rowNumber, 'product', err.message));
        }
      }
    }
  }

  return {
    commit,
    totalRows: records.length,
    validRows: validRows.length,
    imported: commit ? importedProducts.length : 0,
    duplicates,
    errors,
    preview: validRows.slice(0, 10).map((row) => normalizeProduct(row.product)),
    products: importedProducts
  };
}

async function createProductVariant(businessId, productId, payload) {
  const product = await getProductById(businessId, productId);
  const variant = validateVariant({ ...payload, businessId, productId, product });
  if (hasDatabaseConfig()) {
    const result = await query(
      `insert into commerce_product_variants
       (business_id, product_id, name, sku, option_name, option_value, price_cents, inventory_count, status, meta_product_retailer_id)
       values
       (:businessId, :productId, :name, :sku, :optionName, :optionValue, :priceCents, :inventoryCount, :status, :metaProductRetailerId)`,
      variant
    );
    const variants = await listProductVariants(businessId, productId);
    return variants.find((item) => Number(item.id) === Number(result.insertId));
  }

  const stored = { ...variant, id: nextVariantId++, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  demoVariants.unshift(stored);
  return normalizeVariant(stored);
}

async function listProductCollections(businessId) {
  if (!hasDatabaseConfig()) {
    const products = await listProducts(businessId);
    return demoCollections
      .filter((collection) => Number(collection.businessId || collection.business_id || 1) === Number(businessId))
      .map((collection) => normalizeCollection(collection, products));
  }

  const rows = await query(
    `select c.*,
            count(i.product_id) as product_count
     from commerce_product_collections c
     left join commerce_product_collection_items i on i.collection_id = c.id
     where c.business_id = :businessId
     group by c.id
     order by c.updated_at desc, c.id desc`,
    { businessId }
  );
  return rows.map((row) => normalizeCollection(row));
}

async function createProductCollection(businessId, payload) {
  const products = await listProducts(businessId);
  const collection = validateCollection({ ...payload, businessId }, products);

  if (hasDatabaseConfig()) {
    const result = await query(
      `insert into commerce_product_collections
       (business_id, name, description, status)
       values (:businessId, :name, :description, :status)`,
      collection
    );
    for (const productId of collection.productIds) {
      await query(
        `insert into commerce_product_collection_items
         (business_id, collection_id, product_id)
         values (:businessId, :collectionId, :productId)`,
        { businessId, collectionId: result.insertId, productId }
      );
    }
    return getProductCollectionById(businessId, result.insertId);
  }

  const stored = { ...collection, id: nextCollectionId++, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  demoCollections.unshift(stored);
  return normalizeCollection(stored, products);
}

async function getProductCollectionById(businessId, collectionId) {
  const products = await listProducts(businessId);
  if (!hasDatabaseConfig()) {
    const collection = demoCollections.find((item) => Number(item.id) === Number(collectionId) && Number(item.businessId || 1) === Number(businessId));
    if (!collection) throw notFound('Collection not found');
    return normalizeCollection(collection, products);
  }

  const rows = await query(
    `select * from commerce_product_collections
     where id = :collectionId and business_id = :businessId
     limit 1`,
    { collectionId, businessId }
  );
  if (!rows[0]) throw notFound('Collection not found');
  const items = await query(
    `select product_id as productId
     from commerce_product_collection_items
     where business_id = :businessId and collection_id = :collectionId
     order by sort_order, id`,
    { businessId, collectionId }
  );
  return normalizeCollection({ ...rows[0], productIds: items.map((item) => item.productId) }, products);
}

async function shareProductCollection({ businessId, collectionId, to, body, footer }) {
  const collection = await getProductCollectionById(businessId, collectionId);
  if (!collection.productIds.length) {
    const error = new Error('Add products to this collection before sharing it');
    error.status = 400;
    throw error;
  }
  const result = await shareCatalog({
    businessId,
    to,
    productIds: collection.productIds,
    body: body || collection.description || `Browse ${collection.name}.`,
    footer: footer || collection.name
  });
  return { ...result, collection };
}

async function listCoupons(businessId) {
  if (!hasDatabaseConfig()) {
    return demoCoupons
      .filter((coupon) => Number(coupon.businessId || coupon.business_id || 1) === Number(businessId))
      .map(normalizeCoupon);
  }

  const rows = await query(
    `select * from commerce_coupons
     where business_id = :businessId
     order by updated_at desc, id desc`,
    { businessId }
  );
  return rows.map(normalizeCoupon);
}

async function createCoupon(businessId, payload) {
  const coupon = validateCoupon({ ...payload, businessId });
  if (hasDatabaseConfig()) {
    const result = await query(
      `insert into commerce_coupons
       (business_id, code, name, discount_type, discount_value, minimum_order_cents,
        max_redemptions, status, starts_at, ends_at)
       values
       (:businessId, :code, :name, :discountType, :discountValue, :minimumOrderCents,
        :maxRedemptions, :status, :startsAt, :endsAt)`,
      coupon
    );
    const coupons = await listCoupons(businessId);
    return coupons.find((item) => Number(item.id) === Number(result.insertId));
  }

  const stored = { ...coupon, id: nextCouponId++, redeemedCount: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  demoCoupons.unshift(stored);
  return normalizeCoupon(stored);
}

async function applyCouponToOrder({ businessId, orderId, code }) {
  const order = await getOrderById(businessId, orderId);
  const coupon = await getCouponByCode(businessId, code);
  const discount = calculateCouponDiscount({ coupon, order });
  if (discount.discountCents < 1) {
    const error = new Error('Coupon does not apply to this order');
    error.status = 400;
    throw error;
  }
  const subtotalCents = order.subtotalCents || order.totalCents;
  const totalCents = Math.max(0, subtotalCents - discount.discountCents);

  if (hasDatabaseConfig()) {
    await query(
      `update commerce_orders
       set subtotal_cents = :subtotalCents,
           discount_cents = :discountCents,
           discount_code = :code,
           total_cents = :totalCents,
           updated_at = current_timestamp
       where business_id = :businessId and id = :orderId`,
      { businessId, orderId, subtotalCents, discountCents: discount.discountCents, code: coupon.code, totalCents }
    );
    await query(
      `insert into commerce_coupon_redemptions
       (business_id, coupon_id, order_id, discount_cents)
       values (:businessId, :couponId, :orderId, :discountCents)
       on duplicate key update discount_cents = values(discount_cents)`,
      { businessId, couponId: coupon.id, orderId, discountCents: discount.discountCents }
    );
    await query(
      `update commerce_coupons
       set redeemed_count = redeemed_count + 1,
           updated_at = current_timestamp
       where business_id = :businessId and id = :couponId`,
      { businessId, couponId: coupon.id }
    );
  } else {
    const stored = demoOrders.find((item) => Number(item.id) === Number(orderId) && Number(item.businessId || 1) === Number(businessId));
    if (!stored) throw notFound('Order not found');
    stored.subtotalCents = subtotalCents;
    stored.discountCents = discount.discountCents;
    stored.discountCode = coupon.code;
    stored.totalCents = totalCents;
    const demoCoupon = demoCoupons.find((item) => Number(item.id) === Number(coupon.id));
    if (demoCoupon) demoCoupon.redeemedCount = Number(demoCoupon.redeemedCount || 0) + 1;
    demoCouponRedemptions.unshift({
      id: nextCouponRedemptionId++,
      businessId: Number(businessId),
      couponId: coupon.id,
      orderId: Number(orderId),
      discountCents: discount.discountCents,
      createdAt: new Date().toISOString()
    });
  }

  await recordOrderEvent({
    businessId,
    orderId,
    eventType: 'coupon.applied',
    status: order.status,
    note: `Coupon ${coupon.code} applied`,
    metadata: { couponId: coupon.id, code: coupon.code, discountCents: discount.discountCents }
  });

  return { ...(await getOrderById(businessId, orderId)), coupon, discountSummary: discount };
}

async function listProductVariants(businessId, productId = null) {
  if (!hasDatabaseConfig()) {
    return demoVariants
      .filter((variant) => Number(variant.businessId || variant.business_id || 1) === Number(businessId))
      .filter((variant) => !productId || Number(variant.productId || variant.product_id) === Number(productId))
      .map(normalizeVariant);
  }

  const rows = await query(
    `select * from commerce_product_variants
     where business_id = :businessId
       and (:productId is null or product_id = :productId)
     order by product_id, id`,
    { businessId, productId }
  );
  return rows.map(normalizeVariant);
}

async function getProductById(businessId, productId) {
  if (!hasDatabaseConfig()) {
    const product = demoProducts.find((item) => Number(item.id) === Number(productId) && Number(item.businessId || 1) === Number(businessId));
    if (!product) throw notFound('Product not found');
    return normalizeProduct(product);
  }

  const rows = await query(
    `select * from commerce_products where id = :productId and business_id = :businessId limit 1`,
    { productId, businessId }
  );
  if (!rows[0]) throw notFound('Product not found');
  return normalizeProduct(rows[0]);
}

async function listOrders(businessId) {
  if (!hasDatabaseConfig()) {
    return demoOrders
      .filter((order) => Number(order.businessId || order.business_id || 1) === Number(businessId))
      .sort((a, b) => Number(b.id) - Number(a.id))
      .map(normalizeOrder);
  }

  const rows = await query(
    `select o.*,
            count(i.id) as item_count
     from commerce_orders o
     left join commerce_order_items i on i.order_id = o.id
     where o.business_id = :businessId
     group by o.id
     order by o.created_at desc, o.id desc`,
    { businessId }
  );
  return rows.map(normalizeOrder);
}

async function listAbandonedCarts(businessId, options = {}) {
  const olderThanMinutes = Math.max(0, Number(options.olderThanMinutes ?? 30));
  const cutoffAt = new Date(Date.now() - olderThanMinutes * 60 * 1000).toISOString();
  const recoverableStatuses = new Set(['new', 'pending_payment']);

  if (!hasDatabaseConfig()) {
    return demoOrders
      .filter((order) => Number(order.businessId || order.business_id || 1) === Number(businessId))
      .filter((order) => recoverableStatuses.has(order.status || 'new'))
      .filter((order) => !order.createdAt || new Date(order.createdAt).getTime() <= new Date(cutoffAt).getTime())
      .sort((a, b) => Number(b.id) - Number(a.id))
      .map((order) => withRecoverySummary(normalizeOrder(order), demoOrderEvents));
  }

  const rows = await query(
    `select o.*,
            count(distinct i.id) as item_count,
            count(distinct case when e.event_type = 'cart_recovery.sent' then e.id end) as recovery_count,
            max(case when e.event_type = 'cart_recovery.sent' then e.created_at end) as last_recovery_sent_at
     from commerce_orders o
     left join commerce_order_items i on i.order_id = o.id
     left join commerce_order_events e on e.order_id = o.id and e.business_id = o.business_id
     where o.business_id = :businessId
       and o.status in ('new', 'pending_payment')
       and o.created_at <= :cutoffAt
     group by o.id
     order by o.created_at asc, o.id asc`,
    { businessId, cutoffAt }
  );
  return rows.map((row) => withRecoverySummary(normalizeOrder(row), [], row));
}

async function createOrder(businessId, payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) {
    const error = new Error('At least one order item is required');
    error.status = 400;
    throw error;
  }

  const products = await listProducts(businessId);
  const resolvedItems = items.map((item) => {
    const product = products.find((candidate) => String(candidate.id) === String(item.productId));
    if (!product) throw notFound(`Product ${item.productId} not found`);
    const quantity = Math.max(1, Number(item.quantity || 1));
    return {
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      quantity,
      unitPriceCents: product.priceCents,
      currency: product.currency
    };
  });
  const totalCents = resolvedItems.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const order = {
    businessId: Number(businessId),
    customerName: payload.customerName || 'WhatsApp customer',
    customerPhone: payload.customerPhone || payload.phone || '',
    status: payload.status || 'pending_payment',
    source: payload.source || 'manual',
    currency: resolvedItems[0]?.currency || 'ZAR',
    subtotalCents: totalCents,
    discountCents: 0,
    discountCode: '',
    totalCents,
    paymentProvider: payload.paymentProvider || 'payment_link',
    paymentReference: payload.paymentReference || `wa_order_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    paymentLinkUrl: payload.paymentLinkUrl || ''
  };

  if (hasDatabaseConfig()) {
    const result = await query(
      `insert into commerce_orders
       (business_id, customer_name, customer_phone, status, source, currency, total_cents,
        subtotal_cents, discount_cents, discount_code, payment_provider, payment_reference, payment_link_url)
       values
       (:businessId, :customerName, :customerPhone, :status, :source, :currency, :totalCents,
        :subtotalCents, :discountCents, :discountCode, :paymentProvider, :paymentReference, :paymentLinkUrl)`,
      order
    );
    for (const item of resolvedItems) {
      await query(
        `insert into commerce_order_items
         (business_id, order_id, product_id, product_name, sku, quantity, unit_price_cents, currency)
         values
         (:businessId, :orderId, :productId, :productName, :sku, :quantity, :unitPriceCents, :currency)`,
        { ...item, businessId, orderId: result.insertId }
      );
      await decrementProductInventory({ businessId, productId: item.productId, quantity: item.quantity });
    }
    await recordOrderEvent({ businessId, orderId: result.insertId, eventType: 'order.created', status: order.status, note: 'Order created' });
    return { ...(await getOrderById(businessId, result.insertId)), items: resolvedItems };
  }

  const stored = { ...order, id: nextOrderId++, itemCount: resolvedItems.length, items: resolvedItems, createdAt: new Date().toISOString() };
  demoOrders.unshift(stored);
  for (const item of resolvedItems) {
    const product = demoProducts.find((candidate) => Number(candidate.id) === Number(item.productId));
    if (product) product.inventoryCount = Math.max(0, Number(product.inventoryCount || 0) - item.quantity);
  }
  demoOrderEvents.unshift({
    id: nextOrderEventId++,
    businessId: Number(businessId),
    orderId: stored.id,
    eventType: 'order.created',
    status: order.status,
    note: 'Order created',
    createdAt: new Date().toISOString()
  });
  return normalizeOrder(stored);
}

async function getOrderById(businessId, orderId) {
  if (!hasDatabaseConfig()) {
    const order = demoOrders.find((item) => Number(item.id) === Number(orderId) && Number(item.businessId || 1) === Number(businessId));
    if (!order) throw notFound('Order not found');
    return {
      ...normalizeOrder(order),
      items: order.items || [],
      events: demoOrderEvents.filter((event) => Number(event.orderId) === Number(orderId) && Number(event.businessId) === Number(businessId)).map(normalizeOrderEvent)
    };
  }

  const rows = await query(
    `select o.*,
            count(i.id) as item_count
     from commerce_orders o
     left join commerce_order_items i on i.order_id = o.id
     where o.id = :orderId and o.business_id = :businessId
     group by o.id
     limit 1`,
    { orderId, businessId }
  );
  if (!rows[0]) throw notFound('Order not found');
  const items = await query(
    `select * from commerce_order_items where business_id = :businessId and order_id = :orderId order by id`,
    { businessId, orderId }
  );
  const events = await query(
    `select * from commerce_order_events where business_id = :businessId and order_id = :orderId order by created_at desc, id desc`,
    { businessId, orderId }
  );
  return { ...normalizeOrder(rows[0]), items: items.map(normalizeOrderItem), events: events.map(normalizeOrderEvent) };
}

async function linkOrderItemToProduct({ businessId, orderId, itemId = null, retailerId = '', productId }) {
  if (!productId) {
    const error = new Error('productId is required');
    error.status = 400;
    throw error;
  }
  const product = await getProductById(businessId, productId);
  const order = await getOrderById(businessId, orderId);
  const target = findOrderItemForLink(order.items || [], { itemId, retailerId });
  if (!target) throw notFound('Order item not found');
  const originalRetailerId = target.metaProductRetailerId || target.sku || retailerId || '';

  if (hasDatabaseConfig()) {
    await query(
      `update commerce_order_items
       set product_id = :productId,
           product_name = :productName,
           sku = :sku,
           currency = :currency
       where business_id = :businessId
         and order_id = :orderId
         and (:itemId is null or id = :itemId)
         and (:itemId is not null or sku = :retailerId)`,
      {
        businessId,
        orderId,
        itemId: itemId || null,
        retailerId: originalRetailerId,
        productId: product.id,
        productName: product.name,
        sku: product.sku || product.metaProductRetailerId,
        currency: product.currency || target.currency || order.currency || 'ZAR'
      }
    );
    await updateOrderMetadata(businessId, orderId, removeUnmatchedOrderItem(order.metadata, originalRetailerId));
  } else {
    const stored = demoOrders.find((item) => Number(item.id) === Number(orderId) && Number(item.businessId || item.business_id || 1) === Number(businessId));
    if (!stored) throw notFound('Order not found');
    const storedItem = findOrderItemForLink(stored.items || [], { itemId, retailerId: originalRetailerId });
    if (!storedItem) throw notFound('Order item not found');
    storedItem.productId = product.id;
    storedItem.productName = product.name;
    storedItem.sku = product.sku || product.metaProductRetailerId;
    storedItem.currency = product.currency || storedItem.currency || stored.currency || 'ZAR';
    stored.metadata = removeUnmatchedOrderItem(stored.metadata, originalRetailerId);
  }

  await recordOrderEvent({
    businessId,
    orderId,
    eventType: 'order.catalog_item_linked',
    status: order.status,
    note: `Linked WhatsApp retailer ID ${originalRetailerId || target.sku || target.id} to ${product.name}`,
    metadata: {
      productId: product.id,
      sku: product.sku,
      productRetailerId: product.metaProductRetailerId,
      originalRetailerId
    }
  });

  return getOrderById(businessId, orderId);
}

async function findRecentPostPurchaseSend({ businessId, customerPhone, excludeOrderId = null }) {
  const normalizedPhone = normalizeCustomerPhone(customerPhone);
  if (!normalizedPhone) return null;
  const cutoff = new Date(Date.now() - automationCustomerCooldownMs());

  if (!hasDatabaseConfig()) {
    const ordersById = new Map(
      demoOrders
        .filter((order) => Number(order.businessId || order.business_id || 1) === Number(businessId))
        .map((order) => [String(order.id), normalizeOrder(order)])
    );
    return demoOrderEvents
      .filter((event) => Number(event.businessId || event.business_id) === Number(businessId))
      .filter((event) => postPurchaseSentEventTypes.includes(event.eventType || event.event_type))
      .filter((event) => !excludeOrderId || String(event.orderId || event.order_id) !== String(excludeOrderId))
      .map((event) => ({ event: normalizeOrderEvent(event), order: ordersById.get(String(event.orderId || event.order_id)) }))
      .filter((item) => item.order && normalizeCustomerPhone(item.order.customerPhone) === normalizedPhone)
      .filter((item) => new Date(item.event.createdAt || 0).getTime() >= cutoff.getTime())
      .sort((a, b) => new Date(b.event.createdAt || 0) - new Date(a.event.createdAt || 0))[0] || null;
  }

  const rows = await query(
    `select e.*, o.customer_phone as customerPhone
     from commerce_order_events e
     join commerce_orders o on o.id = e.order_id and o.business_id = e.business_id
     where e.business_id = :businessId
       and o.customer_phone = :customerPhone
       and (:excludeOrderId is null or e.order_id <> :excludeOrderId)
       and e.event_type in ('post_purchase.review.sent', 'post_purchase.reorder.sent', 'post_purchase.follow_up.sent')
       and e.created_at >= :cutoffAt
     order by e.created_at desc, e.id desc
     limit 1`,
    { businessId, customerPhone, excludeOrderId, cutoffAt: cutoff.toISOString() }
  );
  if (!rows[0]) return null;
  return { event: normalizeOrderEvent(rows[0]), order: { customerPhone } };
}

async function updateOrderStatus({ businessId, orderId, status, note, sendWhatsApp = false }) {
  const normalizedStatus = normalizeOrderStatus(status);
  const order = await getOrderById(businessId, orderId);
  if (hasDatabaseConfig()) {
    await query(
      `update commerce_orders
       set status = :status,
           updated_at = current_timestamp
       where business_id = :businessId and id = :orderId`,
      { businessId, orderId, status: normalizedStatus }
    );
  } else {
    const stored = demoOrders.find((item) => Number(item.id) === Number(orderId) && Number(item.businessId || 1) === Number(businessId));
    if (stored) stored.status = normalizedStatus;
  }
  await recordOrderEvent({ businessId, orderId, eventType: 'order.status_updated', status: normalizedStatus, note: note || `Status changed to ${normalizedStatus}` });
  const updated = await getOrderById(businessId, orderId);
  await applyCommerceAutomationRulesForOrder({ businessId, orderId, source: 'status_updated' });
  if (!sendWhatsApp) return updated;
  const message = await sendOrderStatusMessage({ businessId, orderId, body: orderStatusText(updated) });
  return { ...updated, message };
}

async function updateOrderFulfilment({ businessId, orderId, provider, trackingNumber, trackingUrl, note, sendWhatsApp = false }) {
  const fulfilment = validateFulfilment({ provider, trackingNumber, trackingUrl });
  const nextStatus = trackingNumber || trackingUrl ? 'out_for_delivery' : 'packed';

  if (hasDatabaseConfig()) {
    await query(
      `update commerce_orders
       set status = case when status in ('new', 'confirmed', 'pending_payment', 'paid', 'packed') then :status else status end,
           fulfilment_provider = :provider,
           tracking_number = :trackingNumber,
           tracking_url = :trackingUrl,
           fulfilled_at = coalesce(fulfilled_at, current_timestamp),
           updated_at = current_timestamp
       where business_id = :businessId and id = :orderId`,
      { businessId, orderId, status: nextStatus, ...fulfilment }
    );
  } else {
    const stored = demoOrders.find((item) => Number(item.id) === Number(orderId) && Number(item.businessId || 1) === Number(businessId));
    if (!stored) throw notFound('Order not found');
    if (['new', 'confirmed', 'pending_payment', 'paid', 'packed'].includes(stored.status)) stored.status = nextStatus;
    stored.fulfilmentProvider = fulfilment.provider;
    stored.trackingNumber = fulfilment.trackingNumber;
    stored.trackingUrl = fulfilment.trackingUrl;
    stored.fulfilledAt = stored.fulfilledAt || new Date().toISOString();
  }

  await recordOrderEvent({
    businessId,
    orderId,
    eventType: 'order.fulfilment_updated',
    status: nextStatus,
    note: note || fulfilmentNote(fulfilment),
    metadata: fulfilment
  });
  const updated = await getOrderById(businessId, orderId);
  await applyCommerceAutomationRulesForOrder({ businessId, orderId, source: 'fulfilment_updated' });
  if (!sendWhatsApp) return updated;
  const message = await sendOrderStatusMessage({ businessId, orderId, body: orderStatusText(updated) });
  return { ...updated, message };
}

async function createOrderPaymentLink({ businessId, orderId, provider = 'payfast', paymentLinkUrl = null }) {
  const order = await getOrderById(businessId, orderId);
  const link = paymentLinkUrl || buildPaymentLink({ order, provider });
  if (hasDatabaseConfig()) {
    await query(
      `update commerce_orders
       set status = case when status = 'new' then 'pending_payment' else status end,
           payment_provider = :provider,
           payment_link_url = :paymentLinkUrl,
           updated_at = current_timestamp
       where business_id = :businessId and id = :orderId`,
      { businessId, orderId, provider, paymentLinkUrl: link }
    );
  } else {
    const stored = demoOrders.find((item) => Number(item.id) === Number(orderId) && Number(item.businessId || 1) === Number(businessId));
    if (stored) {
      if (stored.status === 'new') stored.status = 'pending_payment';
      stored.paymentProvider = provider;
      stored.paymentLinkUrl = link;
    }
  }
  await recordOrderEvent({
    businessId,
    orderId,
    eventType: 'payment_link.created',
    status: 'pending_payment',
    note: `${provider} payment link created`,
    metadata: { paymentLinkUrl: link }
  });
  return getOrderById(businessId, orderId);
}

async function sendOrderPaymentLink({ businessId, orderId, body }) {
  let order = await getOrderById(businessId, orderId);
  if (!order.paymentLinkUrl) {
    order = await createOrderPaymentLink({ businessId, orderId, provider: order.paymentProvider || 'payfast' });
  }
  const payload = buildOrderDetailsPayload({
    to: order.customerPhone,
    order,
    body: body || `Please review and pay for order #${order.id}.`
  });
  const result = await sendInteractiveMessage({ businessId, payload });
  await recordOrderEvent({
    businessId,
    orderId,
    eventType: 'payment_link.sent',
    status: order.status,
    note: 'Payment link sent on WhatsApp',
    metadata: { providerMessageId: result.messageId, mode: result.mode }
  });
  return { ...result, payload, order: await getOrderById(businessId, orderId) };
}

async function sendAbandonedCartRecovery({ businessId, orderId, body }) {
  let order = await getOrderById(businessId, orderId);
  if (!['new', 'pending_payment'].includes(order.status)) {
    const error = new Error('Only unpaid new or pending payment orders can receive cart recovery messages');
    error.status = 400;
    throw error;
  }
  if (!order.paymentLinkUrl) {
    order = await createOrderPaymentLink({ businessId, orderId, provider: order.paymentProvider || 'payfast' });
  }
  const payload = buildOrderDetailsPayload({
    to: order.customerPhone,
    order,
    body: body || abandonedCartText(order)
  });
  const result = await sendInteractiveMessage({ businessId, payload });
  await recordOrderEvent({
    businessId,
    orderId,
    eventType: 'cart_recovery.sent',
    status: order.status,
    note: 'Abandoned cart recovery sent on WhatsApp',
    metadata: { providerMessageId: result.messageId, mode: result.mode }
  });
  return { ...result, payload, order: await getOrderById(businessId, orderId) };
}

async function sendOrderStatusMessage({ businessId, orderId, body }) {
  const order = await getOrderById(businessId, orderId);
  const payload = buildOrderStatusPayload({ to: order.customerPhone, order, body: body || orderStatusText(order) });
  const result = await sendInteractiveMessage({ businessId, payload });
  await recordOrderEvent({
    businessId,
    orderId,
    eventType: 'order_status.sent',
    status: order.status,
    note: 'Order status sent on WhatsApp',
    metadata: { providerMessageId: result.messageId, mode: result.mode }
  });
  return { ...result, payload, order };
}

async function reconcileOrderPayment({
  businessId,
  orderId = null,
  paymentReference = null,
  provider = 'payfast',
  providerPaymentId = null,
  amountCents = null,
  amount = null,
  paymentStatus = 'COMPLETE',
  raw = {},
  checks = {}
}) {
  const order = orderId
    ? await getOrderById(businessId, orderId)
    : await getOrderByPaymentReference({ businessId, paymentReference });
  const receivedAmountCents = amountCents ?? moneyToCents(amount);
  const normalizedStatus = String(paymentStatus || '').trim().toUpperCase();
  const paidStatuses = new Set(['COMPLETE', 'PAID', 'CAPTURED', 'SUCCESS']);
  const metadata = {
    provider,
    providerPaymentId,
    paymentReference: paymentReference || order.paymentReference,
    amountCents: receivedAmountCents,
    paymentStatus: normalizedStatus,
    checks,
    raw
  };

  if (checks.signature && checks.signature.ok !== true) {
    await recordOrderEvent({
      businessId,
      orderId: order.id,
      eventType: 'payment.rejected',
      status: order.status,
      note: 'Payment signature check failed',
      metadata
    });
    return { status: 'rejected', reason: 'invalid signature', order: await getOrderById(businessId, order.id) };
  }

  if (!paidStatuses.has(normalizedStatus)) {
    await recordOrderEvent({
      businessId,
      orderId: order.id,
      eventType: 'payment.rejected',
      status: order.status,
      note: `Payment status ${normalizedStatus || 'UNKNOWN'} did not complete`,
      metadata
    });
    return { status: 'ignored', reason: 'payment not complete', order: await getOrderById(businessId, order.id) };
  }

  if (receivedAmountCents !== Number(order.totalCents || 0)) {
    await recordOrderEvent({
      businessId,
      orderId: order.id,
      eventType: 'payment.rejected',
      status: order.status,
      note: `Payment amount mismatch: expected ${order.totalCents} cents, received ${receivedAmountCents} cents`,
      metadata
    });
    return { status: 'rejected', reason: 'amount mismatch', order: await getOrderById(businessId, order.id) };
  }

  if (hasDatabaseConfig()) {
    await query(
      `update commerce_orders
       set status = 'paid',
           payment_provider = :provider,
           payment_reference = coalesce(payment_reference, :paymentReference),
           updated_at = current_timestamp
       where business_id = :businessId and id = :orderId`,
      { businessId, orderId: order.id, provider, paymentReference: paymentReference || order.paymentReference }
    );
  } else {
    const stored = demoOrders.find((item) => Number(item.id) === Number(order.id) && Number(item.businessId || 1) === Number(businessId));
    if (stored) {
      stored.status = 'paid';
      stored.paymentProvider = provider;
      stored.paymentReference = stored.paymentReference || paymentReference || order.paymentReference;
    }
  }

  await recordOrderEvent({
    businessId,
    orderId: order.id,
    eventType: 'payment.reconciled',
    status: 'paid',
    note: `${provider} payment reconciled`,
    metadata
  });
  await applyCommerceAutomationRulesForOrder({ businessId, orderId: order.id, source: 'payment_reconciled' });
  return { status: 'processed', order: await getOrderById(businessId, order.id) };
}

async function listReturnRequests(businessId) {
  if (!hasDatabaseConfig()) {
    const orders = await listOrders(businessId);
    return demoReturns
      .filter((request) => Number(request.businessId || request.business_id || 1) === Number(businessId))
      .sort((a, b) => Number(b.id) - Number(a.id))
      .map((request) => normalizeReturnRequest(request, orders.find((order) => Number(order.id) === Number(request.orderId))));
  }

  const rows = await query(
    `select r.*, o.customer_name as customerName, o.customer_phone as customerPhone, o.total_cents as orderTotalCents
     from commerce_return_requests r
     join commerce_orders o on o.id = r.order_id and o.business_id = r.business_id
     where r.business_id = :businessId
     order by r.updated_at desc, r.id desc`,
    { businessId }
  );
  return rows.map((row) => normalizeReturnRequest(row));
}

async function createReturnRequest({ businessId, orderId, reason, resolution = 'refund', amount = null, amountCents = null, note = '', sendWhatsApp = false }) {
  const order = await getOrderById(businessId, orderId);
  const request = validateReturnRequest({ businessId, order, reason, resolution, amount, amountCents, note });

  let stored;
  if (hasDatabaseConfig()) {
    const result = await query(
      `insert into commerce_return_requests
       (business_id, order_id, reason, resolution, status, amount_cents, note)
       values (:businessId, :orderId, :reason, :resolution, :status, :amountCents, :note)`,
      request
    );
    stored = await getReturnRequestById(businessId, result.insertId);
  } else {
    const demoRequest = {
      ...request,
      id: nextReturnId++,
      refundReference: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    demoReturns.unshift(demoRequest);
    stored = normalizeReturnRequest(demoRequest, order);
  }

  await recordOrderEvent({
    businessId,
    orderId,
    eventType: 'return.requested',
    status: stored.status,
    note: `Return requested: ${stored.reason}`,
    metadata: { returnRequestId: stored.id, resolution: stored.resolution, amountCents: stored.amountCents }
  });

  if (!sendWhatsApp) return stored;
  const message = await sendOrderStatusMessage({ businessId, orderId, body: returnStatusText(order, stored) });
  return { ...stored, message };
}

async function updateReturnRequest({ businessId, returnId, status, note = '', refundReference = '', amount = null, amountCents = null, sendWhatsApp = false }) {
  const current = await getReturnRequestById(businessId, returnId);
  const normalizedStatus = normalizeReturnStatus(status);
  const nextAmountCents = amountCents ?? (amount === null || amount === undefined || amount === '' ? current.amountCents : moneyToCents(amount));
  if (nextAmountCents < 0 || nextAmountCents > current.orderTotalCents) {
    const error = new Error('Return amount cannot exceed the order total');
    error.status = 400;
    throw error;
  }

  if (hasDatabaseConfig()) {
    await query(
      `update commerce_return_requests
       set status = :status,
           amount_cents = :amountCents,
           refund_reference = :refundReference,
           note = :note,
           updated_at = current_timestamp
       where business_id = :businessId and id = :returnId`,
      {
        businessId,
        returnId,
        status: normalizedStatus,
        amountCents: nextAmountCents,
        refundReference: String(refundReference || current.refundReference || '').trim(),
        note: String(note || current.note || '').trim()
      }
    );
  } else {
    const stored = demoReturns.find((request) => Number(request.id) === Number(returnId) && Number(request.businessId || 1) === Number(businessId));
    if (!stored) throw notFound('Return request not found');
    stored.status = normalizedStatus;
    stored.amountCents = nextAmountCents;
    stored.refundReference = String(refundReference || stored.refundReference || '').trim();
    stored.note = String(note || stored.note || '').trim();
    stored.updatedAt = new Date().toISOString();
  }

  if (normalizedStatus === 'refunded') {
    await updateOrderStatus({ businessId, orderId: current.orderId, status: 'refunded', note: note || 'Refund completed' });
  }

  await recordOrderEvent({
    businessId,
    orderId: current.orderId,
    eventType: 'return.status_updated',
    status: normalizedStatus,
    note: note || `Return status changed to ${normalizedStatus}`,
    metadata: { returnRequestId: current.id, refundReference, amountCents: nextAmountCents }
  });

  const updated = await getReturnRequestById(businessId, returnId);
  if (!sendWhatsApp) return updated;
  const order = await getOrderById(businessId, current.orderId);
  const message = await sendOrderStatusMessage({ businessId, orderId: current.orderId, body: returnStatusText(order, updated) });
  return { ...updated, message };
}

async function getCommerceCustomerSegments(businessId) {
  const [orders, returns] = await Promise.all([listOrders(businessId), listReturnRequests(businessId)]);
  const customers = buildCustomerProfiles({ orders, returns });
  const segments = [
    segmentSummary('first_time_buyer', 'First-time buyers', customers.filter((customer) => customer.paidOrders === 1)),
    segmentSummary('repeat_buyer', 'Repeat buyers', customers.filter((customer) => customer.paidOrders >= 2)),
    segmentSummary('vip_customer', 'VIP customers', customers.filter((customer) => customer.paidOrders >= 3 || customer.lifetimeValueCents >= 150000)),
    segmentSummary('needs_follow_up', 'Needs follow-up', customers.filter((customer) => customer.needsFollowUp)),
    segmentSummary('at_risk', 'At-risk customers', customers.filter((customer) => customer.returnCount > 0 || customer.daysSinceLastPaidOrder >= 60))
  ];

  return {
    customers,
    segments,
    summary: {
      customers: customers.length,
      vipCustomers: segments.find((segment) => segment.id === 'vip_customer')?.count || 0,
      needsFollowUp: segments.find((segment) => segment.id === 'needs_follow_up')?.count || 0,
      atRisk: segments.find((segment) => segment.id === 'at_risk')?.count || 0
    }
  };
}

async function listCommerceAutomationEvents(businessId) {
  const relevantTypes = new Set([
    'automation.rules_applied',
    'payment.reconciled',
    ...postPurchaseSentEventTypes,
    ...postPurchaseSuppressedEventTypes
  ]);
  if (!hasDatabaseConfig()) {
    return demoOrderEvents
      .filter((event) => Number(event.businessId || event.business_id) === Number(businessId))
      .filter((event) => relevantTypes.has(event.eventType || event.event_type))
      .map(normalizeOrderEvent);
  }

  const rows = await query(
    `select * from commerce_order_events
     where business_id = :businessId
       and event_type in ('automation.rules_applied', 'payment.reconciled', 'post_purchase.review.sent', 'post_purchase.reorder.sent', 'post_purchase.follow_up.sent', 'post_purchase.review.suppressed', 'post_purchase.reorder.suppressed', 'post_purchase.follow_up.suppressed')
     order by created_at desc, id desc`,
    { businessId }
  );
  return rows.map(normalizeOrderEvent);
}

async function listCommerceAutomationRules(businessId) {
  let rules;
  if (!hasDatabaseConfig()) {
    seedDemoAutomationRules(businessId);
    rules = demoAutomationRules
      .filter((rule) => Number(rule.businessId || rule.business_id) === Number(businessId))
      .map(normalizeAutomationRule);
    return enrichAutomationRulesWithTemplates(businessId, rules);
  }

  const rows = await query(
    `select * from commerce_automation_rules
     where business_id = :businessId
     order by id`,
    { businessId }
  );
  rules = rows.length
    ? rows.map(normalizeAutomationRule)
    : commerceAutomationRuleDefinitions.map((rule) => normalizeAutomationRule({ ...rule, businessId }));
  return enrichAutomationRulesWithTemplates(businessId, rules);
}

async function updateCommerceAutomationRule({ businessId, ruleId, enabled, delayValue, delayUnit }) {
  const currentRules = await listCommerceAutomationRules(businessId);
  const currentRule = currentRules.find((item) => item.ruleKey === String(ruleId || '').trim());
  const rule = validateAutomationRuleUpdate({ businessId, ruleId, enabled, delayValue, delayUnit, currentRule });
  if (hasDatabaseConfig()) {
    await query(
      `insert into commerce_automation_rules
       (business_id, rule_key, name, description, trigger_status, prompt_type, delay_value, delay_unit, enabled)
       values (:businessId, :ruleKey, :name, :description, :triggerStatus, :promptType, :delayValue, :delayUnit, :enabled)
       on duplicate key update
         name = values(name),
         description = values(description),
         trigger_status = values(trigger_status),
         prompt_type = values(prompt_type),
         delay_value = values(delay_value),
         delay_unit = values(delay_unit),
         enabled = values(enabled),
         updated_at = current_timestamp`,
      { ...rule, enabled: rule.enabled ? 1 : 0 }
    );
    const rules = await listCommerceAutomationRules(businessId);
    return rules.find((item) => item.ruleKey === rule.ruleKey);
  }

  seedDemoAutomationRules(businessId);
  const index = demoAutomationRules.findIndex((item) => Number(item.businessId) === Number(businessId) && item.ruleKey === rule.ruleKey);
  if (index === -1) demoAutomationRules.push({ ...rule, updatedAt: new Date().toISOString() });
  else demoAutomationRules[index] = { ...demoAutomationRules[index], ...rule, updatedAt: new Date().toISOString() };
  return normalizeAutomationRule(demoAutomationRules.find((item) => Number(item.businessId) === Number(businessId) && item.ruleKey === rule.ruleKey));
}

async function installCommerceAutomationTemplate({ businessId, ruleId }) {
  const rules = await listCommerceAutomationRules(businessId);
  const rule = rules.find((item) => item.ruleKey === String(ruleId || '').trim());
  if (!rule) throw notFound('Automation rule not found');

  const draft = commerceAutomationTemplateDraft(rule);
  const templates = await listTemplates(businessId);
  const existing = templates.find((template) => template.slug === draft.slug || template.name === draft.name);
  const template = existing || await createTemplate(businessId, draft);
  const refreshedRules = await listCommerceAutomationRules(businessId);
  return {
    created: !existing,
    template,
    rule: refreshedRules.find((item) => item.ruleKey === rule.ruleKey)
  };
}

async function submitCommerceAutomationTemplate({ businessId, ruleId }) {
  let rules = await listCommerceAutomationRules(businessId);
  let rule = rules.find((item) => item.ruleKey === String(ruleId || '').trim());
  if (!rule) throw notFound('Automation rule not found');
  if (!rule.templateReadiness?.templateId) {
    await installCommerceAutomationTemplate({ businessId, ruleId });
    rules = await listCommerceAutomationRules(businessId);
    rule = rules.find((item) => item.ruleKey === String(ruleId || '').trim());
  }
  const templateId = rule.templateReadiness?.templateId;
  if (!templateId) {
    const error = new Error('Automation template could not be found or created');
    error.status = 400;
    throw error;
  }
  const submission = await submitTemplateToMeta({ businessId, templateId });
  const refreshedRules = await listCommerceAutomationRules(businessId);
  return {
    ...submission,
    rule: refreshedRules.find((item) => item.ruleKey === rule.ruleKey)
  };
}

async function syncCommerceAutomationTemplates(businessId, options = {}) {
  const sync = await syncMetaTemplates(businessId, options);
  return {
    sync,
    rules: await listCommerceAutomationRules(businessId)
  };
}

async function previewCommerceAutomationRule({ businessId, ruleId, limit = 10 }) {
  const rules = await listCommerceAutomationRules(businessId);
  const rule = rules.find((item) => item.ruleKey === String(ruleId || '').trim());
  if (!rule) throw notFound('Automation rule not found');

  const [orders, events] = await Promise.all([
    listOrders(businessId),
    listCommerceAutomationEvents(businessId)
  ]);
  const scheduledOrderIds = new Set();
  for (const event of events) {
    if (event.eventType !== 'automation.rules_applied') continue;
    const scheduled = event.metadata?.scheduled || [];
    if (scheduled.some((item) => (item.ruleKey || item.ruleId) === rule.ruleKey)) {
      scheduledOrderIds.add(String(event.orderId));
    }
  }
  const candidateOrders = orders
    .filter((order) => order.status === rule.triggerStatus)
    .filter((order) => isPromptEligibleForOrder(order, rule.promptType))
    .map((order) => ({
      id: order.id,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      status: order.status,
      total: order.total,
      totalCents: order.totalCents,
      createdAt: order.createdAt,
      alreadyScheduled: scheduledOrderIds.has(String(order.id))
    }));
  const matchingOrders = await Promise.all(candidateOrders.map((order) => automationRulePreviewOrder({ businessId, order, rule })));
  matchingOrders
    .sort((a, b) => Number(a.alreadyScheduled) - Number(b.alreadyScheduled) || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  const alreadyScheduled = matchingOrders.filter((order) => order.alreadyScheduled).length;
  const suppressedByConsent = matchingOrders.filter((order) => order.suppressionReason === 'customer_opted_out').length;
  const suppressedByCooldown = matchingOrders.filter((order) => order.suppressionReason === 'automation_cooldown').length;
  const suppressedByTemplate = matchingOrders.filter((order) => order.suppressionReason === 'template_missing' || order.suppressionReason === 'configured_template_missing' || order.suppressionReason === 'template_not_approved').length;
  const sendableToSchedule = matchingOrders.filter((order) => order.sendable).length;
  const orderLimit = Math.max(0, Number(limit ?? 10));
  return {
    rule,
    summary: {
      matchingOrders: matchingOrders.length,
      alreadyScheduled,
      readyToSchedule: matchingOrders.length - alreadyScheduled,
      sendableToSchedule,
      suppressedByConsent,
      suppressedByCooldown,
      suppressedByTemplate,
      enabled: rule.enabled,
      delayValue: rule.delayValue,
      delayUnit: rule.delayUnit
    },
    orders: matchingOrders.slice(0, Number.isFinite(orderLimit) ? orderLimit : 10)
  };
}

async function automationRulePreviewOrder({ businessId, order, rule }) {
  if (order.alreadyScheduled) return { ...order, sendable: false, suppressionReason: 'already_scheduled', suppressionLabel: 'Already scheduled' };
  const consent = await getContactConsentState({ businessId, phone: order.customerPhone });
  if (consent.suppressed) {
    return { ...order, sendable: false, suppressionReason: 'customer_opted_out', suppressionLabel: 'Customer opted out' };
  }
  const recentSend = await findRecentPostPurchaseSend({ businessId, customerPhone: order.customerPhone, excludeOrderId: order.id });
  if (recentSend) {
    return {
      ...order,
      sendable: false,
      suppressionReason: 'automation_cooldown',
      suppressionLabel: `Cooldown until ${automationCustomerCooldownHours()}h window passes`,
      previousOrderId: recentSend.event.orderId,
      previousSentAt: recentSend.event.createdAt
    };
  }
  const templateGuard = automationTemplateGuard(rule);
  if (templateGuard) {
    return {
      ...order,
      sendable: false,
      suppressionReason: templateGuard.reason,
      suppressionLabel: templateGuard.label,
      templateStatus: templateGuard.status,
      templateName: templateGuard.templateName
    };
  }
  return { ...order, sendable: Boolean(rule.enabled), suppressionReason: rule.enabled ? '' : 'disabled', suppressionLabel: rule.enabled ? '' : 'Rule paused' };
}

async function scheduleAutomationRuleForOrder({ businessId, order, rule, source }) {
  if (!rule.enabled) return { skipped: { ruleKey: rule.ruleKey, reason: 'disabled' } };
  if (rule.triggerStatus !== order.status) {
    return { skipped: { ruleKey: rule.ruleKey, reason: `waiting for ${rule.triggerStatus}` } };
  }
  if (!isPromptEligibleForOrder(order, rule.promptType)) {
    return { skipped: { ruleKey: rule.ruleKey, reason: 'order not eligible' } };
  }
  const templateGuard = automationTemplateGuard(rule);
  if (templateGuard) {
    return {
      skipped: {
        ruleKey: rule.ruleKey,
        reason: templateGuard.reason,
        label: templateGuard.label,
        templateStatus: templateGuard.status,
        templateName: templateGuard.templateName
      }
    };
  }

  const runAt = new Date(Date.now() + automationRuleDelayMs(rule));
  const job = await enqueueJob({
    type: 'commerce.post_purchase_prompt',
    payload: {
      businessId,
      orderId: order.id,
      promptType: rule.promptType,
      ruleId: rule.ruleKey,
      source,
      templateName: rule.templateReadiness?.ready ? rule.templateReadiness.templateName : undefined,
      templateLanguage: rule.templateReadiness?.ready ? rule.templateReadiness.language : undefined
    },
    runAt,
    dedupeKey: `commerce.post_purchase_prompt:${businessId}:${order.id}:${rule.ruleKey}`
  });
  return {
    scheduled: { ruleKey: rule.ruleKey, promptType: rule.promptType, runAt: runAt.toISOString(), ...job }
  };
}

async function applyCommerceAutomationRulesForOrder({ businessId, orderId, source = 'manual' }) {
  const order = await getOrderById(businessId, orderId);
  const rules = await listCommerceAutomationRules(businessId);
  const scheduled = [];
  const skipped = [];

  for (const rule of rules) {
    const result = await scheduleAutomationRuleForOrder({ businessId, order, rule, source });
    if (result.scheduled) scheduled.push(result.scheduled);
    if (result.skipped) skipped.push(result.skipped);
  }

  if (scheduled.length) {
    await recordOrderEvent({
      businessId,
      orderId: order.id,
      eventType: 'automation.rules_applied',
      status: order.status,
      note: `${scheduled.length} commerce automation rule(s) scheduled`,
      metadata: { source, scheduled }
    });
  }

  return { scheduled, skipped, order: await getOrderById(businessId, order.id) };
}

async function applyCommerceAutomationRuleToReadyOrders({ businessId, ruleId, source = 'manual_rule_apply' }) {
  const preview = await previewCommerceAutomationRule({ businessId, ruleId, limit: Number.MAX_SAFE_INTEGER });
  const rule = preview.rule;
  const readyOrders = preview.orders.filter((order) => order.sendable);
  const scheduled = [];
  const skipped = preview.orders
    .filter((order) => !order.sendable)
    .map((order) => ({
      orderId: order.id,
      ruleKey: rule.ruleKey,
      reason: order.suppressionReason || 'not_sendable',
      label: order.suppressionLabel || ''
    }));

  for (const order of readyOrders) {
    const result = await scheduleAutomationRuleForOrder({ businessId, order, rule, source });
    if (result.scheduled) {
      scheduled.push({ orderId: order.id, ...result.scheduled });
      await recordOrderEvent({
        businessId,
        orderId: order.id,
        eventType: 'automation.rules_applied',
        status: order.status,
        note: `Commerce automation rule ${rule.name} scheduled`,
        metadata: { source, scheduled: [result.scheduled] }
      });
    }
    if (result.skipped) skipped.push({ orderId: order.id, ...result.skipped });
  }

  return {
    rule,
    summary: {
      matchingOrders: preview.summary.matchingOrders,
      alreadyScheduled: preview.summary.alreadyScheduled,
      readyToSchedule: preview.summary.readyToSchedule,
      sendableToSchedule: preview.summary.sendableToSchedule,
      suppressedByConsent: preview.summary.suppressedByConsent,
      suppressedByCooldown: preview.summary.suppressedByCooldown,
      suppressedByTemplate: preview.summary.suppressedByTemplate,
      scheduled: scheduled.length,
      skipped: skipped.length
    },
    scheduled,
    skipped
  };
}

async function getCommerceAutomationInsights(businessId, options = {}) {
  const attributionDays = normalizeAttributionDays(options.attributionDays);
  const [rules, events, orders] = await Promise.all([
    listCommerceAutomationRules(businessId),
    listCommerceAutomationEvents(businessId),
    listOrders(businessId)
  ]);
  return buildCommerceAutomationInsights({ rules, events, orders, attributionDays });
}

async function sendPostPurchasePrompt({
  businessId,
  orderId,
  promptType = 'review',
  body = '',
  ruleId = null,
  source = 'manual',
  templateName = '',
  templateLanguage = '',
  templateParameters = null
}) {
  const order = await getOrderById(businessId, orderId);
  if (!['paid', 'packed', 'out_for_delivery', 'completed'].includes(order.status)) {
    const error = new Error('Post-purchase prompts require a paid or fulfilled order');
    error.status = 400;
    throw error;
  }
  const normalizedType = normalizePostPurchasePromptType(promptType);
  const consent = await getContactConsentState({ businessId, phone: order.customerPhone });
  if (consent.suppressed) {
    await recordOrderEvent({
      businessId,
      orderId,
      eventType: `post_purchase.${normalizedType}.suppressed`,
      status: order.status,
      note: `Post-purchase ${normalizedType} prompt suppressed because the customer is opted out`,
      metadata: { ruleId, source, reason: 'customer_opted_out', phone: consent.phone }
    });
    return {
      suppressed: true,
      reason: 'customer_opted_out',
      promptType: normalizedType,
      order: await getOrderById(businessId, orderId)
    };
  }
  const recentSend = await findRecentPostPurchaseSend({ businessId, customerPhone: order.customerPhone, excludeOrderId: order.id });
  if (recentSend) {
    const retryAt = automationCooldownRetryAt(recentSend.event.createdAt);
    const retry = await enqueueJob({
      type: 'commerce.post_purchase_prompt',
      payload: {
        businessId,
        orderId: order.id,
        promptType: normalizedType,
        body,
        ruleId,
        source: `${source}:cooldown_retry`,
        templateName,
        templateLanguage,
        templateParameters
      },
      runAt: retryAt,
      dedupeKey: `commerce.post_purchase_prompt_retry:${businessId}:${order.id}:${ruleId || normalizedType}`
    });
    await recordOrderEvent({
      businessId,
      orderId,
      eventType: `post_purchase.${normalizedType}.suppressed`,
      status: order.status,
      note: `Post-purchase ${normalizedType} prompt suppressed by customer cooldown`,
      metadata: {
        ruleId,
        source,
        reason: 'automation_cooldown',
        cooldownHours: automationCustomerCooldownHours(),
        previousOrderId: recentSend.event.orderId,
        previousEventId: recentSend.event.id,
        previousSentAt: recentSend.event.createdAt,
        retryAt: retryAt.toISOString(),
        retry
      }
    });
    return {
      suppressed: true,
      reason: 'automation_cooldown',
      promptType: normalizedType,
      cooldownHours: automationCustomerCooldownHours(),
      retryAt: retryAt.toISOString(),
      retry,
      order: await getOrderById(businessId, orderId)
    };
  }
  const text = String(body || postPurchasePromptText(order, normalizedType)).slice(0, 1024);
  const template = resolvePostPurchaseTemplate({
    promptType: normalizedType,
    order,
    templateName,
    templateLanguage,
    templateParameters
  });
  const result = template
    ? await sendTemplateMessage({
      businessId,
      to: order.customerPhone,
      templateName: template.name,
      language: template.language,
      parameters: template.parameters
    })
    : await sendTextMessage({ businessId, to: order.customerPhone, text });
  await recordOrderEvent({
    businessId,
    orderId,
    eventType: `post_purchase.${normalizedType}.sent`,
    status: order.status,
    note: `Post-purchase ${normalizedType} prompt sent on WhatsApp`,
    metadata: {
      providerMessageId: result.messageId,
      mode: result.mode,
      body: text,
      messageType: template ? 'template' : 'text',
      templateName: template?.name || null,
      templateLanguage: template?.language || null,
      templateParameters: template?.parameters || null,
      ruleId,
      source
    }
  });
  return {
    ...result,
    promptType: normalizedType,
    body: text,
    messageType: template ? 'template' : 'text',
    template,
    order: await getOrderById(businessId, orderId)
  };
}

async function schedulePostPurchasePrompts({ businessId, orderId, triggers = ['review', 'reorder', 'follow_up'] }) {
  const order = await getOrderById(businessId, orderId);
  if (!['paid', 'packed', 'out_for_delivery', 'completed'].includes(order.status)) {
    return { scheduled: [], skipped: 'order is not paid or fulfilled' };
  }

  const scheduled = [];
  for (const trigger of triggers) {
    const promptType = normalizePostPurchasePromptType(trigger);
    if (!isPromptEligibleForOrder(order, promptType)) continue;
    const runAt = postPurchaseRunAt(promptType);
    const job = await enqueueJob({
      type: 'commerce.post_purchase_prompt',
      payload: { businessId, orderId: order.id, promptType },
      runAt,
      dedupeKey: `commerce.post_purchase_prompt:${businessId}:${order.id}:${promptType}`
    });
    scheduled.push({ promptType, runAt: runAt.toISOString(), ...job });
  }

  if (scheduled.length) {
    await recordOrderEvent({
      businessId,
      orderId: order.id,
      eventType: 'post_purchase.scheduled',
      status: order.status,
      note: `${scheduled.length} post-purchase prompt(s) scheduled`,
      metadata: { scheduled }
    });
  }
  return { scheduled, order: await getOrderById(businessId, order.id) };
}

async function getCommerceAnalytics(businessId) {
  const [products, orders] = await Promise.all([listProducts(businessId), listOrders(businessId)]);
  const paidStatuses = new Set(['paid', 'packed', 'out_for_delivery', 'completed']);
  const paidOrders = orders.filter((order) => paidStatuses.has(order.status));
  const pendingPayment = orders.filter((order) => order.status === 'pending_payment');
  const totalRevenueCents = paidOrders.reduce((sum, order) => sum + Number(order.totalCents || 0), 0);
  const averageOrderValueCents = paidOrders.length ? Math.round(totalRevenueCents / paidOrders.length) : 0;
  const lowStock = products.filter((product) => Number(product.inventoryCount || 0) > 0 && Number(product.inventoryCount || 0) <= 5);

  return {
    currency: 'ZAR',
    summary: {
      products: products.length,
      activeProducts: products.filter((product) => product.status === 'active').length,
      orders: orders.length,
      paidOrders: paidOrders.length,
      pendingPayment: pendingPayment.length,
      totalRevenueCents,
      totalRevenue: cents(totalRevenueCents),
      averageOrderValueCents,
      averageOrderValue: cents(averageOrderValueCents),
      lowStock: lowStock.length
    },
    statusBreakdown: summarizeByStatus(orders),
    lowStock
  };
}

async function getOrderByPaymentReference({ businessId, paymentReference }) {
  if (!paymentReference) throw notFound('Payment reference not found');
  const order = await findOrderByPaymentReference({ businessId, paymentReference });
  if (!order) throw notFound('Order not found');
  return order;
}

async function findOrderByPaymentReference({ businessId, paymentReference }) {
  if (!paymentReference) return null;
  if (!hasDatabaseConfig()) {
    const order = demoOrders.find((item) => (
      Number(item.businessId || item.business_id || 1) === Number(businessId) &&
      String(item.paymentReference || item.payment_reference || '') === String(paymentReference)
    ));
    if (!order) return null;
    return getOrderById(businessId, order.id);
  }

  const rows = await query(
    `select id from commerce_orders
     where business_id = :businessId and payment_reference = :paymentReference
    limit 1`,
    { businessId, paymentReference }
  );
  if (!rows[0]) return null;
  return getOrderById(businessId, rows[0].id);
}

async function getReturnRequestById(businessId, returnId) {
  if (!hasDatabaseConfig()) {
    const request = demoReturns.find((item) => Number(item.id) === Number(returnId) && Number(item.businessId || 1) === Number(businessId));
    if (!request) throw notFound('Return request not found');
    const order = await getOrderById(businessId, request.orderId);
    return normalizeReturnRequest(request, order);
  }

  const rows = await query(
    `select r.*, o.customer_name as customerName, o.customer_phone as customerPhone, o.total_cents as orderTotalCents
     from commerce_return_requests r
     join commerce_orders o on o.id = r.order_id and o.business_id = r.business_id
     where r.business_id = :businessId and r.id = :returnId
     limit 1`,
    { businessId, returnId }
  );
  if (!rows[0]) throw notFound('Return request not found');
  return normalizeReturnRequest(rows[0]);
}

async function getInventoryAlerts(businessId, options = {}) {
  const threshold = Math.max(1, Number(options.threshold || process.env.COMMERCE_LOW_STOCK_THRESHOLD || 5));
  const products = await listProducts(businessId);
  const active = products.filter((product) => product.status === 'active');
  const outOfStock = active.filter((product) => Number(product.inventoryCount || 0) <= 0);
  const lowStock = active.filter((product) => Number(product.inventoryCount || 0) > 0 && Number(product.inventoryCount || 0) <= threshold);
  return {
    threshold,
    outOfStock,
    lowStock,
    summary: {
      activeProducts: active.length,
      outOfStock: outOfStock.length,
      lowStock: lowStock.length,
      alertCount: outOfStock.length + lowStock.length
    }
  };
}

async function shareCatalog({ businessId, to, productIds = [], body, footer }) {
  if (!to) {
    const error = new Error('to is required');
    error.status = 400;
    throw error;
  }
  const products = await listProducts(businessId, { status: 'active' });
  const selected = productIds.length
    ? products.filter((product) => productIds.map(String).includes(String(product.id)))
    : products.slice(0, 10);
  if (!selected.length) {
    const error = new Error('Add at least one active product before sharing a catalogue');
    error.status = 400;
    throw error;
  }

  const payload = buildCommerceMessagePayload({
    to,
    products: selected,
    body: body || 'Browse our WhatsApp catalogue and reply here if you need help checking out.',
    footer: footer || 'Powered by ChatClan commerce'
  });
  const result = await sendInteractiveMessage({ businessId, payload });
  return { ...result, payload, products: selected };
}

function buildCommerceMessagePayload({ to, products, body, footer }) {
  const catalogId = products.find((product) => product.metaCatalogId)?.metaCatalogId;
  const productCards = products.filter((product) => product.metaProductRetailerId && product.metaCatalogId);
  if (catalogId && productCards.length >= 2) {
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'carousel',
        body: { text: String(body).slice(0, 1024) },
        action: {
          cards: productCards.slice(0, 10).map((product, index) => ({
            card_index: index,
            type: 'product',
            action: {
              catalog_id: product.metaCatalogId,
              product_retailer_id: product.metaProductRetailerId
            }
          }))
        }
      }
    };
  }

  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'catalog_message',
      body: { text: String(body).slice(0, 1024) },
      action: {
        name: 'catalog_message',
        parameters: products[0]?.metaProductRetailerId
          ? { thumbnail_product_retailer_id: products[0].metaProductRetailerId }
          : undefined
      },
      footer: footer ? { text: String(footer).slice(0, 60) } : undefined
    }
  };
}

async function recordOrderFromMetaEvent({ businessId, event }) {
  const order = event.raw?.order;
  if (!order?.product_items?.length) return null;
  const paymentReference = event.messageId;
  if (paymentReference) {
    const existing = await findOrderByPaymentReference({ businessId, paymentReference });
    if (existing) {
      await recordOrderEvent({
        businessId,
        orderId: existing.id,
        eventType: 'order.webhook_duplicate',
        status: existing.status,
        note: 'Duplicate WhatsApp order webhook ignored',
        metadata: { messageId: paymentReference, catalogId: order.catalog_id || null }
      });
      return { ...existing, duplicate: true };
    }
  }
  const products = await listProducts(businessId);
  const items = order.product_items.map((item) => {
    const product = products.find((candidate) => candidate.metaProductRetailerId === item.product_retailer_id || candidate.sku === item.product_retailer_id);
    return {
      productId: product?.id,
      productName: product?.name || item.product_retailer_id,
      sku: product?.sku || item.product_retailer_id,
      metaProductRetailerId: item.product_retailer_id,
      quantity: Math.max(1, Number(item.quantity || 1)),
      unitPriceCents: Math.round(Number(item.item_price || 0) * 100),
      currency: item.currency || product?.currency || 'ZAR'
    };
  });
  const unmatchedItems = items
    .filter((item) => !item.productId)
    .map((item) => ({
      productRetailerId: item.metaProductRetailerId,
      quantity: item.quantity,
      itemPriceCents: item.unitPriceCents,
      currency: item.currency
    }));
  const totalCents = items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0);
  const payload = {
    customerName: event.profileName || 'WhatsApp customer',
    customerPhone: event.from,
    status: 'new',
    source: 'whatsapp_catalog',
    paymentReference,
    items: []
  };
  const metadata = {
    catalogId: order.catalog_id || null,
    text: order.text || null,
    messageId: paymentReference || null,
    unmatchedItems
  };

  if (hasDatabaseConfig()) {
    const result = await query(
      `insert into commerce_orders
       (business_id, customer_name, customer_phone, status, source, currency, total_cents, subtotal_cents, discount_cents, payment_reference, metadata_json)
       values
       (:businessId, :customerName, :customerPhone, 'new', 'whatsapp_catalog', :currency, :totalCents, :subtotalCents, 0, :paymentReference, :metadata)`,
      {
        businessId,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        currency: items[0]?.currency || 'ZAR',
        totalCents,
        subtotalCents: totalCents,
        paymentReference: payload.paymentReference,
        metadata: JSON.stringify(metadata)
      }
    );
    for (const item of items) {
      await query(
        `insert into commerce_order_items
         (business_id, order_id, product_id, product_name, sku, quantity, unit_price_cents, currency)
         values
         (:businessId, :orderId, :productId, :productName, :sku, :quantity, :unitPriceCents, :currency)`,
        { ...item, businessId, orderId: result.insertId, productId: item.productId || null }
      );
      if (item.productId) await decrementProductInventory({ businessId, productId: item.productId, quantity: item.quantity });
    }
    await recordOrderEvent({
      businessId,
      orderId: result.insertId,
      eventType: 'order.received_from_whatsapp',
      status: 'new',
      note: 'Order received from WhatsApp catalog',
      metadata
    });
    if (unmatchedItems.length) {
      await recordOrderEvent({
        businessId,
        orderId: result.insertId,
        eventType: 'order.catalog_item_unmatched',
        status: 'new',
        note: `${unmatchedItems.length} WhatsApp catalog item(s) did not match local products`,
        metadata: { catalogId: order.catalog_id || null, unmatchedItems }
      });
    }
    return { ...(await getOrderById(businessId, result.insertId)), items };
  }

  const stored = {
    ...payload,
    businessId: Number(businessId),
    id: nextOrderId++,
    currency: items[0]?.currency || 'ZAR',
    subtotalCents: totalCents,
    discountCents: 0,
    discountCode: '',
    totalCents,
    itemCount: items.length,
    items,
    metadata,
    createdAt: new Date().toISOString()
  };
  demoOrders.unshift(stored);
  for (const item of items) {
    const product = demoProducts.find((candidate) => Number(candidate.id) === Number(item.productId));
    if (product) product.inventoryCount = Math.max(0, Number(product.inventoryCount || 0) - item.quantity);
  }
  await recordOrderEvent({
    businessId,
    orderId: stored.id,
    eventType: 'order.received_from_whatsapp',
    status: 'new',
    note: 'Order received from WhatsApp catalog',
    metadata
  });
  if (unmatchedItems.length) {
    await recordOrderEvent({
      businessId,
      orderId: stored.id,
      eventType: 'order.catalog_item_unmatched',
      status: 'new',
      note: `${unmatchedItems.length} WhatsApp catalog item(s) did not match local products`,
      metadata: { catalogId: order.catalog_id || null, unmatchedItems }
    });
  }
  return normalizeOrder(stored);
}

function buildOrderDetailsPayload({ to, order, body }) {
  const items = (order.items || []).map((item) => ({
    retailer_id: item.sku || String(item.productId || item.product_id || item.id),
    name: item.productName || item.product_name,
    amount: { value: Number(item.unitPriceCents || item.unit_price_cents || 0), offset: 100 },
    quantity: Number(item.quantity || 1)
  }));
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'order_details',
      body: { text: String(body || `Order #${order.id} is ready for payment.`).slice(0, 1024) },
      footer: { text: 'Secure payment link' },
      action: {
        name: 'review_and_pay',
        parameters: {
          reference_id: String(order.paymentReference || `order-${order.id}`).slice(0, 60),
          type: 'physical-goods',
          payment_type: 'payment_link',
          payment_settings: [
            {
              type: 'payment_link',
              payment_link: { uri: order.paymentLinkUrl || buildPaymentLink({ order, provider: order.paymentProvider || 'payfast' }) }
            }
          ],
          currency: order.currency || 'ZAR',
          total_amount: { value: Number(order.totalCents || 0), offset: 100 },
          order: {
            status: 'pending',
            items,
            subtotal: { value: Number(order.subtotalCents || order.totalCents || 0), offset: 100 }
          }
        }
      }
    }
  };
}

function buildOrderStatusPayload({ to, order, body }) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'order_status',
      body: { text: String(body || orderStatusText(order)).slice(0, 1024) },
      footer: { text: 'Order update' },
      action: {
        name: 'review_order',
        parameters: {
          reference_id: String(order.paymentReference || `order-${order.id}`).slice(0, 60),
          order: { status: mapWhatsAppOrderStatus(order.status) },
          payment: order.status === 'paid' || order.status === 'completed'
            ? { status: 'captured', timestamp: Math.floor(Date.now() / 1000) }
            : { status: order.status === 'pending_payment' ? 'pending' : 'authorized', timestamp: Math.floor(Date.now() / 1000) }
        }
      }
    }
  };
}

function buildPaymentLink({ order, provider = 'payfast' }) {
  const baseByProvider = {
    payfast: process.env.COMMERCE_PAYFAST_LINK_BASE_URL,
    yoco: process.env.COMMERCE_YOCO_LINK_BASE_URL,
    ozow: process.env.COMMERCE_OZOW_LINK_BASE_URL
  };
  const baseUrl = baseByProvider[provider] || process.env.COMMERCE_PAYMENT_LINK_BASE_URL || `${process.env.APP_URL || 'https://checkout.chatclan.co.za'}/pay`;
  const params = new URLSearchParams({
    order: String(order.id),
    ref: String(order.paymentReference || `order-${order.id}`),
    amount: cents(Number(order.totalCents || 0)),
    currency: order.currency || 'ZAR'
  });
  return `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}${params.toString()}`;
}

async function recordOrderEvent({ businessId, orderId, eventType, status = null, note = null, metadata = null }) {
  if (hasDatabaseConfig()) {
    await query(
      `insert into commerce_order_events
       (business_id, order_id, event_type, status, note, metadata_json)
       values (:businessId, :orderId, :eventType, :status, :note, :metadata)`,
      { businessId, orderId, eventType, status, note, metadata: metadata ? JSON.stringify(metadata) : null }
    );
    return null;
  }
  const event = {
    id: nextOrderEventId++,
    businessId: Number(businessId),
    orderId: Number(orderId),
    eventType,
    status,
    note,
    metadata,
    createdAt: new Date().toISOString()
  };
  demoOrderEvents.unshift(event);
  return normalizeOrderEvent(event);
}

async function decrementProductInventory({ businessId, productId, quantity }) {
  if (!productId) return;
  if (hasDatabaseConfig()) {
    await query(
      `update commerce_products
       set inventory_count = greatest(0, inventory_count - :quantity)
       where business_id = :businessId and id = :productId`,
      { businessId, productId, quantity }
    );
  }
}

function validateProduct(payload) {
  const name = String(payload.name || '').trim();
  const sku = String(payload.sku || '').trim() || slugify(name);
  const priceCents = Math.round(Number(payload.price || payload.priceRand || payload.amount || 0) * 100) || Number(payload.priceCents || 0);
  if (!name) {
    const error = new Error('Product name is required');
    error.status = 400;
    throw error;
  }
  if (!priceCents || priceCents < 1) {
    const error = new Error('Product price must be greater than zero');
    error.status = 400;
    throw error;
  }
  return {
    businessId: Number(payload.businessId),
    name,
    sku,
    description: String(payload.description || '').trim(),
    priceCents,
    currency: String(payload.currency || 'ZAR').toUpperCase(),
    imageUrl: String(payload.imageUrl || payload.image_url || '').trim(),
    inventoryCount: Math.max(0, Number(payload.inventoryCount || payload.inventory_count || 0)),
    status: ['active', 'draft', 'archived'].includes(payload.status) ? payload.status : 'active',
    metaCatalogId: String(payload.metaCatalogId || payload.meta_catalog_id || '').trim(),
    metaProductRetailerId: String(payload.metaProductRetailerId || payload.meta_product_retailer_id || sku).trim(),
    paymentLinkUrl: String(payload.paymentLinkUrl || payload.payment_link_url || '').trim()
  };
}

function csvProductPayload(record) {
  return {
    name: record.name || record.productname || record.product,
    sku: record.sku || record.retailerid || record.productretailerid,
    description: record.description,
    price: record.price || record.amount || record.pricezar,
    priceCents: record.pricecents,
    currency: record.currency,
    imageUrl: record.imageurl || record.image,
    inventoryCount: record.inventorycount || record.inventory || record.stock || record.quantity,
    status: record.status,
    metaCatalogId: record.metacatalogid || record.catalogid,
    metaProductRetailerId: record.metaproductretailerid || record.productretailerid || record.retailerid,
    paymentLinkUrl: record.paymentlinkurl || record.producturl || record.url || record.checkouturl
  };
}

function normalizeHeader(header) {
  return String(header || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function key(value) {
  return String(value || '').trim().toLowerCase();
}

function rowError(row, field, message) {
  return { row, field, message };
}

function isDuplicateProductError(err) {
  return /duplicate|unique/i.test(String(err?.message || '')) || err?.code === 'ER_DUP_ENTRY';
}

function validateVariant(payload) {
  const optionName = String(payload.optionName || payload.option_name || 'Option').trim();
  const optionValue = String(payload.optionValue || payload.option_value || payload.name || '').trim();
  const name = String(payload.name || `${payload.product.name} - ${optionValue}`).trim();
  const sku = String(payload.sku || '').trim() || `${payload.product.sku}-${slugify(optionValue || name)}`;
  const priceCents = payload.price || payload.priceRand || payload.amount
    ? Math.round(Number(payload.price || payload.priceRand || payload.amount) * 100)
    : payload.priceCents || payload.price_cents
      ? Number(payload.priceCents || payload.price_cents)
      : null;
  if (!name || !optionValue) {
    const error = new Error('Variant name and option value are required');
    error.status = 400;
    throw error;
  }
  return {
    businessId: Number(payload.businessId),
    productId: Number(payload.productId),
    name,
    sku,
    optionName,
    optionValue,
    priceCents,
    inventoryCount: Math.max(0, Number(payload.inventoryCount || payload.inventory_count || 0)),
    status: ['active', 'draft', 'archived'].includes(payload.status) ? payload.status : 'active',
    metaProductRetailerId: String(payload.metaProductRetailerId || payload.meta_product_retailer_id || sku).trim()
  };
}

function validateCollection(payload, products) {
  const name = String(payload.name || '').trim();
  const productIds = parseProductIds(payload.productIds || payload.product_ids);
  if (!name) {
    const error = new Error('Collection name is required');
    error.status = 400;
    throw error;
  }
  if (!productIds.length) {
    const error = new Error('Select at least one product for the collection');
    error.status = 400;
    throw error;
  }

  const knownIds = new Set(products.map((product) => String(product.id)));
  const missing = productIds.filter((productId) => !knownIds.has(String(productId)));
  if (missing.length) {
    const error = new Error(`Unknown product ids: ${missing.join(', ')}`);
    error.status = 400;
    throw error;
  }

  return {
    businessId: Number(payload.businessId),
    name,
    description: String(payload.description || '').trim(),
    status: ['active', 'draft', 'archived'].includes(payload.status) ? payload.status : 'active',
    productIds
  };
}

function validateFulfilment(payload) {
  const provider = String(payload.provider || payload.fulfilmentProvider || payload.fulfilment_provider || '').trim();
  const trackingNumber = String(payload.trackingNumber || payload.tracking_number || '').trim();
  const trackingUrl = String(payload.trackingUrl || payload.tracking_url || '').trim();
  if (!provider && !trackingNumber && !trackingUrl) {
    const error = new Error('Provide a courier, tracking number, or tracking URL');
    error.status = 400;
    throw error;
  }
  if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
    const error = new Error('Tracking URL must start with http:// or https://');
    error.status = 400;
    throw error;
  }
  return {
    provider: provider.slice(0, 120),
    trackingNumber: trackingNumber.slice(0, 180),
    trackingUrl: trackingUrl.slice(0, 500)
  };
}

function validateCoupon(payload) {
  const code = normalizeCouponCode(payload.code);
  const name = String(payload.name || code).trim();
  const discountType = String(payload.discountType || payload.discount_type || 'percent').trim().toLowerCase();
  const rawDiscountValue = Number(payload.discountValue || payload.discount_value || 0);
  const minimumOrderCents = moneyToCents(payload.minimumOrder || payload.minimum_order || payload.minimumOrderCents || payload.minimum_order_cents || 0);
  const maxRedemptions = payload.maxRedemptions || payload.max_redemptions ? Math.max(1, Number(payload.maxRedemptions || payload.max_redemptions)) : null;
  const status = ['active', 'draft', 'archived'].includes(payload.status) ? payload.status : 'active';

  if (!code) {
    const error = new Error('Coupon code is required');
    error.status = 400;
    throw error;
  }
  if (!['percent', 'fixed'].includes(discountType)) {
    const error = new Error('Coupon discountType must be percent or fixed');
    error.status = 400;
    throw error;
  }
  if (discountType === 'percent' && (rawDiscountValue < 1 || rawDiscountValue > 100)) {
    const error = new Error('Percent coupons must be between 1 and 100');
    error.status = 400;
    throw error;
  }
  if (discountType === 'fixed' && rawDiscountValue < 1) {
    const error = new Error('Fixed coupons must have a positive discount value');
    error.status = 400;
    throw error;
  }

  return {
    businessId: Number(payload.businessId),
    code,
    name,
    discountType,
    discountValue: discountType === 'fixed' ? moneyToCents(rawDiscountValue) : Math.round(rawDiscountValue),
    minimumOrderCents,
    maxRedemptions,
    status,
    startsAt: payload.startsAt || payload.starts_at || null,
    endsAt: payload.endsAt || payload.ends_at || null
  };
}

async function getCouponByCode(businessId, code) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) {
    const error = new Error('Coupon code is required');
    error.status = 400;
    throw error;
  }
  const coupons = await listCoupons(businessId);
  const coupon = coupons.find((item) => item.code === normalizedCode);
  if (!coupon) throw notFound('Coupon not found');
  validateCouponUsable(coupon);
  return coupon;
}

function validateCouponUsable(coupon) {
  const now = Date.now();
  if (coupon.status !== 'active') {
    const error = new Error('Coupon is not active');
    error.status = 400;
    throw error;
  }
  if (coupon.startsAt && Date.parse(coupon.startsAt) > now) {
    const error = new Error('Coupon is not active yet');
    error.status = 400;
    throw error;
  }
  if (coupon.endsAt && Date.parse(coupon.endsAt) < now) {
    const error = new Error('Coupon has expired');
    error.status = 400;
    throw error;
  }
  if (coupon.maxRedemptions && Number(coupon.redeemedCount || 0) >= Number(coupon.maxRedemptions)) {
    const error = new Error('Coupon redemption limit reached');
    error.status = 400;
    throw error;
  }
}

function calculateCouponDiscount({ coupon, order }) {
  const subtotalCents = Number(order.subtotalCents || order.totalCents || 0);
  if (subtotalCents < Number(coupon.minimumOrderCents || 0)) return { discountCents: 0, subtotalCents };
  const discountCents = coupon.discountType === 'percent'
    ? Math.round(subtotalCents * Number(coupon.discountValue || 0) / 100)
    : Math.min(subtotalCents, Number(coupon.discountValue || 0));
  return { discountCents: Math.max(0, Math.min(subtotalCents, discountCents)), subtotalCents };
}

function normalizeCouponCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9_-]+/g, '');
}

function moneyToCents(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    return Math.round(Number(trimmed) * 100) || 0;
  }
  const numeric = Number(value || 0);
  if (!numeric) return 0;
  return Number.isInteger(numeric) && numeric > 1000 ? numeric : Math.round(numeric * 100);
}

function fulfilmentNote(fulfilment) {
  const parts = [
    fulfilment.provider ? `Courier: ${fulfilment.provider}` : '',
    fulfilment.trackingNumber ? `Tracking: ${fulfilment.trackingNumber}` : '',
    fulfilment.trackingUrl ? `Track: ${fulfilment.trackingUrl}` : ''
  ].filter(Boolean);
  return parts.length ? parts.join(' | ') : 'Fulfilment updated';
}

function parseProductIds(value) {
  if (Array.isArray(value)) return [...new Set(value.map(Number).filter(Boolean))];
  return [...new Set(String(value || '').split(/[,\n\s]+/).map((item) => Number(item.trim())).filter(Boolean))];
}

function normalizeProduct(product) {
  return {
    id: product.id,
    businessId: product.businessId || product.business_id,
    name: product.name,
    sku: product.sku,
    description: product.description || '',
    priceCents: Number(product.priceCents || product.price_cents || 0),
    price: (Number(product.priceCents || product.price_cents || 0) / 100).toFixed(2),
    currency: product.currency || 'ZAR',
    imageUrl: product.imageUrl || product.image_url || '',
    inventoryCount: Number(product.inventoryCount || product.inventory_count || 0),
    status: product.status || 'active',
    metaCatalogId: product.metaCatalogId || product.meta_catalog_id || '',
    metaProductRetailerId: product.metaProductRetailerId || product.meta_product_retailer_id || product.sku,
    paymentLinkUrl: product.paymentLinkUrl || product.payment_link_url || '',
    updatedAt: product.updatedAt || product.updated_at || product.createdAt || product.created_at || null
  };
}

function normalizeCollection(collection, products = []) {
  const productIds = parseProductIds(collection.productIds || collection.product_ids || collection.product_id_list);
  const collectionProducts = productIds
    .map((productId) => products.find((product) => String(product.id) === String(productId)))
    .filter(Boolean);
  return {
    id: collection.id,
    businessId: collection.businessId || collection.business_id,
    name: collection.name,
    description: collection.description || '',
    status: collection.status || 'active',
    productIds,
    productCount: Number(collection.productCount || collection.product_count || productIds.length || collectionProducts.length || 0),
    retailerIds: collectionProducts.map((product) => product.metaProductRetailerId || product.sku).filter(Boolean),
    products: collectionProducts,
    updatedAt: collection.updatedAt || collection.updated_at || collection.createdAt || collection.created_at || null
  };
}

function normalizeCoupon(coupon) {
  return {
    id: coupon.id,
    businessId: coupon.businessId || coupon.business_id,
    code: normalizeCouponCode(coupon.code),
    name: coupon.name,
    discountType: coupon.discountType || coupon.discount_type,
    discountValue: Number(coupon.discountValue || coupon.discount_value || 0),
    minimumOrderCents: Number(coupon.minimumOrderCents || coupon.minimum_order_cents || 0),
    minimumOrder: cents(Number(coupon.minimumOrderCents || coupon.minimum_order_cents || 0)),
    maxRedemptions: coupon.maxRedemptions ?? coupon.max_redemptions ?? null,
    redeemedCount: Number(coupon.redeemedCount || coupon.redeemed_count || 0),
    status: coupon.status || 'active',
    startsAt: coupon.startsAt || coupon.starts_at || null,
    endsAt: coupon.endsAt || coupon.ends_at || null,
    updatedAt: coupon.updatedAt || coupon.updated_at || coupon.createdAt || coupon.created_at || null
  };
}

function normalizeVariant(variant) {
  return {
    id: variant.id,
    businessId: variant.businessId || variant.business_id,
    productId: variant.productId || variant.product_id,
    name: variant.name,
    sku: variant.sku,
    optionName: variant.optionName || variant.option_name || '',
    optionValue: variant.optionValue || variant.option_value || '',
    priceCents: variant.priceCents ?? variant.price_cents ?? null,
    price: variant.priceCents || variant.price_cents ? cents(Number(variant.priceCents || variant.price_cents)) : null,
    inventoryCount: Number(variant.inventoryCount || variant.inventory_count || 0),
    status: variant.status || 'active',
    metaProductRetailerId: variant.metaProductRetailerId || variant.meta_product_retailer_id || variant.sku,
    updatedAt: variant.updatedAt || variant.updated_at || variant.createdAt || variant.created_at || null
  };
}

function normalizeOrder(order) {
  return {
    id: order.id,
    businessId: order.businessId || order.business_id,
    customerName: order.customerName || order.customer_name || 'WhatsApp customer',
    customerPhone: order.customerPhone || order.customer_phone || '',
    status: order.status || 'new',
    source: order.source || 'manual',
    currency: order.currency || 'ZAR',
    subtotalCents: Number(order.subtotalCents || order.subtotal_cents || order.totalCents || order.total_cents || 0),
    subtotal: (Number(order.subtotalCents || order.subtotal_cents || order.totalCents || order.total_cents || 0) / 100).toFixed(2),
    discountCents: Number(order.discountCents || order.discount_cents || 0),
    discount: (Number(order.discountCents || order.discount_cents || 0) / 100).toFixed(2),
    discountCode: order.discountCode || order.discount_code || '',
    totalCents: Number(order.totalCents || order.total_cents || 0),
    total: (Number(order.totalCents || order.total_cents || 0) / 100).toFixed(2),
    itemCount: Number(order.itemCount || order.item_count || order.items?.length || 0),
    paymentProvider: order.paymentProvider || order.payment_provider || '',
    paymentReference: order.paymentReference || order.payment_reference || '',
    paymentLinkUrl: order.paymentLinkUrl || order.payment_link_url || '',
    paymentReady: Boolean(order.paymentLinkUrl || order.payment_link_url),
    recoveryCount: Number(order.recoveryCount || order.recovery_count || 0),
    lastRecoverySentAt: order.lastRecoverySentAt || order.last_recovery_sent_at || null,
    fulfilmentProvider: order.fulfilmentProvider || order.fulfilment_provider || '',
    trackingNumber: order.trackingNumber || order.tracking_number || '',
    trackingUrl: order.trackingUrl || order.tracking_url || '',
    fulfilledAt: order.fulfilledAt || order.fulfilled_at || null,
    metadata: order.metadata || parseJson(order.metadata_json) || {},
    createdAt: order.createdAt || order.created_at || null,
    items: order.items || undefined
  };
}

function withRecoverySummary(order, events = [], raw = {}) {
  const recoveryEvents = events.filter((event) => (
    Number(event.businessId || event.business_id) === Number(order.businessId) &&
    Number(event.orderId || event.order_id) === Number(order.id) &&
    (event.eventType || event.event_type) === 'cart_recovery.sent'
  ));
  const lastEvent = recoveryEvents
    .slice()
    .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))[0];
  return {
    ...order,
    recoveryCount: Number(raw.recovery_count ?? raw.recoveryCount ?? recoveryEvents.length ?? 0),
    lastRecoverySentAt: raw.last_recovery_sent_at || raw.lastRecoverySentAt || lastEvent?.createdAt || lastEvent?.created_at || null
  };
}

function normalizeOrderItem(item) {
  return {
    id: item.id,
    businessId: item.businessId || item.business_id,
    orderId: item.orderId || item.order_id,
    productId: item.productId || item.product_id,
    productName: item.productName || item.product_name,
    sku: item.sku,
    metaProductRetailerId: item.metaProductRetailerId || item.meta_product_retailer_id || item.sku,
    quantity: Number(item.quantity || 1),
    unitPriceCents: Number(item.unitPriceCents || item.unit_price_cents || 0),
    unitPrice: cents(Number(item.unitPriceCents || item.unit_price_cents || 0)),
    currency: item.currency || 'ZAR'
  };
}

function findOrderItemForLink(items, { itemId = null, retailerId = '' }) {
  const normalizedRetailerId = key(retailerId);
  return items.find((item) => {
    if (itemId && String(item.id || '') === String(itemId)) return true;
    const itemRetailerId = key(item.metaProductRetailerId || item.sku);
    return normalizedRetailerId && itemRetailerId === normalizedRetailerId;
  });
}

function removeUnmatchedOrderItem(metadata = {}, retailerId = '') {
  const normalizedRetailerId = key(retailerId);
  const current = metadata && typeof metadata === 'object' ? metadata : {};
  const unmatchedItems = Array.isArray(current.unmatchedItems)
    ? current.unmatchedItems.filter((item) => key(item.productRetailerId) !== normalizedRetailerId)
    : [];
  return { ...current, unmatchedItems };
}

async function updateOrderMetadata(businessId, orderId, metadata) {
  if (!hasDatabaseConfig()) return;
  await query(
    `update commerce_orders
     set metadata_json = :metadata,
         updated_at = current_timestamp
     where business_id = :businessId and id = :orderId`,
    { businessId, orderId, metadata: JSON.stringify(metadata || {}) }
  );
}

function normalizeOrderEvent(event) {
  return {
    id: event.id,
    businessId: event.businessId || event.business_id,
    orderId: event.orderId || event.order_id,
    eventType: event.eventType || event.event_type,
    status: event.status || '',
    note: event.note || '',
    metadata: event.metadata || parseJson(event.metadata_json) || {},
    createdAt: event.createdAt || event.created_at || null
  };
}

function normalizeReturnRequest(request, order = {}) {
  const amountCents = Number(request.amountCents || request.amount_cents || 0);
  return {
    id: request.id,
    businessId: request.businessId || request.business_id,
    orderId: request.orderId || request.order_id,
    customerName: request.customerName || order.customerName || order.customer_name || '',
    customerPhone: request.customerPhone || order.customerPhone || order.customer_phone || '',
    orderTotalCents: Number(request.orderTotalCents || request.order_total_cents || order.totalCents || order.total_cents || 0),
    orderTotal: cents(Number(request.orderTotalCents || request.order_total_cents || order.totalCents || order.total_cents || 0)),
    reason: request.reason || '',
    resolution: request.resolution || 'refund',
    status: request.status || 'requested',
    amountCents,
    amount: cents(amountCents),
    refundReference: request.refundReference || request.refund_reference || '',
    note: request.note || '',
    createdAt: request.createdAt || request.created_at || null,
    updatedAt: request.updatedAt || request.updated_at || request.createdAt || request.created_at || null
  };
}

function normalizeOrderStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (orderStatuses.has(normalized)) return normalized;
  const error = new Error(`Order status must be one of: ${Array.from(orderStatuses).join(', ')}`);
  error.status = 400;
  throw error;
}

function normalizeReturnStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  if (returnStatuses.has(normalized)) return normalized;
  const error = new Error(`Return status must be one of: ${Array.from(returnStatuses).join(', ')}`);
  error.status = 400;
  throw error;
}

function normalizePostPurchasePromptType(promptType) {
  const normalized = String(promptType || '').trim().toLowerCase();
  if (['review', 'reorder', 'follow_up'].includes(normalized)) return normalized;
  const error = new Error('Post-purchase prompt type must be review, reorder, or follow_up');
  error.status = 400;
  throw error;
}

function normalizeAutomationRule(rule) {
  return {
    id: rule.ruleKey || rule.rule_key || rule.id,
    businessId: rule.businessId || rule.business_id,
    ruleKey: rule.ruleKey || rule.rule_key || rule.id,
    name: rule.name,
    description: rule.description || '',
    triggerStatus: rule.triggerStatus || rule.trigger_status,
    promptType: normalizePostPurchasePromptType(rule.promptType || rule.prompt_type),
    delayValue: Number(rule.delayValue ?? rule.delay_value ?? 0),
    delayUnit: normalizeAutomationDelayUnit(rule.delayUnit || rule.delay_unit || 'hours'),
    enabled: Boolean(Number(rule.enabled ?? 1)),
    updatedAt: rule.updatedAt || rule.updated_at || rule.createdAt || rule.created_at || null
  };
}

function validateAutomationRuleUpdate({ businessId, ruleId, enabled, delayValue, delayUnit, currentRule = null }) {
  const ruleKey = String(ruleId || '').trim();
  const definition = commerceAutomationRuleDefinitions.find((rule) => rule.ruleKey === ruleKey);
  if (!definition) {
    const error = new Error('Unknown commerce automation rule');
    error.status = 404;
    throw error;
  }
  const nextDelayValue = delayValue === undefined || delayValue === null || delayValue === ''
    ? Number(currentRule?.delayValue ?? definition.delayValue)
    : Math.max(0, Math.round(Number(delayValue)));
  if (!Number.isFinite(nextDelayValue)) {
    const error = new Error('Delay value must be a positive number');
    error.status = 400;
    throw error;
  }
  return {
    ...definition,
    businessId: Number(businessId),
    delayValue: nextDelayValue,
    delayUnit: normalizeAutomationDelayUnit(delayUnit || currentRule?.delayUnit || definition.delayUnit),
    enabled: enabled === undefined ? Boolean(currentRule?.enabled ?? definition.enabled) : Boolean(enabled)
  };
}

function normalizeAutomationDelayUnit(unit) {
  const normalized = String(unit || 'hours').trim().toLowerCase();
  if (automationDelayUnits.has(normalized)) return normalized;
  const error = new Error('Automation delay unit must be minutes, hours, or days');
  error.status = 400;
  throw error;
}

function automationRuleDelayMs(rule) {
  const multipliers = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000
  };
  return Math.max(0, Number(rule.delayValue || 0) * multipliers[normalizeAutomationDelayUnit(rule.delayUnit)]);
}

function automationCustomerCooldownHours() {
  const value = Number(process.env.COMMERCE_AUTOMATION_CUSTOMER_COOLDOWN_HOURS ?? 24);
  return Number.isFinite(value) ? Math.max(0, value) : 24;
}

function automationCustomerCooldownMs() {
  return automationCustomerCooldownHours() * 60 * 60 * 1000;
}

function commerceAutomationRequiresApprovedTemplates() {
  const explicit = String(process.env.COMMERCE_AUTOMATION_REQUIRE_APPROVED_TEMPLATES || '').trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(explicit)) return true;
  if (['0', 'false', 'no', 'off'].includes(explicit)) return false;
  return String(process.env.META_SEND_MODE || '').trim().toLowerCase() === 'live';
}

function automationTemplateGuard(rule) {
  if (!commerceAutomationRequiresApprovedTemplates()) return null;
  if (rule.templateReadiness?.ready) return null;
  const readiness = rule.templateReadiness || {};
  const reason = readiness.reason || 'template_not_approved';
  const status = readiness.status || 'Missing';
  const label = status === 'Submitted'
    ? 'Template awaiting approval'
    : status === 'Rejected'
      ? 'Template rejected'
      : status === 'Missing'
        ? 'Approved template required'
        : 'Template not approved';
  return {
    reason,
    label,
    status,
    templateName: readiness.templateName || readiness.templateLabel || ''
  };
}

async function enrichAutomationRulesWithTemplates(businessId, rules) {
  let templates = [];
  try {
    templates = await listTemplates(businessId);
  } catch {
    templates = [];
  }
  return rules.map((rule) => ({
    ...rule,
    templateReadiness: buildAutomationTemplateReadiness(rule, templates)
  }));
}

function buildAutomationTemplateReadiness(rule, templates) {
  const expectedCategory = automationTemplateCategory(rule.promptType);
  const configuredName = postPurchaseConfiguredTemplateName(rule.promptType);
  const language = String(process.env.COMMERCE_POST_PURCHASE_TEMPLATE_LANGUAGE || 'en_ZA').trim() || 'en_ZA';
  const suggestedName = configuredName || `wazify_${String(rule.promptType || 'follow_up').replace(/[^a-z0-9_]+/g, '_')}_prompt`;
  const candidates = templates
    .filter((template) => !expectedCategory || template.category === expectedCategory)
    .filter((template) => {
      const templateName = String(template.slug || template.name || '').toLowerCase();
      const normalizedConfigured = String(configuredName || '').toLowerCase();
      if (normalizedConfigured) return templateName === normalizedConfigured || String(template.name || '').toLowerCase() === normalizedConfigured;
      return templateName.includes(String(rule.promptType || '').toLowerCase());
    });
  const approved = candidates.find((template) => template.status === 'Approved');
  const selected = approved || candidates[0] || null;
  if (approved) {
    return {
      ready: true,
      required: true,
      templateId: approved.id,
      templateName: approved.slug || approved.name,
      templateLabel: approved.name,
      language: approved.language || language,
      status: approved.status,
      category: approved.category,
      metaTemplateId: approved.metaTemplateId || null,
      message: 'Approved WhatsApp template ready for outbound automation.'
    };
  }
  if (selected) {
    return {
      ready: false,
      required: true,
      templateId: selected.id,
      templateName: selected.slug || selected.name,
      templateLabel: selected.name,
      language: selected.language || language,
      status: selected.status,
      category: selected.category,
      metaTemplateId: selected.metaTemplateId || null,
      reason: 'template_not_approved',
      message: `Template exists but is ${selected.status.toLowerCase()}. Submit and approve it before live outbound automation.`
    };
  }
  return {
    ready: false,
    required: true,
    templateName: suggestedName,
    templateLabel: suggestedName,
    language,
    status: 'Missing',
    category: expectedCategory,
    reason: configuredName ? 'configured_template_missing' : 'template_missing',
    message: configuredName
      ? 'Configured template was not found for this business.'
      : 'Create and approve a WhatsApp template for this automation before relying on live outbound sends.'
  };
}

function commerceAutomationTemplateDraft(rule) {
  const promptType = normalizePostPurchasePromptType(rule.promptType);
  const category = automationTemplateCategory(promptType);
  const base = {
    review: {
      name: 'Wazify Review Prompt',
      body: 'Hi {{1}}, thanks for order {{2}}. Reply {{3}} to share feedback or get help.'
    },
    reorder: {
      name: 'Wazify Reorder Prompt',
      body: 'Hi {{1}}, ready to reorder from order {{2}}? Reply {{3}} and we will help you check out on WhatsApp. Reply STOP to opt out.',
      footer: 'Reply STOP to opt out.'
    },
    follow_up: {
      name: 'Wazify Follow Up Prompt',
      body: 'Hi {{1}}, checking in on order {{2}}. Reply {{3}} if you need help or a product recommendation.'
    }
  }[promptType];
  return {
    name: base.name,
    slug: `wazify_${promptType}_prompt`,
    category,
    industry: 'ecommerce',
    language: String(process.env.COMMERCE_POST_PURCHASE_TEMPLATE_LANGUAGE || 'en_ZA').trim() || 'en_ZA',
    status: 'Draft',
    body: base.body,
    footer: base.footer || ''
  };
}

function automationTemplateCategory(promptType) {
  return promptType === 'reorder' ? 'MARKETING' : 'UTILITY';
}

function postPurchaseConfiguredTemplateName(promptType) {
  return String(process.env[postPurchaseTemplateEnvKey(promptType)] || process.env.COMMERCE_POST_PURCHASE_TEMPLATE_NAME || '').trim();
}

function automationCooldownRetryAt(previousSentAt) {
  const previousTime = new Date(previousSentAt || 0).getTime();
  const retryTime = Number.isFinite(previousTime) && previousTime > 0
    ? previousTime + automationCustomerCooldownMs() + 1000
    : Date.now() + automationCustomerCooldownMs() + 1000;
  return new Date(Math.max(Date.now() + 1000, retryTime));
}

function seedDemoAutomationRules(businessId) {
  for (const definition of commerceAutomationRuleDefinitions) {
    const exists = demoAutomationRules.some((rule) => Number(rule.businessId) === Number(businessId) && rule.ruleKey === definition.ruleKey);
    if (!exists) {
      demoAutomationRules.push({
        ...definition,
        businessId: Number(businessId),
        updatedAt: new Date().toISOString()
      });
    }
  }
}

function buildCommerceAutomationInsights({ rules, events, orders = [], attributionDays = 30 }) {
  const rates = metaRateConfig();
  const stats = new Map(rules.map((rule) => [rule.ruleKey, {
    scheduled: 0,
    sent: 0,
    suppressed: 0,
    suppressedReasons: {},
    deduped: 0,
    estimatedCostCents: 0,
    attributedOrders: 0,
    attributedRevenueCents: 0,
    lastScheduledAt: null,
    lastSentAt: null,
    lastAttributedAt: null
  }]));
  const recent = [];
  const orderById = new Map(orders.map((order) => [String(order.id), order]));
  const sentPrompts = [];
  const paidEvents = [];

  for (const event of events) {
    if (event.eventType === 'automation.rules_applied') {
      for (const scheduled of event.metadata?.scheduled || []) {
        const ruleKey = scheduled.ruleKey || scheduled.ruleId;
        if (!stats.has(ruleKey)) continue;
        const ruleStats = stats.get(ruleKey);
        if (scheduled.deduped) ruleStats.deduped += 1;
        else ruleStats.scheduled += 1;
        ruleStats.lastScheduledAt = latestDate(ruleStats.lastScheduledAt, event.createdAt);
        recent.push({
          type: 'scheduled',
          ruleKey,
          promptType: scheduled.promptType,
          orderId: event.orderId,
          occurredAt: event.createdAt,
          deduped: Boolean(scheduled.deduped)
        });
      }
      continue;
    }

    if (String(event.eventType || '').startsWith('post_purchase.') && String(event.eventType || '').endsWith('.suppressed')) {
      const ruleKey = event.metadata?.ruleId || event.metadata?.ruleKey || null;
      if (!stats.has(ruleKey)) continue;
      const ruleStats = stats.get(ruleKey);
      const reason = event.metadata?.reason || 'suppressed';
      ruleStats.suppressed += 1;
      ruleStats.suppressedReasons[reason] = Number(ruleStats.suppressedReasons[reason] || 0) + 1;
      recent.push({
        type: 'suppressed',
        ruleKey,
        promptType: event.eventType.replace('post_purchase.', '').replace('.suppressed', ''),
        orderId: event.orderId,
        occurredAt: event.createdAt,
        reason,
        retryAt: event.metadata?.retryAt || null,
        retryJobId: event.metadata?.retry?.jobId || null,
        retryDeduped: Boolean(event.metadata?.retry?.deduped)
      });
      continue;
    }

    if (String(event.eventType || '').startsWith('post_purchase.') && String(event.eventType || '').endsWith('.sent')) {
      const ruleKey = event.metadata?.ruleId || event.metadata?.ruleKey || null;
      if (!stats.has(ruleKey)) continue;
      const sourceOrder = orderById.get(String(event.orderId));
      const ruleStats = stats.get(ruleKey);
      ruleStats.sent += 1;
      ruleStats.estimatedCostCents += automationPromptCostCents(event.eventType, rates);
      ruleStats.lastSentAt = latestDate(ruleStats.lastSentAt, event.createdAt);
      sentPrompts.push({
        ruleKey,
        orderId: event.orderId,
        customerPhone: normalizeCustomerPhone(sourceOrder?.customerPhone),
        promptType: event.eventType.replace('post_purchase.', '').replace('.sent', ''),
        sentAt: event.createdAt
      });
      recent.push({
        type: 'sent',
        ruleKey,
        promptType: event.eventType.replace('post_purchase.', '').replace('.sent', ''),
        orderId: event.orderId,
        occurredAt: event.createdAt,
        mode: event.metadata?.mode || ''
      });
      continue;
    }

    if (event.eventType === 'payment.reconciled') {
      const paidOrder = orderById.get(String(event.orderId));
      if (!paidOrder) continue;
      paidEvents.push({
        orderId: event.orderId,
        customerPhone: normalizeCustomerPhone(paidOrder.customerPhone),
        paidAt: event.createdAt,
        totalCents: Number(paidOrder.totalCents || 0)
      });
    }
  }

  for (const attribution of attributeAutomationRevenue({ sentPrompts, paidEvents, attributionDays })) {
    const ruleStats = stats.get(attribution.ruleKey);
    if (!ruleStats) continue;
    ruleStats.attributedOrders += 1;
    ruleStats.attributedRevenueCents += attribution.totalCents;
    ruleStats.lastAttributedAt = latestDate(ruleStats.lastAttributedAt, attribution.paidAt);
    recent.push({
      type: 'attributed_order',
      ruleKey: attribution.ruleKey,
      promptType: attribution.promptType,
      orderId: attribution.orderId,
      occurredAt: attribution.paidAt,
      revenue: cents(attribution.totalCents)
    });
  }

  const ruleRows = rules.map((rule) => {
    const ruleStats = stats.get(rule.ruleKey) || {};
    const scheduled = Number(ruleStats.scheduled || 0);
    const sent = Number(ruleStats.sent || 0);
    const estimatedCostCents = Number(ruleStats.estimatedCostCents || 0);
    const attributedRevenueCents = Number(ruleStats.attributedRevenueCents || 0);
    const roi = estimatedCostCents ? Number((attributedRevenueCents / estimatedCostCents).toFixed(2)) : null;
    const row = {
      ...rule,
      metrics: {
        scheduled,
        sent,
        suppressed: Number(ruleStats.suppressed || 0),
        suppressedReasons: { ...(ruleStats.suppressedReasons || {}) },
        deduped: Number(ruleStats.deduped || 0),
        templateReady: Boolean(rule.templateReadiness?.ready),
        templateStatus: rule.templateReadiness?.status || 'Missing',
        templateBlocker: rule.templateReadiness?.ready ? '' : (rule.templateReadiness?.reason || 'template_not_ready'),
        estimatedCostCents,
        estimatedCost: cents(estimatedCostCents),
        attributedOrders: Number(ruleStats.attributedOrders || 0),
        attributedRevenueCents,
        attributedRevenue: cents(attributedRevenueCents),
        roi,
        sendRate: scheduled ? Math.round((sent / scheduled) * 100) : 0,
        lastScheduledAt: ruleStats.lastScheduledAt || null,
        lastSentAt: ruleStats.lastSentAt || null,
        lastAttributedAt: ruleStats.lastAttributedAt || null
      }
    };
    return { ...row, recommendation: automationRuleRecommendation(row) };
  });
  const summary = ruleRows.reduce((totals, rule) => {
    totals.rules += 1;
    if (rule.enabled) totals.enabledRules += 1;
    if (rule.templateReadiness?.ready) totals.templateReady += 1;
    else if (rule.templateReadiness?.status === 'Submitted') totals.templatePending += 1;
    else if (rule.templateReadiness?.status === 'Draft') totals.templateDraft += 1;
    else totals.templateMissing += 1;
    totals.scheduled += rule.metrics.scheduled;
    totals.sent += rule.metrics.sent;
    totals.suppressed += rule.metrics.suppressed;
    totals.deduped += rule.metrics.deduped;
    totals.estimatedCostCents += rule.metrics.estimatedCostCents;
    totals.attributedOrders += rule.metrics.attributedOrders;
    totals.attributedRevenueCents += rule.metrics.attributedRevenueCents;
    return totals;
  }, { rules: 0, enabledRules: 0, templateReady: 0, templatePending: 0, templateDraft: 0, templateMissing: 0, scheduled: 0, sent: 0, suppressed: 0, deduped: 0, estimatedCostCents: 0, estimatedCost: '0.00', attributedOrders: 0, attributedRevenueCents: 0, attributedRevenue: '0.00', roi: null, sendRate: 0 });
  summary.sendRate = summary.scheduled ? Math.round((summary.sent / summary.scheduled) * 100) : 0;
  summary.estimatedCost = cents(summary.estimatedCostCents);
  summary.attributedRevenue = cents(summary.attributedRevenueCents);
  summary.roi = summary.estimatedCostCents ? Number((summary.attributedRevenueCents / summary.estimatedCostCents).toFixed(2)) : null;
  summary.templateReadiness = {
    ready: summary.templateReady,
    pending: summary.templatePending,
    draft: summary.templateDraft,
    missing: summary.templateMissing,
    blocked: Math.max(0, summary.rules - summary.templateReady),
    total: summary.rules
  };

  return {
    attribution: {
      windowDays: attributionDays,
      costSource: 'configured Meta rate card estimate'
    },
    summary,
    rules: ruleRows,
    recommendations: ruleRows
      .map((rule) => rule.recommendation)
      .filter((recommendation) => recommendation && recommendation.priority !== 'none')
      .sort((a, b) => recommendationWeight(b.priority) - recommendationWeight(a.priority))
      .slice(0, 5),
    recent: recent
      .sort((a, b) => new Date(b.occurredAt || 0) - new Date(a.occurredAt || 0))
      .slice(0, 8)
  };
}

function automationRuleRecommendation(rule) {
  const metrics = rule.metrics || {};
  const template = rule.templateReadiness || {};
  if (!rule.enabled) {
    return {
      ruleKey: rule.ruleKey,
      priority: 'low',
      action: 'Paused',
      message: 'This automation is paused. Enable it when you want it to schedule prompts again.'
    };
  }
  if (metrics.suppressedReasons?.customer_opted_out && metrics.suppressedReasons.customer_opted_out >= metrics.sent) {
    return {
      ruleKey: rule.ruleKey,
      priority: 'high',
      action: 'Check consent',
      message: `${metrics.suppressedReasons.customer_opted_out} prompt(s) were suppressed because customers are opted out. Review opt-in capture before scaling this rule.`
    };
  }
  if (metrics.suppressedReasons?.automation_cooldown && metrics.suppressedReasons.automation_cooldown >= metrics.sent) {
    return {
      ruleKey: rule.ruleKey,
      priority: 'medium',
      action: 'Check frequency',
      message: `${metrics.suppressedReasons.automation_cooldown} prompt(s) were held back by the customer cooldown. Keep the cooldown if you want a quieter buyer experience.`
    };
  }
  if (!template.ready) {
    const status = template.status || 'Missing';
    const action = status === 'Missing'
      ? 'Create template'
      : status === 'Draft'
        ? 'Submit template'
        : status === 'Submitted'
          ? 'Sync approval'
          : 'Review template';
    const message = status === 'Missing'
      ? `${rule.name} needs an approved WhatsApp template before proactive live automation can send.`
      : status === 'Draft'
        ? `${template.templateLabel || template.templateName || 'This template'} is drafted but not submitted to Meta yet.`
        : status === 'Submitted'
          ? `${template.templateLabel || template.templateName || 'This template'} is awaiting Meta review. Sync template status after approval.`
          : template.message || `${rule.name} needs template attention before live automation.`;
    return {
      ruleKey: rule.ruleKey,
      priority: status === 'Submitted' ? 'medium' : 'high',
      action,
      message
    };
  }
  if (!metrics.scheduled && !metrics.sent) {
    return {
      ruleKey: rule.ruleKey,
      priority: 'medium',
      action: 'Watch setup',
      message: `No matching ${rule.triggerStatus} orders have triggered this automation yet.`
    };
  }
  if (metrics.scheduled > 0 && !metrics.sent) {
    return {
      ruleKey: rule.ruleKey,
      priority: 'high',
      action: 'Check worker',
      message: 'Prompts have been scheduled but not sent yet. Check worker timing and queue health.'
    };
  }
  if (metrics.sent >= 3 && !metrics.attributedOrders) {
    return {
      ruleKey: rule.ruleKey,
      priority: 'high',
      action: 'Improve copy',
      message: 'This automation is sending but has not driven attributed orders yet. Test the message, offer, or delay.'
    };
  }
  if (metrics.roi !== null && metrics.roi >= 10 && metrics.attributedOrders > 0) {
    return {
      ruleKey: rule.ruleKey,
      priority: 'high',
      action: 'Scale',
      message: 'This automation is producing strong attributed revenue against estimated message cost.'
    };
  }
  if (metrics.attributedOrders > 0) {
    return {
      ruleKey: rule.ruleKey,
      priority: 'medium',
      action: 'Keep running',
      message: 'This automation is generating attributed orders. Keep monitoring ROI and delivery cost.'
    };
  }
  return {
    ruleKey: rule.ruleKey,
    priority: 'low',
    action: 'Monitor',
    message: 'This automation is active. Let it gather more sends before changing it.'
  };
}

function recommendationWeight(priority) {
  return { high: 3, medium: 2, low: 1, none: 0 }[priority] || 0;
}

function attributeAutomationRevenue({ sentPrompts, paidEvents, attributionDays = 30 }) {
  const attributionWindowMs = attributionDays * 24 * 60 * 60 * 1000;
  const sent = sentPrompts
    .filter((prompt) => prompt.customerPhone && prompt.sentAt)
    .sort((a, b) => new Date(b.sentAt || 0) - new Date(a.sentAt || 0));
  const attributed = [];

  for (const paidEvent of paidEvents) {
    if (!paidEvent.customerPhone || !paidEvent.paidAt) continue;
    const paidAt = new Date(paidEvent.paidAt).getTime();
    const match = sent.find((prompt) => {
      if (prompt.customerPhone !== paidEvent.customerPhone) return false;
      if (String(prompt.orderId) === String(paidEvent.orderId)) return false;
      const sentAt = new Date(prompt.sentAt).getTime();
      return sentAt <= paidAt && paidAt - sentAt <= attributionWindowMs;
    });
    if (!match) continue;
    attributed.push({
      ruleKey: match.ruleKey,
      promptType: match.promptType,
      orderId: paidEvent.orderId,
      paidAt: paidEvent.paidAt,
      totalCents: paidEvent.totalCents
    });
  }

  return attributed;
}

function automationPromptCostCents(eventType, rates) {
  const promptType = String(eventType || '').replace('post_purchase.', '').replace('.sent', '');
  const category = promptType === 'reorder' ? 'MARKETING' : 'UTILITY';
  return Number(rates[category] || 0);
}

function normalizeAttributionDays(value) {
  const days = Number(value ?? process.env.COMMERCE_AUTOMATION_ATTRIBUTION_DAYS ?? 30);
  if (!Number.isFinite(days)) return 30;
  return Math.min(90, Math.max(1, Math.round(days)));
}

function validateReturnRequest({ businessId, order, reason, resolution, amount, amountCents, note }) {
  const normalizedReason = String(reason || '').trim();
  const normalizedResolution = String(resolution || 'refund').trim().toLowerCase();
  const requestedAmountCents = amountCents ?? (amount === null || amount === undefined || amount === '' ? Number(order.totalCents || 0) : moneyToCents(amount));
  if (!normalizedReason) {
    const error = new Error('Return reason is required');
    error.status = 400;
    throw error;
  }
  if (!['refund', 'exchange', 'store_credit'].includes(normalizedResolution)) {
    const error = new Error('Return resolution must be refund, exchange, or store_credit');
    error.status = 400;
    throw error;
  }
  if (!['paid', 'packed', 'out_for_delivery', 'completed', 'refunded'].includes(order.status)) {
    const error = new Error('Returns can only be opened after payment has been confirmed');
    error.status = 400;
    throw error;
  }
  if (requestedAmountCents < 0 || requestedAmountCents > Number(order.totalCents || 0)) {
    const error = new Error('Return amount cannot exceed the order total');
    error.status = 400;
    throw error;
  }
  return {
    businessId: Number(businessId),
    orderId: order.id,
    reason: normalizedReason,
    resolution: normalizedResolution,
    status: 'requested',
    amountCents: requestedAmountCents,
    note: String(note || '').trim()
  };
}

function buildCustomerProfiles({ orders, returns }) {
  const paidStatuses = new Set(['paid', 'packed', 'out_for_delivery', 'completed', 'refunded']);
  const profiles = new Map();
  for (const order of orders) {
    const phone = normalizeCustomerPhone(order.customerPhone);
    if (!phone) continue;
    const profile = profiles.get(phone) || {
      phone,
      customerName: order.customerName || phone,
      orderCount: 0,
      paidOrders: 0,
      lifetimeValueCents: 0,
      lastOrderAt: null,
      lastPaidOrderAt: null,
      returnCount: 0,
      needsFollowUp: false
    };
    profile.orderCount += 1;
    profile.customerName = profile.customerName === phone && order.customerName ? order.customerName : profile.customerName;
    profile.lastOrderAt = latestDate(profile.lastOrderAt, order.createdAt);
    if (paidStatuses.has(order.status)) {
      profile.paidOrders += 1;
      profile.lifetimeValueCents += Number(order.totalCents || 0);
      profile.lastPaidOrderAt = latestDate(profile.lastPaidOrderAt, order.createdAt);
    }
    if (order.status === 'pending_payment' || order.status === 'new') profile.needsFollowUp = true;
    profiles.set(phone, profile);
  }
  for (const request of returns) {
    const phone = normalizeCustomerPhone(request.customerPhone);
    if (!phone) continue;
    const profile = profiles.get(phone) || {
      phone,
      customerName: request.customerName || phone,
      orderCount: 0,
      paidOrders: 0,
      lifetimeValueCents: 0,
      lastOrderAt: null,
      lastPaidOrderAt: null,
      returnCount: 0,
      needsFollowUp: false
    };
    profile.returnCount += 1;
    profile.needsFollowUp = !['closed', 'refunded', 'rejected'].includes(request.status);
    profiles.set(phone, profile);
  }
  return [...profiles.values()]
    .map((profile) => {
      const daysSinceLastPaidOrder = profile.lastPaidOrderAt ? Math.floor((Date.now() - new Date(profile.lastPaidOrderAt).getTime()) / 86400000) : null;
      return {
        ...profile,
        lifetimeValue: cents(profile.lifetimeValueCents),
        daysSinceLastPaidOrder
      };
    })
    .sort((a, b) => b.lifetimeValueCents - a.lifetimeValueCents);
}

function segmentSummary(id, label, customers) {
  return {
    id,
    label,
    count: customers.length,
    customers: customers.slice(0, 8)
  };
}

function postPurchasePromptText(order, promptType) {
  if (promptType === 'review') {
    return `Hi ${order.customerName || 'there'}, thanks for your WhatsApp order #${order.id}. How was your experience? Reply with your review or any feedback.`;
  }
  if (promptType === 'reorder') {
    return `Hi ${order.customerName || 'there'}, would you like to reorder from order #${order.id}? Reply REORDER and we will help you check out on WhatsApp.`;
  }
  return `Hi ${order.customerName || 'there'}, just checking in after order #${order.id}. Reply here if you need help, support, or another product recommendation.`;
}

function resolvePostPurchaseTemplate({ promptType, order, templateName = '', templateLanguage = '', templateParameters = null }) {
  const name = String(templateName || process.env[postPurchaseTemplateEnvKey(promptType)] || process.env.COMMERCE_POST_PURCHASE_TEMPLATE_NAME || '').trim();
  if (!name) return null;
  return {
    name,
    language: String(templateLanguage || process.env.COMMERCE_POST_PURCHASE_TEMPLATE_LANGUAGE || 'en_ZA').trim() || 'en_ZA',
    parameters: Array.isArray(templateParameters) && templateParameters.length
      ? templateParameters
      : defaultPostPurchaseTemplateParameters(order, promptType)
  };
}

function postPurchaseTemplateEnvKey(promptType) {
  const keyByType = {
    review: 'COMMERCE_REVIEW_TEMPLATE_NAME',
    reorder: 'COMMERCE_REORDER_TEMPLATE_NAME',
    follow_up: 'COMMERCE_FOLLOW_UP_TEMPLATE_NAME'
  };
  return keyByType[promptType] || 'COMMERCE_FOLLOW_UP_TEMPLATE_NAME';
}

function defaultPostPurchaseTemplateParameters(order, promptType) {
  const labelByType = {
    review: 'review',
    reorder: 'reorder',
    follow_up: 'support'
  };
  return [
    order.customerName || 'there',
    order.id,
    labelByType[promptType] || 'support'
  ];
}

function isPromptEligibleForOrder(order, promptType) {
  if (promptType === 'review') return ['completed', 'out_for_delivery'].includes(order.status);
  if (promptType === 'reorder') return ['paid', 'packed', 'out_for_delivery', 'completed'].includes(order.status);
  return ['paid', 'packed', 'out_for_delivery', 'completed'].includes(order.status);
}

function postPurchaseRunAt(promptType) {
  const delayByType = {
    review: Number(process.env.COMMERCE_REVIEW_PROMPT_DELAY_HOURS || 24) * 60 * 60 * 1000,
    reorder: Number(process.env.COMMERCE_REORDER_PROMPT_DELAY_DAYS || 21) * 24 * 60 * 60 * 1000,
    follow_up: Number(process.env.COMMERCE_FOLLOW_UP_PROMPT_DELAY_HOURS || 2) * 60 * 60 * 1000
  };
  return new Date(Date.now() + Math.max(0, delayByType[promptType] || 0));
}

function latestDate(current, candidate) {
  if (!candidate) return current;
  if (!current) return candidate;
  return new Date(candidate).getTime() > new Date(current).getTime() ? candidate : current;
}

function normalizeCustomerPhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function mapWhatsAppOrderStatus(status) {
  if (status === 'pending_payment' || status === 'new' || status === 'confirmed') return 'pending';
  if (status === 'paid' || status === 'packed') return 'processing';
  if (status === 'out_for_delivery') return 'partially_shipped';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled' || status === 'refunded') return 'canceled';
  return 'pending';
}

function orderStatusText(order) {
  const labels = {
    new: 'received',
    confirmed: 'confirmed',
    pending_payment: 'awaiting payment',
    paid: 'paid',
    packed: 'packed',
    out_for_delivery: 'out for delivery',
    completed: 'completed',
    cancelled: 'cancelled',
    refunded: 'refunded'
  };
  const tracking = order.trackingNumber
    ? ` Tracking: ${order.trackingNumber}${order.fulfilmentProvider ? ` via ${order.fulfilmentProvider}` : ''}.`
    : '';
  const link = order.trackingUrl ? ` Track here: ${order.trackingUrl}` : '';
  return `Order #${order.id} is ${labels[order.status] || order.status}. Total: R ${order.total}.${tracking}${link}`;
}

function abandonedCartText(order) {
  const saved = order.discountCode ? ` Your ${order.discountCode} discount is included.` : '';
  return `Hi ${order.customerName || 'there'}, your WhatsApp order #${order.id} is still waiting for payment. Total: R ${order.total}.${saved} You can complete checkout from this message.`;
}

function returnStatusText(order, request) {
  const labels = {
    requested: 'has been received',
    approved: 'has been approved',
    rejected: 'could not be approved',
    item_received: 'item has been received',
    refunded: 'refund has been completed',
    closed: 'has been closed'
  };
  const reference = request.refundReference ? ` Reference: ${request.refundReference}.` : '';
  return `Return for order #${order.id} ${labels[request.status] || `is ${request.status}`}. Amount: R ${request.amount}. Reason: ${request.reason}.${reference}`;
}

function summarizeByStatus(orders) {
  return orders.reduce((summary, order) => {
    summary[order.status] = (summary[order.status] || 0) + 1;
    return summary;
  }, {});
}

function cents(value) {
  return (Number(value || 0) / 100).toFixed(2);
}

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

module.exports = {
  buildCommerceMessagePayload,
  buildOrderDetailsPayload,
  buildOrderStatusPayload,
  applyCouponToOrder,
  applyCommerceAutomationRuleToReadyOrders,
  applyCommerceAutomationRulesForOrder,
  archiveProduct,
  createOrder,
  createOrderPaymentLink,
  createCoupon,
  createProduct,
  createProductCollection,
  createProductVariant,
  createReturnRequest,
  getCommerceAnalytics,
  getCommerceAutomationInsights,
  installCommerceAutomationTemplate,
  listCommerceAutomationRules,
  getCommerceCustomerSegments,
  getInventoryAlerts,
  getOrderById,
  getProductCollectionById,
  importProducts,
  listAbandonedCarts,
  listCoupons,
  listProductCollections,
  listOrders,
  listProducts,
  listProductVariants,
  listReturnRequests,
  linkOrderItemToProduct,
  previewCommerceAutomationRule,
  recordOrderFromMetaEvent,
  reconcileOrderPayment,
  sendAbandonedCartRecovery,
  sendOrderPaymentLink,
  sendOrderStatusMessage,
  sendPostPurchasePrompt,
  schedulePostPurchasePrompts,
  shareCatalog,
  shareProductCollection,
  submitCommerceAutomationTemplate,
  syncCommerceAutomationTemplates,
  updateCommerceAutomationRule,
  updateOrderFulfilment,
  updateProduct,
  updateReturnRequest,
  updateOrderStatus
};
