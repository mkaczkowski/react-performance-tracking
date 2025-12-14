# Contributing to React Performance Tracking

Thank you for your interest in contributing! This document provides guidelines for contributing to the project.

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Development Setup

1. Fork and clone the repository:

   ```bash
   git clone https://github.com/YOUR_USERNAME/react-performance-tracking.git
   cd react-performance-tracking
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the library:

   ```bash
   npm run build
   ```

4. Run tests:
   ```bash
   npm test              # Unit tests
   npm run test:e2e      # E2E tests (requires test app)
   ```

## Development Workflow

### Available Scripts

| Command                 | Description                           |
| ----------------------- | ------------------------------------- |
| `npm run build`         | Build the library (ESM + CJS + types) |
| `npm run dev`           | Build in watch mode                   |
| `npm test`              | Run unit tests                        |
| `npm run test:watch`    | Run tests in watch mode               |
| `npm run test:coverage` | Run tests with coverage               |
| `npm run test:e2e`      | Run E2E tests                         |
| `npm run typecheck`     | TypeScript type checking              |
| `npm run lint`          | Check code style                      |
| `npm run lint:fix`      | Fix linting issues                    |
| `npm run format`        | Format code with Prettier             |

### Running E2E Tests

E2E tests require the test application:

```bash
# Terminal 1: Start the test app
npm run serve:test-app

# Terminal 2: Run E2E tests
npm run test:e2e
```

## Making Changes

### Code Style

- Follow the existing code style (enforced by ESLint and Prettier)
- Run `npm run lint:fix` and `npm run format` before committing
- Follow patterns documented in [CODING_STANDARDS.md](docs/CODING_STANDARDS.md)

### Testing

- Add unit tests for new functionality
- Maintain 80% code coverage minimum
- Follow patterns in [TESTING_GUIDELINES.md](docs/TESTING_GUIDELINES.md)
- E2E tests for integration scenarios

### Commit Messages

Use clear, descriptive commit messages:

```
feat: add custom metrics API
fix: handle CDP session timeout
docs: update README examples
test: add FPS tracking tests
refactor: simplify threshold resolution
```

## Pull Request Process

1. Create a feature branch from `main`:

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them

3. Ensure all checks pass:

   ```bash
   npm run typecheck
   npm run lint
   npm run format:check
   npm test
   npm run test:e2e
   ```

4. Push to your fork and open a Pull Request

5. Fill out the PR template with:
   - Description of changes
   - Related issue (if applicable)
   - Testing performed

### PR Requirements

- [ ] All tests pass
- [ ] Code follows project style guidelines
- [ ] New code has appropriate test coverage
- [ ] Documentation updated if needed
- [ ] No breaking changes (or clearly documented)

## Reporting Issues

### Bug Reports

Include:

- Node.js and npm versions
- Browser and Playwright version
- Minimal reproduction steps
- Expected vs actual behavior
- Error messages and stack traces

### Feature Requests

Describe:

- The use case and problem being solved
- Proposed solution (if any)
- Alternatives considered

## Architecture Overview

See [architecture.mdx](site/pages/docs/advanced/architecture.mdx) for detailed system design.

### Key Directories

```
src/
├── react/       # React layer (PerformanceProvider, hooks)
├── playwright/  # Playwright layer (fixtures, features, runner)
└── utils/       # Shared utilities
```

## Questions?

- Open a [GitHub Issue](https://github.com/mkaczkowski/react-performance-tracking/issues)
- Check existing issues and documentation first

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
