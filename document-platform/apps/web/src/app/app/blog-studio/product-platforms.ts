export const PRODUCT_PLATFORMS = [
  { id: 'auto', label: 'Auto-detect / any website' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'woocommerce', label: 'WooCommerce' },
  { id: 'magento', label: 'Magento / Adobe Commerce' },
  { id: 'prestashop', label: 'PrestaShop' },
  { id: 'bigcommerce', label: 'BigCommerce' },
  { id: 'jtl', label: 'JTL-Shop' },
  { id: 'react', label: 'React / Next.js / JavaScript SPA' },
  { id: 'custom', label: 'Custom-coded website' },
] as const;

export const CUSTOM_SELECTOR_FIELDS = [
  { key: 'productCard', label: 'Product card', placeholder: '.product-card' },
  { key: 'title', label: 'Product title', placeholder: '.product-title, h2' },
  { key: 'price', label: 'Price', placeholder: '.price, [data-price]' },
  { key: 'link', label: 'Product link', placeholder: 'a[href]' },
  { key: 'image', label: 'Image', placeholder: 'img' },
  { key: 'description', label: 'Description', placeholder: '.description' },
  { key: 'sku', label: 'SKU / product ID', placeholder: '[data-sku], .sku' },
] as const;

export type CustomSelectorKey = (typeof CUSTOM_SELECTOR_FIELDS)[number]['key'];
