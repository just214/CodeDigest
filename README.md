<p align="center">
  <img src="https://raw.githubusercontent.com/Nowayz/CodeDigest/refs/heads/resources/codedigest_logo.png" alt="logo"/>
</p>
**CodeDigest** is a single-file Node.js command-line tool that consolidates an entire code repository (directory structure and text-based files) into a digest file for easy consumption by your preferred LLM (Large Language Model). It helps you quickly gather all source code in one place so you can feed it into LLM-based tools for analysis, code generation, or any other AI-driven development workflows.

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
  --ignore <file>, -g <file>           File containing ignore patterns
  --include <file>, -n <file>          File containing include patterns
  --ignore-pattern <pattern>, -i <pattern>
                                       Ignore pattern (can be used multiple times)
  --include-pattern <pattern>, -I <pattern>
                                       Include pattern (can be used multiple times)
  --max-size <bytes>, -s <bytes>       Maximum file size (default: 10 MB)
  --max-total-size <bytes>, -t <bytes> Maximum total size (default: 500 MB)
  --max-depth <number>, -d <number>    Maximum directory depth (default: 20)
  --omit-excluded                      Omit excluded files from the directory tree
  --quiet, -q                          Suppress 'Added' and 'Skipped' messages
  --ultra-quiet, -uq                   Suppress all non-error output
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

  # Combine include and ignore patterns
  node codedigest.mjs -p ./src -o digest.txt -g ignore.txt -i '*.test.js' -I '*.js'

  # Omit excluded files from the directory tree
  node codedigest.mjs --omit-excluded
```

### Options

| Option                        | Alias | Description                                                | Default                 |
|-------------------------------|-------|------------------------------------------------------------|-------------------------|
| `--path <path>`               | `-p`  | Directory to process.                                     | `.` (current directory) |
| `--output <file>`             | `-o`  | Output file path.                                          | `digest.txt`           |
| `--ignore <file>`             | `-g`  | File containing ignore patterns.                           | —                       |
| `--include <file>`            | `-n`  | File containing include patterns.                          | —                      |
| `--ignore-pattern <pattern>`  | `-i`  | Add an ignore pattern (can be used multiple times).        | —                       |
| `--include-pattern <pattern>` | `-I`  | Add an include pattern (can be used multiple times).       | —                       |
| `--max-size <bytes>`          | `-s`  | Maximum individual file size (in bytes).                   | `10 MB`                |
| `--max-total-size <bytes>`    | `-t`  | Maximum total size (in bytes) before digest stops adding.  | `500 MB`               |
| `--max-depth <number>`        | `-d`  | Maximum directory depth.                                   | `20`                   |
| `--omit-excluded`             | —     | Omit excluded files from the directory tree to reduce clutter. | `false`            |
| `--quiet`                     | `-q`  | Suppress "Added" and "Skipped" messages.                   | `false`                |
| `--ultra-quiet`               | `-uq` | Suppress all non-error output.                             | `false`                |
| `--help`                      | `-h`  | Show help message.                                         | —                       |

### Ignore & Include Patterns

**CodeDigest** supports multiple ways to specify ignore patterns:

1. **Built-in defaults** (comprehensive set of common excludes)
2. **`.cdignore` file** in the target directory
3. **Command-line options** (`--ignore-file` and `--ignore-pattern`)

#### .cdignore File Format

The `.cdignore` file supports glob patterns, literal paths, and template inclusion:

```plaintext
# Comments start with #
*.test.js                # Ignore all test files
test/                    # Ignore test directory
!important-test.js       # Don't ignore this specific test file

# Include patterns from other files using @include
@include .gitignore      # Include all patterns from .gitignore
@include .npmignore      # Include all patterns from .npmignore
@include custom/ignore   # Include patterns from a custom file
```

**Features:**
- **Literal Paths**: Simply list files or directories to ignore
- **Glob Patterns**: Use standard glob syntax (*, **, ?, etc.)
- **Negation**: Use ! to explicitly not ignore a file
- **Templates**: Include patterns from other files using @include
- **Comments**: Lines starting with # are ignored
- **Path Resolution**: Template paths are resolved relative to the .cdignore file

The `.cdignore` file is automatically loaded if present in the target directory. Its patterns are combined with any other ignore patterns specified via command-line options.

#### Default Ignore Patterns

CodeDigest comes with a comprehensive set of default ignore patterns:

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
- **Others:** Patterns like `**/*.rs.bk`, `