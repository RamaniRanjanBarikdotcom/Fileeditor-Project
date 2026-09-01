import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  Ip,
  Headers,
} from '@nestjs/common';
import { DownloadsService } from './downloads.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('downloads')
@UseGuards(JwtAuthGuard)
export class DownloadsController {
  constructor(private readonly downloadsService: DownloadsService) {}

  /**
   * Get user's purchased digital library.
   */
  @Get('library')
  async getMyLibrary(@Req() req: any) {
    const data = await this.downloadsService.getUserLibrary(req.user.userId);
    return { success: true, data };
  }

  /**
   * Request short-lived signed download URL for a purchased product.
   */
  @Post(':productId/sign')
  async getSignedDownloadUrl(
    @Req() req: any,
    @Param('productId') productId: string,
    @Ip() ip: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    const data = await this.downloadsService.getDownloadUrl({
      userId: req.user.userId,
      productId,
      ipAddress: ip,
      userAgent,
    });
    return { success: true, data };
  }
}
