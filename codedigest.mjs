#!/usr/bin/env node

/**
 * codedigest.mjs - A Node.js script to generate a digest of a directory's structure and file contents.
 *
 * @module codedigest.mjs
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, lstatSync, readdirSync, readlinkSync, openSync, readSync, closeSync } from 'node:fs';
import { join, extname, dirname, relative, resolve, sep, normalize } from 'node:path';

const MAX_FILE_SIZE        = 10 * 1024 * 1024;  // 10 MB
const MAX_DIRECTORY_DEPTH  = 20;
const MAX_TOTAL_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const CHUNK_SIZE           = 1024 * 1024;       // 1 MB

/**
 * Default patterns to ignore.
 *
 * @type {Set<string>}
 */
const DEFAULT_IGNORE_PATTERNS = new Set([
  '*.pyc',           '*.pyo',           '*.pyd',           '__pycache__',     '.pytest_cache',
  '.coverage',       '.tox',            '.nox',            '.mypy_cache',     '.ruff_cache',
  '.hypothesis',     'poetry.lock',     'Pipfile.lock',    'node_modules',    'bower_components',
  'package-lock.json','yarn.lock',      '.npm',            '.yarn',           '.pnpm-store',
  '*.class',         '*.jar',           '*.war',           '*.ear',           '*.nar',
  '.gradle/',        'build/',          '.settings/',      '.classpath',      'gradle-app.setting',
  '*.gradle',        '.project',        '*.o',             '*.obj',           '*.dll',
  '*.dylib',         '*.exe',           '*.lib',           '*.out',           '*.a',
  '*.pdb',           '.build/',         '*.xcodeproj/',    '*.xcworkspace/',  '*.pbxuser',
  '*.mode1v3',       '*.mode2v3',       '*.perspectivev3', '*.xcuserstate',   'xcuserdata/',
  '.swiftpm/',       '*.gem',           '.bundle/',        'vendor/bundle',   'Gemfile.lock',
  '.ruby-version',   '.ruby-gemset',    '.rvmrc',          'Cargo.lock',      '**/*.rs.bk',
  'target/',         'pkg/',            'obj/',            '*.suo',           '*.user',
  '*.userosscache',  '*.sln.docstates', 'packages/',       '*.nupkg',         'bin/',
  '.git',            '.svn',            '.hg',             '.gitignore',      '.gitattributes',
  '.gitmodules',     '*.svg',           '*.png',           '*.jpg',           '*.jpeg',
  '*.gif',           '*.ico',           '*.pdf',           '*.mov',           '*.mp4',
  '*.mp3',           '*.wav',           'venv',            '.venv',           'env',
  '.env',            'virtualenv',      '.idea',           '.vscode',         '.vs',
  '*.swo',           '*.swn',           '.settings',       '*.sublime-*',     '*.log',
  '*.bak',           '*.swp',           '*.tmp',           '*.temp',          '.cache',
  '.sass-cache',     '.eslintcache',    '.DS_Store',       'Thumbs.db',       'desktop.ini',
  'build',           'dist',            'target',          'out',             '*.egg-info',
  '*.egg',           '*.whl',           '*.so',            'site-packages',   '.docusaurus',
  '.next',           '.nuxt',           '*.min.js',        '*.min.css',       '*.map',
  '.terraform',      '*.tfstate*',      'vendor/',
]);

/**
 * ANSI escape codes for formatting.
 */
const FORMAT = {
  bold:   (text) => `\x1b[1m${text}\x1b[0m`,
  red:    (text) => `\x1b[31m${text}\x1b[0m`,
  green:  (text) => `\x1b[32m${text}\x1b[0m`,
  yellow: (text) => `\x1b[33m${text}\x1b[0m`,
  white:  (text) => `\x1b[37m${text}\x1b[0m`,
  gray:   (text) => `\x1b[90m${text}\x1b[0m`,
  invert: (text) => `\x1b[7m${text}\x1b[27m`,
};

/**
 * @typedef {Object} FileInfo
 * @property {string} path - The relative path of the file.
 * @property {string} content - The content of the file.
 * @property {number} size - The size of the file in bytes.
 */

/**
 * @typedef {Object} ProcessingStats
 * @property {number} totalSize - The total size of processed files in bytes.
 * @property {number} fileCount - The number of files processed.
 * @property {Set<string>} seenPaths - A set of resolved paths to detect circular references.
 * @property {Set<string>} seenSymlinks - A set of "entry:target" symlink pairs to detect circular symlinks.
 * @property {Array<{timestamp: string, message: string, stack?: string}>} errors - An array of error objects.
 * @property {number} skippedFiles - The number of files skipped due to exceeding maxFileSize.
 * @property {number} excludedFiles - The number of files excluded by pattern.
 * @property {number} nonTextFiles - The number of files excluded because they are not text files.
 * @property {boolean} sizeLimitReached - Indicates if the total size limit was reached.
 * @property {number} startTime - Timestamp of the start of processing.
 * @property {Set<string>} matchedIgnorePatterns - Set of ignore patterns that matched at least one file/directory.
 */

/**
 * @typedef {Object} ProcessingOptions
 * @property {string[]} ignorePatterns - Patterns of files and directories to ignore.
 * @property {string[]} includePatterns - Patterns of files and directories to include.
 * @property {number} maxFileSize - Maximum file size to process.
 * @property {number} maxTotalSize - Maximum total size of files to process.
 * @property {number} maxDepth - Maximum directory traversal depth.
 * @property {string} rootPath - The absolute path of the root directory being processed.
 * @property {boolean} quiet - Whether to suppress Added and Skipped messages.
 * @property {boolean} ultraQuiet - Whether to suppress all non-error output.
 * @property {boolean} omitExcluded - Whether to omit excluded files from the directory tree.
 */

/**
 * Creates a new ProcessingStats object.
 *
 * @returns {ProcessingStats} A new ProcessingStats object.
 */
const createStats = () => ({
  totalSize:             0,
  fileCount:             0,
  seenPaths:             new Set(),
  seenSymlinks:          new Set(),
  errors:                [],
  skippedFiles:          0,
  excludedFiles:         0,
  nonTextFiles:          0,
  sizeLimitReached:      false,
  startTime:             Date.now(),
  matchedIgnorePatterns: new Set(),

  /**
   * Adds an error to the errors array.
   *
   * @param {Error} error - The error object to add.
   */
  addError(error) {
    this.errors.push({
      timestamp: new Date().toISOString(),
      message:   error.message,
      stack:     error.stack,
    });
  },
});

/**
 * Matches a file path against a glob pattern.
 *
 * @param {string} path - The file path to match.
 * @param {string} pattern - The glob pattern to match against.
 * @param {Object} [opts={}] - Options for matching.
 * @param {boolean} [opts.nocase=false] - Perform case-insensitive matching.
 * @param {boolean} [opts.dot=false] - Match dotfiles.
 * @returns {boolean} True if the path matches the pattern, false otherwise.
 */
function miniMatch(path, pattern, opts = {}) {
  try {
    if (!pattern || typeof pattern !== 'string') {
      console.warn(`Invalid pattern: ${pattern}`);
      return false;
    }

    const options         = { nocase: false, dot: false, ...opts };
    const { nocase, dot } = options;

    /**
     * Escapes special regular expression characters in a string.
     *
     * @param {string} s - The string to escape.
     * @returns {string} The escaped string.
     */
    const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    let pat = pattern;
    let neg = false;
    if (pat.startsWith('!')) {
      neg = true;
      pat = pat.slice(1);
    }

    const parts     = pat.split(sep);
    const pathParts = path.split(sep);

    /**
     * Matches a single path part against a pattern part.
     *
     * @param {string} pathPart - The path part.
     * @param {string} patPart - The pattern part.
     * @returns {boolean} True if the parts match, false otherwise.
     */
    const matchPart = (pathPart, patPart) => {
      if (patPart === '**') return true;
      const regexStr = patPart.split('*').map(escapeRegExp).join('.*');
      const regex    = new RegExp(`^${regexStr}$`, nocase ? 'i' : '');
      return regex.test(pathPart);
    };

    if (!dot && path.split('/').some((part) => part.startsWith('.'))) {
      if (!pat.split('/').some((part) => part.startsWith('.'))) {
        return false;
      }
    }

    /**
     * Recursively matches path parts against pattern parts.
     *
     * @param {string[]} pathParts - The path parts.
     * @param {string[]} patParts - The pattern parts.
     * @returns {boolean} True if the path matches the pattern, false otherwise.
     */
    const match = (pathParts, patParts) => {
      if (patParts.length === 0) return pathParts.length === 0;
      if (patParts[0] === '**') {
        if (patParts.length === 1) return true;
        for (let i = 0; i <= pathParts.length; i++) {
          if (match(pathParts.slice(i), patParts.slice(1))) return true;
        }
        return false;
      }
      if (pathParts.length === 0 || !matchPart(pathParts[0], patParts[0]))
        return false;
      return match(pathParts.slice(1), patParts.slice(1));
    };

    let result = match(pathParts, parts);
    return neg ? !result : result;
  } catch (error) {
    console.error(`Error in pattern matching: ${error.message}`);
    return false;
  }
}

/**
 * Checks if a path should be ignored based on the given ignore patterns,
 * replicating .gitignore-like "last pattern wins" logic, with path normalized
 * to use `/` separators and matchBase for patterns without a slash.
 *
 * @param {string} path - The path to check.
 * @param {string[]} ignorePatterns - The patterns to ignore.
 * @param {Object} minimatchOptions - Options for minimatch.
 * @param {ProcessingStats} [stats] - The processing statistics for tracking matched patterns.
 * @returns {boolean} True if the path should be ignored, false otherwise.
 */
const shouldIgnore = (path, ignorePatterns, minimatchOptions, stats) => {
  // Force forward slashes for consistent matching
  const normalizedPath = normalize(path).split(sep).join('/');

  // Track the final ignore status after evaluating *all* patterns
  let shouldBeIgnored = false;

  for (const pattern of ignorePatterns) {
    const isNegated     = pattern.startsWith('!');
    const actualPattern = isNegated ? pattern.slice(1) : pattern;

    const match = miniMatch(normalizedPath, actualPattern, {
      ...minimatchOptions,
      // For patterns without '/', act like gitignore's "basename" match
      matchBase: !actualPattern.includes('/'),
    });

    if (match) {
      // If we match a non-negated pattern, set ignored to true
      // If we match a negated pattern, set ignored to false
      shouldBeIgnored = !isNegated;

      // Keep track of which pattern matched only if it leads to ignoring
      if (!isNegated && stats) {
        stats.matchedIgnorePatterns.add(pattern);
      }
      // We do NOT return immediately—last pattern wins
    }
  }

  return shouldBeIgnored;
};

/**
 * Reads the content of a file, handling large files in chunks.
 *
 * @param {string} filePath - The path to the file.
 * @param {number} maxFileSize - The maximum file size allowed.
 * @returns {string} The content of the file or an error message.
 */
const readFileContent = (filePath, maxFileSize) => {
  try {
    const stats = lstatSync(filePath);

    if (stats.size > maxFileSize) {
      return `[File too large to display, size: ${formatBytes(stats.size)}]`;
    }

    if (!isTextFile(filePath)) {
      return '[Non-text file]';
    }

    if (stats.size > CHUNK_SIZE) {
      const fd      = openSync(filePath, 'r');
      const buffer  = Buffer.alloc(CHUNK_SIZE);
      let content   = '';
      let bytesRead;

      try {
        while ((bytesRead = readSync(fd, buffer, 0, buffer.length, null)) !== 0) {
          content += buffer.toString('utf8', 0, bytesRead);
        }
      } finally {
        closeSync(fd);
      }
      return content;
    }

    return readFileSync(filePath, 'utf-8');
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
};

/**
 * Determines if a file is likely a text file based on its extension and content.
 *
 * @param {string} filePath - The path to the file.
 * @returns {boolean} True if the file is likely a text file, false otherwise.
 */
const isTextFile = (filePath) => {
  const textExtensions = new Set([
    '.txt',  '.md',   '.py',  '.js',   '.java', '.c',   '.cpp',  '.h',   '.hpp',
    '.cs',   '.go',   '.rs',  '.swift', '.rb',   '.php',  '.html', '.css',
    '.json', '.xml',  '.yaml','.yml',   '.sh',   '.bat',  '.sql',  '.csv',
    '.tsv',  '.ini',  '.cfg', '.toml',  '.lua',  '.pl',   '.pm',   '.r',
    '.ts',
  ]);

  if (textExtensions.has(extname(filePath).toLowerCase())) {
    return true;
  }

  try {
    const buffer = readFileSync(filePath, { encoding: 'utf8', flag: 'r' });
    return !buffer.includes('\0');
  } catch (error) {
    console.error(`Error checking if file is text: ${error.message}`);
    return false;
  }
};

/**
 * Formats a number of bytes into a human-readable string.
 *
 * @param {number} bytes - The number of bytes.
 * @param {number} [decimals=2] - The number of decimal places to use.
 * @returns {string} The formatted string.
 */
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k     = 1024;
  const dm    = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i     = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

/**
 * Processes a symbolic link.
 *
 * @param {string} entryPath - The path to the symbolic link.
 * @param {string} targetPath - The target path of the symbolic link.
 * @param {ProcessingStats} stats - The processing statistics.
 * @param {FileInfo[]} files - The array to store file information.
 * @param {ProcessingOptions} options - The processing options.
 * @returns {FileInfo[]} An array of file information from the target.
 */
const processSymlink = (entryPath, targetPath, stats, files, options) => {
  const symlinkKey = `${entryPath}:${targetPath}`;
  if (stats.seenSymlinks.has(symlinkKey)) {
    if (!options.ultraQuiet) {
      console.warn(
        `Circular symlink detected: ${entryPath} -> ${targetPath}`
      );
    }
    return [];
  }
  stats.seenSymlinks.add(symlinkKey);

  try {
    const targetStat = lstatSync(targetPath);
    if (targetStat.isDirectory()) {
      return processDirectory(targetPath, options, stats);
    } else {
      processFile(targetPath, options.maxFileSize, stats, files, options.rootPath, options);
      return [];
    }
  } catch (err) {
    if (!options.ultraQuiet) {
      console.warn(
        `Broken symlink or permission error: ${entryPath} -> ${targetPath}`
      );
    }
    return [];
  }
};

/**
 * Processes a single file.
 *
 * @param {string} filePath - The path to the file.
 * @param {number} maxFileSize - The maximum file size allowed.
 * @param {ProcessingStats} stats - The processing statistics.
 * @param {FileInfo[]} files - The array to store file information.
 * @param {string} rootPath - The absolute path of the root directory.
 * @param {ProcessingOptions} options - The processing options.
 */
const processFile = (filePath, maxFileSize, stats, files, rootPath, options) => {
  try {
    const fileSize = lstatSync(filePath).size;

    if (fileSize > maxFileSize) {
      stats.skippedFiles++;
      if (!options.quiet && !options.ultraQuiet) {
        console.warn(`${FORMAT.bold('Skipping file larger than maxFileSize:')} ${filePath}`);
      }
      return;
    }

    if (stats.totalSize + fileSize > MAX_TOTAL_SIZE_BYTES) {
      stats.sizeLimitReached = true;
      if (!options.quiet && !options.ultraQuiet) {
        console.warn(`${FORMAT.bold('Total size limit reached at:')} ${filePath}`);
      }
      return;
    }

    if (!isTextFile(filePath)) {
      stats.nonTextFiles++;
      if (!options.quiet && !options.ultraQuiet) {
        console.warn(`${FORMAT.bold('Skipping non-text file:')} ${filePath}`);
      }
      return;
    }

    stats.totalSize += fileSize;
    stats.fileCount++;

    const relativePath = relative(rootPath, filePath);
    files.push({
      path:    relativePath,
      content: readFileContent(filePath, maxFileSize),
      size:    fileSize,
    });

    // Log the file added to the digest
    if (!options.quiet && !options.ultraQuiet) {
      console.log(`${FORMAT.bold('Added to digest:')} ${relativePath}`);
    }

  } catch (error) {
    stats.addError(error);
    console.error(`Error processing file ${filePath}: ${error.message}`);
  }
};

/**
 * Processes a directory recursively.
 *
 * @param {string} dirPath - The path to the directory.
 * @param {ProcessingOptions} options - The processing options.
 * @param {ProcessingStats} stats - The processing statistics.
 * @returns {FileInfo[]} An array of file information.
 */
const processDirectory = (
  dirPath,
  {
    ignorePatterns,
    includePatterns = [],
    maxFileSize     = MAX_FILE_SIZE,
    maxTotalSize    = MAX_TOTAL_SIZE_BYTES,
    maxDepth        = MAX_DIRECTORY_DEPTH,
    currentDepth    = 0,
    rootPath        = dirPath,
    quiet,
    ultraQuiet,
    omitExcluded,
  },
  stats = createStats()
) => {
  /**
   * @type {FileInfo[]}
   */
  const files = [];

  if (currentDepth > maxDepth) {
    if (!ultraQuiet) {
      console.warn(`Max directory depth reached at ${dirPath}`);
    }
    return files;
  }

  const resolvedPath = resolve(dirPath);
  if (stats.seenPaths.has(resolvedPath)) {
    if (!ultraQuiet) {
      console.warn(`Circular reference detected at ${dirPath}, skipping.`);
    }
    return files;
  }
  stats.seenPaths.add(resolvedPath);

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (stats.sizeLimitReached) {
        break;
      }

      const entryPath         = join(dirPath, entry.name);
      const relativeEntryPath = relative(rootPath, entryPath);

      if (omitExcluded) {
        if (
          shouldIgnore(relativeEntryPath, ignorePatterns, {
            nocase: true,
            dot:    true,
          }, stats)
        ) {
          stats.excludedFiles++;
          continue;
        }
        if (
          includePatterns.length > 0 &&
          !includePatterns.some((p) =>
            miniMatch(
              normalize(relativeEntryPath).split(sep).join('/'),
              p,
              { nocase: true, dot: true, matchBase: !p.includes('/') }
            )
          )
        ) {
          stats.excludedFiles++;
          continue;
        }
      }

      if (entry.isSymbolicLink()) {
        try {
          const targetPath = resolve(
            dirname(entryPath),
            readlinkSync(entryPath)
          );
          const symlinks = processSymlink(
            entryPath,
            targetPath,
            stats,
            files,
            {
              ignorePatterns,
              includePatterns,
              maxFileSize,
              maxTotalSize,
              maxDepth,
              currentDepth: currentDepth + 1,
              rootPath,
              quiet,
              ultraQuiet,
              omitExcluded,
            }
          );
          files.push(...symlinks);
        } catch (error) {
          stats.addError(error);
          if (!ultraQuiet) {
            console.error(
              `Error processing symlink ${entryPath}: ${error.message}`
            );
          }
        }
      } else if (entry.isDirectory()) {
        const subFiles = processDirectory(
          entryPath,
          {
            ignorePatterns,
            includePatterns,
            maxFileSize,
            maxTotalSize,
            maxDepth,
            currentDepth: currentDepth + 1,
            rootPath,
            quiet,
            ultraQuiet,
            omitExcluded,
          },
          stats
        );
        files.push(...subFiles);
      } else if (entry.isFile()) {
        processFile(entryPath, maxFileSize, stats, files, rootPath, { quiet, ultraQuiet });
      }
    }
  } catch (error) {
    stats.addError(error);
    if (!ultraQuiet) {
      console.error(`Error reading directory ${dirPath}: ${error.message}`);
    }
  }

  return files;
};

/**
 * Generates a tree-like directory structure string.
 *
 * @param {string} dirPath - The path to the directory.
 * @param {string[]} ignorePatterns - The patterns to ignore.
 * @param {string[]} includePatterns - The patterns to include.
 * @param {number} maxDepth - The maximum depth to traverse.
 * @param {number} [currentDepth=0] - The current depth.
 * @param {string} [prefix=''] - The prefix for indentation.
 * @param {string} [rootPath=dirPath] - The root path.
 * @param {{content: string, truncated: boolean}} [result={ content: '', truncated: false }] - The result object.
 * @param {boolean} ultraQuiet - Whether to suppress all non-error output.
 * @param {boolean} omitExcluded - Whether to omit excluded files from the tree.
 * @returns {string} The directory tree string.
 */
const generateDirectoryTree = (
  dirPath,
  ignorePatterns,
  includePatterns,
  maxDepth,
  currentDepth = 0,
  prefix       = '',
  rootPath     = dirPath,
  result       = { content: '', truncated: false },
  ultraQuiet   = false,
  omitExcluded = false
) => {
  if (currentDepth > maxDepth || result.truncated) {
    return result.content;
  }

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    let filteredEntries = entries;

    if (omitExcluded) {
      filteredEntries = entries
        .filter((entry) => {
          const rel = normalize(relative(rootPath, join(dirPath, entry.name))).split(sep).join('/');
          return !shouldIgnore(rel, ignorePatterns, { nocase: true, dot: true })
            && (
              includePatterns.length === 0
              || includePatterns.some((p) =>
                  miniMatch(rel, p, {
                    nocase: true,
                    dot: true,
                    matchBase: !p.includes('/'),
                  })
                )
            );
        });
    }

    filteredEntries.forEach((entry, index) => {
      if (result.content.length > CHUNK_SIZE) {
        result.truncated = true;
        return;
      }

      const isLast    = index === filteredEntries.length - 1;
      const entryPath = join(dirPath, entry.name);

      result.content += `${prefix}${isLast ? '└── ' : '├── '}${entry.name}${
        entry.isDirectory() ? '/' : ''
      }\n`;

      if (entry.isDirectory() && !result.truncated) {
        generateDirectoryTree(
          entryPath,
          ignorePatterns,
          includePatterns,
          maxDepth,
          currentDepth + 1,
          `${prefix}${isLast ? '    ' : '│   '}`,
          rootPath,
          result,
          ultraQuiet,
          omitExcluded
        );
      }
    });
  } catch (error) {
    if (!ultraQuiet) {
      console.error(
        `Error generating directory tree for ${dirPath}: ${error.message}`
      );
    }
  }

  return result.truncated
    ? result.content + '\n[Directory tree truncated due to size]'
    : result.content;
};

/**
 * Validates the command line arguments.
 *
 * @param {Object} args - The parsed command line arguments.
 * @param {number} args.maxSize - The maximum file size.
 * @param {number} args.maxTotalSize - The maximum total size.
 * @param {number} args.maxDepth - The maximum directory depth.
 * @param {string|null} args.ignoreFile - Path to the ignore file.
 * @param {string|null} args.includeFile - Path to the include file.
 * @param {boolean} args.quiet - Whether quiet mode is enabled.
 * @param {boolean} args.ultraQuiet - Whether ultra-quiet mode is enabled.
 * @param {boolean} args.omitExcluded - Whether to omit excluded files from the tree.
 * @throws {Error} If any argument is invalid.
 */
const validateArgs = (args) => {
  const errors = [];

  if (args.maxSize      <= 0) errors.push('maxSize must be positive');
  if (args.maxTotalSize <= 0) errors.push('maxTotalSize must be positive');
  if (args.maxDepth     <= 0) errors.push('maxDepth must be positive');

  if (args.ignoreFile && !existsSync(args.ignoreFile)) {
    errors.push(`Ignore file not found: ${args.ignoreFile}`);
  }

  if (args.includeFile && !existsSync(args.includeFile)) {
    errors.push(`Include file not found: ${args.includeFile}`);
  }

  if (errors.length > 0) {
    throw new Error(`Invalid arguments:\n${errors.join('\n')}`);
  }
};

/**
 * Loads patterns from a file.
 *
 * @param {string} filePath - The path to the file.
 * @returns {string[]} An array of patterns.
 */
const loadPatternsFromFile = (filePath) => {
  try {
    if (!filePath) return [];
    const content = readFileSync(filePath, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#'));
  } catch (error) {
    console.error(`Error reading patterns from ${filePath}: ${error.message}`);
    return [];
  }
};

/**
 * Generates a summary of the processing results.
 *
 * @param {string} path - The path to the processed directory.
 * @param {ProcessingStats} stats - The processing statistics.
 * @param {ProcessingOptions} options - The processing options.
 * @param {string} outputFile - The path to the digest output file.
 * @returns {string} The summary string.
 */
const generateSummary = (path, stats, options, outputFile) => {
  const {
    includePatterns,
    maxFileSize,
    maxTotalSize,
    maxDepth,
    quiet,
    ultraQuiet,
    omitExcluded,
  } = options;

  const executionTime = Date.now() - stats.startTime;

  const {
    bold,
    red,
    green,
    yellow,
    white,
    gray,
    invert,
  } = FORMAT;

  return `
${invert(bold(' Digest Summary '))}
${white('Processed directory:')}         ${gray(path)}
${white('Execution time:')}              ${yellow((executionTime / 1000).toFixed(2))} ${gray('seconds')}
${white('Files added to digest:')}       ${green(stats.fileCount)}
${white('Files excluded by pattern:')}   ${red(stats.excludedFiles)}
${white('Files excluded (non-text):')}   ${red(stats.nonTextFiles)}
${white('Files skipped (size limit):')}  ${red(stats.skippedFiles)}
${white('Total size:')}                  ${yellow(formatBytes(stats.totalSize))}
${white('Size limit reached:')}          ${stats.sizeLimitReached ? red('Yes') : green('No')}

${invert(bold(' Configuration '))}
${white('Max file size:')}       ${yellow(formatBytes(maxFileSize))}
${white('Max total size:')}      ${yellow(formatBytes(maxTotalSize))}
${white('Max directory depth:')} ${yellow(maxDepth)}
${white('Omit excluded from tree:')} ${omitExcluded ? green('Yes') : red('No')}
${bold('Ignore patterns that matched:')} ${
    stats.matchedIgnorePatterns.size
      ? `\n  ${gray(Array.from(stats.matchedIgnorePatterns).join('\n  '))}`
      : 'None'
}
${white('Include patterns:')}   ${
    includePatterns.length ? `\n  ${gray(includePatterns.join('\n  '))}` : 'None'
}

${invert(bold(` Errors (${stats.errors.length}) `))}
${
    stats.errors.length
      ? stats.errors
          .map((err) => `${err.timestamp}: ${err.message}`)
          .join('\n')
      : 'No errors occurred'
}

${invert(bold(' Digest File '))}
${outputFile}
`;
};

/**
 * Parses command line arguments.
 *
 * @returns {Object} The parsed arguments.
 */
const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsedArgs = {
    path:                '.',
    outputFile:          'digest.txt',
    ignoreFile:          null,
    includeFile:         null,
    ignorePatterns:      [],
    includePatterns:     [],
    maxSize:             MAX_FILE_SIZE,
    maxTotalSize:        MAX_TOTAL_SIZE_BYTES,
    maxDepth:            MAX_DIRECTORY_DEPTH,
    quiet:               false,
    ultraQuiet:          false,
    omitExcluded:        false,
    skipDefaultIgnore:   false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      // Long options
      case '--path':                parsedArgs.path              = args[++i]; break;
      case '--output':              parsedArgs.outputFile        = args[++i]; break;
      case '--ignore':              parsedArgs.ignoreFile        = args[++i]; break;
      case '--include':             parsedArgs.includeFile       = args[++i]; break;
      case '--ignore-pattern':      parsedArgs.ignorePatterns.push(args[++i]); break;
      case '--include-pattern':     parsedArgs.includePatterns.push(args[++i]); break;
      case '--max-size':            parsedArgs.maxSize           = parseInt(args[++i], 10); break;
      case '--max-total-size':      parsedArgs.maxTotalSize      = parseInt(args[++i], 10); break;
      case '--max-depth':           parsedArgs.maxDepth          = parseInt(args[++i], 10); break;
      case '--omit-excluded':       parsedArgs.omitExcluded      = true; break;
      case '--quiet':               parsedArgs.quiet             = true; break;
      case '--ultra-quiet':         parsedArgs.ultraQuiet        = true; break;
      case '--skip-default-ignore': parsedArgs.skipDefaultIgnore = true; break;
      case '--help':                printHelp(); process.exit(0);

      // Short options
      case '-p':                    parsedArgs.path              = args[++i]; break;
      case '-o':                    parsedArgs.outputFile        = args[++i]; break;
      case '-g':                    parsedArgs.ignoreFile        = args[++i]; break;
      case '-n':                    parsedArgs.includeFile       = args[++i]; break;
      case '-i':                    parsedArgs.ignorePatterns.push(args[++i]); break;
      case '-I':                    parsedArgs.includePatterns.push(args[++i]); break;
      case '-s':                    parsedArgs.maxSize           = parseInt(args[++i], 10); break;
      case '-t':                    parsedArgs.maxTotalSize      = parseInt(args[++i], 10); break;
      case '-d':                    parsedArgs.maxDepth          = parseInt(args[++i], 10); break;
      case '-q':                    parsedArgs.quiet             = true; break;
      case '-uq':                   parsedArgs.ultraQuiet        = true; break;
      case '-k':                    parsedArgs.skipDefaultIgnore = true; break;
      case '-h':                    printHelp(); process.exit(0);
      default:
        console.warn(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  return parsedArgs;
};

/**
 * Prints the help message with usage examples.
 */
const printHelp = () => {
  console.log(`
Usage: node codedigest.mjs [options]

Options:
  --path <path>, -p <path>                 Directory to process (default: current directory)
  --output <file>, -o <file>               Output file path (default: digest.txt)
  --ignore <file>, -g <file>               File containing ignore patterns
  --include <file>, -n <file>              File containing include patterns
  --ignore-pattern <pattern>, -i <pattern> Ignore pattern (can be used multiple times)
  --include-pattern <pattern>, -I <pattern>Include pattern (can be used multiple times)
  --max-size <bytes>, -s <bytes>           Maximum file size (default: ${formatBytes(MAX_FILE_SIZE)})
  --max-total-size <bytes>, -t <bytes>     Maximum total size (default: ${formatBytes(MAX_TOTAL_SIZE_BYTES)})
  --max-depth <number>, -d <number>        Maximum directory depth (default: ${MAX_DIRECTORY_DEPTH})
  --omit-excluded                          Omit excluded files from the directory tree
  --quiet, -q                              Suppress 'Added' and 'Skipped' messages
  --ultra-quiet, -uq                       Suppress all non-error output
  --skip-default-ignore, -k                Skip default ignore patterns; use only user-provided patterns
  --help, -h                               Display this help message

Examples:
  # Basic usage with default options
  node codedigest.mjs

  # Specify a directory and output file
  node codedigest.mjs --path ./myproject --output mydigest.txt

  # Use ignore patterns from a file and add additional ignore patterns via command line
  node codedigest.mjs --ignore .gitignore --ignore-pattern '*.log' --ignore-pattern 'temp/'

  # Use include patterns to only include specific file types
  node codedigest.mjs --include '*.js' --include '*.md'

  # Combine include and ignore patterns
  node codedigest.mjs -p ./src -o digest.txt -g ignore.txt -i '*.test.js' -I '*.js'

  # Omit excluded files from the directory tree
  node codedigest.mjs --omit-excluded

  # Skip default ignore patterns and use only user-provided patterns
  node codedigest.mjs --skip-default-ignore --ignore-pattern 'custom/**/*.js'
`);
};

/**
 * Ensures that a directory exists, creating it if necessary.
 *
 * @param {string} dirPath - The path to the directory.
 */
const ensureDirectoryExists = (dirPath) => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};

/**
 * The main function of the script.
 */
const main = async () => {
  try {
    const args = parseArgs();
    validateArgs(args);

    // Bug fix: Instead of ignoring all user patterns, only skip the defaults if skipDefaultIgnore is set
    const ignorePatterns = [
      ...(args.skipDefaultIgnore ? [] : Array.from(DEFAULT_IGNORE_PATTERNS)),
      ...(args.ignoreFile ? loadPatternsFromFile(args.ignoreFile) : []),
      ...args.ignorePatterns,
    ];

    const includePatterns = [
      ...(args.includeFile ? loadPatternsFromFile(args.includeFile) : []),
      ...args.includePatterns,
    ];

    const rootPath       = resolve(args.path);
    const outputFilePath = resolve(args.outputFile);

    // Exclude the output file itself from the digest
    if (outputFilePath.startsWith(rootPath)) {
      const relativeOutputPath   = relative(rootPath, outputFilePath);
      const normalizedOutputPath = relativeOutputPath.split(sep).join('/');
      ignorePatterns.push(normalizedOutputPath);
    }

    if (!existsSync(args.path)) {
      throw new Error(`Path does not exist: ${args.path}`);
    }

    const stat = lstatSync(args.path);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${args.path}`);
    }

    const options = {
      ignorePatterns,
      includePatterns,
      maxFileSize:  args.maxSize,
      maxTotalSize: args.maxTotalSize,
      maxDepth:     args.maxDepth,
      rootPath:     rootPath,
      quiet:        args.quiet,
      ultraQuiet:   args.ultraQuiet,
      omitExcluded: args.omitExcluded,
    };

    const statsObj = createStats();
    const files    = processDirectory(args.path, options, statsObj);

    const digestContent = files.map((file) => {
      const separator = '='.repeat(48) + '\n';
      return `${separator}File: ${file.path}\n${separator}${file.content}\n`;
    }).join('');

    const directoryTree = generateDirectoryTree(
      args.path,
      ignorePatterns,
      includePatterns,
      args.maxDepth,
      0,
      '',
      rootPath,
      { content: '', truncated: false },
      args.ultraQuiet,
      args.omitExcluded
    );

    const summary = generateSummary(args.path, statsObj, options, args.outputFile);

    ensureDirectoryExists(dirname(args.outputFile));
    writeFileSync(
      args.outputFile,
      `Directory Structure\n==================\n${directoryTree}\n\nFile Contents\n=============\n${digestContent}\n\n${summary}`
    );

    // Output the summary to the console
    if (!args.ultraQuiet) {
      console.log(summary);
    }

    if (statsObj.errors.length > 0 && !args.ultraQuiet) {
      console.warn(`\nWarning: ${statsObj.errors.length} errors occurred during processing. Check the console for details.`);
    }
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
};

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
