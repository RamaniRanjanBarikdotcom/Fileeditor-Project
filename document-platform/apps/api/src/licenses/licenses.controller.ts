import { Controller, Post, Get, Body, UseGuards, Req, Ip } from '@nestjs/common';
import { LicensesService } from './licenses.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class ActivateLicenseDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  machineHash!: string;

  @IsString()
  @IsOptional()
  deviceInfo?: string;
}

@Controller('licenses')
export class LicensesController {
  constructor(private readonly licensesService: LicensesService) {}

  /**
   * Activate machine with license key (Public API called by CLI/Desktop app).
   */
  @Post('activate')
  async activateLicense(@Body() dto: ActivateLicenseDto, @Ip() ip: string) {
    const data = await this.licensesService.activateLicense({
      key: dto.key,
      machineHash: dto.machineHash,
      deviceInfo: dto.deviceInfo,
      ipAddress: ip,
    });
    return { success: true, data };
  }

  /**
   * Get user's purchased licenses and activation seats.
   */
  @Get('my-licenses')
  @UseGuards(JwtAuthGuard)
  async getMyLicenses(@Req() req: any) {
    const data = await this.licensesService.getUserLicenses(req.user.userId);
    return { success: true, data };
  }
}
