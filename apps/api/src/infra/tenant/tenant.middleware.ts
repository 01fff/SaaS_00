import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const slug = req.hostname.split('.')[0];
    const tenant = await this.tenantService.getBySlug(slug);
    req['tenantSchema'] = tenant.schema_name;
    next();
  }
}
