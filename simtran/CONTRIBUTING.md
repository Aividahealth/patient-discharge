# Contributing to Discharge Summary Simplifier

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to this project.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help maintain a positive environment

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/discharge-summary-simplifier.git
   cd discharge-summary-simplifier/backend
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### 1. Make Your Changes

- Write clean, readable TypeScript code
- Follow the existing code style (use Prettier and ESLint)
- Add JSDoc comments for public functions
- Update types in `src/types/index.ts` as needed

### 2. Write Tests

- Add unit tests for new functionality
- Ensure all tests pass:
  ```bash
  npm test
  ```
- Aim for >80% code coverage:
  ```bash
  npm run test:coverage
  ```

### 3. Format and Lint

```bash
# Format code
npm run format

# Lint code
npm run lint
```

### 4. Build and Verify

```bash
# Build TypeScript
npm run build

# Run all checks
npm test && npm run build && npm run lint
```

## Testing Guidelines

### Unit Tests

- Place tests in the `tests/` directory
- Name test files with `.test.ts` extension
- Use descriptive test names
- Mock external dependencies (GCS, Vertex AI)

Example test structure:
```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should do expected behavior', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = service.method(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Integration Tests

- Test end-to-end workflows
- Use actual GCS buckets in test environment
- Clean up resources after tests

## Code Style

### TypeScript

- Use explicit return types for public functions
- Prefer `const` over `let`
- Use descriptive variable names
- Avoid `any` type (use `unknown` if necessary)

### Naming Conventions

- **Files**: `kebab-case.ts` (e.g., `gcs.service.ts`)
- **Classes**: `PascalCase` (e.g., `GCSService`)
- **Functions**: `camelCase` (e.g., `readFile`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- **Interfaces**: `PascalCase` (e.g., `SimplificationResult`)

### Comments

- Use JSDoc for public APIs:
  ```typescript
  /**
   * Simplifies medical discharge summary content
   * @param request - The simplification request with content and metadata
   * @returns Promise with simplified content
   * @throws {VertexAIError} If AI service fails
   */
  async simplify(request: SimplificationRequest): Promise<SimplificationResponse> {
    // Implementation
  }
  ```

## Commit Messages

Use conventional commit format:

```
type(scope): subject

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(simplification): add support for Spanish language

fix(gcs): handle special characters in filenames

docs(readme): update deployment instructions

test(services): add tests for retry logic
```

## Pull Request Process

### 1. Update Documentation

- Update README.md if adding features
- Add inline code comments for complex logic
- Update SETUP.md if changing deployment

### 2. Create Pull Request

- Push your branch to your fork
- Create PR against the `main` branch
- Fill out the PR template completely

### 3. PR Title and Description

Title format: `type(scope): description`

Description should include:
- **What**: What changes were made
- **Why**: Reason for the changes
- **How**: Approach taken
- **Testing**: How to test the changes

Example:
```markdown
## What
Adds support for batch processing of multiple files

## Why
Users requested ability to process multiple files at once

## How
- Added queue service to manage batch jobs
- Implemented parallel processing with concurrency limits
- Added progress tracking

## Testing
1. Upload multiple files to input bucket
2. Verify all files are processed
3. Check logs for parallel execution
```

### 4. Code Review

- Address reviewer feedback promptly
- Keep discussions focused and professional
- Update your branch as needed

### 5. Merging

- Squash commits if requested
- Ensure CI/CD passes
- Wait for approval before merging

## Feature Ideas

Looking for contribution ideas? Consider:

### High Priority
- [ ] Support for additional languages (Spanish, etc.)
- [ ] Batch processing mode
- [ ] Progress notifications (email, Pub/Sub)
- [ ] Configurable simplification levels
- [ ] Support for PDF input files

### Medium Priority
- [ ] Web UI for uploading files
- [ ] Real-time processing status dashboard
- [ ] A/B testing different prompts
- [ ] Custom terminology dictionaries
- [ ] HIPAA compliance documentation

### Low Priority
- [ ] CLI tool for local processing
- [ ] Docker container support
- [ ] Integration with EHR systems
- [ ] Analytics dashboard
- [ ] Automated prompt optimization

## Bug Reports

When reporting bugs, include:

1. **Environment**: OS, Node version, gcloud version
2. **Steps to reproduce**: Exact steps to trigger the bug
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Logs**: Relevant error messages and logs
6. **Screenshots**: If applicable

Use this template:
```markdown
## Bug Description
Brief description of the issue

## Environment
- OS: macOS 14.0
- Node: v20.10.0
- gcloud: 456.0.0

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Logs
```
Paste relevant logs here
```

## Security Issues

**Do not** open public issues for security vulnerabilities.

Instead:
1. Email security concerns to: [security contact]
2. Include detailed description
3. Wait for acknowledgment
4. Work with maintainers on fix

## Questions?

- Open a discussion on GitHub
- Check existing issues and PRs
- Review documentation thoroughly

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to make medical information more accessible! 🏥
