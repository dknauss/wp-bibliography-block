# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub issues.**

This plugin accepts untrusted input (pasted text, CrossRef API responses) and renders output into post content as HTML. The [SPEC.md](SPEC.md) documents the full threat model and sanitization strategy.

To report a vulnerability:

1. Use [GitHub Private Vulnerability Reporting](https://github.com/dknauss/wp-bibliography-block/security/advisories/new) to submit a report.
2. Include:
   - A description of the vulnerability.
   - Steps to reproduce or a proof of concept.
   - The potential impact (XSS, injection, data exposure, etc.).

You should receive an acknowledgment within **72 hours**. A fix or mitigation plan will be communicated within **7 days** of confirmation.

## Scope

The following areas are particularly relevant:

- **Stored XSS** via pasted BibTeX, DOI metadata, or display overrides
- **JSON-LD / CSL-JSON script block breakout** via crafted field values
- **COinS attribute injection** via special characters in metadata
- **Prototype pollution** via citation-js parsing
- **Denial of service** via oversized pastes or mass DOI lookups
