"""Start the local practice website and API with public configuration only.

Docker and local Supabase must already be running. The script creates one
fictional organiser and keeps its reusable credentials in the ignored
`.env.practice.json` file outside `web/`. It never contacts production.
"""

import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import uuid


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
WEBSITE_DIRECTORY = REPOSITORY_ROOT / "web"
PRACTICE_ACCOUNT_FILE = REPOSITORY_ROOT / ".env.practice.json"
WEBSITE_PORT = 8080
SUPABASE_COMMAND = ["npx", "--yes", "supabase@2.117.0"]
PROCESS_ENVIRONMENT = os.environ.copy()

DOCKER_DIRECTORY = Path("/Applications/Docker.app/Contents/Resources/bin")
if DOCKER_DIRECTORY.joinpath("docker").exists():
    PROCESS_ENVIRONMENT["PATH"] = (
        str(DOCKER_DIRECTORY) + ":" + PROCESS_ENVIRONMENT["PATH"]
    )


def send_json_request(request_address, method="GET", headers=None, payload=None):
    """Send a local JSON request and return its status and decoded response."""
    request_body = None
    request_headers = headers or {}
    if payload is not None:
        request_body = json.dumps(payload).encode()
        request_headers = {**request_headers, "Content-Type": "application/json"}
    try:
        request = Request(
            request_address,
            method=method,
            headers=request_headers,
            data=request_body,
        )
        with urlopen(request, timeout=15) as response:
            response_body = response.read()
            decoded_response = json.loads(response_body) if response_body else None
            return response.status, decoded_response
    except HTTPError as error:
        return error.code, None


def write_private_file(file_path, content):
    """Write a file with owner-only permissions, including on first creation."""
    file_descriptor = os.open(
        file_path,
        os.O_WRONLY | os.O_CREAT | os.O_TRUNC,
        0o600,
    )
    with os.fdopen(file_descriptor, "w") as output_stream:
        output_stream.write(content)
    file_path.chmod(0o600)


def load_local_supabase_configuration():
    """Read public and administrative values from the local Supabase stack."""
    command_result = subprocess.run(
        SUPABASE_COMMAND + ["status", "-o", "json"],
        cwd=REPOSITORY_ROOT,
        env=PROCESS_ENVIRONMENT,
        check=True,
        capture_output=True,
        text=True,
    )
    configuration = json.loads(command_result.stdout)
    api_address = configuration["API_URL"].rstrip("/")
    assert urlparse(api_address).hostname in (
        "127.0.0.1",
        "localhost",
    ), "Only local Supabase is allowed"
    return configuration, api_address


def load_or_create_practice_account(api_address, configuration):
    """Reuse a verified local organiser or create a new fictional account."""
    administrator_headers = {
        "apikey": configuration["ANON_KEY"],
        "Authorization": "Bearer " + configuration["SERVICE_ROLE_KEY"],
    }
    account = (
        json.loads(PRACTICE_ACCOUNT_FILE.read_text())
        if PRACTICE_ACCOUNT_FILE.exists()
        else None
    )
    if account:
        assert account["api_url"] == api_address, (
            "Saved practice account belongs to a different local instance"
        )
        response_status, user = send_json_request(
            api_address + "/auth/v1/admin/users/" + account["id"],
            headers=administrator_headers,
        )
        if response_status == 404:
            account = None
        else:
            assert response_status == 200 and user["email"] == account["email"], (
                "Cannot verify saved practice account"
            )
    if account:
        return account

    email_address = f"practice-organiser-{uuid.uuid4().hex[:8]}@example.test"
    password = secrets.token_urlsafe(18)
    response_status, user = send_json_request(
        api_address + "/auth/v1/admin/users",
        "POST",
        administrator_headers,
        {
            "email": email_address,
            "password": password,
            "email_confirm": True,
        },
    )
    assert response_status in (200, 201), "Cannot create local practice organiser"
    account = {
        "api_url": api_address,
        "id": user["id"],
        "email": email_address,
        "password": password,
    }
    write_private_file(
        PRACTICE_ACCOUNT_FILE,
        json.dumps(account, indent=2) + "\n",
    )
    return account


class PracticeRequestHandler(SimpleHTTPRequestHandler):
    """Serve only website files and the allow-listed public runtime settings."""

    def __init__(self, *arguments, **keyword_arguments):
        """Restrict static-file serving to the repository's website directory."""
        super().__init__(
            *arguments,
            directory=str(WEBSITE_DIRECTORY),
            **keyword_arguments,
        )

    def end_headers(self):
        """Prevent caching and content-type sniffing during local practice."""
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

    def do_GET(self):
        """Serve public settings, mark practice HTML, or serve a website asset."""
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
                    "</script>\n</head>",
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
        """Disable directory listings even within the public website directory."""
        self.send_error(404)
        return None


def raise_keyboard_interrupt(unused_signal_number, unused_stack_frame):
    """Convert termination into the same orderly shutdown as Ctrl+C."""
    raise KeyboardInterrupt


LOCAL_CONFIGURATION, LOCAL_API_ADDRESS = load_local_supabase_configuration()
PRACTICE_ACCOUNT = load_or_create_practice_account(
    LOCAL_API_ADDRESS,
    LOCAL_CONFIGURATION,
)

# This is the entire browser configuration allow-list. Privileged keys,
# credentials and database addresses are never served.
PUBLIC_BROWSER_CONFIGURATION = {
    "provider": "supabase",
    "environment": "practice",
    "url": LOCAL_API_ADDRESS,
    "publishableKey": LOCAL_CONFIGURATION.get(
        "PUBLISHABLE_KEY", LOCAL_CONFIGURATION["ANON_KEY"]
    ),
}

WEBSITE_SERVER = ThreadingHTTPServer(
    ("127.0.0.1", WEBSITE_PORT),
    PracticeRequestHandler,
)
FUNCTION_SETTINGS_FILE = REPOSITORY_ROOT / ".env.practice-functions"
write_private_file(
    FUNCTION_SETTINGS_FILE,
    (
        f'SPORTS_DAY_ORGANISER_IDS={PRACTICE_ACCOUNT["id"]}\n'
        f"SPORTS_DAY_ALLOWED_ORIGINS=http://127.0.0.1:{WEBSITE_PORT},"
        f"http://localhost:{WEBSITE_PORT}\n"
    ),
)
FUNCTION_LOG_FILE = REPOSITORY_ROOT / "supabase/.temp/practice-functions.log"
FUNCTION_LOG_FILE.parent.mkdir(exist_ok=True)
FUNCTION_PROCESS = None

try:
    with FUNCTION_LOG_FILE.open("w") as log_stream:
        FUNCTION_PROCESS = subprocess.Popen(
            SUPABASE_COMMAND
            + [
                "functions",
                "serve",
                "sports-day-api",
                "--env-file",
                str(FUNCTION_SETTINGS_FILE),
            ],
            cwd=REPOSITORY_ROOT,
            env=PROCESS_ENVIRONMENT,
            stdout=log_stream,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )
        for attempt_number in range(60):
            if FUNCTION_PROCESS.poll() is not None:
                raise RuntimeError(
                    "Practice API stopped. Check "
                    "supabase/.temp/practice-functions.log."
                )
            try:
                response_status, unused_response = send_json_request(
                    LOCAL_API_ADDRESS
                    + "/functions/v1/sports-day-api?action=getTeams"
                )
                if response_status == 401:
                    break
            except (URLError, TimeoutError):
                pass
            time.sleep(1)
        else:
            raise RuntimeError(
                "Practice API did not start. Check "
                "supabase/.temp/practice-functions.log."
            )

        print(
            f"Practice website ready: http://127.0.0.1:{WEBSITE_PORT}",
            flush=True,
        )
        print(
            "Practice organiser credentials are in .env.practice.json "
            "(private, ignored by Git).",
            flush=True,
        )
        print(
            "Press Ctrl+C to stop the practice website and function server.",
            flush=True,
        )
        signal.signal(signal.SIGTERM, raise_keyboard_interrupt)
        WEBSITE_SERVER.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    WEBSITE_SERVER.server_close()
    if FUNCTION_PROCESS and FUNCTION_PROCESS.poll() is None:
        os.killpg(FUNCTION_PROCESS.pid, signal.SIGTERM)
        try:
            FUNCTION_PROCESS.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(FUNCTION_PROCESS.pid, signal.SIGKILL)
            FUNCTION_PROCESS.wait()
