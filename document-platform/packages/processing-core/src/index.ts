import {
  ErrorCode,
  ProcessingContext,
  ProcessingEngine,
  ProcessingLocation,
  ProcessingRequest,
  ProcessingResult,
  ResolvedProcessingLocation,
  ToolCapability,
} from '@docconv/shared-types';
import { getToolDefinition, listToolDefinitions } from '@docconv/tool-registry';

export class ProcessingRoutingError extends Error {
  constructor(public readonly code: ErrorCode, message: string) {
    super(message);
    this.name = 'ProcessingRoutingError';
  }
}

export function createProcessingContext(env: Record<string, string | undefined>): ProcessingContext {
  // Fail closed: native processing is advertised only when the deployment
  // explicitly opts in. A missing environment variable must not expose a tool
  // whose executables or workers are absent.
  const deploymentMode = env.DEPLOYMENT_MODE === 'DOCKER_NATIVE' ? 'DOCKER_NATIVE' : 'HOSTINGER';
  const enabled = (name: string, fallback: boolean) =>
    env[name] === undefined ? fallback : env[name] === 'true';
  return {
    deploymentMode,
    browserEnabled: enabled('PROCESSING_BROWSER_ENABLED', true),
    nodeEnabled: enabled('PROCESSING_NODE_ENABLED', true),
    nativeEnabled: enabled('PROCESSING_NATIVE_ENABLED', deploymentMode === 'DOCKER_NATIVE'),
  };
}

export class CapabilityRegistry {
  get(operation: string): ToolCapability | undefined {
    return listToolDefinitions().find((tool) => tool.operation === operation)?.capability;
  }

  list(context: ProcessingContext) {
    return listToolDefinitions().map((tool) => ({
      ...tool,
      capability: this.forContext(tool.capability, context),
    }));
  }

  private forContext(capability: ToolCapability, context: ProcessingContext): ToolCapability {
    return {
      ...capability,
      browser: { ...capability.browser, supported: capability.browser.supported && context.browserEnabled },
      node: { ...capability.node, supported: capability.node.supported && context.nodeEnabled },
      native: { ...capability.native, supported: capability.native.supported && context.nativeEnabled },
    };
  }
}

export class ProcessingRouter {
  constructor(
    private readonly engines: ProcessingEngine[],
    private readonly capabilities = new CapabilityRegistry(),
  ) {}

  async resolve(request: ProcessingRequest, context: ProcessingContext): Promise<ProcessingEngine> {
    const capability = this.capabilities.get(request.operation);
    if (!capability) {
      throw new ProcessingRoutingError(ErrorCode.UNSUPPORTED_CONVERSION, `Unknown operation: ${request.operation}`);
    }

    this.assertInputLimits(request, capability);
    const order = this.locationOrder(request.requestedLocation || capability.preferred);
    for (const location of order) {
      if (!this.locationEnabled(location, capability, context)) continue;
      const candidates = this.engines.filter((engine) => engine.location === location);
      for (const engine of candidates) {
        if (await engine.canProcess(request, context)) return engine;
      }
      if (request.requestedLocation && request.requestedLocation !== 'AUTO') break;
    }
    throw new ProcessingRoutingError(
      ErrorCode.TOOL_UNAVAILABLE_IN_CURRENT_DEPLOYMENT,
      'No enabled processing engine can safely perform this operation.',
    );
  }

  async process(request: ProcessingRequest, context: ProcessingContext): Promise<ProcessingResult> {
    return (await this.resolve(request, context)).process(request, context);
  }

  private locationOrder(preferred: ProcessingLocation): ResolvedProcessingLocation[] {
    if (preferred === 'BROWSER') return ['BROWSER', 'NODE', 'NATIVE'];
    if (preferred === 'NODE') return ['NODE', 'BROWSER', 'NATIVE'];
    if (preferred === 'NATIVE') return ['NATIVE', 'NODE', 'BROWSER'];
    return ['BROWSER', 'NODE', 'NATIVE'];
  }

  private locationEnabled(
    location: ResolvedProcessingLocation,
    capability: ToolCapability,
    context: ProcessingContext,
  ): boolean {
    const key = location.toLowerCase() as 'browser' | 'node' | 'native';
    const contextKey = `${key}Enabled` as 'browserEnabled' | 'nodeEnabled' | 'nativeEnabled';
    return capability[key].supported && context[contextKey];
  }

  private assertInputLimits(request: ProcessingRequest, capability: ToolCapability): void {
    const requested = request.requestedLocation;
    const candidates = requested && requested !== 'AUTO'
      ? [capability[requested.toLowerCase() as 'browser' | 'node' | 'native']]
      : [capability.browser, capability.node, capability.native].filter((item) => item.supported);
    const maxFiles = Math.max(...candidates.map((item) => item.maxFiles ?? 1));
    const maxBytes = Math.max(...candidates.map((item) => item.maxBytes ?? 0));
    if (request.files.length > maxFiles) {
      throw new ProcessingRoutingError(ErrorCode.TOO_MANY_FILES, `This operation accepts at most ${maxFiles} files.`);
    }
    if (maxBytes > 0 && request.files.some((file) => file.sizeBytes > maxBytes)) {
      throw new ProcessingRoutingError(ErrorCode.FILE_TOO_LARGE, `An input exceeds the ${maxBytes}-byte capability limit.`);
    }
  }
}

export { getToolDefinition, listToolDefinitions };
