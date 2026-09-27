import {
  Body,
  Controller,
  Delete,
  Get,
  MessageEvent,
  Param,
  Patch,
  Post,
  Query,
  Request,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Observable, from, interval } from 'rxjs';
import { distinctUntilChanged, map, startWith, switchMap, takeWhile } from 'rxjs/operators';
import { BlogGenerationStatus, PlatformRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireFeatures } from '../feature-flags/require-features.decorator';
import { BlogStudioService } from './blog-studio.service';
import { BlogSettingsService } from './blog-settings.service';
import { BlogProvidersService } from './blog-providers.service';
import { BlogPublishingService } from './blog-publishing.service';
import { BlogAnalyticsService } from './blog-analytics.service';
import { BlogStudioPermissionGuard } from './blog-permissions.service';
import { BlogSchedulerService } from './blog-scheduler.service';
import { BlogProductsService } from './blog-products.service';
import { BlogImagesService } from './blog-images.service';
import { BlogLogsService } from './blog-logs.service';
import { BlogNotificationsService } from './blog-notifications.service';
import { PlatformRoles } from '../common/decorators/platform-roles.decorator';
import { PlatformRolesGuard } from '../common/guards/platform-roles.guard';
import {
  BlogExportDto,
  BlogImageDto,
  CreateBlogCategoryDto,
  CreateBlogDestinationDto,
  CreateBlogGenerationDto,
  CreateBlogProductCollectionDto,
  CreateBlogProductDto,
  CreateBlogProviderDto,
  CreateBlogScheduleDto,
  ImportBlogSchedulesDto,
  CreatePromptTemplateDto,
  UpdateBlogScheduleDto,
  UpdateBlogDto,
  UpdateBlogDestinationDto,
  UpdateBlogProviderDto,
  UpdateRemoteBlogPostDto,
  UpdateBlogStudioSettingsDto,
  UpsertBlogCategoryMappingDto,
} from './blog-studio.dto';

@ApiTags('blog-studio')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@RequireFeatures('blogStudio')
@Controller('blog-studio')
export class BlogStudioController {
  constructor(
    private readonly studio: BlogStudioService,
    private readonly settingsService: BlogSettingsService,
    private readonly providersService: BlogProvidersService,
    private readonly publishingService: BlogPublishingService,
    private readonly analyticsService: BlogAnalyticsService,
    private readonly schedulerService: BlogSchedulerService,
    private readonly productsService: BlogProductsService,
    private readonly imagesService: BlogImagesService,
    private readonly logsService: BlogLogsService,
    private readonly notificationsService: BlogNotificationsService,
  ) {}

  @Post('generations')
  @Throttle({ short: { limit: 3, ttl: 60_000 }, medium: { limit: 10, ttl: 60 * 60_000 } })
  @ApiOperation({ summary: 'Reserve usage and queue a Blog Studio generation' })
  async create(@Request() req: any, @Body() dto: CreateBlogGenerationDto) {
    return {
      success: true,
      data: await this.studio.createGeneration(req.user.userId, req.user.orgId, dto),
    };
  }

  @Get('generations/:id')
  async generation(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.studio.getGeneration(req.user.userId, req.user.orgId, id),
    };
  }

  @Sse('generations/:id/events')
  events(@Request() req: any, @Param('id') id: string): Observable<MessageEvent> {
    const terminal = new Set<BlogGenerationStatus>(['COMPLETED', 'FAILED', 'CANCELLED']);
    return interval(1_000).pipe(
      startWith(0),
      switchMap(() => from(this.studio.getGeneration(req.user.userId, req.user.orgId, id))),
      distinctUntilChanged(
        (previous, current) => previous.updatedAt.getTime() === current.updatedAt.getTime(),
      ),
      map((job) => ({
        type: 'progress',
        data: {
          id: job.id,
          status: job.status,
          progress: job.progress,
          stage: job.currentStage,
          error: job.errorMessage,
          blog: job.blog,
        },
      })),
      takeWhile((event) => !terminal.has((event.data as any).status), true),
    );
  }

  @Post('generations/:id/cancel')
  async cancel(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.studio.cancelGeneration(req.user.userId, req.user.orgId, id),
    };
  }

  @Get('blogs')
  async list(
    @Request() req: any,
    @Query('q') query?: string,
    @Query('language') language?: string,
  ) {
    return {
      success: true,
      data: await this.studio.listBlogs(req.user.userId, req.user.orgId, query, language),
    };
  }

  @Get('blogs/:id')
  async get(@Request() req: any, @Param('id') id: string) {
    return { success: true, data: await this.studio.getBlog(req.user.userId, req.user.orgId, id) };
  }

  @Patch('blogs/:id')
  async update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateBlogDto) {
    return {
      success: true,
      data: await this.studio.updateBlog(req.user.userId, req.user.orgId, id, dto),
    };
  }

  @Delete('blogs/:id')
  async remove(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.studio.deleteBlog(req.user.userId, req.user.orgId, id),
    };
  }

  @Post('blogs/:id/regenerate')
  @Throttle({ short: { limit: 3, ttl: 60_000 }, medium: { limit: 10, ttl: 60 * 60_000 } })
  async regenerate(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.studio.regenerate(req.user.userId, req.user.orgId, id),
    };
  }

  @Post('blogs/:id/images')
  @Throttle({ short: { limit: 3, ttl: 60_000 }, medium: { limit: 10, ttl: 60 * 60_000 } })
  @RequireFeatures('blogStudioImages')
  async image(@Request() req: any, @Param('id') id: string, @Body() dto: BlogImageDto) {
    return {
      success: true,
      data: await this.imagesService.generateImage(req.user.orgId, req.user.userId, id, dto),
    };
  }

  @Post('blogs/:id/exports')
  async export(@Request() req: any, @Param('id') id: string, @Body() dto: BlogExportDto) {
    return {
      success: true,
      data: await this.studio.exportBlog(req.user.userId, req.user.orgId, id, dto),
    };
  }

  @Get('exports/:id')
  async exportStatus(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.studio.getExport(req.user.userId, req.user.orgId, id),
    };
  }

  @Get('usage')
  async usage(@Request() req: any) {
    return { success: true, data: await this.studio.getUsage(req.user.userId, req.user.orgId) };
  }

  // ─── Phase 4 Additions ──────────────────────────────────────

  @Get('settings')
  @RequireFeatures('blogStudioFullSuite')
  @UseGuards(BlogStudioPermissionGuard)
  async getSettings(@Request() req: any) {
    return { success: true, data: await this.settingsService.getSettings(req.user.orgId) };
  }

  @Patch('settings')
  @RequireFeatures('blogStudioFullSuite')
  @UseGuards(BlogStudioPermissionGuard)
  async updateSettings(@Request() req: any, @Body() dto: UpdateBlogStudioSettingsDto) {
    return { success: true, data: await this.settingsService.updateSettings(req.user.orgId, dto) };
  }

  @Get('providers')
  @RequireFeatures('blogStudioByok')
  @UseGuards(BlogStudioPermissionGuard)
  async listProviders(@Request() req: any) {
    return { success: true, data: await this.providersService.listProviders(req.user.orgId) };
  }

  @Post('providers')
  @RequireFeatures('blogStudioByok')
  @UseGuards(BlogStudioPermissionGuard)
  async createProvider(@Request() req: any, @Body() dto: CreateBlogProviderDto) {
    return { success: true, data: await this.providersService.createProvider(req.user.orgId, dto) };
  }

  @Patch('providers/:id')
  @RequireFeatures('blogStudioByok')
  @UseGuards(BlogStudioPermissionGuard)
  async updateProvider(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBlogProviderDto,
  ) {
    return {
      success: true,
      data: await this.providersService.updateProvider(req.user.orgId, id, dto),
    };
  }

  @Post('providers/:id/test')
  @RequireFeatures('blogStudioByok')
  @UseGuards(BlogStudioPermissionGuard)
  async testProvider(@Request() req: any, @Param('id') id: string) {
    return { success: true, data: await this.providersService.testProvider(req.user.orgId, id) };
  }

  @Delete('providers/:id')
  @RequireFeatures('blogStudioByok')
  @UseGuards(BlogStudioPermissionGuard)
  async deleteProvider(@Request() req: any, @Param('id') id: string) {
    return { success: true, data: await this.providersService.deleteProvider(req.user.orgId, id) };
  }

  @Get('prompts')
  @RequireFeatures('blogStudioFullSuite')
  @UseGuards(BlogStudioPermissionGuard)
  async listPrompts(@Request() req: any, @Query('stage') stage?: string) {
    return {
      success: true,
      data: await this.settingsService.listPromptTemplates(req.user.orgId, stage),
    };
  }

  @Post('prompts')
  @RequireFeatures('blogStudioFullSuite')
  @UseGuards(BlogStudioPermissionGuard)
  async createPrompt(@Request() req: any, @Body() dto: CreatePromptTemplateDto) {
    return {
      success: true,
      data: await this.settingsService.createPromptTemplate(req.user.orgId, req.user.userId, dto),
    };
  }

  @Get('destinations')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async listDestinations(@Request() req: any) {
    return { success: true, data: await this.publishingService.listDestinations(req.user.orgId) };
  }

  @Post('destinations')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async createDestination(@Request() req: any, @Body() dto: CreateBlogDestinationDto) {
    return { success: true, data: await this.publishingService.createDestination(req.user.orgId, dto) };
  }

  @Patch('destinations/:id')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async updateDestination(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBlogDestinationDto,
  ) {
    return {
      success: true,
      data: await this.publishingService.updateDestination(req.user.orgId, id, dto),
    };
  }

  @Post('destinations/:id/test')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async testDestination(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.publishingService.testDestination(req.user.orgId, id),
    };
  }

  @Delete('destinations/:id')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async deleteDestination(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.publishingService.deleteDestination(req.user.orgId, id),
    };
  }

  @Get('destinations/:id/categories')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async listCategories(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.publishingService.listCategories(req.user.orgId, id),
    };
  }

  @Post('destinations/:id/categories')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async createCategory(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateBlogCategoryDto,
  ) {
    return {
      success: true,
      data: await this.publishingService.createCategory(req.user.orgId, id, dto),
    };
  }

  @Post('destinations/:id/category-mappings')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async upsertCategoryMapping(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpsertBlogCategoryMappingDto,
  ) {
    return {
      success: true,
      data: await this.publishingService.upsertCategoryMapping(req.user.orgId, id, dto),
    };
  }

  @Delete('destinations/:id/category-mappings/:mappingId')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async deleteCategoryMapping(
    @Request() req: any,
    @Param('id') id: string,
    @Param('mappingId') mappingId: string,
  ) {
    return {
      success: true,
      data: await this.publishingService.deleteCategoryMapping(req.user.orgId, id, mappingId),
    };
  }

  @Post('blogs/:id/publish')
  @RequireFeatures('blogStudioPublishing')
  @UseGuards(BlogStudioPermissionGuard)
  async publishBlog(@Request() req: any, @Param('id') id: string, @Body() dto: any) {
    return { success: true, data: await this.publishingService.publish(req.user.orgId, req.user.userId, id, dto.destinationId, dto.publishedAs) };
  }

  @Get('publishing')
  @RequireFeatures('blogStudioPublishing')
  async listPublishing(@Request() req: any, @Query('destinationId') destinationId?: string) {
    return {
      success: true,
      data: await this.publishingService.listPublications(req.user.orgId, destinationId),
    };
  }

  @Get('remote-posts')
  @RequireFeatures('blogStudioPublishing', 'blogStudioSync')
  async listRemotePosts(@Request() req: any, @Query('destinationId') destinationId?: string) {
    return {
      success: true,
      data: await this.publishingService.listRemotePosts(req.user.orgId, destinationId),
    };
  }

  @Get('remote-posts/:id')
  @RequireFeatures('blogStudioPublishing', 'blogStudioSync')
  async getRemotePost(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.publishingService.getRemotePost(req.user.orgId, id),
    };
  }

  @Patch('remote-posts/:id')
  @RequireFeatures('blogStudioPublishing', 'blogStudioSync')
  @UseGuards(BlogStudioPermissionGuard)
  async updateRemotePost(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateRemoteBlogPostDto,
  ) {
    return {
      success: true,
      data: await this.publishingService.updateRemotePost(req.user.orgId, id, dto),
    };
  }

  @Delete('remote-posts/:id')
  @RequireFeatures('blogStudioPublishing', 'blogStudioSync')
  @UseGuards(BlogStudioPermissionGuard)
  async deleteRemotePost(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.publishingService.deleteRemotePost(req.user.orgId, id),
    };
  }

  @Post('destinations/:id/sync')
  @RequireFeatures('blogStudioPublishing', 'blogStudioSync')
  @UseGuards(BlogStudioPermissionGuard)
  async syncDestination(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.publishingService.syncDestination(req.user.orgId, id),
    };
  }

  @Get('schedules')
  @RequireFeatures('blogStudioScheduler')
  async listSchedules(@Request() req: any) {
    return { success: true, data: await this.schedulerService.listSchedules(req.user.orgId) };
  }

  @Post('schedules')
  @RequireFeatures('blogStudioScheduler')
  async createSchedule(@Request() req: any, @Body() dto: CreateBlogScheduleDto) {
    return {
      success: true,
      data: await this.schedulerService.createSchedule(req.user.orgId, req.user.userId, dto),
    };
  }

  @Post('schedules/import')
  @RequireFeatures('blogStudioScheduler')
  async importSchedules(@Request() req: any, @Body() dto: ImportBlogSchedulesDto) {
    return {
      success: true,
      data: await this.schedulerService.handleCsvImport(
        req.user.orgId,
        req.user.userId,
        dto.rows,
        dto.filename,
      ),
    };
  }

  @Post('schedules/:id/cancel')
  @RequireFeatures('blogStudioScheduler')
  async cancelSchedule(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.schedulerService.cancelSchedule(req.user.orgId, id),
    };
  }

  @Patch('schedules/:id')
  @RequireFeatures('blogStudioScheduler')
  async updateSchedule(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateBlogScheduleDto,
  ) {
    return {
      success: true,
      data: await this.schedulerService.updateSchedule(req.user.orgId, id, dto),
    };
  }

  @Delete('schedules/:id')
  @RequireFeatures('blogStudioScheduler')
  async deleteSchedule(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.schedulerService.deleteSchedule(req.user.orgId, id),
    };
  }

  @Get('product-collections')
  @RequireFeatures('blogStudioFullSuite')
  async listCollections(@Request() req: any) {
    return { success: true, data: await this.productsService.listCollections(req.user.orgId) };
  }

  @Post('product-collections')
  @RequireFeatures('blogStudioFullSuite')
  async createCollection(@Request() req: any, @Body() dto: CreateBlogProductCollectionDto) {
    return {
      success: true,
      data: await this.productsService.createCollection(req.user.orgId, dto),
    };
  }

  @Delete('product-collections/:id')
  @RequireFeatures('blogStudioFullSuite')
  async deleteCollection(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.productsService.deleteCollection(req.user.orgId, id),
    };
  }

  @Get('product-collections/:id/products')
  @RequireFeatures('blogStudioFullSuite')
  async listProducts(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.productsService.listProducts(req.user.orgId, id),
    };
  }

  @Post('product-collections/:id/products')
  @RequireFeatures('blogStudioFullSuite')
  async addProduct(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreateBlogProductDto,
  ) {
    return {
      success: true,
      data: await this.productsService.addProduct(req.user.orgId, id, dto),
    };
  }

  @Post('product-collections/:id/scrape')
  @RequireFeatures('blogStudioScraping')
  async scrapeProducts(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: { url?: string },
  ) {
    return {
      success: true,
      data: await this.productsService.scrapeProductsFromUrl(req.user.orgId, id, dto.url),
    };
  }

  @Delete('product-collections/:collectionId/products/:productId')
  @RequireFeatures('blogStudioFullSuite')
  async deleteProduct(
    @Request() req: any,
    @Param('collectionId') collectionId: string,
    @Param('productId') productId: string,
  ) {
    return {
      success: true,
      data: await this.productsService.deleteProduct(req.user.orgId, collectionId, productId),
    };
  }

  @Get('images')
  @RequireFeatures('blogStudioImages')
  async listImages(@Request() req: any, @Query('blogId') blogId?: string) {
    return {
      success: true,
      data: await this.imagesService.listGallery(req.user.orgId, blogId),
    };
  }

  @Post('blogs/:blogId/images/:imageId/featured')
  @RequireFeatures('blogStudioImages')
  async setFeaturedImage(
    @Request() req: any,
    @Param('blogId') blogId: string,
    @Param('imageId') imageId: string,
  ) {
    return {
      success: true,
      data: await this.imagesService.setFeaturedImage(req.user.orgId, blogId, imageId),
    };
  }

  @Delete('blogs/:blogId/images/:imageId')
  @RequireFeatures('blogStudioImages')
  async deleteImage(
    @Request() req: any,
    @Param('blogId') blogId: string,
    @Param('imageId') imageId: string,
  ) {
    return {
      success: true,
      data: await this.imagesService.deleteImage(req.user.orgId, blogId, imageId),
    };
  }

  @Get('logs')
  @RequireFeatures('blogStudioFullSuite')
  async logs(
    @Request() req: any,
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return {
      success: true,
      data: await this.logsService.getLogs(req.user.orgId, Number(limit), Number(offset)),
    };
  }

  @Get('notifications')
  async notifications(@Request() req: any, @Query('unread') unread?: string) {
    return {
      success: true,
      data: await this.notificationsService.list(req.user.orgId, req.user.userId, unread === 'true'),
    };
  }

  @Post('notifications/:id/read')
  async markNotificationRead(@Request() req: any, @Param('id') id: string) {
    return {
      success: true,
      data: await this.notificationsService.markRead(req.user.orgId, req.user.userId, id),
    };
  }

  @Get('analytics')
  @RequireFeatures('blogStudioAnalytics')
  @UseGuards(BlogStudioPermissionGuard)
  async getAnalytics(@Request() req: any) {
    return { success: true, data: await this.analyticsService.getDashboardMetrics(req.user.orgId) };
  }

  @Get('admin/overview')
  @UseGuards(PlatformRolesGuard)
  @PlatformRoles(PlatformRole.ADMIN)
  async adminOverview() {
    return { success: true, data: await this.analyticsService.getAdminMetrics() };
  }
}
