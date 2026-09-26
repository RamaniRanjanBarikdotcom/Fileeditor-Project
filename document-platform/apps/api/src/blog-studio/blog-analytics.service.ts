import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

const startOfDay = (d: Date) => { const nd = new Date(d); nd.setHours(0,0,0,0); return nd; };
const subDays = (d: Date, days: number) => { const nd = new Date(d); nd.setDate(nd.getDate() - days); return nd; };
const format = (d: Date) => d.toISOString().split('T')[0];
    

@Injectable()
export class BlogAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardMetrics(organizationId: string, days = 30) {
    const startDate = subDays(startOfDay(new Date()), days);

    // 1. Generation Stats
    const generationJobs = await this.prisma.blogGenerationJob.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate }
      },
      select: {
        status: true,
        createdAt: true,
      }
    });

    const totalGenerated = generationJobs.length;
    const completedGenerated = generationJobs.filter((j: any) => j.status === 'COMPLETED').length;
    const failedGenerated = generationJobs.filter((j: any) => j.status === 'FAILED').length;

    // 2. Publication Stats
    const publications = await this.prisma.blogPublication.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate }
      },
      select: {
        status: true,
        createdAt: true,
      }
    });

    const totalPublished = publications.filter((p: any) => p.status === 'PUBLISHED').length;

    // 3. Document Stats
    const documents = await this.prisma.blogDocument.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate }
      },
      select: {
        wordCount: true,
        seoScore: true,
      }
    });

    const totalWords = documents.reduce((acc: any, doc: any) => acc + ((doc.wordCount as number) || 0), 0);
    const avgSeoScore = documents.length > 0 
      ? documents.reduce((acc: any, doc: any) => acc + ((doc.seoScore as number) || 0), 0) / documents.length 
      : 0;

    // 4. Usage/Credits (aggregated from saas usage records if available, or just estimating)
    const usageRecords = await this.prisma.saasUsageRecord.findMany({
      where: {
        organizationId,
        
        createdAt: { gte: startDate }
      },
      select: {
        credits: true,
        createdAt: true,
      }
    });

    const totalCreditsUsed = usageRecords.reduce((acc: any, record: any) => acc + ((record.credits as number) || 0), 0);

    // 5. Daily Trend (for charts)
    const dailyTrend = this.buildDailyTrend(generationJobs, publications, startDate, days);

    return {
      overview: {
        totalGenerated,
        completedGenerated,
        failedGenerated,
        totalPublished,
        totalWords,
        avgSeoScore: Math.round(avgSeoScore),
        totalCreditsUsed,
      },
      trend: dailyTrend,
    };
  }

  async getAdminMetrics() {
    const now = new Date();
    const activeCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [documents, jobs, publications, activeOrganizations, usage] = await Promise.all([
      this.prisma.blogDocument.count({ where: { status: { not: 'DELETED' } } }),
      this.prisma.blogGenerationJob.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.blogPublication.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.blogGenerationJob.groupBy({
        by: ['organizationId'],
        where: { createdAt: { gte: activeCutoff } },
      }),
      this.prisma.saasUsageRecord.aggregate({
        _sum: { credits: true, completedBlogs: true, imageCount: true },
      }),
    ]);
    return {
      documents,
      jobs: Object.fromEntries(jobs.map((item) => [item.status, item._count._all])),
      publications: Object.fromEntries(
        publications.map((item) => [item.status, item._count._all]),
      ),
      activeOrganizations: activeOrganizations.length,
      creditsConsumed: usage._sum.credits || 0,
      completedBlogs: usage._sum.completedBlogs || 0,
      generatedImages: usage._sum.imageCount || 0,
    };
  }

  private buildDailyTrend(jobs: any[], publications: any[], startDate: Date, days: number) {
    const trend: Record<string, { generations: number, publications: number }> = {};
    
    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = format(date) as string;
      trend[dateStr] = { generations: 0, publications: 0 };
    }

    for (const job of jobs) {
      if (job.status === 'COMPLETED') {
        const dateStr = format(new Date(job.createdAt)) as string;
        if (trend[dateStr]) trend[dateStr].generations++;
      }
    }

    for (const pub of publications) {
      if (pub.status === 'PUBLISHED') {
        const dateStr = format(new Date(pub.createdAt)) as string;
        if (trend[dateStr]) trend[dateStr].publications++;
      }
    }

    return Object.keys(trend).sort().map(date => ({
      date,
      generations: trend[date]!.generations,
      publications: trend[date]!.publications,
    }));
  }
}
