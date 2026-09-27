import { BadGatewayException, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import axios from 'axios';
import * as cheerio from 'cheerio';
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

const PLATFORM_SELECTORS = {
  shopify: {
    productCard: '[class*="product"]',
    title: '[class*="product"] [class*="title"], [class*="product"] h3, [class*="product"] h2',
    price: '[class*="price"], [data-price]',
    link: 'a[href]',
    image: 'img',
  },
  woocommerce: {
    productCard: '.product',
    title: '.woocommerce-loop-product__title, h2, h3',
    price: '.price, .amount',
    link: 'a[href]',
    image: 'img',
  },
  react: {
    productCard: '[data-product], [class*="product"], [class*="item"]',
    title: 'h2, h3, [class*="title"], [data-title]',
    price: '[class*="price"], [data-price]',
    link: 'a[href]',
    image: 'img',
  },
  generic: {
    productCard: '[class*="product"], [class*="item"], [data-product]',
    title: 'h2, h3, .title, .product-title',
    price: '[class*="price"], [data-price]',
    link: 'a[href]',
    image: 'img',
  },
  jtl: {
    productCard:
      '.product, .product-wrapper article, .product-item, .product-wrapper, .col-product, .artbox, .thumbnail, [itemtype*="Product"]',
    title:
      '.product-title, .product-name, .arttitle, h2[itemprop="name"], h3, [itemprop="name"]',
    price:
      '.price, .product-price, .price-large, .pprice, .price [itemprop="price"], [itemprop="price"], [data-price]',
    link: 'a.product-link, a[itemprop="url"], a[href]',
    image:
      'img.product-image, .product-img, img.artimg, img[data-src], img.lazyload, img[itemprop="image"], img',
  },
};

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
    return this.prisma.blogProductCollection.create({
      data: {
        organizationId,
        name: dto.name,
        sourceUrl: dto.sourceUrl,
        sourceType: dto.sourceType?.toLowerCase(),
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
    const sourceType = (collection.sourceType || 'generic').toLowerCase() as keyof typeof PLATFORM_SELECTORS;
    
    // First try standard APIs
    if (sourceType === 'shopify') {
      try {
        products = await this.fetchShopify(url);
    } catch {
        products = [];
      }
    } else if (sourceType === 'woocommerce') {
      try {
        products = await this.fetchWooCommerce(url);
      } catch {
        products = [];
      }
    } else {
      try {
        products = await this.fetchJsonLd(url);
      } catch {
        products = [];
      }
    }

    // Fallback to Puppeteer / Cheerio scraping if JSON-LD or API failed to find products
    if (!products || products.length === 0) {
      products = await this.scrapeWithPuppeteer(url, sourceType);
    }

    if (!products.length) {
      throw new BadGatewayException(
        'No public products were found. Verify the source type and that the storefront exposes product data.',
      );
    }

    let inserted = 0;
    let updated = 0;
    for (const product of products.slice(0, 100)) {
      if (!product.title || !product.title.trim()) continue;
      const externalId = product.externalId || product.productUrl || slugify(product.title);
      const data = {
        title: product.title.slice(0, 500),
        description: product.description?.slice(0, 20_000) || '',
        price: product.price?.slice(0, 100),
        currency: product.currency?.slice(0, 20),
        imageUrl: product.imageUrl?.slice(0, 2_000),
        productUrl: product.productUrl?.slice(0, 2_000),
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
    return { scrapedCount: inserted + updated, inserted, updated };
  }

  private async scrapeWithPuppeteer(url: string, sourceType: keyof typeof PLATFORM_SELECTORS): Promise<ScrapedProduct[]> {
    let html = '';
    
    if (puppeteer) {
      let browser;
      try {
        browser = await puppeteer.launch({ 
          headless: true, 
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] 
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppToolkitLab/1.0');
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        html = await page.content();
      } catch (error) {
        console.warn('Puppeteer failed, falling back to axios:', error);
      } finally {
        if (browser) await browser.close();
      }
    }
    
    // If puppeteer failed or is not installed, fallback to axios
    if (!html) {
      try {
        html = await this.getText(url);
      } catch {
        return [];
      }
    }

    const $ = cheerio.load(html);
    const selectors = PLATFORM_SELECTORS[sourceType] || PLATFORM_SELECTORS.generic;
    const products: ScrapedProduct[] = [];
    const baseUrl = new URL(url).origin;

    $(selectors.productCard).each((i, el) => {
      const $el = $(el);
      const title = $el.find(selectors.title).first().text().trim();
      const priceText = $el.find(selectors.price).first().text().trim();
      let productUrl = $el.find(selectors.link).first().attr('href');
      let imageUrl = $el.find(selectors.image).first().attr('src') || $el.find(selectors.image).first().attr('data-src');

      if (!title) return;

      if (productUrl && !productUrl.startsWith('http')) {
        productUrl = productUrl.startsWith('/') ? baseUrl + productUrl : baseUrl + '/' + productUrl;
      }
      if (imageUrl && !imageUrl.startsWith('http')) {
        imageUrl = imageUrl.startsWith('/') ? baseUrl + imageUrl : baseUrl + '/' + imageUrl;
      }

      const { amount, currency } = parsePrice(priceText);

      products.push({
        title,
        price: amount ? String(amount) : undefined,
        currency,
        productUrl,
        imageUrl,
      });
    });

    return products;
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

  private async fetchJsonLd(sourceUrl: string): Promise<ScrapedProduct[]> {
    const html = await this.getText(sourceUrl);
    const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    const found: any[] = [];
    for (const block of blocks) {
      try {
        const parsed = JSON.parse(block[1] || 'null');
        collectProducts(parsed, found);
      } catch {
        // Ignore malformed third-party JSON-LD while continuing with other blocks.
      }
    }
    return found.map((product) => {
      const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers || {};
      const brand = typeof product.brand === 'string' ? product.brand : product.brand?.name;
      const image = Array.isArray(product.image) ? product.image[0] : product.image;
      return {
        externalId: String(product.sku || product.productID || product.url || product.name),
        title: String(product.name || ''),
        description: stripHtml(String(product.description || '')),
        price: offer.price ? String(offer.price) : undefined,
        currency: offer.priceCurrency,
        imageUrl: typeof image === 'string' ? image : image?.url,
        productUrl: product.url || sourceUrl,
        category: product.category,
        brand,
        fieldsJson: { sku: product.sku, availability: offer.availability },
      };
    });
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
    await this.urlSecurity.validateUrl(url);
    return axios.get(url, {
      responseType,
      timeout: 20_000,
      maxRedirects: 0,
      maxContentLength: 3 * 1024 * 1024,
      httpAgent: createSafeHttpAgent(),
      httpsAgent: createSafeHttpsAgent(),
      headers: { Accept: responseType === 'json' ? 'application/json' : 'text/html' },
    });
  }
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
