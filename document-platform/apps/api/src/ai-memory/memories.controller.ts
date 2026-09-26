import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CreateMemoryDto,
  MemoryQueryDto,
  SearchMemoryDto,
  UpdateMemoryDto,
} from './memory.dto';
import { MemoryService } from './memory.service';

@ApiTags('ai-memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai/memories')
export class MemoriesController {
  constructor(private readonly memories: MemoryService) {}

  @Get()
  @ApiOperation({ summary: 'Search and filter authorized project memory' })
  async list(@Request() req: any, @Query() query: MemoryQueryDto) {
    const result = await this.memories.list(req.user.userId, req.user.orgId, query);
    return {
      success: true,
      ...result,
      items: result.items.map((memory) => this.publicMemory(memory)),
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create an explicit persistent memory' })
  async create(@Request() req: any, @Body() dto: CreateMemoryDto) {
    return {
      success: true,
      data: this.publicMemory(await this.memories.create(req.user.userId, req.user.orgId, dto)),
    };
  }

  @Post('search')
  @ApiOperation({ summary: 'Retrieve and rank active memory for an authorized project' })
  async search(@Request() req: any, @Body() dto: SearchMemoryDto) {
    return {
      success: true,
      data: await this.memories.search(
        req.user.userId,
        req.user.orgId,
        dto.projectId,
        dto.query,
        dto.tokenBudget,
      ),
    };
  }

  @Get(':memoryId')
  @ApiOperation({ summary: 'Get memory and provenance' })
  async get(@Request() req: any, @Param('memoryId') memoryId: string) {
    return {
      success: true,
      data: this.publicMemory(await this.memories.get(req.user.userId, req.user.orgId, memoryId)),
    };
  }

  @Patch(':memoryId')
  @ApiOperation({ summary: 'Edit memory, status, importance, visibility, or pinning' })
  async update(
    @Request() req: any,
    @Param('memoryId') memoryId: string,
    @Body() dto: UpdateMemoryDto,
  ) {
    return {
      success: true,
      data: this.publicMemory(
        await this.memories.update(req.user.userId, req.user.orgId, memoryId, dto),
      ),
    };
  }

  @Post(':memoryId/archive')
  async archive(@Request() req: any, @Param('memoryId') memoryId: string) {
    return {
      success: true,
      data: this.publicMemory(
        await this.memories.archive(req.user.userId, req.user.orgId, memoryId),
      ),
    };
  }

  @Delete(':memoryId')
  @ApiOperation({ summary: 'Soft-delete a memory while retaining its audit history' })
  async remove(@Request() req: any, @Param('memoryId') memoryId: string) {
    return {
      success: true,
      data: this.publicMemory(
        await this.memories.softDelete(req.user.userId, req.user.orgId, memoryId),
      ),
    };
  }

  private publicMemory<T extends { embedding?: number[] }>(memory: T): Omit<T, 'embedding'> {
    const { embedding: _embedding, ...record } = memory;
    return record;
  }
}
