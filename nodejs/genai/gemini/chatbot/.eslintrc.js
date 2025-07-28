module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2022: true, // Use a recent ECMAScript version (e.g., 2022 for dynamic import support)
    node: true,
  },
  extends: [
    'airbnb-base', // Assuming you are using airbnb-base config
  ],
  ignorePatterns: ['resources/*'],
  parserOptions: {
    ecmaVersion: 2022, // Crucial: Set to 2020 or higher for dynamic import()
    sourceType: 'script', // Keep as 'script' because the file uses 'require' (CommonJS)
                          // and dynamic import is allowed in script mode.
  },
  rules: {
    'linebreak-style': ['error', (process.platform === 'win32' ? 'windows' : 'unix')],
    'max-len': ['error', {
      code: 300, // Set the desired maximum line length here (e.g., 120)
      ignoreUrls: true, // Optional: Ignore lines containing URLs
      ignoreStrings: false, // Optional: Apply limit to string literals (default is often false)
      ignoreTemplateLiterals: false, // Optional: Apply limit to template literals (default is often false)
      ignoreComments: false, // Optional: Apply limit to comments (default is often false)
      // You can add other options here if needed
    }],
  },
};
