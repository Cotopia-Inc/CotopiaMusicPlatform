# Security Policy

## Supported Versions

We actively maintain and patch security issues on the following versions:

| Version | Supported |
|---|---|
| Latest (main branch) | ✅ Yes |
| Older releases | ❌ No |

We recommend always running the latest version.

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you believe you have found a security vulnerability in Cotopia, please report it responsibly through one of the following channels:

- **Email:** techsupport@cotopia.org
- **GitHub Private Disclosure:** Use [GitHub's private security advisory](../../security/advisories/new) feature to report confidentially.

### What to Include

Please provide as much of the following information as possible to help us understand and resolve the issue quickly:

- A description of the vulnerability and its potential impact.
- The type of vulnerability (e.g., XSS, SQL injection, authentication bypass, data exposure).
- Step-by-step instructions to reproduce the issue.
- Any proof-of-concept code or screenshots.
- The affected endpoint(s), route(s), or component(s).
- Your suggested fix, if you have one.

---

## Our Commitment

- We will acknowledge receipt of your report within **48 hours**.
- We will keep you informed of our progress toward a fix.
- We will credit you in the release notes (if you wish) once the vulnerability is resolved.
- We ask that you give us a reasonable amount of time to fix the issue before any public disclosure.

---

## Scope

The following are **in scope** for our security program:

- The Cotopia web application (frontend + API)
- Authentication and session management
- User data exposure or unauthorized access
- Role privilege escalation
- Content moderation bypass
- Payment flow vulnerabilities

The following are **out of scope:**

- Denial of service attacks
- Social engineering of our team members
- Issues in third-party services we depend on (please report those to the relevant vendor)
- Vulnerabilities requiring physical access to a user's device

---

## Safe Harbor

Cotopia will not pursue legal action against researchers who:

- Report vulnerabilities in good faith through the channels above.
- Do not access, modify, or delete data belonging to other users.
- Do not disrupt or degrade the platform for other users.
- Do not publicly disclose the vulnerability before we have had a reasonable time to patch it.

Thank you for helping keep Cotopia and its users safe.
