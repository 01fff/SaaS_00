import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

const mockPrismaService = {
  usuario: {
    findUnique: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const usuarioAtivo = {
  id: 'uuid-1',
  email: 'admin@clinica.com',
  senha_hash: 'hash_valido',
  perfil: 'ADMIN',
  ativo: true,
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('deve gerar access_token e refresh_token com credenciais válidas', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(usuarioAtivo);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      mockJwtService.sign
        .mockReturnValueOnce('access_token_jwt')
        .mockReturnValueOnce('refresh_token_jwt');

      const result = await service.login('admin@clinica.com', 'senha123');

      expect(result).toEqual({
        access_token: 'access_token_jwt',
        refresh_token: 'refresh_token_jwt',
      });
      expect(mockPrismaService.usuario.findUnique).toHaveBeenCalledWith({
        where: { email: 'admin@clinica.com' },
      });
    });

    it('deve lançar UnauthorizedException quando usuário não existe', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(null);

      await expect(
        service.login('naoexiste@clinica.com', 'senha123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('deve lançar UnauthorizedException quando senha incorreta', async () => {
      mockPrismaService.usuario.findUnique.mockResolvedValue(usuarioAtivo);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      await expect(
        service.login('admin@clinica.com', 'senha_errada'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refreshToken', () => {
    it('deve renovar access_token com refresh_token válido', async () => {
      mockJwtService.verify.mockReturnValue({
        sub: 'uuid-1',
        email: 'admin@clinica.com',
        perfil: 'ADMIN',
      });
      mockJwtService.sign.mockReturnValue('novo_access_token');

      const result = await service.refreshToken('refresh_token_valido');

      expect(result).toEqual({ access_token: 'novo_access_token' });
      expect(mockJwtService.verify).toHaveBeenCalledWith('refresh_token_valido');
    });

    it('deve lançar UnauthorizedException com refresh_token inválido', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refreshToken('token_invalido')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
