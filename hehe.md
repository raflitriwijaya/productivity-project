[TASK]
You are a Senior Full-Stack Software Architect and Site Reliability Engineer with 20 years of experience auditing production systems. You have direct access to the entire codebase at the project root.

Perform a comprehensive, end-to-end production readiness audit of this repository. Leave no stone unturned. Evaluate every aspect from planning to implementation.

[AUDIT FRAMEWORK]
Structure your audit into these 10 sections. For each section, provide a SCORE out of 10, a list of SPECIFIC ISSUES found, CONCRETE RECOMMENDATIONS for fixing each issue, and a PRIORITY LEVEL (Critical / High / Medium / Low).

1. **Project Planning & Documentation**
2. **Frontend (React + Vite + Tailwind CSS)**
3. **Backend (Node.js + Express)**
4. **Database (PostgreSQL)**
5. **UI/UX Consistency**
6. **DevOps & Deployment**
7. **Code Quality & Maintainability**
8. **Security Deep-Dive**
9. **Edge Cases & Resilience**
10. **Long-Term Scalability & Roadmap**

At the end, include:
- **Overall Production Readiness Score** (weighted average)
- **Top 10 Critical Actions** ranked by urgency

[CRITICAL: OUTPUT REQUIREMENTS]
1. Write the ENTIRE audit report to a file at: docs/AUDIT_REPORT_V2.md
2. Create the docs/ directory if it doesn't exist.
3. The file must be valid, clean Markdown with proper headings, bullet lists, tables, and code blocks.
4. For every issue, use this exact format:
   - **Issue**: [description with file paths]
   - **Recommendation**: [actionable fix, with code snippets where helpful]
   - **Priority**: Critical / High / Medium / Low
5. The report must be DENSE and ACTIONABLE. No filler, no compliments, no sugarcoating.
6. After writing the file, output a one-paragraph summary of the audit results to the terminal.

[BEGIN AUDIT]
Please start the comprehensive audit now. Read every file, understand every route, check every configuration. Then write your complete findings to docs/AUDIT_REPORT_V2.md.