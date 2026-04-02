import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockPrismaService = {
  usuario: {
    findUnique: jest.fn(),
  },
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('deve gerar access_token + refresh_token no login bem-sucedido', async () => {
      const usuario = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        senha_hash: 'hashed_password_123',
        roles: ['profissional'],
        status: 'ATIVO',
      };

      const accessToken = 'access.token.here';
      const refreshToken = 'refresh.token.here';

      mockPrismaService.usuario.findUnique.mockResolvedValue(usuario);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign
        .mockReturnValueOnce(accessToken)
        .mockReturnValueOnce(refreshToken);

      const result = await service.login('usuario@email.com', 'senha123');

      expect(result).toEqual({
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: usuario.id,
          email: usuario.email,
          roles: usuario.roles,
        },
      });
    });

    it('deve gerar access_token com tempo de expiração 15 minutos', async () => {
      const usuario = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        senha_hash: 'hashed_password_123',
        roles: ['profissional'],
        status: 'ATIVO',
      };

      mockPrismaService.usuario.findUnique.mockResolvedValue(usuario);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('token');

      await service.login('usuario@email.com', 'senha123');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          expiresIn: '15m',
        }),
      );
    });

    it('deve gerar refresh_token com tempo de expiração 7 dias', async () => {
      const usuario = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        senha_hash: 'hashed_password_123',
        roles: ['profissional'],
        status: 'ATIVO',
      };

      mockPrismaService.usuario.findUnique.mockResolvedValue(usuario);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('token');

      await service.login('usuario@email.com', 'senha123');

      // Chamada ao sign para refresh_token
      const secondCall = mockJwtService.sign.mock.calls[1];
      expect(secondCall[1]).toEqual(
        expect.objectContaining({
          expiresIn: '7d',
        }),
      );
    });

    it('deve usar bcrypt com rounds = 12 para comparar senha', async () => {
      const usuario = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        senha_hash: 'hashed_password_123',
        roles: ['profissional'],
        status: 'ATIVO',
      };

      mockPrismaService.usuario.findUnique.mockResolvedValue(usuario);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('token');

      await service.login('usuario@email.com', 'senha123');

      expect(bcrypt.compare).toHaveBeenCalledWith('senha123', usuario.senha_hash);
    });

    it('deve lançar UnauthorizedException para senha incorreta', async () => {
      const usuario = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        senha_hash: 'hashed_password_123',
        roles: ['profissional'],
        status: 'ATIVO',
      };

      mockPrismaService.usuario.findUnique.mockResolvedValue(usuario);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('usuario@email.com', 'senhaErrada')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException para usuário inexistente', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      await expect(service.login('naoexiste@email.com', 'senha123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve negar login para usuário INATIVO', async () => {
      const usuario = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        senha_hash: 'hashed_password_123',
        roles: ['profissional'],
        status: 'INATIVO',
      };

      mockPrismaService.usuario.findUnique.mockResolvedValue(usuario);

      await expect(service.login('usuario@email.com', 'senha123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve negar login para usuário SUSPENSO', async () => {
      const usuario = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        senha_hash: 'hashed_password_123',
        roles: ['profissional'],
        status: 'SUSPENSO',
      };

      mockPrismaService.usuario.findUnique.mockResolvedValue(usuario);

      await expect(service.login('usuario@email.com', 'senha123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve incluir payload correto no access_token', async () => {
      const usuario = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        senha_hash: 'hashed_password_123',
        roles: ['profissional'],
        status: 'ATIVO',
      };

      mockPrismaService.usuario.findUnique.mockResolvedValue(usuario);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwtService.sign.mockReturnValue('token');

      await service.login('usuario@email.com', 'senha123');

      const firstCall = mockJwtService.sign.mock.calls[0];
      expect(firstCall[0]).toEqual({
        id: usuario.id,
        email: usuario.email,
        roles: usuario.roles,
      });
    });
  });

  describe('refresh', () => {
    it('deve renovar access_token com refresh_token válido', async () => {
      const payload = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        roles: ['profissional'],
      };

      const newAccessToken = 'new.access.token';

      mockJwtService.verify.mockReturnValue(payload);
      mockJwtService.sign.mockReturnValue(newAccessToken);

      const result = await service.refreshToken('valid.refresh.token');

      expect(result).toEqual({
        access_token: newAccessToken,
      });
    });

    it('deve usar payload do refresh_token para gerar novo access_token', async () => {
      const payload = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        roles: ['profissional'],
      };

      mockJwtService.verify.mockReturnValue(payload);
      mockJwtService.sign.mockReturnValue('new.token');

      await service.refreshToken('valid.refresh.token');

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        payload,
        expect.objectContaining({
          expiresIn: '15m',
        }),
      );
    });

    it('deve lançar UnauthorizedException para refresh_token inválido', async () => {
      mockJwtService.verify.mockThrowValue(new Error('invalid signature'));

      await expect(service.refreshToken('invalid.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('deve lançar UnauthorizedException para refresh_token expirado', async () => {
      mockJwtService.verify.mockThrowValue(new Error('jwt expired'));

      await expect(service.refreshToken('expired.token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('hash password', () => {
    it('deve hashear senha com bcrypt rounds = 12', async () => {
      const senha = 'minhasenha123';
      const hashedPassword = 'bcrypt_hash_123';

      (bcrypt.hash as jest.Mock).mockResolvedValue(hashedPassword);

      const result = await service.hashPassword(senha);

      expect(bcrypt.hash).toHaveBeenCalledWith(senha, 12);
      expect(result).toBe(hashedPassword);
    });
  });

  describe('validate token', () => {
    it('deve validar token JWT válido', () => {
      const token = 'valid.token.here';
      const payload = {
        id: 'uuid-1',
        email: 'usuario@email.com',
        roles: ['profissional'],
      };

      mockJwtService.verify.mockReturnValue(payload);

      const result = service.validateToken(token);

      expect(result).toEqual(payload);
      expect(mockJwtService.verify).toHaveBeenCalledWith(token);
    });

    it('deve lançar erro para token inválido', () => {
      mockJwtService.verify.mockThrowValue(new Error('invalid signature'));

      expect(() => service.validateToken('invalid.token')).toThrow();
    });

    it('deve lançar erro para token expirado', () => {
      mockJwtService.verify.mockThrowValue(new Error('jwt expired'));

      expect(() => service.validateToken('expired.token')).toThrow();
    });
  });
});
