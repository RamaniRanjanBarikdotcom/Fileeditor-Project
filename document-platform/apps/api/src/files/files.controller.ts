import {
  Controller, Post, Get, Delete, Param, Query, Body,
  UseGuards, Request, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FilesService } from './files.service';
import { BadRequestException } from '@nestjs/common';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

enum PasteFormat {
  HTML = 'html',
  MARKDOWN = 'markdown',
  TEXT = 'txt',
  URL = 'url',
}

class PasteContentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2_000_000)
  content!: string;

  @IsEnum(PasteFormat)
  format!: PasteFormat;
}

@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 26_214_400 } }))
  async upload(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('A file is required.');
    const result = await this.filesService.uploadFile(
      req.user.userId,
      req.user.orgId,
      file,
    );
    return { success: true, data: result };
  }

  @Post('paste')
  @ApiOperation({ summary: 'Upload pasted content (HTML, Markdown, or text)' })
  async paste(
    @Request() req: any,
    @Body() body: PasteContentDto,
  ) {
    const result = await this.filesService.uploadPastedContent(
      req.user.userId,
      req.user.orgId,
      body.content,
      body.format,
    );
    return { success: true, data: result };
  }

  @Get()
  @ApiOperation({ summary: 'List uploaded files' })
  async list(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    const result = await this.filesService.listFiles(
      req.user.userId,
      req.user.orgId,
      page,
      pageSize,
    );
    return { success: true, ...result };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get file details' })
  async getFile(@Request() req: any, @Param('id') id: string) {
    const file = await this.filesService.getFile(id, req.user.userId);
    return { success: true, data: file };
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Get signed download URL' })
  async download(@Request() req: any, @Param('id') id: string) {
    const result = await this.filesService.getDownloadUrl(id, req.user.userId);
    return { success: true, data: result };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a file' })
  async delete(@Request() req: any, @Param('id') id: string) {
    return this.filesService.deleteFile(id, req.user.userId);
  }
}
