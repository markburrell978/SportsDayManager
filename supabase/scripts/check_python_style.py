"""Check the small Python surface for readable names and purpose comments."""

import ast
from pathlib import Path
import sys


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
PYTHON_DIRECTORIES = (
    REPOSITORY_ROOT / "supabase/scripts",
    REPOSITORY_ROOT / "supabase/tests",
)
FORBIDDEN_NAMES = {
    "args",
    "cfg",
    "config",
    "env",
    "idx",
    "len",
    "num",
    "opts",
    "params",
    "temp",
    "tmp",
    "url",
    "urls",
}
ALLOWED_SPECIAL_ARGUMENTS = {"self", "cls"}
MAXIMUM_LINE_LENGTH = 88


def find_python_files():
    """Return project Python files in a stable order."""
    return sorted(
        file_path
        for directory in PYTHON_DIRECTORIES
        for file_path in directory.glob("*.py")
    )


def binding_names(syntax_tree):
    """Yield locally declared variable and argument names with their locations."""
    for syntax_node in ast.walk(syntax_tree):
        if isinstance(syntax_node, ast.Name) and isinstance(
            syntax_node.ctx,
            ast.Store,
        ):
            yield syntax_node.id, syntax_node.lineno
        if isinstance(syntax_node, ast.arg):
            yield syntax_node.arg, syntax_node.lineno


def validate_file(file_path):
    """Return style errors for one parsed Python source file."""
    errors = []
    source = file_path.read_text()
    syntax_tree = ast.parse(source, filename=str(file_path))

    for line_number, source_line in enumerate(source.splitlines(), start=1):
        if len(source_line) > MAXIMUM_LINE_LENGTH:
            errors.append(
                f"{file_path}:{line_number}: line exceeds "
                f"{MAXIMUM_LINE_LENGTH} characters"
            )

    for binding_name, line_number in binding_names(syntax_tree):
        shortened_name = (
            len(binding_name) == 1
            or binding_name in FORBIDDEN_NAMES
            or binding_name.endswith("_id")
            or binding_name.endswith("_ids")
        )
        if shortened_name and binding_name not in ALLOWED_SPECIAL_ARGUMENTS:
            errors.append(
                f"{file_path}:{line_number}: expand shortened binding "
                f"'{binding_name}'"
            )

    documented_node_types = (
        ast.FunctionDef,
        ast.AsyncFunctionDef,
        ast.ClassDef,
    )
    for syntax_node in ast.walk(syntax_tree):
        if isinstance(syntax_node, documented_node_types) and not ast.get_docstring(
            syntax_node
        ):
            errors.append(
                f"{file_path}:{syntax_node.lineno}: add a purpose docstring to "
                f"'{syntax_node.name}'"
            )
    return errors


def main():
    """Validate every project Python file and return a command exit status."""
    errors = []
    for file_path in find_python_files():
        errors.extend(validate_file(file_path))
    if errors:
        print("\n".join(errors))
        return 1
    print("Python naming, line length and purpose comments passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
