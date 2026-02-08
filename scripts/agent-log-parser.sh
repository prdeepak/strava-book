#!/bin/bash
# agent-log-parser.sh — Parses Claude stream-json output into readable progress log
#
# Reads NDJSON from stdin, writes timestamped human-readable progress to stdout.
# Captures: assistant text, tool calls (name + truncated args), tool results (truncated),
# and final token usage.
#
# Usage:
#   claude -p "..." --output-format stream-json | ./scripts/agent-log-parser.sh

while IFS= read -r line; do
    # Skip empty lines
    [[ -z "$line" ]] && continue

    # Parse type — fast path with grep before jq
    type=$(echo "$line" | jq -r '.type // empty' 2>/dev/null)
    [[ -z "$type" ]] && continue

    ts=$(date '+%H:%M:%S')

    case "$type" in
        assistant)
            # Assistant message with tool_use or text
            # Extract tool names if present
            tools=$(echo "$line" | jq -r '
                [.message.content[]? | select(.type == "tool_use") | .name] | join(", ")
            ' 2>/dev/null)
            if [[ -n "$tools" && "$tools" != "" ]]; then
                # Show tool name + first 120 chars of input for context
                echo "$line" | jq -r --arg ts "$ts" '
                    .message.content[]? | select(.type == "tool_use") |
                    "[\($ts)] 🔧 \(.name): \(.input | tostring | .[0:120])"
                ' 2>/dev/null
            fi

            # Extract text content
            text=$(echo "$line" | jq -r '
                [.message.content[]? | select(.type == "text") | .text] | join("")
            ' 2>/dev/null)
            if [[ -n "$text" && "$text" != "" ]]; then
                # Truncate long text to first 200 chars
                truncated="${text:0:200}"
                [[ ${#text} -gt 200 ]] && truncated="${truncated}..."
                echo "[$ts] 💬 $truncated"
            fi
            ;;

        result)
            # Tool result — show truncated output
            tool_name=$(echo "$line" | jq -r '.tool_name // "unknown"' 2>/dev/null)
            result_text=$(echo "$line" | jq -r '
                (.result // .error // "no output") | tostring | .[0:150]
            ' 2>/dev/null)
            # Only log errors or short results; skip huge file reads
            is_error=$(echo "$line" | jq -r '.is_error // false' 2>/dev/null)
            if [[ "$is_error" == "true" ]]; then
                echo "[$ts] ❌ $tool_name error: $result_text"
            else
                echo "[$ts] ✅ $tool_name done"
            fi
            ;;

        system)
            # System messages (init, cost updates)
            subtype=$(echo "$line" | jq -r '.subtype // empty' 2>/dev/null)
            case "$subtype" in
                init)
                    model=$(echo "$line" | jq -r '.model // "unknown"' 2>/dev/null)
                    cwd=$(echo "$line" | jq -r '.cwd // "unknown"' 2>/dev/null)
                    echo "[$ts] 🚀 Agent started — model=$model cwd=$cwd"
                    ;;
                cost)
                    cost=$(echo "$line" | jq -r '.costUsd // 0 | . * 100 | round / 100' 2>/dev/null)
                    turns=$(echo "$line" | jq -r '.totalTurns // 0' 2>/dev/null)
                    echo "[$ts] 💰 Cost: \$${cost} after $turns turns"
                    ;;
            esac
            ;;
    esac
done
