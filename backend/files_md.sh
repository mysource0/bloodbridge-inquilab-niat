#!/bin/bash

# ==========================================
# Code Collector → Markdown (code.txt)
# ==========================================

# --- Configuration ---
START_DIR="."                  # Directory to start searching from
MAX_DEPTH=6                    # Max depth for find
OUTPUT_FILE="code.txt"         # Output file

# Directories to ignore
IGNORE_DIRS=("node_modules" "assets" "backup_assets" ".git" ".vscode" "dist" "build" "venv" "__pycache__")

# Filenames to ignore (applies anywhere in tree)
IGNORE_FILES=("vocab.txt" "special_tokens.txt")  # Added more files if needed

# File extensions to include
INCLUDE_EXTENSIONS=("py" "sql" "js" "jsx" "ts" "tsx" "css" "scss" "html" "txt" "env")

# Line filters → regex patterns of lines to remove
FILTER_PATTERNS=(
  "^# Script was called via:"
  "^#python train_many_data_files_v2.py"
  "^python train_many_data_files_v2.py"
)

# Content patterns to skip entire files
CONTENT_IGNORE_PATTERNS=(
  "^\[PAD\]$"
  "^\[unused[0-9]+\]$"
)

# ==========================================
# --- Helper Functions ---
# ==========================================

# Check if a value is in an array
in_array() {
  local item="$1"; shift
  for element; do
    [[ "$element" == "$item" ]] && return 0
  done
  return 1
}

# Check if file content matches any ignore patterns
check_content_ignore() {
  local file="$1"
  for pattern in "${CONTENT_IGNORE_PATTERNS[@]}"; do
    if grep -E "$pattern" "$file" >/dev/null; then
      return 0  # Match found, ignore file
    fi
  done
  return 1  # No match, process file
}

# Apply line filters to file content
filter_file_content() {
  local file="$1"
  local content
  content=$(cat "$file")
  for pattern in "${FILTER_PATTERNS[@]}"; do
    content=$(echo "$content" | grep -v -E "$pattern")
  done
  echo "$content"
}

# Detect language hint for Markdown
lang_hint() {
  case "$1" in
    py)   echo "python" ;;
    js|jsx) echo "javascript" ;;
    ts|tsx) echo "typescript" ;;
    css) echo "css" ;;
    scss) echo "scss" ;;
    html) echo "html" ;;
    md) echo "markdown" ;;
    sh) echo "bash" ;;
    json) echo "json" ;;
    yaml|yml) echo "yaml" ;;
    txt) echo "" ;;
    *) echo "" ;;
  esac
}

# ==========================================
# --- Main Script ---
# ==========================================

# Ensure start dir exists
if [ ! -d "$START_DIR" ]; then
  echo "Error: Start directory '$START_DIR' not found." >&2
  exit 1
fi

# Clear output file
> "$OUTPUT_FILE"
echo "Created/Cleared output file: $OUTPUT_FILE"

# Build find command options for ignored dirs
ignore_opts=()
if [ ${#IGNORE_DIRS[@]} -gt 0 ]; then
  ignore_opts+=("(")
  first_ignore=true
  for dir in "${IGNORE_DIRS[@]}"; do
    if [ "$first_ignore" = false ]; then
      ignore_opts+=("-o")
    fi
    ignore_opts+=("-name" "$dir" "-type" "d")
    first_ignore=false
  done
  ignore_opts+=(")" "-prune")
else
  ignore_opts+=("(" "-false" ")" "-prune")
fi

# Build find command options for included extensions
include_opts=()
if [ ${#INCLUDE_EXTENSIONS[@]} -gt 0 ]; then
  include_opts+=("(")
  first_include=true
  for ext in "${INCLUDE_EXTENSIONS[@]}"; do
    if [ "$first_include" = false ]; then
      include_opts+=("-o")
    fi
    include_opts+=("-name" "*.$ext")
    first_include=false
  done
  include_opts+=(")")
fi

echo "Starting file search in '$START_DIR' up to depth ${MAX_DEPTH}..."

# Run find and process files
find "$START_DIR" -maxdepth "$MAX_DEPTH" \
  "${ignore_opts[@]}" \
  -o \( -type f "${include_opts[@]}" \) \
  -print0 | while IFS= read -r -d $'\0' file; do
    
    clean_file="${file#./}"
    filename=$(basename "$clean_file")

    # Skip unwanted files
    if in_array "$filename" "${IGNORE_FILES[@]}"; then
      echo "Skipping file: $clean_file"
      continue
    fi

    # Skip files with specific content patterns
    if check_content_ignore "$file"; then
      echo "Skipping file with ignored content: $clean_file"
      continue
    fi

    echo "Processing: $clean_file"

    # Get extension & language
    extension="${clean_file##*.}"
    extension_lower=$(tr '[:upper:]' '[:lower:]' <<< "$extension")
    lang=$(lang_hint "$extension_lower")

    {
      printf '`%s`\n\n' "$clean_file"
      printf '```%s\n' "$lang"
      filter_file_content "$file"
      printf '\n```\n\n'
    } >> "$OUTPUT_FILE"

done

echo "Markdown generation complete: $OUTPUT_FILE"