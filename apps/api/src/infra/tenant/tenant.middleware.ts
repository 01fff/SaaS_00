import {
  Injectable,
  NestMiddleware,
  ForbiddenException,
} from '@nestjs/common';
import { Request, NextFunction } from 'express';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantService: TenantService) {}

  async use(req: Request, res: any, next: NextFunction) {
    try {
      const parts = req.hostname.split('.');

      // Validar: precisa ter pelo menos 2 partes (ex: clinica.localhost ou clinica.example.com)
      if (parts.length < 2) {
        res.status(400).json({ error: 'Invalid hostname' });
        return;
      }

      let slug = parts[0];

      // Ignorar www
      if (slug === 'www') {
        slug = parts[1];
      }

      // Validar slug vazio
      if (!slug || slug.length === 0) {
        res.status(400).json({ error: 'Invalid slug' });
        return;
      }

      // Buscar tenant
      const tenant = await this.tenantService.getBySlug(slug);

      // Adicionar ao contexto
      (req as any).tenant = tenant;
      (req as any).tenantSchema = tenant.schema_name;

      next();
    } catch (error) {
      if (error instanceof ForbiddenException) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }

      res.status(400).json({ error: 'Bad request' });
    }
  }
}
