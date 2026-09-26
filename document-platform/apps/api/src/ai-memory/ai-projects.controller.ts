import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiProjectsService } from './ai-projects.service';
import { CreateAiProjectDto, UpdateAiProjectDto } from './memory.dto';

@ApiTags('ai-memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/projects')
export class AiProjectsController {
  constructor(private readonly projects: AiProjectsService) {}

  @Get()
  @ApiOperation({ summary: 'List authorized AI projects' })
  async list(@Request() req: any) {
    return { success: true, data: await this.projects.list(req.user.userId, req.user.orgId) };
  }

  @Post()
  @ApiOperation({ summary: 'Create an organization-scoped AI project' })
  async create(@Request() req: any, @Body() dto: CreateAiProjectDto) {
    return {
      success: true,
      data: await this.projects.create(req.user.userId, req.user.orgId, dto),
    };
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'Get project context and memory status' })
  async get(@Request() req: any, @Param('projectId') projectId: string) {
    return {
      success: true,
      data: await this.projects.get(req.user.userId, req.user.orgId, projectId),
    };
  }

  @Patch(':projectId')
  @ApiOperation({ summary: 'Update memory and extraction settings for a project' })
  async update(
    @Request() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: UpdateAiProjectDto,
  ) {
    return {
      success: true,
      data: await this.projects.update(req.user.userId, req.user.orgId, projectId, dto),
    };
  }

  @Post(':projectId/summary/rebuild')
  @ApiOperation({ summary: 'Queue a canonical project-summary rebuild' })
  async rebuild(@Request() req: any, @Param('projectId') projectId: string) {
    return {
      success: true,
      data: await this.projects.refreshSummary(req.user.userId, req.user.orgId, projectId),
    };
  }

  @Get(':projectId/session-summaries')
  @ApiOperation({ summary: 'List recent session summaries for a project' })
  async summaries(@Request() req: any, @Param('projectId') projectId: string) {
    return {
      success: true,
      data: await this.projects.listSessionSummaries(req.user.userId, req.user.orgId, projectId),
    };
  }
}

