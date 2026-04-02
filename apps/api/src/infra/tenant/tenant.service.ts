import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  async getBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
    });

    if (!tenant || tenant.status !== 'ATIVO') {
      throw new ForbiddenException('Tenant não encontrado ou inativo');
    }

    return tenant;
  }
}
