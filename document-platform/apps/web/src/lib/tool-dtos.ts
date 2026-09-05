import { SubscriptionPlanTier, ToolDto } from '@docconv/shared-types';
import { getToolDefinition, listToolDefinitions } from '@docconv/tool-registry';

const MB = 1024 * 1024;

/**
 * Public, build-time tool metadata. The database may enrich or override this
 * metadata, but a public tool page must never disappear merely because the API
 * or database is temporarily unavailable.
 */
export function createStaticToolDto(slug: string): ToolDto | undefined {
  const definition = getToolDefinition(slug);
  if (!definition) return undefined;

  const preferredKey = definition.capability.preferred.toLowerCase() as 'browser' | 'node' | 'native';
  const preferredLimit =
    definition.capability[preferredKey]?.maxBytes ||
    definition.capability.browser.maxBytes ||
    definition.capability.node.maxBytes ||
    definition.capability.native.maxBytes;
  const maxFileSizeBytes = Math.min(250 * MB, Math.max(1, preferredLimit || 10 * MB));

  return {
    id: definition.id,
    slug: definition.slug,
    name: definition.title,
    category: definition.category,
    engine: definition.capability.preferred.toLowerCase(),
    acceptedFormats: definition.inputTypes,
    outputFormats: definition.outputTypes,
    minimumPlan: SubscriptionPlanTier.FREE,
    anonymousEnabled: true,
    costUnits: 1,
    maxFileSizeBytes,
    isPublished: definition.availability !== 'COMING_SOON',
    isFeatured: true,
    sortOrder: listToolDefinitions().findIndex((tool) => tool.slug === slug) + 1,
    seoMetadata: {
      title: definition.title,
      description: definition.description,
      canonical: `https://apptoolkitlab.com/tools/${definition.slug}`,
    },
    operation: definition.operation,
    availability: definition.availability,
    capability: definition.capability,
    privacy: definition.privacy,
  };
}

export function listStaticToolDtos(): ToolDto[] {
  return listToolDefinitions()
    .map((tool) => createStaticToolDto(tool.slug))
    .filter((tool): tool is ToolDto => Boolean(tool));
}
