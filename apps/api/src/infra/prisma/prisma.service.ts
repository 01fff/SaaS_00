import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  async withTenant<T>(
    schema: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    await this.$executeRawUnsafe(`SET search_path = "${schema}"`);
    return fn();
  }
}
