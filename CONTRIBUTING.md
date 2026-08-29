# Contributing to Frame Sense

Thank you for your interest in contributing to Frame Sense! This document provides guidelines for contributing code, formatting, and raising issues.

## Development Setup

See [docs/development.md](docs/development.md) for step-by-step instructions on setting up Node.js, `pnpm` workspaces, and the Python virtual environment.

### Code Style Guidelines

*   **TypeScript / React**:
    *   Follow modern React functional patterns using TypeScript.
    *   Separate logic from components when possible using hooks and services.
    *   Keep styling aligned with our dark cinematic design rules in `globals.css` and `tailwind.config.js`.
*   **Python**:
    *   Follow PEP 8 guidelines.
    *   Provide type hints for all function arguments and returns.
    *   Organize code into Pydantic models/schemas and routers.

## Pull Request Guidelines

1.  **Branch Naming**: Use descriptive branch names:
    *   `feature/feature-name`
    *   `bugfix/issue-description`
    *   `docs/updates`
2.  **Lint and Build**:
    *   Verify the project compiles by running `pnpm run build`.
    *   Verify the API launches without issue.
3.  **Submit PR**: Fill out the Pull Request Template when opening a PR on GitHub.

## Reporting Issues

*   Search existing issues to check if your problem has already been reported.
    *   Use the Issue templates for Bug Reports or Feature Requests.
