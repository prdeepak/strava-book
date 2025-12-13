# Agent Instructions for Docker Environment

1. **Environment**: This project runs inside a Docker container.
2. **Shortcuts**: ALWAYS prefer using the Makefile.
3. **Common Actions**:
   - Start: \`make up\`
   - Run Code: \`make run\`
   - Test: \`make test\`

4. **Git Sync Protocol (CRITICAL)**:
   - When the user says "Sync", "Save", or "Push":
     1. Run \`git status\` and \`git diff --stat\` to see what changed.
     2. **Propose a concise commit message** to the user based on those changes.
     3. **STOP** and wait for the user to Confirm or Edit the message.
     4. Once confirmed, run: \`make sync msg="<Final Message>"\`

5. **Restriction**: NEVER run python scripts directly on the host machine.
