import { Controller, Post, Get, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConversionsService } from './conversions.service';
import { ConversionOptions, CreateConversionRequest, OutputFormat } from '@docconv/shared-types';
import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';

class CreateConversionDto implements CreateConversionRequest {
  @IsUUID()
  sourceFileId!: string;

  @IsEnum(OutputFormat)
  targetFormat!: OutputFormat;

  @IsOptional()
  @IsObject()
  settings?: ConversionOptions;
}

@ApiTags('conversions')
@Controller('conversions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ConversionsController {
  constructor(private readonly conversionsService: ConversionsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new conversion job' })
  async create(@Request() req: any, @Body() body: CreateConversionDto) {
    const result = await this.conversionsService.createConversion(
      req.user.userId,
      req.user.orgId,
      body,
    );
    return { success: true, data: result };
  }

  @Get()
  @ApiOperation({ summary: 'List conversion jobs' })
  async list(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const result = await this.conversionsService.listConversions(
      req.user.userId,
      req.user.orgId,
      page,
      pageSize,
    );
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get status of a conversion job' })
  async getStatus(@Request() req: any, @Param('id') id: string) {
    const job = await this.conversionsService.getJobStatus(id, req.user.orgId);
    return { success: true, data: job };
  }

  @Post(':id/download-url')
  @ApiOperation({ summary: 'Get a signed download URL for the converted output' })
  async getDownloadUrl(@Request() req: any, @Param('id') id: string) {
    const url = await this.conversionsService.getDownloadUrl(id, req.user.orgId);
    return { success: true, data: { url } };
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a queued or processing conversion job' })
  async cancel(@Request() req: any, @Param('id') id: string) {
    const result = await this.conversionsService.cancelConversion(
      id,
      req.user.orgId,
      req.user.userId,
    );
    return { success: true, data: result };
  }
}
