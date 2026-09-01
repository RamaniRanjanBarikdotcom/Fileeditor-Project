import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService, CreateProductDto } from './products.service';
import { ProductType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformRolesGuard } from '../common/guards/platform-roles.guard';
import { PlatformRoles } from '../common/decorators/platform-roles.decorator';
import { PlatformRole } from '@prisma/client';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async getProducts(@Query('type') type?: ProductType) {
    const data = await this.productsService.getPublishedProducts(type);
    return { success: true, data };
  }

  @Get(':slug')
  async getProductBySlug(@Param('slug') slug: string) {
    const data = await this.productsService.getProductBySlug(slug);
    return { success: true, data };
  }

  @Post()
  @UseGuards(JwtAuthGuard, PlatformRolesGuard)
  @PlatformRoles(PlatformRole.ADMIN)
  async createProduct(@Body() dto: CreateProductDto) {
    const data = await this.productsService.createProduct(dto);
    return { success: true, data };
  }
}
