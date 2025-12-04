# Security Policy

## Supported Versions

We release patches for security vulnerabilities. Currently supported versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of react-performance-tracking seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do NOT:

- Open a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly before it has been addressed

### Please DO:

1. **Report via GitHub Security Advisories** at https://github.com/mkaczkowski/react-performance-tracking/security/advisories/new
   - Provide a description of the vulnerability
   - Include steps to reproduce the issue
   - Describe the potential impact
   - Suggest fixes if available

   Alternatively, you can email security concerns to the project maintainers through GitHub.

2. **Allow time for response**: We aim to respond to security reports within 48 hours and will keep you informed about the progress toward a fix and full announcement.

3. **Coordinate disclosure**: We ask that you give us reasonable time to address the issue before any public disclosure.

## Security Update Process

1. The security report is received and assigned to a primary handler
2. The problem is confirmed and a list of affected versions is determined
3. Code is audited to find any similar problems
4. Fixes are prepared for all supported versions
5. New versions are released and users are notified

## Security Best Practices

When using react-performance-tracking:

### In CI/CD Environments

- Keep dependencies up to date
- Use npm audit to check for known vulnerabilities
- Run tests in isolated environments
- Use read-only tokens where possible

### In Test Code

- Avoid committing sensitive data in test fixtures
- Use environment variables for sensitive configuration
- Don't log sensitive information in performance artifacts
- Be cautious with CPU/network throttling in shared CI environments

### With Playwright

- Keep Playwright and browser versions updated
- Use Playwright's built-in security features
- Isolate test contexts appropriately
- Review artifacts before sharing (performance data may contain sensitive information)

## Dependencies

We regularly update dependencies to address security vulnerabilities. You can check our current dependency status:

```bash
npm audit
```

## Security-Related Configuration

The library does not:

- Make external network requests (except those initiated by your tests)
- Store data outside the test process
- Require elevated permissions
- Access system resources beyond what Playwright requires

## Questions?

If you have questions about this security policy, please open a discussion in our GitHub repository (for non-sensitive questions) or contact us directly via email (for sensitive matters).

## Acknowledgments

We appreciate the security research community and will acknowledge researchers who responsibly disclose vulnerabilities (with their permission).
