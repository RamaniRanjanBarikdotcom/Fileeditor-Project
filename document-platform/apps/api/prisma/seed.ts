import { PrismaClient, SubscriptionPlanTier, ProductType, CurrencyCode, PaymentProvider, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding AppToolkitLab database...');

  // ─── 1. Subscription Plans ───────────────────────────────────

  const freePlan = await prisma.subscriptionPlan.upsert({
    where: { tier: SubscriptionPlanTier.FREE },
    update: {},
    create: {
      tier: SubscriptionPlanTier.FREE,
      name: 'Free Starter',
      monthlyOpsLimit: 300, // ~10 ops/day
      maxFileSizeBytes: BigInt(25 * 1024 * 1024), // 25 MB
      retentionDays: 1, // 24h
      hasApiAccess: false,
      maxTeamSeats: 1,
    },
  });

  const proPlan = await prisma.subscriptionPlan.upsert({
    where: { tier: SubscriptionPlanTier.PRO },
    update: {},
    create: {
      tier: SubscriptionPlanTier.PRO,
      name: 'Pro Developer',
      monthlyOpsLimit: 500,
      maxFileSizeBytes: BigInt(100 * 1024 * 1024), // 100 MB
      retentionDays: 30,
      hasApiAccess: false,
      maxTeamSeats: 1,
    },
  });

  const businessPlan = await prisma.subscriptionPlan.upsert({
    where: { tier: SubscriptionPlanTier.BUSINESS },
    update: {},
    create: {
      tier: SubscriptionPlanTier.BUSINESS,
      name: 'Business Enterprise',
      monthlyOpsLimit: 5000,
      maxFileSizeBytes: BigInt(250 * 1024 * 1024), // 250 MB
      retentionDays: 90,
      hasApiAccess: true,
      maxTeamSeats: 10,
    },
  });

  console.log(`✅ Subscription plans seeded: ${freePlan.name}, ${proPlan.name}, ${businessPlan.name}`);

  // Internal principal used only by the public anonymous-tool pipeline. It is
  // inactive, has no usable password, and can never authenticate interactively.
  const anonymousUser = await prisma.user.upsert({
    where: { email: 'anonymous@internal.toolsuite.local' },
    update: { status: UserStatus.INACTIVE },
    create: {
      email: 'anonymous@internal.toolsuite.local',
      passwordHash: await bcrypt.hash(crypto.randomUUID(), 12),
      firstName: 'Anonymous',
      lastName: 'Tool User',
      status: UserStatus.INACTIVE,
    },
  });

  const anonymousOrganization = await prisma.organization.upsert({
    where: { slug: 'internal-anonymous-tools' },
    update: { planId: freePlan.id },
    create: {
      name: 'Anonymous Tool Sessions',
      slug: 'internal-anonymous-tools',
      ownerUserId: anonymousUser.id,
      planId: freePlan.id,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: {
        organizationId: anonymousOrganization.id,
        userId: anonymousUser.id,
      },
    },
    update: {},
    create: {
      organizationId: anonymousOrganization.id,
      userId: anonymousUser.id,
      role: 'OWNER',
    },
  });

  // ─── 2. Server-Authoritative Tools ───────────────────────────

  const tools = [
    {
      slug: 'pdf-to-docx',
      name: 'PDF to Word Converter',
      category: 'Document',
      engine: 'pdf-extractor',
      acceptedFormats: ['pdf'],
      outputFormats: ['docx'],
      minimumPlan: SubscriptionPlanTier.FREE,
      anonymousEnabled: true,
      costUnits: 1,
      maxFileSizeBytes: BigInt(10 * 1024 * 1024), // 10MB
      isPublished: true,
      isFeatured: true,
      sortOrder: 1,
      seoMetadata: {
        title: 'Free PDF to Word Converter Online — Editable DOCX Output',
        description: 'Convert PDF documents to editable Microsoft Word (DOCX) files with OCR text extraction. Fast, secure, and free online.',
        keywords: ['pdf to word', 'convert pdf to docx', 'pdf text extraction', 'editable word converter'],
      },
    },
    {
      slug: 'pdf-ocr',
      name: 'PDF OCR & Text Extractor',
      category: 'Document',
      engine: 'pdf-extractor',
      acceptedFormats: ['pdf'],
      outputFormats: ['txt'],
      minimumPlan: SubscriptionPlanTier.FREE,
      anonymousEnabled: true,
      costUnits: 1,
      maxFileSizeBytes: BigInt(10 * 1024 * 1024),
      isPublished: true,
      isFeatured: true,
      sortOrder: 2,
      seoMetadata: {
        title: 'Online PDF OCR & Text Extraction Tool',
        description: 'Extract English text from digital and scanned PDF files into a downloadable text file.',
        keywords: ['pdf ocr', 'extract text from pdf', 'scanned pdf extractor'],
      },
    },
    {
      slug: 'url-to-pdf',
      name: 'URL to PDF Web Capture',
      category: 'Web',
      engine: 'chromium',
      acceptedFormats: ['url'],
      outputFormats: ['pdf'],
      minimumPlan: SubscriptionPlanTier.FREE,
      anonymousEnabled: true,
      costUnits: 1,
      maxFileSizeBytes: BigInt(10 * 1024 * 1024),
      isPublished: true,
      isFeatured: true,
      sortOrder: 3,
      seoMetadata: {
        title: 'URL to PDF Converter — Save Web Pages as Clean PDFs',
        description: 'Capture a public webpage into a PDF using a real headless Chromium browser.',
        keywords: ['url to pdf', 'webpage to pdf', 'html webpage snapshot'],
      },
    },
    {
      slug: 'url-to-docx',
      name: 'URL to Word Converter',
      category: 'Web',
      engine: 'chromium',
      acceptedFormats: ['url'],
      outputFormats: ['docx'],
      minimumPlan: SubscriptionPlanTier.FREE,
      anonymousEnabled: true,
      costUnits: 1,
      maxFileSizeBytes: BigInt(10 * 1024 * 1024),
      isPublished: true,
      isFeatured: false,
      sortOrder: 4,
      seoMetadata: {
        title: 'Convert Webpages to Editable Word Documents (DOCX)',
        description: 'Save blog posts, documentation, and articles from any URL directly into Microsoft Word format.',
        keywords: ['url to word', 'web to docx', 'article to word'],
      },
    },
    {
      slug: 'html-to-pdf',
      name: 'HTML to PDF Template Engine',
      category: 'Developer',
      engine: 'chromium',
      acceptedFormats: ['html', 'txt'],
      outputFormats: ['pdf'],
      minimumPlan: SubscriptionPlanTier.FREE,
      anonymousEnabled: true,
      costUnits: 1,
      maxFileSizeBytes: BigInt(10 * 1024 * 1024),
      isPublished: true,
      isFeatured: true,
      sortOrder: 5,
      seoMetadata: {
        title: 'HTML to PDF Converter — High Precision Rendering',
        description: 'Render HTML and CSS into a PDF using a headless Chromium browser.',
        keywords: ['html to pdf', 'convert html to pdf', 'pdf template generator'],
      },
    },
    {
      slug: 'markdown-to-pdf',
      name: 'Markdown to PDF Converter',
      category: 'Developer',
      engine: 'pandoc',
      acceptedFormats: ['markdown', 'md'],
      outputFormats: ['pdf'],
      minimumPlan: SubscriptionPlanTier.FREE,
      anonymousEnabled: true,
      costUnits: 1,
      maxFileSizeBytes: BigInt(10 * 1024 * 1024),
      isPublished: true,
      isFeatured: false,
      sortOrder: 6,
      seoMetadata: {
        title: 'Markdown to PDF Converter — GitHub Flavored Markdown',
        description: 'Format and export Markdown documentation, technical specs, and notes into beautifully styled PDFs.',
        keywords: ['markdown to pdf', 'md to pdf', 'gfm pdf export'],
      },
    },
    {
      slug: 'image-to-pdf',
      name: 'Image to PDF Converter',
      category: 'Image',
      engine: 'image-worker',
      acceptedFormats: ['png', 'jpg', 'jpeg'],
      outputFormats: ['pdf'],
      minimumPlan: SubscriptionPlanTier.FREE,
      anonymousEnabled: true,
      costUnits: 1,
      maxFileSizeBytes: BigInt(10 * 1024 * 1024),
      isPublished: true,
      isFeatured: false,
      sortOrder: 7,
      seoMetadata: {
        title: 'Convert Images to PDF Online (PNG, JPG, JPEG)',
        description: 'Convert a PNG, JPG, or JPEG image into a PDF file.',
        keywords: ['image to pdf', 'jpg to pdf', 'png to pdf'],
      },
    },
    {
      slug: 'document-editor',
      name: 'Online Document Studio',
      category: 'Studio',
      engine: 'docx-generator',
      acceptedFormats: ['md', 'html', 'txt'],
      outputFormats: ['pdf', 'docx', 'html', 'markdown'],
      minimumPlan: SubscriptionPlanTier.FREE,
      anonymousEnabled: true,
      costUnits: 1,
      maxFileSizeBytes: BigInt(10 * 1024 * 1024),
      isPublished: true,
      isFeatured: true,
      sortOrder: 8,
      seoMetadata: {
        title: 'Online Rich Document Studio & Exporter',
        description: 'Compose, format, and export documents directly to PDF, DOCX, and HTML in a modern rich-text workspace.',
        keywords: ['online document editor', 'rich text editor', 'document studio'],
      },
    },
  ];

  for (const tool of tools) {
    await prisma.tool.upsert({
      where: { slug: tool.slug },
      update: tool,
      create: tool,
    });
  }

  console.log(`✅ ${tools.length} Launch tools seeded in registry.`);

  // ─── 3. Initial Software & Automation Products ───────────────

  const products = [
    {
      slug: 'apptoolkitlab-desktop-cli',
      name: 'AppToolkitLab CLI Pro Engine',
      tagline: 'High-throughput command-line document conversion & automation tool',
      description: 'A cross-platform binary CLI for batch converting PDFs, URLs, Markdown, and HTML with hardware acceleration.',
      type: ProductType.SOFTWARE,
      isPublished: true,
      isFeatured: true,
      sortOrder: 1,
      prices: {
        create: [
          {
            currency: CurrencyCode.USD,
            amountMinorUnits: 2900, // $29.00
            provider: PaymentProvider.STRIPE,
          },
          {
            currency: CurrencyCode.INR,
            amountMinorUnits: 249900, // ₹2,499.00
            provider: PaymentProvider.RAZORPAY,
          },
        ],
      },
    },
    {
      slug: 'nextjs-saas-starter-kit',
      name: 'Enterprise Next.js SaaS Boilerplate',
      tagline: 'Production-ready Next.js 16 + NestJS + Stripe + Razorpay boilerplate',
      description: 'Complete full-stack starter kit with authentication, dual payment routing, rate limiting, and PostgreSQL integration.',
      type: ProductType.SOFTWARE,
      isPublished: true,
      isFeatured: true,
      sortOrder: 2,
      prices: {
        create: [
          {
            currency: CurrencyCode.USD,
            amountMinorUnits: 4900, // $49.00
            provider: PaymentProvider.STRIPE,
          },
          {
            currency: CurrencyCode.INR,
            amountMinorUnits: 399900, // ₹3,999.00
            provider: PaymentProvider.RAZORPAY,
          },
        ],
      },
    },
  ];

  for (const prod of products) {
    const existing = await prisma.product.findUnique({ where: { slug: prod.slug } });
    if (!existing) {
      await prisma.product.create({
        data: prod,
      });
    }
  }

  console.log('✅ Initial software marketplace products seeded.');
  console.log('🎉 Seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
