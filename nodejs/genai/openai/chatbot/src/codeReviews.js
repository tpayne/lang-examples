const logger = require('./logger');
const OpenAI = require('openai');

const { getConfig } = require('./properties');

const {
  fetchRepoContentsRecursive,
} = require('./gitFunctions');

const {
  createUniqueTempDir,
  deleteDirectoryRecursively,
  readFilesInDirectory,
} = require('./utilities');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* eslint-disable no-restricted-syntax, no-await-in-loop, consistent-return */

async function analyzeCode(fileContent,
  analysisRequest, ai) {
  try {    
    const response = await openai.chat.completions.create({
      model: getConfig().aiModel,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that analyzes code '+
                   ' and spots issues, security problems and bugs. '+
                   'You explain the issues, but aim to be concise',
        },
        {
          role: 'user',
          content: `${analysisRequest}:\n\n\`\`\`\n${fileContent}\n\`\`\``,
        },
      ],
      max_tokens: Number(getConfig().maxTokens),
      temperature: 0.2, // Lower temperature for more focused analysis
    });

    if (response.choices && response.choices[0].message &&
      response.choices[0].message.content) {
      return response.choices[0].message.content.trim();
    }
    return null;
  } catch(error) {
    throw error;
  }
}
/**
 * Lists the names of public repositories for a given GitHub username.
 * Fetches repo data and extracts the 'name' property.
 * Handles API errors and "Not Found" exceptions.
 * @async
 * @param {string} username The GitHub username.
 * @param {string} repoName The GitHub repo name.
 * @param {string} repoPath The GitHub path name.
 * @returns {Promise<string[]>} Array of public repository names.
 * @throws {Error} If API request fails or user is not found.
 */
async function codeReviews(username, repoName, repoPath) {
  const analysisRequest = 'Explain what this code does and identify' +
                          ' any potential issues or areas for improvement.';
  const responseMap = new Map();
  try {
    const tmpDir = await createUniqueTempDir();
    const response = await fetchRepoContentsRecursive(
      username,
      repoName,
      repoPath,
      tmpDir,
      false,
    );
    if (!response.success) {
      return {
        success: false,
        message: response.message,
      };
    }
    const files = await readFilesInDirectory(tmpDir);

    await deleteDirectoryRecursively(tmpDir);
    let count = 0;
    const counter = files.size; // Assuming files is an array
    for (const [fileN, fileContent] of files) {
      if (!fileContent) {
        continue;
      }

      const analysis = await analyzeCode(fileContent, analysisRequest, openai);
      count++;
      responseMap.set(fileN, analysis); 
    }

    return Array.from(responseMap.entries()).map(([fileN, analysis]) => ({
      fileName: fileN,
      result: analysis,
    }));
  } catch (error) {
    logger.error(`Error getting files for review (exception): ${error.message || error}`);
    throw error;
  }
}

module.exports = {
  codeReviews,
};
