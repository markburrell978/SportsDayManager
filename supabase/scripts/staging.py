"""Serve the website locally against an isolated hosted Supabase project.

The ignored `.env.staging.json` file contains public browser settings only.
The organiser enters their password in the website; this script never reads or
stores it. The published GitHub Pages configuration remains unchanged.
"""

import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
WEBSITE_DIRECTORY = REPOSITORY_ROOT / "web"
STAGING_SETTINGS_FILE = REPOSITORY_ROOT / ".env.staging.json"
WEBSITE_PORT = 8080


def load_public_browser_configuration():
    """Validate and return the ignored hosted-staging browser settings."""
    settings = json.loads(STAGING_SETTINGS_FILE.read_text())
    project_address = settings.get("projectUrl")
    publishable_key = settings.get("publishableKey")
    parsed_address = urlparse(project_address or "")
    if (
        parsed_address.scheme != "https"
        or not parsed_address.hostname
        or not parsed_address.hostname.endswith(".supabase.co")
        or parsed_address.path not in ("", "/")
        or parsed_address.params
        or parsed_address.query
        or parsed_address.fragment
        or not isinstance(publishable_key, str)
        or not publishable_key.startswith("sb_publishable_")
    ):
        raise RuntimeError("Staging browser settings are invalid.")
    return {
        "provider": "supabase",
        "environment": "staging",
        "url": project_address.rstrip("/"),
        "publishableKey": publishable_key,
    }


PUBLIC_BROWSER_CONFIGURATION = load_public_browser_configuration()


class StagingRequestHandler(SimpleHTTPRequestHandler):
    """Serve only public website assets with hosted staging configuration."""

    def __init__(self, *positional_arguments, **keyword_arguments):
        """Serve files from the repository's public website directory."""
        super().__init__(
            *positional_arguments,
            directory=str(WEBSITE_DIRECTORY),
            **keyword_arguments,
        )

    def end_headers(self):
        """Prevent caching and content-type sniffing during staging tests."""
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_GET(self):
        """Serve runtime settings, mark test HTML, or serve a website asset."""
        allowed_hosts = (
            f"127.0.0.1:{WEBSITE_PORT}",
            f"localhost:{WEBSITE_PORT}",
        )
        if self.headers.get("Host") not in allowed_hosts:
            self.send_error(403)
            return

        request_path = urlparse(self.path).path
        if request_path == "/js/runtime-config.js":
            response_body = (
                "window.SPORTS_DAY_RUNTIME = Object.freeze("
                + json.dumps(PUBLIC_BROWSER_CONFIGURATION)
                + ");\n"
            ).encode()
            content_type = "application/javascript"
        elif request_path in ("/", "/index.html"):
            response_body = (
                WEBSITE_DIRECTORY.joinpath("index.html")
                .read_text()
                .replace(
                    "</head>",
                    "<script>window.SPORTS_DAY_TEST_ENVIRONMENT = true;"
                    "</script>\n"
                    "</head>",
                )
                .encode()
            )
            content_type = "text/html; charset=utf-8"
        else:
            return super().do_GET()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(response_body)))
        self.end_headers()
        self.wfile.write(response_body)

    def list_directory(self, directory_path):
        """Disable directory listings within the public website directory."""
        self.send_error(404)
        return None


def main():
    """Run the local staging website until interrupted."""
    website_server = ThreadingHTTPServer(
        ("127.0.0.1", WEBSITE_PORT),
        StagingRequestHandler,
    )
    print("Hosted Supabase staging website is ready.")
    print(f"Open http://127.0.0.1:{WEBSITE_PORT}")
    print("Use the organiser account created in Supabase Authentication.")
    print("Press Ctrl+C to stop the staging website.")
    try:
        website_server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping staging website.")
    finally:
        website_server.server_close()


if __name__ == "__main__":
    main()
