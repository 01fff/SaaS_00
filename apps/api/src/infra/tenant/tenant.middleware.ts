import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from './tenant.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostname = req.hostname;
      
      // Extrair slug do subdomínio
      const parts = hostname.split('.');
      
      // Validar: localhost ou algo.localhost ou algo.com.br
      if (parts.length < 2) {
        res.status(400).json({ error: 'Invalid hostname' });
        return;
      }

      // Ignorar "www"
      let slug = parts[0];
      if (slug === 'www' && parts.length > 1) {
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
