# Security Policy

## Supported Versions

We actively support the following versions of Android Messages Desktop:

| Version | Supported          |
| ------- | ------------------ |
| 6.0.x   | :white_check_mark: |
| 5.7.x   | :white_check_mark: |
| 5.6.x   | :white_check_mark: |
| 5.5.x   | :white_check_mark: |
| 5.4.x   | :white_check_mark: |
| < 5.4.x | :x:                |

**Note:** Security updates are backported to supported versions as needed. We recommend always using the latest version
for the best security posture.

## Reporting a Vulnerability

We take security seriously and appreciate your efforts to responsibly disclose your findings.

### How to Report

**Do NOT open a public issue** for security vulnerabilities. Instead, please report security issues through one of these
channels:

1. **GitHub Security Advisories** (Preferred): [Report via GitHub](https://github.com/LanikSJ/android-messages-desktop/security/advisories/new)
2. **Email**: Send details to [security@lanik.us](mailto:security@lanik.us)
3. **Security Discussions**: Open a discussion in our [GitHub Discussions](https://github.com/LanikSJ/android-messages-desktop/discussions/categories/security)
4. **Security Issues**: Create a [Security Advisory](https://github.com/LanikSJ/android-messages-desktop/security/advisories/new)
   on GitHub

### What to Include

When reporting a vulnerability, please include:

- **Description**: Clear explanation of the security issue
- **Steps to Reproduce**: Detailed steps to reproduce the vulnerability
- **Impact Assessment**: Potential impact and affected components
- **Proof of Concept**: If applicable, a minimal reproduction case
- **Suggested Fix**: If you have ideas for a fix (optional)

### Response Timeline

We are committed to responding to security reports in a timely manner:

- **Initial Response**: Within 48 hours of receiving the report
- **Status Update**: Within 5 business days with assessment
- **Resolution**: We will work diligently to fix critical vulnerabilities as quickly as possible

### Responsible Disclosure

We ask that you:

- Give us reasonable time to investigate and fix the issue before public disclosure
- Do not access, modify, or delete user data
- Do not perform attacks that could harm the availability of our services
- Do not publicly disclose the vulnerability until we have had a chance to address it

## Security Considerations

### Electron Application Security

This application is built with Electron, which combines Chromium and Node.js. We implement the following security measures:

- **Node.js Integration Disabled**: Node.js integration is disabled in the renderer process to prevent access to system
  APIs
- **Context Isolation**: Enabled to prevent prototype pollution attacks
- **Content Security Policy**: Implemented to prevent XSS attacks
- **User Agent Override**: Modified to prevent Google from blocking the application

### Data Handling

- **No Local Storage**: Messages and user data are not stored locally on your device
- **Web Content Only**: The application acts as a wrapper for the web interface at `messages.google.com`
- **Network Requests**: All network requests go directly to Google's servers

### Known Limitations

- **Code Signing**: Currently, macOS and Windows binaries are not signed due to certificate requirements
- **Auto-updates**: Implemented but relies on GitHub releases for distribution
- **Third-party Dependencies**: Regularly updated to address known vulnerabilities

## Security Best Practices

### For Users

- **Keep Updated**: Always use the latest version of the application
- **Download from Official Sources**: Only download from our GitHub releases page or trusted package managers
- **Report Suspicious Activity**: If you notice anything unusual, please report it

### For Developers

When contributing to the project:

- **Avoid eval()**: Never use `eval()` or similar functions that execute arbitrary code
- **Sanitize Inputs**: Always validate and sanitize user inputs
- **Secure IPC**: Use secure inter-process communication patterns
- **Dependency Management**: Keep dependencies updated and audit for vulnerabilities

## Security Resources

- [Electron Security Checklist](https://www.electronjs.org/docs/latest/tutorial/security)
- [OWASP Electron Security Guide](https://owasp.org/www-project-electron-security/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## Contact

For general security questions or concerns, you can:

- Open a discussion in our [GitHub Discussions](https://github.com/LanikSJ/android-messages-desktop/discussions)
- Contact the maintainers through the security email above for sensitive matters

Thank you for helping keep Android Messages Desktop secure!
