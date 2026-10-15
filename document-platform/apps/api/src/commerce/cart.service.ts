import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { BillingType, CurrencyCode, ProductType } from '@prisma/client';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get or create active cart for user.
   */
  async getOrCreateCart(userId: string, currency: CurrencyCode = CurrencyCode.USD) {
    let cart = await this.prisma.cart.findFirst({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                prices: { where: { currency, isActive: true, billingType: BillingType.ONE_TIME } },
              },
            },
            price: true,
          },
        },
      },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
        },
        include: {
          items: {
            include: {
              product: {
                include: {
                  prices: { where: { currency, isActive: true, billingType: BillingType.ONE_TIME } },
                },
              },
              price: true,
            },
          },
        },
      });
    }

    const items = cart.items.map((item) => {
      // The stored price may be in another currency; show the selected one.
      const price = item.product.prices[0];
      return {
        id: item.id,
        productId: item.productId,
        productName: item.product.name,
        productSlug: item.product.slug,
        quantity: 1,
        priceMinorUnits: price ? price.amountMinorUnits : 0,
        currency,
      };
    });

    const subtotalMinorUnits = items.reduce((acc, it) => acc + it.priceMinorUnits * it.quantity, 0);

    return {
      id: cart.id,
      currency,
      items,
      subtotalMinorUnits,
      itemCount: items.length,
    };
  }

  /**
   * Add a product to the user's cart.
   */
  async addItem(userId: string, productId: string, currency: CurrencyCode = CurrencyCode.USD) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { prices: { where: { currency, isActive: true, billingType: BillingType.ONE_TIME } } },
    });

    if (!product || !product.isPublished) {
      throw new NotFoundException('Product not found or unavailable.');
    }
    if (product.type === ProductType.SAAS) {
      throw new BadRequestException('Subscriptions are started from the product page, not the cart.');
    }

    const price = product.prices[0];
    if (!price) {
      throw new BadRequestException(`No active price found for currency ${currency}.`);
    }

    let cart = await this.prisma.cart.findFirst({ where: { userId } });
    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    // Check if already in cart
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
    });

    if (!existingItem) {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          priceId: price.id,
        },
      });
    }

    return this.getOrCreateCart(userId, currency);
  }

  /**
   * Remove item from cart.
   */
  async removeItem(
    userId: string,
    cartItemId: string,
    currency: CurrencyCode = CurrencyCode.USD,
  ) {
    const cart = await this.prisma.cart.findFirst({ where: { userId } });
    if (!cart) throw new NotFoundException('Cart not found.');

    await this.prisma.cartItem.deleteMany({
      where: { id: cartItemId, cartId: cart.id },
    });

    return this.getOrCreateCart(userId, currency);
  }

  /**
   * Clear cart.
   */
  async clearCart(userId: string) {
    const cart = await this.prisma.cart.findFirst({ where: { userId } });
    if (cart) {
      await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    }
    return { success: true };
  }
}
