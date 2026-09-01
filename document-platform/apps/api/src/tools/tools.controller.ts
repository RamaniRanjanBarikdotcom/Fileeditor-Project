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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ToolsService } from './tools.service';
import { AnonymousQuotaService } from './anonymous-quota.service';
import { AnonymousToolsService } from './anonymous-tools.service';
import { Request, Response } from 'express';
import { IsOptional, IsString, MaxLength } from 'class-validator';

const ANON_COOKIE_NAME = 'toolsuite_anon_id';

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
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all published tools with optional category filter' })
  async getTools(
    @Query('category') category?: string,
    @Query('featured') featured?: string,
  ) {
    const isFeatured = featured === 'true' || featured === '1';
    const tools = await this.toolsService.getPublishedTools(category, isFeatured);
    return { success: true, data: tools };
  }

  @Post(':slug/execute')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Execute a published tool with anonymous daily quota' })
  async executeAnonymousTool(
    @Param('slug') slug: string,
    @Body() body: AnonymousToolExecutionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { anonId } = this.ensureAnonymousIdentity(req, res);
    const ip = this.getClientIp(req);
    let settings: Record<string, unknown> | undefined;
    if (body.settings) {
      try {
        settings = JSON.parse(body.settings);
      } catch {
        settings = undefined;
      }
    }
    const conversion = await this.anonymousToolsService.execute({
      slug,
      anonId,
      ip,
      url: body.url,
      targetFormat: body.targetFormat,
      settings,
      file,
    });
    return { success: true, data: conversion };
  }

  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Get an anonymous tool conversion status' })
  async getAnonymousJob(
    @Param('jobId') jobId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { anonId } = this.ensureAnonymousIdentity(req, res);
    const status = await this.anonymousToolsService.getStatus(jobId, anonId);
    return { success: true, data: status };
  }

  @Post('jobs/:jobId/download-url')
  @ApiOperation({ summary: 'Get an anonymous tool output download URL' })
  async getAnonymousDownloadUrl(
    @Param('jobId') jobId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { anonId } = this.ensureAnonymousIdentity(req, res);
    const url = await this.anonymousToolsService.getDownloadUrl(jobId, anonId);
    return { success: true, data: { url } };
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get list of tool categories with counts' })
  async getCategories() {
    const categories = await this.toolsService.getCategories();
    return { success: true, data: categories };
  }

  @Get('quota/anonymous')
  @ApiOperation({ summary: 'Check remaining anonymous quota' })
  async checkAnonymousQuota(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
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
    const forwarded = req.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0];
    return forwardedIp?.trim() || req.ip || '127.0.0.1';
  }

  private ensureAnonymousIdentity(req: Request, res: Response) {
    const identity = this.anonymousQuotaService.getOrCreateAnonId(req.cookies);
    if (identity.isNew) {
      res.cookie(
        ANON_COOKIE_NAME,
        this.anonymousQuotaService.createSignedCookieValue(identity.anonId),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 365 * 24 * 60 * 60 * 1000,
        },
      );
    }
    return identity;
  }
}
