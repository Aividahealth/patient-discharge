# File Manifest

Complete list of all files in the discharge-summary-simplifier project.

## Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | NPM dependencies and scripts |
| `tsconfig.json` | TypeScript compiler configuration |
| `.env.example` | Environment variable template |
| `.gitignore` | Git ignore patterns |
| `.gcloudignore` | Cloud deployment ignore patterns |
| `jest.config.js` | Jest testing configuration |
| `.prettierrc` | Prettier code formatting rules |
| `.eslintrc.js` | ESLint linting rules |

## Source Code (src/)

### Main Entry Point
- `src/index.ts` - Cloud Function handler, orchestrates processing pipeline

### Type Definitions
- `src/types/index.ts` - TypeScript interfaces, types, and custom error classes

### Services
- `src/services/gcs.service.ts` - Google Cloud Storage operations (read, write, validate)
- `src/services/simplification.service.ts` - Vertex AI Gemini integration with retry logic

### Utilities
- `src/utils/config.ts` - Environment configuration loader with validation
- `src/utils/logger.ts` - Structured JSON logging for Cloud Logging
- `src/utils/prompts.ts` - AI prompt templates and prompt generation

## Tests (tests/)

- `tests/config.test.ts` - Configuration loading tests
- `tests/gcs.service.test.ts` - GCS service tests
- `tests/simplification.service.test.ts` - Simplification service tests
- `tests/prompts.test.ts` - Prompt generation tests

## Documentation

| File | Description | Target Audience |
|------|-------------|-----------------|
| `README.md` | Complete project documentation | All users |
| `SETUP.md` | Detailed step-by-step setup guide | Deployers |
| `QUICKSTART.md` | 10-minute quick start | New users |
| `PROJECT_SUMMARY.md` | High-level project overview | Stakeholders |
| `CONTRIBUTING.md` | Contribution guidelines | Contributors |
| `FILE_MANIFEST.md` | This file | Developers |

## Scripts

- `deploy.sh` - Automated deployment script with checks and validation

## Examples

- `examples/sample-discharge-summary.md` - Sample input file for testing

## Generated (Not in Version Control)

- `lib/` - Compiled JavaScript output from TypeScript
- `node_modules/` - NPM dependencies
- `coverage/` - Jest test coverage reports
- `.env` - Local environment variables

## File Count Summary

- **Source files**: 9 TypeScript files
- **Test files**: 4 test files
- **Config files**: 8 configuration files
- **Documentation**: 6 markdown files
- **Scripts**: 1 deployment script
- **Examples**: 1 sample file

**Total tracked files**: 29 files

## Lines of Code

- **TypeScript source**: ~1,400 lines
- **Tests**: ~300 lines
- **Documentation**: ~1,800 lines
- **Total**: ~3,500 lines

## Key Files for Different Roles

### For Developers
- `src/index.ts` - Start here
- `src/types/index.ts` - Understand data structures
- `CONTRIBUTING.md` - Contribution guidelines

### For DevOps/Deployers
- `deploy.sh` - Deployment automation
- `SETUP.md` - Complete setup guide
- `.env.example` - Required configuration

### For End Users
- `QUICKSTART.md` - Get started fast
- `README.md` - Full documentation
- `examples/` - Sample files

### For Project Managers
- `PROJECT_SUMMARY.md` - High-level overview
- `README.md` - Features and architecture

### For Contributors
- `CONTRIBUTING.md` - How to contribute
- `tests/` - Testing examples
- `.prettierrc` + `.eslintrc.js` - Code style
