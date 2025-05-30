module.exports = {
  extends: 'airbnb-base',
  ignorePatterns: ['resources/*'],
  rules: {
    'linebreak-style': ['error', (process.platform === 'win32' ? 'windows' : 'unix')],
    'max-len': ['error', {
      code: 200, // Set the desired maximum line length here (e.g., 120)
      ignoreUrls: true, // Optional: Ignore lines containing URLs
      ignoreStrings: false, // Optional: Apply limit to string literals (default is often false)
      ignoreTemplateLiterals: false, // Optional: Apply limit to template literals (default is often false)
      ignoreComments: false, // Optional: Apply limit to comments (default is often false)
      // You can add other options here if needed
    }],
  },
};
