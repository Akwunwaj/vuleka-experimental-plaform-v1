const business = {
  id: 1,
  name: 'ChatClan Demo Store',
  plan: 'Growth',
  contactsLimit: 10000,
  contactsUsed: 4312,
  billingRenewal: '2026-07-01'
};

const metrics = [
  { label: 'Messages sent', value: '48.2k', change: '+18.4%' },
  { label: 'Delivery rate', value: '97.8%', change: '+2.1%' },
  { label: 'Replies', value: '6,921', change: '+11.6%' },
  { label: 'Revenue attributed', value: 'R 86k', change: '+24.3%' }
];

const campaigns = [
  { id: 1, name: 'Winter Sale Broadcast', status: 'Sent', audience: '2,341 contacts', category: 'MARKETING', sent: 2341, delivered: 2298, readRate: '82%', revenue: 'R 42,800' },
  { id: 2, name: 'Abandoned Cart Recovery', status: 'Running', audience: '412 contacts', category: 'UTILITY', sent: 412, delivered: 401, readRate: '88%', revenue: 'R 14,220' },
  { id: 3, name: 'VIP Early Access', status: 'Draft', audience: '156 contacts', category: 'MARKETING', sent: 0, delivered: 0, readRate: '-', revenue: '-' }
];

const contacts = [
  { id: 1, name: 'Nomsa Mkhize', phone: '+27 82 123 4567', segment: 'VIP', optedIn: true, lastSeen: 'Today' },
  { id: 2, name: 'Thabo Nkosi', phone: '+27 71 234 5678', segment: 'Recent buyer', optedIn: true, lastSeen: 'Yesterday' },
  { id: 3, name: 'Zanele Dlamini', phone: '+27 83 345 6789', segment: 'Fashion lovers', optedIn: true, lastSeen: '2 days ago' },
  { id: 4, name: 'Lerato Phiri', phone: '+27 76 456 7890', segment: 'Inactive 30d', optedIn: false, lastSeen: '31 days ago' }
];

const inbox = [
  { id: 1, name: 'Nomsa Mkhize', avatar: 'NM', preview: 'Can I collect in store today?', unread: 2 },
  { id: 2, name: 'Thabo Nkosi', avatar: 'TN', preview: 'Please send me the size chart.', unread: 0 },
  { id: 3, name: 'Zanele Dlamini', avatar: 'ZD', preview: 'I used the discount code.', unread: 1 }
];

const templates = [
  { id: 1, name: 'Flash Sale', category: 'Marketing', status: 'Approved', body: 'Hi {{1}}, our {{2}} sale is live. Use code {{3}} before midnight.' },
  { id: 2, name: 'Order Shipped', category: 'Utility', status: 'Approved', body: 'Your order {{1}} is on the way. Track it here: {{2}}' },
  { id: 3, name: 'Appointment Reminder', category: 'Utility', status: 'Approved', body: 'Reminder: your booking is confirmed for {{1}} at {{2}}.' },
  { id: 4, name: 'Winback Offer', category: 'Marketing', status: 'Approved', body: 'We miss you, {{1}}. Here is {{2}} off your next order.' }
];

const plans = [
  { name: 'Starter', price: 299, contacts: '2,000', campaigns: '5/month', bestFor: 'New small businesses' },
  { name: 'Growth', price: 799, contacts: '10,000', campaigns: 'Unlimited', bestFor: 'Growing stores and service teams' },
  { name: 'Pro', price: 1999, contacts: 'Unlimited', campaigns: 'Unlimited', bestFor: 'Agencies and multi-branch teams' }
];

const providers = [
  { name: 'PayFast', strength: 'Best SME subscription fit', fees: '3.5% + R2 cards, 2% EFT', status: 'Connected' },
  { name: 'Peach Payments', strength: 'Enterprise tokenization', fees: 'Custom volume pricing', status: 'Available' },
  { name: 'Ozow', strength: 'Instant EFT', fees: '1.5% flat', status: 'Available' },
  { name: 'Yoco', strength: 'Payment links and POS ecosystem', fees: '2.95%', status: 'Available' }
];

const products = [
  {
    id: 1,
    businessId: 1,
    name: 'Winter Knit Dress',
    sku: 'winter-knit-dress',
    description: 'Warm midi dress available in olive and black.',
    priceCents: 69900,
    currency: 'ZAR',
    imageUrl: '',
    inventoryCount: 18,
    status: 'active',
    metaCatalogId: 'demo_catalog_za',
    metaProductRetailerId: 'winter-knit-dress',
    paymentLinkUrl: 'https://payfast.example/checkout/winter-knit-dress'
  },
  {
    id: 2,
    businessId: 1,
    name: 'Leather Crossbody Bag',
    sku: 'leather-crossbody-bag',
    description: 'Compact everyday bag with adjustable strap.',
    priceCents: 54900,
    currency: 'ZAR',
    imageUrl: '',
    inventoryCount: 11,
    status: 'active',
    metaCatalogId: 'demo_catalog_za',
    metaProductRetailerId: 'leather-crossbody-bag',
    paymentLinkUrl: 'https://payfast.example/checkout/leather-crossbody-bag'
  }
];

const orders = [
  {
    id: 1,
    businessId: 1,
    customerName: 'Nomsa Mkhize',
    customerPhone: '+27 82 123 4567',
    status: 'pending_payment',
    source: 'whatsapp_catalog',
    currency: 'ZAR',
    totalCents: 69900,
    itemCount: 1,
    paymentProvider: 'payment_link',
    paymentReference: 'wa_order_demo_1',
    paymentLinkUrl: 'https://payfast.example/checkout/order-demo-1',
    createdAt: '2026-06-28T09:30:00.000Z'
  }
];

module.exports = { business, metrics, campaigns, contacts, inbox, templates, plans, providers, products, orders };
