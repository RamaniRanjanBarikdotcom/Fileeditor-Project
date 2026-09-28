import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
import type { Browser, HTTPRequest, Page } from 'puppeteer';
import {
  UrlSecurityService,
  createSafeHttpAgent,
  createSafeHttpsAgent,
} from '@docconv/url-security';
import { PrismaService } from '../common/prisma.service';
import { CreateBlogProductCollectionDto, CreateBlogProductDto } from './blog-studio.dto';

let puppeteer: typeof import('puppeteer') | null = null;
try {
  puppeteer = require('puppeteer');
} catch {
  puppeteer = null;
}

type ScrapedProduct = {
  externalId?: string;
  title: string;
  description?: string;
  price?: string;
  currency?: string;
  imageUrl?: string;
  productUrl?: string;
  category?: string;
  brand?: string;
  fieldsJson?: Record<string, unknown>;
};

export type ProductScrapeConfig = {
  productCard?: string;
  title?: string;
  description?: string;
  price?: string;
  link?: string;
  image?: string;
  sku?: string;
};

type PlatformKey =
  | 'auto'
  | 'shopify'
  | 'woocommerce'
  | 'magento'
  | 'prestashop'
  | 'bigcommerce'
  | 'jtl'
  | 'react'
  | 'custom'
  | 'generic';

const PLATFORM_SELECTORS: Record<PlatformKey, Required<ProductScrapeConfig>> = {
  shopify: {
    productCard: '[data-product-id], .product-card, .grid-product, .product-item, [class*="product-card"]',
    title: '.product-card__title, .grid-product__title, [class*="product"] [class*="title"], h2, h3',
    description: '[class*="description"], [itemprop="description"]',
    price: '[class*="price"], [data-price]',
    link: 'a[href]',
    image: 'img',
    sku: '[data-sku], [itemprop="sku"]',
  },
  woocommerce: {
    productCard: 'li.product, .products .product, .wc-block-grid__product',
    title: '.woocommerce-loop-product__title, h2, h3',
    description: '.woocommerce-product-details__short-description, [itemprop="description"]',
    price: '.price, .amount',
    link: 'a[href]',
    image: 'img',
    sku: '.sku, [itemprop="sku"]',
  },
  magento: {
    productCard: '.product-item, .products-grid .item, [data-product-id]',
    title: '.product-item-name, .product-name, h2, h3',
    description: '.product-item-description, [itemprop="description"]',
    price: '.price, [data-price-amount], [itemprop="price"]',
    link: 'a.product-item-link, a[href]',
    image: '.product-image-photo, img',
    sku: '[data-product-sku], [itemprop="sku"]',
  },
  prestashop: {
    productCard: '.product-miniature, .product-container, [data-id-product]',
    title: '.product-title, .name, h2, h3',
    description: '.product-description, [itemprop="description"]',
    price: '.price, [itemprop="price"]',
    link: 'a.product-thumbnail, a[href]',
    image: 'img',
    sku: '[itemprop="sku"], [data-product-reference]',
  },
  bigcommerce: {
    productCard: '.card, .product, [data-product-id]',
    title: '.card-title, .product-title, h2, h3',
    description: '.card-text, [itemprop="description"]',
    price: '.price, [data-product-price], [itemprop="price"]',
    link: '.card-title a, a[href]',
    image: '.card-image, img',
    sku: '[data-product-sku], [itemprop="sku"]',
  },
  react: {
    productCard: '[data-product], [data-product-id], [class*="product-card"], [class*="ProductCard"], [class*="product_item"]',
    title: 'h2, h3, [class*="title"], [data-title]',
    description: '[class*="description"], [data-description]',
    price: '[class*="price"], [data-price]',
    link: 'a[href]',
    image: 'img',
    sku: '[data-sku], [itemprop="sku"]',
  },
  generic: {
    productCard: '[itemtype*="schema.org/Product"], [data-product], [data-product-id], .product-card, .product-item, article[class*="product"]',
    title: '[itemprop="name"], .product-title, .product-name, h2, h3, [class*="title"]',
    description: '[itemprop="description"], .product-description, [class*="description"]',
    price: '[itemprop="price"], [class*="price"], [data-price]',
    link: 'a[href]',
    image: 'img',
    sku: '[itemprop="sku"], [data-sku]',
  },
  jtl: {
    productCard:
      '.product, .product-wrapper article, .product-item, .product-wrapper, .col-product, .artbox, .thumbnail, [itemtype*="Product"]',
    title:
      '.product-title, .product-name, .arttitle, h2[itemprop="name"], h3, [itemprop="name"]',
    description: '.product-description, .shortdesc, [itemprop="description"]',
    price:
      '.price, .product-price, .price-large, .pprice, .price [itemprop="price"], [itemprop="price"], [data-price]',
    link: 'a.product-link, a[itemprop="url"], a[href]',
    image:
      'img.product-image, .product-img, img.artimg, img[data-src], img.lazyload, img[itemprop="image"], img',
    sku: '.product-sku, .sku, [itemprop="sku"], [data-sku]',
  },
  auto: {} as Required<ProductScrapeConfig>,
  custom: {} as Required<ProductScrapeConfig>,
};

PLATFORM_SELECTORS.auto = PLATFORM_SELECTORS.generic;
PLATFORM_SELECTORS.custom = PLATFORM_SELECTORS.generic;

@Injectable()
export class BlogProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly urlSecurity: UrlSecurityService,
  ) {}

  async listCollections(organizationId: string) {
    return this.prisma.blogProductCollection.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async getCollection(organizationId: string, collectionId: string) {
    const collection = await this.prisma.blogProductCollection.findUnique({ where: { id: collectionId } });
    if (!collection || collection.organizationId !== organizationId) {
      throw new NotFoundException('Product collection not found');
    }
    return collection;
  }

  async createCollection(organizationId: string, dto: CreateBlogProductCollectionDto) {
    if (dto.sourceUrl) await this.urlSecurity.validateUrl(dto.sourceUrl);
    const sourceType = normalizeSourceType(dto.sourceType);
    const scrapeConfig = sanitizeScrapeConfig(dto.scrapeConfig);
    return this.prisma.blogProductCollection.create({
      data: {
        organizationId,
        name: dto.name,
        sourceUrl: dto.sourceUrl,
        sourceType,
        scrapeConfigJson: scrapeConfig as Prisma.InputJsonValue,
      },
    });
  }

  async deleteCollection(organizationId: string, collectionId: string) {
    await this.getCollection(organizationId, collectionId);
    await this.prisma.blogProductCollection.delete({ where: { id: collectionId } });
    return { deleted: true };
  }

  async listProducts(organizationId: string, collectionId: string) {
    await this.getCollection(organizationId, collectionId);
    return this.prisma.blogProduct.findMany({
      where: { collectionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addProduct(organizationId: string, collectionId: string, dto: CreateBlogProductDto) {
    await this.getCollection(organizationId, collectionId);
    if (dto.productUrl) await this.urlSecurity.validateUrl(dto.productUrl);
    if (dto.imageUrl) await this.urlSecurity.validateUrl(dto.imageUrl);
    return this.prisma.blogProduct.create({
      data: {
        collectionId,
        title: dto.title,
        externalId: dto.externalId,
        description: dto.description,
        price: dto.price,
        currency: dto.currency,
        imageUrl: dto.imageUrl,
        productUrl: dto.productUrl,
        category: dto.category,
        brand: dto.brand,
        fieldsJson: (dto.fieldsJson || {}) as Prisma.InputJsonValue,
      },
    });
  }

  async deleteProduct(organizationId: string, collectionId: string, productId: string) {
    await this.getCollection(organizationId, collectionId);
    const product = await this.prisma.blogProduct.findUnique({ where: { id: productId } });
    if (!product || product.collectionId !== collectionId) {
      throw new NotFoundException('Product not found in this collection');
    }
    await this.prisma.blogProduct.delete({ where: { id: productId } });
    return { deleted: true };
  }

  async scrapeProductsFromUrl(organizationId: string, collectionId: string, requestedUrl?: string) {
    const collection = await this.getCollection(organizationId, collectionId);
    const url = requestedUrl || collection.sourceUrl;
    if (!url) throw new BadRequestException('A source URL is required.');
    await this.urlSecurity.validateUrl(url);

    let products: ScrapedProduct[] = [];
    const requestedType = normalizeSourceType(collection.sourceType);
    const scrapeConfig = sanitizeScrapeConfig(collection.scrapeConfigJson);
    let detectedType: PlatformKey = requestedType;
    
    // First try standard APIs
    if (requestedType === 'shopify') {
      try {
        products = await this.fetchShopify(url);
    } catch {
        products = [];
      }
    } else if (requestedType === 'woocommerce') {
      try {
        products = await this.fetchWooCommerce(url);
      } catch {
        products = [];
      }
    } else {
      try {
        const structured = await this.fetchJsonLd(url);
        products = structured.products;
        detectedType = requestedType === 'auto' || requestedType === 'generic'
          ? structured.detectedType
          : requestedType;
      } catch {
        products = [];
      }
    }

    // Fallback to Puppeteer / Cheerio scraping if JSON-LD or API failed to find products
    if (!products || products.length === 0) {
      const rendered = await this.scrapeWithPuppeteer(url, detectedType, scrapeConfig);
      products = rendered.products;
      detectedType = rendered.detectedType;
    }

    if (!products.length) {
      throw new BadGatewayException(
        'No public products were found. Verify the source type and that the storefront exposes product data.',
      );
    }

    products = dedupeProducts(products);
    let inserted = 0;
    let updated = 0;
    const safeOrigins = new Map<string, boolean>();
    for (const product of products.slice(0, 100)) {
      if (!product.title || !product.title.trim()) continue;
      const externalId = product.externalId || product.productUrl || slugify(product.title);
      const productUrl = await this.safeScrapedUrl(product.productUrl, safeOrigins);
      const imageUrl = await this.safeScrapedUrl(product.imageUrl, safeOrigins);
      const data = {
        title: product.title.slice(0, 500),
        description: product.description?.slice(0, 20_000) || '',
        price: product.price?.slice(0, 100),
        currency: product.currency?.slice(0, 20),
        imageUrl: imageUrl?.slice(0, 2_000),
        productUrl: productUrl?.slice(0, 2_000),
        category: product.category?.slice(0, 200),
        brand: product.brand?.slice(0, 200),
        fieldsJson: (product.fieldsJson || {}) as Prisma.InputJsonValue,
        lastScrapedAt: new Date(),
      };
      const existing = await this.prisma.blogProduct.findUnique({
        where: { collectionId_externalId: { collectionId, externalId } },
      });
      if (existing) {
        await this.prisma.blogProduct.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await this.prisma.blogProduct.create({ data: { collectionId, externalId, ...data } });
        inserted += 1;
      }
    }
    return {
      scrapedCount: inserted + updated,
      inserted,
      updated,
      detectedPlatform: detectedType,
      usedCustomSelectors: Object.keys(scrapeConfig).length > 0,
    };
  }

  private async scrapeWithPuppeteer(
    url: string,
    sourceType: PlatformKey,
    customConfig: ProductScrapeConfig,
  ): Promise<{ products: ScrapedProduct[]; detectedType: PlatformKey }> {
    let html = '';
    let browser: Browser | undefined;
    let page: Page | undefined;
    
    if (puppeteer) {
      try {
        browser = await puppeteer.launch({ 
          headless: true, 
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-background-networking',
          ],
        });
        page = await browser.newPage();
        await this.protectBrowserPage(page);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppToolkitLab/1.0');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        await autoScroll(page);
        html = await page.content();
      } catch (error) {
        console.warn('Puppeteer failed, falling back to axios:', error);
      }
    }
    
    // If puppeteer failed or is not installed, fallback to axios
    if (!html) {
      try {
        html = await this.getText(url);
      } catch {
        if (browser) await browser.close();
        return { products: [], detectedType: sourceType };
      }
    }

    const detectedType = sourceType === 'auto' || sourceType === 'generic'
      ? detectStorePlatform(html)
      : sourceType;
    const selectors = mergeSelectors(detectedType, customConfig);
    let products = extractStoreProductsFromHtml(html, url, detectedType, customConfig);

    // A custom/SPA home or category page may expose only product links after
    // hydration. Follow a small, same-origin set and parse each detail page.
    if (products.length < 2) {
      const links = discoverProductLinks(html, url, selectors).slice(0, 12);
      for (const productUrl of links) {
        try {
          let detailHtml: string;
          if (page) {
            await page.goto(productUrl, { waitUntil: 'networkidle2', timeout: 15_000 });
            await autoScroll(page);
            detailHtml = await page.content();
          } else {
            detailHtml = await this.getText(productUrl);
          }
          products.push(...extractProductDetail(detailHtml, productUrl, selectors));
        } catch {
          // One protected, removed or malformed product page must not discard
          // successfully extracted products from the rest of the storefront.
        }
      }
    }

    if (browser) await browser.close();
    return { products: dedupeProducts(products), detectedType };
  }

  private async protectBrowserPage(page: Page) {
    await page.setRequestInterception(true);
    page.on('request', (request: HTTPRequest) => {
      const requestUrl = request.url();
      const resourceType = request.resourceType();
      if (['image', 'media', 'font'].includes(resourceType)) {
        void request.abort();
        return;
      }
      if (!requestUrl.startsWith('http://') && !requestUrl.startsWith('https://')) {
        void request.abort();
        return;
      }
      void this.urlSecurity
        .validateUrl(requestUrl)
        .then(() => request.continue())
        .catch(() => request.abort())
        .catch(() => undefined);
    });
  }

  private async safeScrapedUrl(
    candidate: string | undefined,
    originCache: Map<string, boolean>,
  ) {
    if (!candidate) return undefined;
    try {
      const parsed = new URL(candidate);
      const cached = originCache.get(parsed.origin);
      if (cached === false) return undefined;
      if (cached === undefined) {
        try {
          await this.urlSecurity.validateUrl(parsed.origin);
          originCache.set(parsed.origin, true);
        } catch {
          originCache.set(parsed.origin, false);
          return undefined;
        }
      }
      return parsed.toString();
    } catch {
      return undefined;
    }
  }

  private async fetchShopify(sourceUrl: string): Promise<ScrapedProduct[]> {
    const root = new URL(sourceUrl);
    const endpoint = `${root.origin}/products.json?limit=100`;
    const data = await this.getJson(endpoint);
    return (Array.isArray(data.products) ? data.products : []).map((product: any) => ({
      externalId: String(product.id || product.handle),
      title: String(product.title || ''),
      description: stripHtml(String(product.body_html || '')),
      price: String(product.variants?.[0]?.price || ''),
      currency: String(data.currency || ''),
      imageUrl: product.image?.src,
      productUrl: `${root.origin}/products/${product.handle}`,
      category: product.product_type,
      brand: product.vendor,
      fieldsJson: { handle: product.handle, tags: product.tags },
    }));
  }

  private async fetchWooCommerce(sourceUrl: string): Promise<ScrapedProduct[]> {
    const root = new URL(sourceUrl);
    const endpoint = `${root.origin}/wp-json/wc/store/v1/products?per_page=100`;
    const data = await this.getJson(endpoint);
    return (Array.isArray(data) ? data : []).map((product: any) => ({
      externalId: String(product.id),
      title: String(product.name || ''),
      description: stripHtml(String(product.description || product.short_description || '')),
      price: String(product.prices?.price || ''),
      currency: product.prices?.currency_code,
      imageUrl: product.images?.[0]?.src,
      productUrl: product.permalink,
      category: product.categories?.[0]?.name,
      fieldsJson: { sku: product.sku },
    }));
  }

  private async fetchJsonLd(
    sourceUrl: string,
  ): Promise<{ products: ScrapedProduct[]; detectedType: PlatformKey }> {
    const html = await this.getText(sourceUrl);
    return {
      products: extractJsonLdProducts(html, sourceUrl),
      detectedType: detectStorePlatform(html),
    };
  }

  private async getJson(url: string) {
    const response = await this.request(url, 'json');
    return response.data;
  }

  private async getText(url: string) {
    const response = await this.request(url, 'text');
    return String(response.data);
  }

  private async request(url: string, responseType: 'json' | 'text') {
    let currentUrl = url;
    for (let redirect = 0; redirect <= 3; redirect += 1) {
      await this.urlSecurity.validateUrl(currentUrl);
      const response = await axios.get(currentUrl, {
        responseType,
        timeout: 20_000,
        maxRedirects: 0,
        maxContentLength: 3 * 1024 * 1024,
        validateStatus: () => true,
        httpAgent: createSafeHttpAgent(),
        httpsAgent: createSafeHttpsAgent(),
        headers: {
          Accept: responseType === 'json' ? 'application/json' : 'text/html',
          'User-Agent': 'Mozilla/5.0 (compatible; AppToolkitLab Product Context/1.0)',
        },
      });
      if (response.status >= 300 && response.status < 400 && response.headers.location) {
        currentUrl = new URL(response.headers.location, currentUrl).toString();
        continue;
      }
      if (response.status < 200 || response.status >= 300) {
        throw new BadGatewayException(`Storefront returned HTTP ${response.status}.`);
      }
      return response;
    }
    throw new BadGatewayException('Storefront redirected too many times.');
  }
}

export function normalizeSourceType(value?: string | null): PlatformKey {
  const normalized = String(value || 'auto').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const aliases: Record<string, PlatformKey> = {
    auto: 'auto',
    autodetect: 'auto',
    generic: 'generic',
    shopify: 'shopify',
    woocommerce: 'woocommerce',
    woo: 'woocommerce',
    magento: 'magento',
    adobecommerce: 'magento',
    prestashop: 'prestashop',
    bigcommerce: 'bigcommerce',
    jtl: 'jtl',
    jtlshop: 'jtl',
    react: 'react',
    reactnextjs: 'react',
    nextjs: 'react',
    custom: 'custom',
    customcoded: 'custom',
  };
  return aliases[normalized] || 'auto';
}

export function sanitizeScrapeConfig(value: unknown): ProductScrapeConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const allowed: Array<keyof ProductScrapeConfig> = [
    'productCard',
    'title',
    'description',
    'price',
    'link',
    'image',
    'sku',
  ];
  const sanitized: ProductScrapeConfig = {};
  const $ = cheerio.load('<main><article></article></main>');
  for (const key of allowed) {
    const selector = (value as Record<string, unknown>)[key];
    if (typeof selector !== 'string' || !selector.trim()) continue;
    const trimmed = selector.trim();
    if (trimmed.length > 500) {
      throw new BadRequestException(`${key} selector is too long.`);
    }
    try {
      $(trimmed);
    } catch {
      throw new BadRequestException(`${key} contains an invalid CSS selector.`);
    }
    sanitized[key] = trimmed;
  }
  return sanitized;
}

export function detectStorePlatform(html: string): PlatformKey {
  const source = html.toLowerCase();
  if (source.includes('cdn.shopify.com') || source.includes('shopify.theme')) return 'shopify';
  if (source.includes('woocommerce') || source.includes('wc-block-')) return 'woocommerce';
  if (source.includes('magento_') || source.includes('mage-cache-storage')) return 'magento';
  if (source.includes('prestashop') || source.includes('data-id-product')) return 'prestashop';
  if (source.includes('bigcommerce') || source.includes('stencil-utils')) return 'bigcommerce';
  if (
    source.includes('jtl-shop') ||
    source.includes('jtl_token') ||
    source.includes('class="artbox') ||
    source.includes('class="opc-')
  ) return 'jtl';
  if (
    source.includes('__next_data__') ||
    source.includes('data-reactroot') ||
    source.includes('/_next/static/') ||
    source.includes('id="root"')
  ) return 'react';
  return 'generic';
}

function mergeSelectors(
  sourceType: PlatformKey,
  custom: ProductScrapeConfig,
): Required<ProductScrapeConfig> {
  const base = PLATFORM_SELECTORS[sourceType] || PLATFORM_SELECTORS.generic;
  return { ...PLATFORM_SELECTORS.generic, ...base, ...custom };
}

export function extractJsonLdProducts(html: string, sourceUrl: string): ScrapedProduct[] {
  const blocks = [
    ...html.matchAll(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  const found: any[] = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse((block[1] || 'null').trim());
      collectProducts(parsed, found);
    } catch {
      // Third-party stores frequently include one malformed block. Continue
      // through the remaining structured data instead of failing the scrape.
    }
  }
  return found.map((product) => {
    const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers || {};
    const brand = typeof product.brand === 'string' ? product.brand : product.brand?.name;
    const image = Array.isArray(product.image) ? product.image[0] : product.image;
    return {
      externalId: String(product.sku || product.productID || product.url || product.name || ''),
      title: String(product.name || '').trim(),
      description: stripHtml(String(product.description || '')),
      price: offer.price !== undefined ? String(offer.price) : undefined,
      currency: offer.priceCurrency,
      imageUrl: resolveHttpUrl(typeof image === 'string' ? image : image?.url, sourceUrl),
      productUrl: resolveHttpUrl(product.url, sourceUrl) || sourceUrl,
      category: typeof product.category === 'string' ? product.category : undefined,
      brand,
      fieldsJson: { sku: product.sku, availability: offer.availability },
    };
  }).filter((product) => product.title);
}

export function extractProductsFromHtml(
  html: string,
  sourceUrl: string,
  selectors: Required<ProductScrapeConfig>,
): ScrapedProduct[] {
  const $ = cheerio.load(html);
  const products: ScrapedProduct[] = [];
  $(selectors.productCard).each((_index, element) => {
    const card = $(element);
    const title = card.find(selectors.title).first().text().replace(/\s+/g, ' ').trim();
    if (!title) return;
    const priceNode = card.find(selectors.price).first();
    const priceText = priceNode.attr('content') || priceNode.attr('data-price-amount') || priceNode.attr('data-price') || priceNode.text();
    const link = card.find(selectors.link).first().attr('href');
    const image = card.find(selectors.image).first();
    const imageValue =
      image.attr('src') ||
      image.attr('data-src') ||
      image.attr('data-lazy-src') ||
      firstSrcsetUrl(image.attr('srcset'));
    const skuNode = card.find(selectors.sku).first();
    const externalId = skuNode.attr('content') || skuNode.attr('data-sku') || skuNode.text().trim();
    const { amount, currency } = parsePrice(String(priceText || ''));
    products.push({
      externalId: externalId || undefined,
      title,
      description: card.find(selectors.description).first().text().replace(/\s+/g, ' ').trim() || undefined,
      price: amount === null ? undefined : String(amount),
      currency: currency || undefined,
      productUrl: resolveHttpUrl(link, sourceUrl),
      imageUrl: resolveHttpUrl(imageValue, sourceUrl),
    });
  });
  return products;
}

export function extractStoreProductsFromHtml(
  html: string,
  sourceUrl: string,
  sourceType: string = 'auto',
  config: unknown = {},
) {
  const normalizedType = normalizeSourceType(sourceType);
  const detectedType = normalizedType === 'auto' || normalizedType === 'generic'
    ? detectStorePlatform(html)
    : normalizedType;
  const selectors = mergeSelectors(detectedType, sanitizeScrapeConfig(config));
  return dedupeProducts([
    ...extractJsonLdProducts(html, sourceUrl),
    ...extractProductsFromHtml(html, sourceUrl, selectors),
  ]);
}

function extractProductDetail(
  html: string,
  sourceUrl: string,
  selectors: Required<ProductScrapeConfig>,
): ScrapedProduct[] {
  const structured = extractJsonLdProducts(html, sourceUrl);
  if (structured.length) return structured;
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('[itemprop="name"]').first().text() ||
    $('h1').first().text() ||
    $(selectors.title).first().text();
  const priceNode = $('[itemprop="price"], meta[property="product:price:amount"], [data-price], [class*="price"]').first();
  const priceText = priceNode.attr('content') || priceNode.attr('data-price') || priceNode.text();
  const { amount, currency: parsedCurrency } = parsePrice(String(priceText || ''));
  const currency =
    $('meta[property="product:price:currency"]').attr('content') ||
    $('[itemprop="priceCurrency"]').attr('content') ||
    parsedCurrency;
  if (!title.trim() || amount === null) return [];
  const skuNode = $('[itemprop="sku"], [data-sku], .sku').first();
  return [{
    externalId: skuNode.attr('content') || skuNode.attr('data-sku') || skuNode.text().trim() || sourceUrl,
    title: title.replace(/\s+/g, ' ').trim(),
    description: stripHtml(
      $('meta[name="description"]').attr('content') ||
      $('[itemprop="description"]').first().text() ||
      $(selectors.description).first().text() ||
      '',
    ),
    price: String(amount),
    currency: currency || undefined,
    imageUrl: resolveHttpUrl(
      $('meta[property="og:image"]').attr('content') || $(selectors.image).first().attr('src'),
      sourceUrl,
    ),
    productUrl: sourceUrl,
  }];
}

function discoverProductLinks(
  html: string,
  sourceUrl: string,
  selectors: Required<ProductScrapeConfig>,
) {
  const $ = cheerio.load(html);
  const origin = new URL(sourceUrl).origin;
  const found = new Set<string>();
  const add = (candidate?: string) => {
    const resolved = resolveHttpUrl(candidate, sourceUrl);
    if (!resolved) return;
    const parsed = new URL(resolved);
    if (parsed.origin !== origin || parsed.toString() === sourceUrl) return;
    parsed.hash = '';
    found.add(parsed.toString());
  };
  $(selectors.productCard).find(selectors.link).each((_index, anchor) => add($(anchor).attr('href')));
  $('a[href]').each((_index, anchor) => {
    const href = $(anchor).attr('href') || '';
    const path = href.toLowerCase();
    const likelyPath = /\/(products?|produkt|artikel|item|shop|p)\//.test(path) || /[-?&](product|artikel|sku)[=_-]/.test(path);
    const pricedAncestor = $(anchor).closest('article, li, div').find(selectors.price).length > 0;
    if (likelyPath || pricedAncestor) add(href);
  });
  return [...found];
}

export function dedupeProducts(products: ScrapedProduct[]) {
  const unique = new Map<string, ScrapedProduct>();
  for (const product of products) {
    if (!product.title?.trim()) continue;
    const key = String(
      product.externalId || product.productUrl || slugify(product.title),
    ).trim().toLowerCase();
    const existing = unique.get(key);
    unique.set(key, existing ? mergeProduct(existing, product) : product);
  }
  return [...unique.values()];
}

function mergeProduct(first: ScrapedProduct, second: ScrapedProduct): ScrapedProduct {
  const preferLonger = (left?: string, right?: string) =>
    (right?.length || 0) > (left?.length || 0) ? right : left;
  return {
    ...first,
    ...second,
    title: preferLonger(first.title, second.title) || first.title,
    description: preferLonger(first.description, second.description),
    price: second.price || first.price,
    currency: second.currency || first.currency,
    imageUrl: second.imageUrl || first.imageUrl,
    productUrl: second.productUrl || first.productUrl,
    fieldsJson: { ...(first.fieldsJson || {}), ...(second.fieldsJson || {}) },
  };
}

function resolveHttpUrl(value: unknown, baseUrl: string) {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const resolved = new URL(value.trim(), baseUrl);
    if (!['http:', 'https:'].includes(resolved.protocol)) return undefined;
    return resolved.toString();
  } catch {
    return undefined;
  }
}

function firstSrcsetUrl(value?: string) {
  return value?.split(',')[0]?.trim().split(/\s+/)[0];
}

async function autoScroll(page: Page) {
  await page.evaluate(async () => {
    const browserGlobal = globalThis as any;
    for (let step = 0; step < 4; step += 1) {
      browserGlobal.scrollTo(0, browserGlobal.document.body.scrollHeight);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    browserGlobal.scrollTo(0, 0);
  });
}

function parsePrice(text: string) {
  if (!text) return { amount: null, currency: '' };
  const trimmed = text.trim();
  let currency = '';
  if (trimmed.includes('€')) currency = '€';
  if (trimmed.includes('£')) currency = '£';
  if (trimmed.includes('CHF')) currency = 'CHF';
  if (!currency && trimmed.includes('$')) currency = '$';

  const match = trimmed.match(/[\d.,]+/);
  if (!match) return { amount: null, currency };
  let numberStr = match[0];
  const lastComma = numberStr.lastIndexOf(',');
  const lastDot = numberStr.lastIndexOf('.');
  if (lastComma > lastDot) {
    numberStr = numberStr.replace(/\./g, '').replace(',', '.');
  } else {
    numberStr = numberStr.replace(/,/g, '');
  }
  const amount = parseFloat(numberStr);
  if (Number.isNaN(amount)) return { amount: null, currency };
  return { amount, currency };
}

function collectProducts(value: any, output: any[]) {
  if (!value) return;
  if (Array.isArray(value)) return value.forEach((item) => collectProducts(item, output));
  if (typeof value !== 'object') return;
  const types = Array.isArray(value['@type']) ? value['@type'] : [value['@type']];
  if (types.includes('Product')) output.push(value);
  if (value['@graph']) collectProducts(value['@graph'], output);
  if (value.itemListElement) collectProducts(value.itemListElement, output);
  if (value.item) collectProducts(value.item, output);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 150);
}
