
<p align="center">
  <img src="https://raw.githubusercontent.com/Nowayz/CodeDigest/refs/heads/resources/codedigest_logo.png" alt="logo"/>
</p>
**CodeDigest** is a simple single-file Node.js command-line tool that consolidates an entire code repository (directory structure and text-based files) into a digest file for easy consumption by your preferred LLM (Large Language Model). It helps you quickly gather all source code in one place so you can feed it into LLM-based tools for analysis, code generation, or any other AI-driven development workflows.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Installation](#installation)
3. [Usage](#usage)
4. [Options](#options)
5. [Ignore & Include Patterns](#ignore--include-patterns)
6. [How It Works](#how-it-works)
7. [Nuances & Limits](#nuances--limits)
8. [License](#license)

### Quick Start

```bash
node ./codedigest.mjs --path ./myproject --output consolidated.txt
```

Once run, **`consolidated.txt`** will include:

1. A **directory tree** of `myproject` (excluding specified patterns).
2. **All text-based file contents** (subject to size limits).
3. A **summary** (stats, ignore patterns, errors, etc.).

#### Example Output
```
Directory Structure
===================
myproject/
├── package.json
├── index.js
├── src/
│   ├── app.js
│   └── utils.js
└── README.md

============================================
File: package.json
============================================
{
  "name": "myproject",
  "version": "1.0.0",
  ...
}

============================================
File: index.js
============================================
console.log("Hello World!");

etc...
```

This file can be fed directly to your LLM. For example, if you have an API or local setup where you can provide a text context to a language model, just drop the contents of `consolidated.txt` into the prompt or your specialized ingestion pipeline.

### Installation
1. Download `codedigest.mjs` and place it somewhere in your `PATH`.
2. Ensure you have [Node.js](https://nodejs.org) installed.
3. Run the script:
   ```bash
   node codedigest.mjs
   ```

### Usage
```bash
node codedigest.mjs --help
```
```
Usage: node codedigest.mjs [options]

Options:
  --path <path>, -p <path>             Directory to process (default: current directory)
  --output <file>, -o <file>           Output file path (default: digest.txt)
  --ignore <file>, -g <file>           File containing ignore patterns (gitignore-style)
  --include <file>, -n <file>          File containing include patterns (gitignore-style)
  --ignore-pattern <pattern>, -i <pattern>
                                       Additional ignore pattern (can be used multiple times)
  --include-pattern <pattern>, -I <pattern>
                                       Additional include pattern (can be used multiple times)
  --max-size <bytes>, -s <bytes>       Maximum file size (default: 10MB)
  --max-total-size <bytes>, -t <bytes> Maximum total size (default: 500MB)
  --max-depth <number>, -d <number>    Maximum directory depth (default: 20)
  --quiet, -q                          Suppress 'Added' and 'Skipped' messages
  --ultra-quiet, -uq                   Suppress all non-error output
  --skip-default-ignore, -k            Skip default ignore patterns; use only user-provided patterns
  --help, -h                           Display this help message

Examples:
  # Basic usage with default options
  node codedigest.mjs

  # Specify a directory and output file
  node codedigest.mjs --path ./myproject --output mydigest.txt

  # Use ignore patterns from a file and add additional ignore patterns via command line
  node codedigest.mjs --ignore .gitignore --ignore-pattern '*.log' --ignore-pattern 'temp/'

  # Use include patterns to only include specific file types
  node codedigest.mjs --include '*.js' --include '*.md'

  # Combine include and ignore patterns (Include first, then Exclude)
  node codedigest.mjs -p ./src -o digest.txt -g ignore.txt -i '*.test.js' -I '*.js'

  # Skip default ignore patterns and use only user-provided patterns
  node codedigest.mjs --skip-default-ignore --ignore-pattern 'custom/**/*.js'
```

### Options

| Option                        | Alias | Description                                                | Default                 |
|-------------------------------|-------|------------------------------------------------------------|-------------------------|
| `--path <path>`               | `-p`  | Directory to process.                                     | `.` (current directory) |
| `--output <file>`             | `-o`  | Output file path.                                          | `digest.txt`           |
| `--ignore <file>`             | `-g`  | File containing ignore patterns (gitignore-style).         | —                       |
| `--include <file>`            | `-n`  | File containing include patterns (gitignore-style).        | —                      |
| `--ignore-pattern <pattern>`  | `-i`  | Add an ignore pattern (can be used multiple times).        | —                       |
| `--include-pattern <pattern>` | `-I`  | Add an include pattern (can be used multiple times).       | —                       |
| `--max-size <bytes>`          | `-s`  | Maximum individual file size (in bytes).                   | `10MB`                 |
| `--max-total-size <bytes>`    | `-t`  | Maximum total size (in bytes) before digest stops adding.  | `500MB`                |
| `--max-depth <number>`        | `-d`  | Maximum directory depth.                                   | `20`                   |
| `--quiet`                     | `-q`  | Suppress "Added" and "Skipped" messages.                   | `false`                |
| `--ultra-quiet`               | `-uq` | Suppress all non-error output.                             | `false`                |
| `--skip-default-ignore`       | `-k`  | Skip default ignore patterns; use only user-provided ones. | `false`                 |
| `--help`                      | `-h`  | Show help message.                                         | —                       |

### Ignore & Include Patterns

**CodeDigest** uses a combination of **include** and **ignore (exclude)** patterns to precisely control which files are included in the digest. The logic follows these steps:

1.  **Include First**: If any include patterns are provided, CodeDigest **initially selects only the files and directories that match at least one of these include patterns.** If no include patterns are provided, all files and directories are considered for initial selection.

2.  **Exclude Second**: After the initial selection based on include patterns (or all files if no includes), CodeDigest then applies **ignore (exclude) patterns to filter out files and directories from the initially selected set.** This ensures that even if a file matches an include pattern, it can still be excluded if it matches an ignore pattern.

**Default Ignore Patterns:**

**CodeDigest** comes with a comprehensive set of default ignore patterns to exclude common files and directories that are typically unnecessary for analysis or could clutter the digest. Below is the **full list of default exclude patterns**:

**Note:** Always ensure that the default ignore patterns align with your project's specific needs. You can customize them further using the provided command-line options to tailor the digest to your requirements.

```plaintext
*.pyc
*.pyo
*.pyd
__pycache__
.pytest_cache
.coverage
.tox
.nox
.mypy_cache
.ruff_cache
.hypothesis
poetry.lock
Pipfile.lock
node_modules
bower_components
package-lock.json
yarn.lock
.npm
.yarn
.pnpm-store
*.class
*.jar
*.war
*.ear
*.nar
.gradle/
build/
.settings/
.classpath
gradle-app.setting
*.gradle
.project
*.o
*.obj
*.dll
*.dylib
*.exe
*.lib
*.out
*.a
*.pdb
.build/
*.xcodeproj/
*.xcworkspace/
*.pbxuser
*.mode1v3
*.mode2v3
*.perspectivev3
*.xcuserstate
xcuserdata/
.swiftpm/
*.gem
.bundle/
vendor/bundle
Gemfile.lock
.ruby-version
.ruby-gemset
.rvmrc
Cargo.lock
**/*.rs.bk
target/
pkg/
obj/
*.suo
*.user
*.userosscache
*.sln.docstates
packages/
*.nupkg
bin/
.git
.svn
.hg
.gitignore
.gitattributes
.gitmodules
*.svg
*.png
*.jpg
*.jpeg
*.gif
*.ico
*.pdf
*.mov
*.mp4
*.mp3
*.wav
venv
.venv
env
.env
virtualenv
.idea
.vscode
.vs
*.swo
*.swn
.settings
*.sublime-*
*.log
*.bak
*.swp
*.tmp
*.temp
.cache
.sass-cache
.eslintcache
.DS_Store
Thumbs.db
desktop.ini
build
dist
target
out
*.egg-info
*.egg
*.whl
*.so
site-packages
.docusaurus
.next
.nuxt
*.min.js
*.min.css
*.map
.terraform
*.tfstate*
vendor/
```

**Explanation of Common Patterns:**

- **Version Control Directories:** `.git`, `.svn`, `.hg` – These directories contain version control metadata and are typically not needed in a code digest.
- **Dependency Directories:** `node_modules`, `vendor/bundle`, `build`, `dist`, `target`, `pkg`, `bin`, etc. – These directories usually contain dependencies or build artifacts that can be large and are often unnecessary for code analysis.
- **Cache Directories and Files:** `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.cache`, `.sass-cache`, etc. – These are used for caching compiled files or test results and are not relevant for code digestion.
- **Compiled and Binary Files:** `*.pyc`, `*.pyo`, `*.class`, `*.jar`, `*.dll`, `*.exe`, `*.so`, etc. – These are compiled or binary files that are not human-readable and generally not needed.
- **IDE and Editor Configurations:** `.idea`, `.vscode`, `.sublime-*`, `.project`, `.classpath`, etc. – These files are specific to development environments and editors.
- **Log and Temporary Files:** `*.log`, `*.tmp`, `*.temp`, `*.bak`, `*.swp`, etc. – These files are typically temporary or logs that are not useful for code analysis.
- **Media Files:** `*.svg`, `*.png`, `*.jpg`, `*.jpeg`, `*.gif`, `*.ico`, `*.pdf`, `*.mov`, `*.mp4`, `*.mp3`, `*.wav`, etc. – These files are non-textual and usually not necessary for code digestion.
- **Lock Files:** `poetry.lock`, `Pipfile.lock`, `package-lock.json`, `yarn.lock`, `Cargo.lock` – These files lock dependencies but may not be needed in the digest.
- **Others:** Patterns like `**/*.rs.bk`, `*.min.js`, `*.min.css`, etc., exclude backup files and minified code which can be less readable.

**Customizing Ignore Patterns:**

- **Via Command Line:**
  - Add extra patterns using `--ignore-pattern` or `-i`. For example:
    ```bash
    node codedigest.mjs --ignore-pattern '*.log' --ignore-pattern 'temp/'
    ```
- **Via Ignore File:**
  - Create a file (e.g., `.gitignore`) with your custom ignore patterns and specify it using `--ignore <file>` or `-g <file>`. For example:
    ```bash
    node codedigest.mjs --ignore .gitignore
    ```
- **Skipping Default Ignores:**
    - To use only your custom ignore patterns and skip the default patterns, use the `--skip-default-ignore` or `-k` flag.

### Include Patterns
- If **include** patterns are specified, **only** files matching those patterns are considered for processing **before** applying ignore patterns.
- Useful if you want to focus on specific file types like `.js`, `.py`, etc. or particular directories.

For example, to include only JavaScript and Markdown files:
```bash
node codedigest.mjs --path ./myproject \
  --include-pattern '*.js' \
  --include-pattern '*.md'
```

To include files from a specific source directory, and then exclude test files within it:
```bash
node codedigest.mjs --path ./myproject \
  --include-pattern 'src/**' \
  --ignore-pattern 'src/**/*.test.js'
```
This example first includes everything under the `src/` directory and then excludes any files ending with `.test.js` within that `src/` directory.

### How CodeDigest Works

1. **Directory Traversal**
   Recursively scans folders up to a user-defined depth, respecting symlinks (and avoiding loops by tracking seen paths and symlinks).
2. **Include Checking**
   If include patterns are provided, checks if the current path matches any of the include patterns. Only included paths proceed to the next step.
3. **Ignore Checking**
   Checks if the path matches any ignore patterns. If it does, the path is skipped.
4. **File Reading**
   - Only reads **text-based** files (determined by file extension and null byte check).
   - Skips files larger than `--max-size`.
   - Stops adding new files once `--max-total-size` is reached (but still traverses the structure).
5. **Directory Tree Generation**
   - Generates a **directory tree** in text form, omitting any files or directories that were excluded by either include or ignore patterns.
6. **Single File Output**
   - Appends each included and not-ignored file's content to the digest.
   - Summarizes stats (files processed, filtered, skipped, errors, etc.) at the end, including a breakdown of file sizes by extension and a bar graph.

### Nuances & Limits

- **Size Limits**
  - Default `--max-size=10MB`, `--max-total-size=500MB`.
  - Prevents producing massive output files that are unwieldy or slow to load into an LLM.
- **Directory Depth**
  - Default `--max-depth=20`.
  - Prevents running forever on enormous or deeply nested repositories.
- **Symlinks**
  - Symlinks are tracked to prevent infinite loops from recursive links. Circular symlinks are detected and skipped.
  - Broken symlinks or symlinks with permission errors generate warnings but do not stop the script.
- **File Type Detection**
  - A set of known text extensions is used (e.g., `.js`, `.py`, `.md`, etc.).
  - For files without known text extensions, a check for null characters is performed to determine if it's likely a text file.
- **Large Directories**
  - For big projects, be mindful of memory and time. Consider adding more specific ignore patterns, using include patterns to target specific sections, or reducing `--max-depth`.
- **Filtered Directory Tree**
  - The directory tree always reflects only the files that are included in the digest after applying both include and ignore patterns, providing a clean and focused view of the digested codebase.
- **Output Summary and Stats:**
  - The summary at the end of the digest file provides detailed statistics, including file counts, sizes, matched ignore and include patterns, file size distribution by extension (with a bar graph), and any errors encountered during processing.

### License

This project is licensed under the [MIT License](LICENSE). You can use, modify, and distribute the code as long as the original license is included.

**Enjoy CodeDigest!**