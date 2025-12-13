# Agent Instructions for Docker Environment

1. **Environment**: This project runs inside a Docker container.
2. **Shortcuts**: ALWAYS prefer using the Makefile over raw Docker commands.
3. **Common Actions**:
   - To start environment: `make up`
   - To run the main script: `make run`
   - To enter terminal: `make shell`
   - To apply changes to requirements.txt: `make build` then `make up`
4. **Restriction**: NEVER run python scripts directly on the host machine.
