import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CapabilityRegistry, createProcessingContext } from '@docconv/processing-core';

@ApiTags('capabilities')
@Controller('capabilities')
export class CapabilitiesController {
  private readonly registry = new CapabilityRegistry();

  @Get()
  @ApiOperation({ summary: 'Describe processing capabilities enabled in this deployment' })
  async getCapabilities() {
    const context = createProcessingContext(process.env);
    const gotenbergUrl = process.env.GOTENBERG_URL || 'http://localhost:3100';
    let chromiumWorkerHealthy = false;
    if (context.nativeEnabled) {
      try {
        const response = await fetch(`${gotenbergUrl}/health`, {
          signal: AbortSignal.timeout(2_000),
        });
        chromiumWorkerHealthy = response.ok;
      } catch {
        chromiumWorkerHealthy = false;
      }
    }
    return {
      success: true,
      data: {
        deploymentMode: context.deploymentMode,
        nativeProcessing: context.nativeEnabled,
        browserProcessing: context.browserEnabled,
        nodeProcessing: context.nodeEnabled,
        engineHealth: {
          chromiumAndOfficeWorker: chromiumWorkerHealthy ? 'healthy' : 'unavailable',
        },
        tools: Object.fromEntries(
          this.registry.list(context).map((tool) => [tool.operation, {
            slug: tool.slug,
            availability: tool.availability,
            preferred: tool.capability.preferred,
            browser: tool.capability.browser,
            node: tool.capability.node,
            native: tool.capability.native,
            privacy: tool.privacy,
          }]),
        ),
      },
    };
  }
}
