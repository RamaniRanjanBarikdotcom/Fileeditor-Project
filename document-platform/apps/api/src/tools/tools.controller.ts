import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ToolsService } from './tools.service';
import { AnonymousQuotaService } from './anonymous-quota.service';
import { AnonymousToolsService } from './anonymous-tools.service';
import { Request, Response } from 'express';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { ConversionsService } from '../conversions/conversions.service';

const ANON_COOKIE_NAME = 'apptoolkitlab_anon_id';
const TRANSPORT_UPLOAD_LIMIT = Number(
  process.env.MAX_TRANSPORT_UPLOAD_SIZE_BYTES || 250 * 1024 * 1024,
);

function useSecureCookies() {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === 'true';
  }
  return (process.env.PUBLIC_WEB_URL || process.env.APP_URL || '').startsWith('https://');
}

class AnonymousToolExecutionDto {
  @IsOptional()
  @IsString()
  @MaxLength(4096)
  url?: string;

  @IsOptional()
  @IsString()
  targetFormat?: string;

  @IsOptional()
  @IsString()
  settings?: string;
}

@ApiTags('tools')
@Controller('tools')
export class ToolsController {
  constructor(
    private readonly toolsService: ToolsService,
    private readonly anonymousQuotaService: AnonymousQuotaService,
    private readonly anonymousToolsService: AnonymousToolsService,
    private readonly conversionsService: ConversionsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all published tools with optional category filter' })
  async getTools(@Query('category') category?: string, @Query('featured') featured?: string) {
    const isFeatured = featured === 'true' || featured === '1';
    const tools = await this.toolsService.getPublishedTools(category, isFeatured);
    return { success: true, data: tools };
  }

  @Post(':slug/execute')
  @UseGuards(OptionalJwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: TRANSPORT_UPLOAD_LIMIT } }))
  @ApiOperation({ summary: 'Execute a published tool with anonymous daily quota' })
  async executeAnonymousTool(
    @Param('slug') slug: string,
    @Body() body: AnonymousToolExecutionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let settings: Record<string, unknown> | undefined;
    if (body.settings) {
      try {
        settings = JSON.parse(body.settings);
      } catch {
        settings = undefined;
      }
    }
    const authenticated = (req as any).user;
    const conversion = authenticated
      ? await this.anonymousToolsService.executeAuthenticated({
          slug,
          userId: authenticated.userId,
          organizationId: authenticated.orgId,
          platformRole: authenticated.platformRole,
          url: body.url,
          targetFormat: body.targetFormat,
          settings,
          file,
        })
      : await this.anonymousToolsService.execute({
          slug,
          ...this.ensureAnonymousIdentity(req, res),
          ip: this.getClientIp(req),
          url: body.url,
          targetFormat: body.targetFormat,
          settings,
          file,
        });
    return { success: true, data: conversion };
  }

  @Get('jobs/:jobId')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get an anonymous tool conversion status' })
  async getAnonymousJob(
    @Param('jobId') jobId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authenticated = (req as any).user;
    const status = authenticated
      ? await this.anonymousToolsService.getAuthenticatedStatus(
          jobId,
          authenticated.userId,
          authenticated.orgId,
        )
      : await this.anonymousToolsService.getStatus(
          jobId,
          this.ensureAnonymousIdentity(req, res).anonId,
        );
    return { success: true, data: status };
  }

  @Post('jobs/:jobId/download-url')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get an anonymous tool output download URL' })
  async getAnonymousDownloadUrl(
    @Param('jobId') jobId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authenticated = (req as any).user;
    const url = authenticated
      ? await this.anonymousToolsService.getAuthenticatedDownloadUrl(
          jobId,
          authenticated.userId,
          authenticated.orgId,
        )
      : await this.anonymousToolsService.getDownloadUrl(
          jobId,
          this.ensureAnonymousIdentity(req, res).anonId,
        );
    return { success: true, data: { url } };
  }

  @Post('jobs/:jobId/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Cancel an anonymous tool conversion' })
  async cancelAnonymousJob(
    @Param('jobId') jobId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const authenticated = (req as any).user;
    const result = authenticated
      ? await this.anonymousToolsService.cancelAuthenticated(
          jobId,
          authenticated.userId,
          authenticated.orgId,
        )
      : await this.anonymousToolsService.cancel(
          jobId,
          this.ensureAnonymousIdentity(req, res).anonId,
        );
    return { success: true, data: result };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get list of tool categories with counts' })
  async getCategories() {
    const categories = await this.toolsService.getCategories();
    return { success: true, data: categories };
  }

  @Get('quota/anonymous')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Check remaining anonymous quota' })
  async checkAnonymousQuota(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const authenticated = (req as any).user;
    if (authenticated) {
      return {
        success: true,
        data: await this.conversionsService.getQuotaStatus(
          authenticated.userId,
          authenticated.orgId,
        ),
      };
    }
    const ip = this.getClientIp(req);
    const { anonId } = this.ensureAnonymousIdentity(req, res);

    const quota = await this.anonymousQuotaService.checkQuota(ip, anonId);
    return { success: true, data: quota };
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get tool configuration and SEO metadata by slug' })
  async getToolBySlug(@Param('slug') slug: string) {
    const tool = await this.toolsService.getToolBySlug(slug);
    return { success: true, data: tool };
  }

  private getClientIp(req: Request): string {
    // Express derives this from the configured trusted proxy chain. Reading
    // x-forwarded-for directly would allow callers to rotate spoofed addresses.
    return req.ip || req.socket.remoteAddress || '127.0.0.1';
  }

  private ensureAnonymousIdentity(req: Request, res: Response) {
    const identity = this.anonymousQuotaService.getOrCreateAnonId(req.cookies);
    if (identity.isNew) {
      res.cookie(
        ANON_COOKIE_NAME,
        this.anonymousQuotaService.createSignedCookieValue(identity.anonId),
        {
          httpOnly: true,
          secure: useSecureCookies(),
          sameSite: 'lax',
          maxAge: 365 * 24 * 60 * 60 * 1000,
        },
      );
    }
    return identity;
  }
}
