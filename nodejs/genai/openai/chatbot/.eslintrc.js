module.exports = {
  extends: 'airbnb-base',
  ignorePatterns: ['resources/*'],
  rules: {
    'linebreak-style': ['error', (process.platform === 'win32' ? 'windows' : 'unix')],
  },
};
