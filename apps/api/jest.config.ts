import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          resolvePackageJsonExports: false,
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
  ],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    './src/infra/**': {
      lines: 80,
      functions: 80,
    },
    './src/modules/**': {
      lines: 70,
      functions: 70,
    },
  },
  moduleNameMapper: {
    '^@saas-clinica/types$': '<rootDir>/../../packages/types/src/index.ts',
    '^@saas-clinica/types/(.*)$': '<rootDir>/../../packages/types/src/$1',
    '^@saas-clinica/utils$': '<rootDir>/../../packages/utils/src/index.ts',
    '^@saas-clinica/utils/(.*)$': '<rootDir>/../../packages/utils/src/$1',
  },
};

export default config;
