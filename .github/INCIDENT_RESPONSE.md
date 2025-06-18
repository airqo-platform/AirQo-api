# Incident Response Plan

## 1. Preparation

- Ensure all contributors enable **multi-factor authentication (MFA)**.
- Regularly update dependencies and monitor for vulnerabilities.
- Assign clear roles for incident response: Incident Lead, Communications, Technical Lead.

## 2. Identification

- Monitor for unusual activity, alerts from code/secret scanning, and security advisories.
- Anyone can report a suspected incident via [GitHub Issues](https://github.com/airqo-platform/AirQo-api/issues) (for non-sensitive matters) or via the private vulnerability reporting process.

## 3. Containment

- Restrict access to affected systems or repositories.
- Revoke or rotate any potentially compromised credentials immediately.
- Temporarily disable affected services if necessary.

## 4. Eradication

- Identify and remove the root cause (e.g., malicious code, exposed secrets).
- Patch vulnerabilities and update dependencies as required.

## 5. Recovery

- Restore affected services from clean backups or after remediation.
- Closely monitor for any signs of recurring issues.

## 6. Post-Incident

- Document the incident, response actions, and lessons learned.
- Update this plan and related security documentation as needed.
- Share a summary with the community if appropriate.

## Contacts

- **Security Contact:** security@airqo.net
- **Maintainers:** See [CODEOWNERS](./CODEOWNERS.md) or repository admins.

## Additional Resources

- [GitHub Security Advisories](https://github.com/airqo-platform/AirQo-api/security/advisories)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)

---

_Keep this document up to date and review it after each incident._
