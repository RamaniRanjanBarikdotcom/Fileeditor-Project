import { Controller, Get, Patch, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { BLOG_STUDIO_THEMES, type BlogStudioTheme } from '@docconv/shared-types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from './users.service';

// DTO classes (not plain types) so the global whitelist ValidationPipe rejects
// any other field. A plain type skips validation entirely, which previously let
// a user write fields such as platformRole or status on their own account.
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

export class UpdatePreferencesDto {
  @IsIn(BLOG_STUDIO_THEMES)
  blogStudioTheme!: BlogStudioTheme;
}

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current user profile' })
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.userId);
    return { success: true, data: user };
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update user profile' })
  async updateProfile(@Request() req: any, @Body() body: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(req.user.userId, body);
    return { success: true, data: user };
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Save the current user’s interface preferences' })
  async updatePreferences(@Request() req: any, @Body() body: UpdatePreferencesDto) {
    const preferences = await this.usersService.updatePreferences(req.user.userId, body);
    return { success: true, data: preferences };
  }
}
