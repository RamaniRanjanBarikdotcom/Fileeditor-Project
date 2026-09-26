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
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, SendMessageDto, UpdateConversationDto } from './memory.dto';

@ApiTags('ai-memory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get('projects/:projectId/conversations')
  async list(@Request() req: any, @Param('projectId') projectId: string) {
    return {
      success: true,
      data: await this.conversations.list(req.user.userId, req.user.orgId, projectId),
    };
  }

  @Post('projects/:projectId/conversations')
  async create(
    @Request() req: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return {
      success: true,
      data: await this.conversations.create(req.user.userId, req.user.orgId, projectId, dto),
    };
  }

  @Get('conversations/:conversationId')
  async get(@Request() req: any, @Param('conversationId') conversationId: string) {
    return {
      success: true,
      data: await this.conversations.get(req.user.userId, req.user.orgId, conversationId),
    };
  }

  @Patch('conversations/:conversationId')
  async update(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return {
      success: true,
      data: await this.conversations.update(
        req.user.userId,
        req.user.orgId,
        conversationId,
        dto,
      ),
    };
  }

  @Post('conversations/:conversationId/messages')
  @ApiOperation({ summary: 'Persist a user message and generate a memory-aware AI response' })
  async respond(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    return {
      success: true,
      data: await this.conversations.respond(
        req.user.userId,
        req.user.orgId,
        conversationId,
        dto,
      ),
    };
  }
}

