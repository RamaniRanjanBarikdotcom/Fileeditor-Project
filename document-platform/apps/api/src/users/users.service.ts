import { Injectable } from '@nestjs/common';
import { isBlogStudioTheme, type BlogStudioTheme } from '@docconv/shared-types';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        status: true,
        blogStudioTheme: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async updateProfile(id: string, data: { firstName?: string; lastName?: string }) {
    // Copy only editable fields; never pass request bodies to Prisma directly.
    return this.prisma.user.update({
      where: { id },
      data: { firstName: data.firstName, lastName: data.lastName },
      select: { id: true, email: true, firstName: true, lastName: true },
    });
  }

  async updatePreferences(id: string, data: { blogStudioTheme: BlogStudioTheme }) {
    if (!isBlogStudioTheme(data.blogStudioTheme)) throw new Error('Unknown Blog Studio theme.');
    return this.prisma.user.update({
      where: { id },
      data: { blogStudioTheme: data.blogStudioTheme },
      select: { blogStudioTheme: true },
    });
  }
}
