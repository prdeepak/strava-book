#!/bin/bash

echo "🛠️ Upgrading environment with Testing capabilities..."

# 1. Add pytest to requirements
echo "pytest" >> requirements.txt
echo "✅ Added pytest to requirements.txt"

# 2. Create a 'tests' directory and a sample test
mkdir -p tests
cat <<EOF > tests/test_sample.py
def test_math_works():
    """A simple test to verify the environment is sane."""
    assert 1 + 1 == 2

def test_antigravity_concept():
    """Verify we are ready to fly."""
    gravity = False
    assert gravity is False
EOF
echo "✅ Created tests/test_sample.py"

# 3. Add 'test' command to Makefile
# We use printf to ensure TABS are used (Makefiles require tabs, not spaces)
printf "\ntest:\n\tdocker-compose exec app pytest\n" >> Makefile
echo "✅ Added 'make test' to Makefile"

# 4. Update Agent Rules
cat <<EOF >> AGENT_RULES.md

5. **Testing**:
   - Run unit tests with: \`make test\`
   - ALWAYS run tests before confirming a task is complete.
EOF
echo "✅ Updated AGENT_RULES.md"

echo ""
echo "🔄 Rebuilding container to install pytest..."
make build
make up

echo "🎉 Upgrade complete! Try running: make test"