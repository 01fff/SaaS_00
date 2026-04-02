import type { Config } from 'jest';
import { pathsToModuleNameMapper } from 'ts-jest';
import { compilerOptions } from './tsconfig.json';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths, {
    prefix: '<rootDir>/',
  }),
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    'apps/**/*.ts',
    'src/**/*.ts',
    '!apps/**/*.spec.ts',
    '!apps/**/*.test.ts',
    '!apps/**/index.ts',
    '!src/**/*.spec.ts',
    '!src/**/*.test.ts',
  ],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps'],
  moduleDirectories: ['node_modules', '<rootDir>'],

  coverageThreshold: {
    global: {
      lines: 50,
      functions: 50,
      branches: 50,
      statements: 50,
    },
    'apps/api/src/infra/**': {
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
    'apps/api/src/modules/**': {
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  },

  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};

export default config;
