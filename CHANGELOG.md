# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- MIT license, security policy, contributing guide, and code of conduct
- Deploy templates for Docker Compose (production), Railway, Render, and Fly.io
- Model-provider guide covering OpenRouter and other OpenAI-compatible hosts
- Gitleaks workflow and Dependabot
- Repository-scoped `.env` loading so parent-directory env files are ignored

### Security

- Local dotenv loader no longer walks to `/` or the home directory
