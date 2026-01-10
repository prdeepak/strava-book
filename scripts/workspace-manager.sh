#!/bin/bash
set -e

# Workspace Manager for Multi-Agent Development
# Creates isolated git worktrees with dedicated Docker containers

MAIN_REPO="$HOME/bin/strava-book"
WORKSPACES_DIR="$HOME/bin/strava-workspaces"
REGISTRY_FILE="$WORKSPACES_DIR/registry.json"
STALE_HOURS=24
PORT_MIN=3001
PORT_MAX=3020

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Ensure jq is available
check_dependencies() {
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}Error: jq is required but not installed.${NC}"
        echo "Install with: brew install jq"
        exit 1
    fi
}

# Initialize registry if it doesn't exist
init_registry() {
    mkdir -p "$WORKSPACES_DIR"
    if [[ ! -f "$REGISTRY_FILE" ]]; then
        echo '{
  "workspaces": [],
  "next_port": 3001,
  "port_range": {"min": 3001, "max": 3020}
}' > "$REGISTRY_FILE"
    fi
}

# Find next available port
find_available_port() {
    local port
    for port in $(seq $PORT_MIN $PORT_MAX); do
        # Check if port is in use by system
        if ! lsof -i :$port >/dev/null 2>&1; then
            # Check if port is already assigned in registry
            local assigned
            assigned=$(jq -r ".workspaces[] | select(.port == $port) | .port" "$REGISTRY_FILE")
            if [[ -z "$assigned" ]]; then
                echo $port
                return
            fi
        fi
    done
    echo -e "${RED}Error: No available ports in range $PORT_MIN-$PORT_MAX${NC}" >&2
    exit 1
}

# Generate unique workspace ID
generate_id() {
    echo "ws-$(openssl rand -hex 3)"
}

# Get current timestamp in ISO format
timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Create new workspace
cmd_new() {
    local name="${1:-untitled}"
    local id
    id=$(generate_id)
    local branch="${id}-${name}"
    local port
    port=$(find_available_port)
    local workspace_path="$WORKSPACES_DIR/$id"
    local container_name="strava-ws-$id"

    echo -e "${BLUE}Creating workspace: ${name}${NC}"
    echo "  ID: $id"
    echo "  Branch: $branch"
    echo "  Port: $port"
    echo ""

    # Create git worktree
    echo -e "${YELLOW}Creating git worktree...${NC}"
    cd "$MAIN_REPO"
    git worktree add "$workspace_path" -b "$branch"

    # Copy docker-compose template
    echo -e "${YELLOW}Setting up Docker configuration...${NC}"
    sed -e "s/\${WORKSPACE_ID}/$id/g" \
        -e "s/\${WORKSPACE_PORT}/$port/g" \
        "$MAIN_REPO/scripts/docker-compose.workspace.template.yml" \
        > "$workspace_path/docker-compose.workspace.yml"

    # Create workspace metadata
    cat > "$workspace_path/.workspace.json" << EOF
{
  "id": "$id",
  "name": "$name",
  "branch": "$branch",
  "port": $port,
  "container_name": "$container_name",
  "created_at": "$(timestamp)",
  "main_repo": "$MAIN_REPO"
}
EOF

    # Copy .env.local from main repo (copy instead of symlink so it works inside Docker)
    if [[ -f "$MAIN_REPO/web/.env.local" ]]; then
        cp "$MAIN_REPO/web/.env.local" "$workspace_path/web/.env.local"
    fi

    # Update registry
    local new_workspace
    new_workspace=$(cat << EOF
{
  "id": "$id",
  "name": "$name",
  "branch": "$branch",
  "port": $port,
  "path": "$workspace_path",
  "container_name": "$container_name",
  "created_at": "$(timestamp)",
  "last_active": "$(timestamp)",
  "status": "created"
}
EOF
)
    jq ".workspaces += [$new_workspace]" "$REGISTRY_FILE" > "$REGISTRY_FILE.tmp" && mv "$REGISTRY_FILE.tmp" "$REGISTRY_FILE"

    # Start the container
    echo -e "${YELLOW}Starting Docker container...${NC}"
    cd "$workspace_path"
    docker-compose -f docker-compose.workspace.yml up -d --build

    # Update status to running
    jq "(.workspaces[] | select(.id == \"$id\")).status = \"running\"" "$REGISTRY_FILE" > "$REGISTRY_FILE.tmp" && mv "$REGISTRY_FILE.tmp" "$REGISTRY_FILE"

    echo ""
    echo -e "${GREEN}=========================================="
    echo -e "Workspace created successfully!"
    echo -e "==========================================${NC}"
    echo ""
    echo "  ID:         $id"
    echo "  Name:       $name"
    echo "  Branch:     $branch"
    echo "  Directory:  $workspace_path"
    echo "  Dev server: http://localhost:$port"
    echo ""
    echo -e "${BLUE}To start working:${NC}"
    echo "  cd $workspace_path"
    echo ""
    echo -e "${BLUE}Container is building and starting...${NC}"
    echo "  Check status: docker-compose -f docker-compose.workspace.yml logs -f"
    echo ""
}

# List all workspaces
cmd_list() {
    if [[ ! -f "$REGISTRY_FILE" ]]; then
        echo "No workspaces found."
        return
    fi

    local count
    count=$(jq '.workspaces | length' "$REGISTRY_FILE")

    if [[ "$count" -eq 0 ]]; then
        echo "No workspaces found."
        return
    fi

    # Update status for each workspace
    update_all_statuses

    echo ""
    printf "${BLUE}%-10s %-20s %-6s %-10s %-15s${NC}\n" "ID" "NAME" "PORT" "STATUS" "LAST ACTIVE"
    printf "%-10s %-20s %-6s %-10s %-15s\n" "----------" "--------------------" "------" "----------" "---------------"

    jq -r '.workspaces[] | "\(.id)|\(.name)|\(.port)|\(.status)|\(.last_active)"' "$REGISTRY_FILE" | while IFS='|' read -r id name port status last_active; do
        # Calculate time since last active
        local time_ago
        time_ago=$(time_since "$last_active")

        # Color code status
        local status_color
        case "$status" in
            running) status_color="${GREEN}$status${NC}" ;;
            stopped) status_color="${YELLOW}$status${NC}" ;;
            stale)   status_color="${RED}$status${NC}" ;;
            *)       status_color="$status" ;;
        esac

        printf "%-10s %-20s %-6s %-10b %-15s\n" "$id" "${name:0:20}" "$port" "$status_color" "$time_ago"
    done
    echo ""
}

# Calculate human-readable time since timestamp
time_since() {
    local timestamp="$1"
    local then_epoch
    local now_epoch
    local diff

    # Handle both GNU and BSD date
    if date --version >/dev/null 2>&1; then
        # GNU date
        then_epoch=$(date -d "$timestamp" +%s 2>/dev/null || echo 0)
    else
        # BSD date (macOS)
        then_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$timestamp" +%s 2>/dev/null || echo 0)
    fi

    now_epoch=$(date +%s)
    diff=$((now_epoch - then_epoch))

    if [[ $diff -lt 60 ]]; then
        echo "just now"
    elif [[ $diff -lt 3600 ]]; then
        echo "$((diff / 60)) min ago"
    elif [[ $diff -lt 86400 ]]; then
        echo "$((diff / 3600)) hours ago"
    else
        echo "$((diff / 86400)) days ago"
    fi
}

# Check if workspace is stale (inactive > STALE_HOURS)
is_stale() {
    local last_active="$1"
    local then_epoch
    local now_epoch
    local diff
    local stale_seconds=$((STALE_HOURS * 3600))

    if date --version >/dev/null 2>&1; then
        then_epoch=$(date -d "$last_active" +%s 2>/dev/null || echo 0)
    else
        then_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$last_active" +%s 2>/dev/null || echo 0)
    fi

    now_epoch=$(date +%s)
    diff=$((now_epoch - then_epoch))

    [[ $diff -gt $stale_seconds ]]
}

# Update status of all workspaces
update_all_statuses() {
    local ids
    ids=$(jq -r '.workspaces[].id' "$REGISTRY_FILE")

    for id in $ids; do
        update_workspace_status "$id"
    done
}

# Update status of a single workspace
update_workspace_status() {
    local id="$1"
    local container_name="strava-ws-$id"
    local status="stopped"

    # Check if container is running
    if docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        status="running"
        # Update last_active timestamp
        jq "(.workspaces[] | select(.id == \"$id\")).last_active = \"$(timestamp)\"" "$REGISTRY_FILE" > "$REGISTRY_FILE.tmp" && mv "$REGISTRY_FILE.tmp" "$REGISTRY_FILE"
    else
        # Check if stale
        local last_active
        last_active=$(jq -r ".workspaces[] | select(.id == \"$id\") | .last_active" "$REGISTRY_FILE")
        if is_stale "$last_active"; then
            status="stale"
        fi
    fi

    jq "(.workspaces[] | select(.id == \"$id\")).status = \"$status\"" "$REGISTRY_FILE" > "$REGISTRY_FILE.tmp" && mv "$REGISTRY_FILE.tmp" "$REGISTRY_FILE"
}

# Start a workspace container
cmd_start() {
    local id="$1"
    if [[ -z "$id" ]]; then
        echo -e "${RED}Error: workspace ID required${NC}"
        echo "Usage: workspace-manager.sh start <id>"
        exit 1
    fi

    local workspace_path
    workspace_path=$(jq -r ".workspaces[] | select(.id == \"$id\") | .path" "$REGISTRY_FILE")

    if [[ -z "$workspace_path" || "$workspace_path" == "null" ]]; then
        echo -e "${RED}Error: workspace '$id' not found${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Starting workspace $id...${NC}"
    cd "$workspace_path"
    docker-compose -f docker-compose.workspace.yml up -d

    jq "(.workspaces[] | select(.id == \"$id\")).status = \"running\" | (.workspaces[] | select(.id == \"$id\")).last_active = \"$(timestamp)\"" "$REGISTRY_FILE" > "$REGISTRY_FILE.tmp" && mv "$REGISTRY_FILE.tmp" "$REGISTRY_FILE"

    echo -e "${GREEN}Workspace $id started${NC}"
}

# Stop a workspace container
cmd_stop() {
    local id="$1"
    if [[ -z "$id" ]]; then
        echo -e "${RED}Error: workspace ID required${NC}"
        echo "Usage: workspace-manager.sh stop <id>"
        exit 1
    fi

    local workspace_path
    workspace_path=$(jq -r ".workspaces[] | select(.id == \"$id\") | .path" "$REGISTRY_FILE")

    if [[ -z "$workspace_path" || "$workspace_path" == "null" ]]; then
        echo -e "${RED}Error: workspace '$id' not found${NC}"
        exit 1
    fi

    echo -e "${YELLOW}Stopping workspace $id...${NC}"
    cd "$workspace_path"
    docker-compose -f docker-compose.workspace.yml down

    jq "(.workspaces[] | select(.id == \"$id\")).status = \"stopped\"" "$REGISTRY_FILE" > "$REGISTRY_FILE.tmp" && mv "$REGISTRY_FILE.tmp" "$REGISTRY_FILE"

    echo -e "${GREEN}Workspace $id stopped${NC}"
}

# Open shell in workspace container
cmd_shell() {
    local id="$1"
    if [[ -z "$id" ]]; then
        echo -e "${RED}Error: workspace ID required${NC}"
        echo "Usage: workspace-manager.sh shell <id>"
        exit 1
    fi

    local container_name="strava-ws-$id"

    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${container_name}$"; then
        echo -e "${RED}Error: workspace container is not running${NC}"
        echo "Start it with: workspace-manager.sh start $id"
        exit 1
    fi

    docker exec -it "$container_name" /bin/sh
}

# Destroy a workspace
cmd_destroy() {
    local id="$1"
    local force="${2:-}"

    if [[ -z "$id" ]]; then
        echo -e "${RED}Error: workspace ID required${NC}"
        echo "Usage: workspace-manager.sh destroy <id> [--force]"
        exit 1
    fi

    local workspace_path
    local branch
    local name
    workspace_path=$(jq -r ".workspaces[] | select(.id == \"$id\") | .path" "$REGISTRY_FILE")
    branch=$(jq -r ".workspaces[] | select(.id == \"$id\") | .branch" "$REGISTRY_FILE")
    name=$(jq -r ".workspaces[] | select(.id == \"$id\") | .name" "$REGISTRY_FILE")

    if [[ -z "$workspace_path" || "$workspace_path" == "null" ]]; then
        echo -e "${RED}Error: workspace '$id' not found${NC}"
        exit 1
    fi

    if [[ "$force" != "--force" ]]; then
        read -p "Destroy workspace $id ($name)? [y/N] " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi

    printf "Destroying %s..." "$id"

    # Stop container and remove volumes (suppress all output)
    if [[ -d "$workspace_path" ]]; then
        (cd "$workspace_path" && docker-compose -f docker-compose.workspace.yml down -v 2>/dev/null) || true
    fi
    docker volume rm "${id}_node_modules" 2>/dev/null || true

    # Remove git worktree and branch
    cd "$MAIN_REPO"
    git worktree remove "$workspace_path" --force &>/dev/null || true
    git branch -D "$branch" &>/dev/null || true

    # Remove from registry
    jq "del(.workspaces[] | select(.id == \"$id\"))" "$REGISTRY_FILE" > "$REGISTRY_FILE.tmp" && mv "$REGISTRY_FILE.tmp" "$REGISTRY_FILE"

    # Clean up directory if it still exists
    [[ -d "$workspace_path" ]] && rm -rf "$workspace_path"

    echo -e " ${GREEN}done${NC}"
}

# Cleanup stale workspaces
cmd_cleanup() {
    local dry_run="${1:-}"

    if [[ ! -f "$REGISTRY_FILE" ]]; then
        echo "No registry found. Nothing to clean up."
        return
    fi

    update_all_statuses

    # Find stale workspaces
    local stale_ids
    stale_ids=$(jq -r '.workspaces[] | select(.status == "stale") | .id' "$REGISTRY_FILE")

    if [[ -z "$stale_ids" ]]; then
        echo -e "${GREEN}No stale workspaces found.${NC}"
        return
    fi

    echo -e "${YELLOW}Found stale workspace(s):${NC}"
    for id in $stale_ids; do
        local name
        local last_active
        name=$(jq -r ".workspaces[] | select(.id == \"$id\") | .name" "$REGISTRY_FILE")
        last_active=$(jq -r ".workspaces[] | select(.id == \"$id\") | .last_active" "$REGISTRY_FILE")
        echo "  $id ($name) - inactive since $(time_since "$last_active")"
    done
    echo ""

    if [[ "$dry_run" == "--dry-run" ]]; then
        echo "(Dry run - no changes made)"
        return
    fi

    read -p "Remove all stale workspaces? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        return
    fi

    for id in $stale_ids; do
        cmd_destroy "$id" --force
    done

    echo -e "${GREEN}Cleanup complete.${NC}"
}

# Show help
cmd_help() {
    echo "Workspace Manager - Multi-Agent Development Tool"
    echo ""
    echo "Usage: workspace-manager.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  new [name]        Create a new isolated workspace"
    echo "  list              List all workspaces with status"
    echo "  start <id>        Start a workspace container"
    echo "  stop <id>         Stop a workspace container"
    echo "  shell <id>        Open shell in workspace container"
    echo "  destroy <id>      Remove a workspace completely"
    echo "  cleanup           Remove all stale workspaces"
    echo "  help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  workspace-manager.sh new feature-auth"
    echo "  workspace-manager.sh list"
    echo "  workspace-manager.sh destroy ws-abc123"
    echo "  workspace-manager.sh cleanup --dry-run"
}

# Main entry point
main() {
    check_dependencies
    init_registry

    local command="${1:-help}"
    shift || true

    case "$command" in
        new)     cmd_new "$@" ;;
        list)    cmd_list "$@" ;;
        start)   cmd_start "$@" ;;
        stop)    cmd_stop "$@" ;;
        shell)   cmd_shell "$@" ;;
        destroy) cmd_destroy "$@" ;;
        cleanup) cmd_cleanup "$@" ;;
        help)    cmd_help ;;
        *)
            echo -e "${RED}Unknown command: $command${NC}"
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
