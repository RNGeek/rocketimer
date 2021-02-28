module.exports = {
  testMatch: ['<rootDir>/src/**/*.test.ts?(x)'],
  collectCoverageFrom: ['src/lib/**/*.ts'],
  moduleNameMapper: {
    '\\.mp3$': '<rootDir>/__mocks__/fileMock.js',
  },
};