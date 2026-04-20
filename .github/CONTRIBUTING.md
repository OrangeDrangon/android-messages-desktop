# Contributing

We welcome contributions from developers, testers, and enthusiasts! Whether you're
fixing bugs, improving the app, or just helping spread the word, your help makes
Android Messages Desktop better.

## Ways to Contribute

### As a Developer

If you have coding experience:

- Fix bugs and implement new features
- Improve performance and code quality
- Add or improve tests
- Work on the UI/UX
- Maintain documentation

### As a User/Non-Developer

Without touching code:

- Report bugs you encounter
- Test the app on different systems and configurations
- Provide feedback on usability and features
- Help others in GitHub discussions or issues
- Spread the word to help grow the community

## Reporting Bugs

If something isn't working as expected, please [open an issue on GitHub](https://github.com/LanikSJ/android-messages-desktop/issues)
with as much detail as possible, such as:

- Step-by-step instructions to reproduce the issue
- Expected vs. actual behavior
- Screenshots or video if applicable
- Your system information (OS, app version, etc.)
- Any error logs from the console

Before opening an issue, please ensure:

1. **You're using the latest version** - Check the [releases page](https://github.com/LanikSJ/android-messages-desktop/releases/latest)
   for the newest build
2. **Check for existing issues** - Search the issue tracker to avoid duplicates
3. **Read the documentation** - Check this file, the README.md, and any other docs

## Improving Documentation

Documentation improvements are always appreciated! Fork the repository, update
content in README.md, CONTRIBUTING.md, or other documentation files, and submit
a pull request.

## Development Setup

To contribute code or build the app locally:

### Prerequisites

- Node.js (LTS version recommended)
- Yarn package manager (or npm)

### Setup Steps

1. **Fork** the repository on GitHub
2. **Clone** your fork locally: `git clone https://github.com/YOUR_USERNAME/android-messages-desktop.git`
3. **Install dependencies**: `yarn install`
4. **Start development**: `yarn start` (this builds the app for development and launches it)

### Available Scripts

- `yarn build` - Create a production build
- `yarn build:dev` - Create a development build
- `yarn start` - Build for development and run the app
- `yarn lint` - Run ESLint to check and fix code quality issues
- `yarn package` - Package the app for distribution

### Guidelines

- Run `yarn lint` before submitting changes to ensure code quality and style consistency
- Tests are highly encouraged - add them where possible
- Follow the existing TypeScript/JavaScript patterns in the codebase
- Keep commits focused and descriptive

## We ❤️ Pull Requests

Pull requests are welcome! They don't have to implement new features or fix bugs -
refactoring existing code, removing legacy code, and adding tests are all valuable
contributions.

Please ensure your PR follows these guidelines:

- The code compiles successfully and doesn't break existing functionality
- Changes are tested and don't introduce regressions
- Code is readable with appropriate comments where needed
- A clear PR description provides context and an overview of changes

**Extra points if your code includes tests!**

## Resources

- [GitHub Issues](https://github.com/LanikSJ/android-messages-desktop/issues)
- [Releases](https://github.com/LanikSJ/android-messages-desktop/releases)
- [README.md](../README.md)
