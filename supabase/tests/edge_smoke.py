"""Exercise the local Edge Function with short-lived authentication users.

The test requires the local Supabase stack, Docker and npm. It creates and
removes fictional users and one point profile, and never contacts a remote
project.
"""

import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import tempfile
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen
import uuid


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
SUPABASE_COMMAND = ["npx", "--yes", "supabase@2.117.0"]
PROCESS_ENVIRONMENT = os.environ.copy()
DOCKER_DIRECTORY = Path("/Applications/Docker.app/Contents/Resources/bin")
if DOCKER_DIRECTORY.joinpath("docker").exists():
    PROCESS_ENVIRONMENT["PATH"] = (
        str(DOCKER_DIRECTORY) + ":" + PROCESS_ENVIRONMENT["PATH"]
    )


def send_json_request(request_address, method="GET", headers=None, payload=None):
    """Send an HTTP request and decode successful and error JSON responses."""
    request_body = payload
    request_headers = headers or {}
    if payload is not None and not isinstance(payload, bytes):
        request_body = json.dumps(payload).encode()
        request_headers = {**request_headers, "Content-Type": "application/json"}
    request = Request(
        request_address,
        method=method,
        headers=request_headers,
        data=request_body,
    )
    try:
        with urlopen(request, timeout=15) as response:
            response_body = response.read()
            decoded_response = json.loads(response_body) if response_body else None
            return response.status, decoded_response
    except HTTPError as error:
        response_body = error.read()
        try:
            decoded_response = json.loads(response_body)
        except ValueError:
            decoded_response = {"message": "Non-JSON error response"}
        return error.code, decoded_response


command_result = subprocess.run(
    SUPABASE_COMMAND + ["status", "-o", "json"],
    cwd=REPOSITORY_ROOT,
    env=PROCESS_ENVIRONMENT,
    check=True,
    capture_output=True,
    text=True,
)
LOCAL_CONFIGURATION = json.loads(command_result.stdout)
LOCAL_API_ADDRESS = LOCAL_CONFIGURATION["API_URL"]
assert urlparse(LOCAL_API_ADDRESS).hostname in (
    "localhost",
    "127.0.0.1",
), "Tests require the local API"
ADMINISTRATOR_HEADERS = {
    "apikey": LOCAL_CONFIGURATION["ANON_KEY"],
    "Authorization": "Bearer " + LOCAL_CONFIGURATION["SERVICE_ROLE_KEY"],
}
TEST_USER_IDENTIFIERS = []
FUNCTION_PROCESS = None
TEST_PROFILE_IDENTIFIER = "TEST_HTTP_" + uuid.uuid4().hex

try:
    access_tokens = []
    for account_role in ("organiser", "nonorganiser"):
        email_address = (
            f"sportsday-{account_role}-{uuid.uuid4().hex}@example.test"
        )
        password = secrets.token_urlsafe(32)
        response_status, user = send_json_request(
            LOCAL_API_ADDRESS + "/auth/v1/admin/users",
            "POST",
            ADMINISTRATOR_HEADERS,
            {
                "email": email_address,
                "password": password,
                "email_confirm": True,
            },
        )
        assert response_status in (200, 201), (
            f"Local test-user creation failed: HTTP {response_status}"
        )
        TEST_USER_IDENTIFIERS.append(user["id"])
        response_status, session = send_json_request(
            LOCAL_API_ADDRESS + "/auth/v1/token?grant_type=password",
            "POST",
            {"apikey": LOCAL_CONFIGURATION["ANON_KEY"]},
            {"email": email_address, "password": password},
        )
        assert response_status == 200, (
            f"Local test sign-in failed: HTTP {response_status}"
        )
        access_tokens.append(session["access_token"])

    with tempfile.TemporaryDirectory(prefix="sportsday-edge-") as temporary_directory:
        temporary_path = Path(temporary_directory)
        function_settings_file = temporary_path / ".env.local"
        function_settings_file.write_text(
            f"SPORTS_DAY_ORGANISER_IDS={TEST_USER_IDENTIFIERS[0]}\n"
            "SPORTS_DAY_ALLOWED_ORIGINS=http://localhost:8080\n"
        )
        function_settings_file.chmod(0o600)
        with temporary_path.joinpath("serve.log").open("w") as log_stream:
            FUNCTION_PROCESS = subprocess.Popen(
                SUPABASE_COMMAND
                + [
                    "functions",
                    "serve",
                    "sports-day-api",
                    "--env-file",
                    str(function_settings_file),
                ],
                cwd=REPOSITORY_ROOT,
                env=PROCESS_ENVIRONMENT,
                stdout=log_stream,
                stderr=subprocess.STDOUT,
                start_new_session=True,
            )
            function_endpoint = (
                LOCAL_API_ADDRESS + "/functions/v1/sports-day-api"
            )
            function_ready = False
            for attempt_number in range(60):
                if FUNCTION_PROCESS.poll() is not None:
                    raise RuntimeError(
                        "Local Edge Function server stopped unexpectedly"
                    )
                try:
                    response_status, response_body = send_json_request(
                        function_endpoint + "?action=getTeams"
                    )
                    if (
                        response_status == 401
                        and response_body.get("message") == "Please sign in."
                    ):
                        function_ready = True
                        break
                except (URLError, TimeoutError):
                    pass
                time.sleep(1)
            assert function_ready, (
                "Local Edge Function did not become ready within 60 attempts"
            )

            organiser_headers = {
                "apikey": LOCAL_CONFIGURATION["ANON_KEY"],
                "Authorization": "Bearer " + access_tokens[0],
                "Origin": "http://localhost:8080",
            }
            response_status, response_body = send_json_request(
                function_endpoint + "?action=getTeams",
                headers=organiser_headers,
            )
            assert response_status == 200 and response_body["success"], (
                f"Organiser read failed: HTTP {response_status}, {response_body}"
            )
            assert len(response_body["data"]) == 4

            for invalid_token in (
                LOCAL_CONFIGURATION["ANON_KEY"],
                "invalid-token",
            ):
                response_status, unused_response = send_json_request(
                    function_endpoint + "?action=getTeams",
                    headers={
                        **organiser_headers,
                        "Authorization": "Bearer " + invalid_token,
                    },
                )
                assert response_status == 401

            response_status, unused_response = send_json_request(
                function_endpoint + "?action=getTeams",
                headers={
                    **organiser_headers,
                    "Authorization": "Bearer " + access_tokens[1],
                },
            )
            assert response_status == 403
            response_status, unused_response = send_json_request(
                function_endpoint + "?action=getTeams",
                headers={
                    **organiser_headers,
                    "Origin": "https://untrusted.example",
                },
            )
            assert response_status == 403

            test_profile = {
                "ID": TEST_PROFILE_IDENTIFIER,
                "Name": "HTTP Test",
                "First": 8,
                "Second": 4,
                "Third": 0,
                "Fourth": -2,
            }
            response_status, response_body = send_json_request(
                function_endpoint,
                "POST",
                organiser_headers,
                {"action": "createPointProfile", "payload": test_profile},
            )
            assert response_status == 200 and response_body["success"], response_body
            assert response_body["data"] == test_profile

            test_profile["First"] = 12
            encoded_form = urlencode(
                {
                    "action": "updatePointProfile",
                    "payload": json.dumps(test_profile),
                }
            ).encode()
            response_status, response_body = send_json_request(
                function_endpoint,
                "POST",
                {
                    **organiser_headers,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                encoded_form,
            )
            assert (
                response_status == 200
                and response_body["success"]
                and response_body["data"] == test_profile
            ), response_body

            response_status, response_body = send_json_request(
                function_endpoint,
                "POST",
                organiser_headers,
                {
                    "action": "getPointProfile",
                    "payload": {"ID": TEST_PROFILE_IDENTIFIER},
                },
            )
            assert response_status == 200
            assert response_body["data"] == test_profile

            read_requests = (
                ("getLeaderboard", {}),
                ("getEventHistory", {"eventId": "EV_ROUND_ROBIN"}),
            )
            for action, payload in read_requests:
                response_status, response_body = send_json_request(
                    function_endpoint,
                    "POST",
                    organiser_headers,
                    {"action": action, "payload": payload},
                )
                assert response_status == 200 and response_body["success"], (
                    response_body
                )
            print(
                "Real Edge Function: organiser reads/writes, JSON/form requests, "
                "leaderboard and history passed."
            )
            print(
                "Missing/invalid/anonymous tokens, non-organiser users and "
                "untrusted origins were rejected."
            )
finally:
    if FUNCTION_PROCESS and FUNCTION_PROCESS.poll() is None:
        os.killpg(FUNCTION_PROCESS.pid, signal.SIGTERM)
        try:
            FUNCTION_PROCESS.wait(timeout=10)
        except subprocess.TimeoutExpired:
            os.killpg(FUNCTION_PROCESS.pid, signal.SIGKILL)
            FUNCTION_PROCESS.wait()

    # This value contains only a fixed prefix and generated hexadecimal text.
    subprocess.run(
        [
            "docker",
            "exec",
            "-i",
            "supabase_db_SportsDayManager",
            "psql",
            "-U",
            "postgres",
            "-d",
            "postgres",
            "-v",
            "ON_ERROR_STOP=1",
        ],
        input=(
            "delete from public.point_profiles where id = "
            f"'{TEST_PROFILE_IDENTIFIER}';\n"
        ),
        text=True,
        check=True,
        env=PROCESS_ENVIRONMENT,
        stdout=subprocess.DEVNULL,
    )
    for user_identifier in TEST_USER_IDENTIFIERS:
        response_status, unused_response = send_json_request(
            LOCAL_API_ADDRESS + "/auth/v1/admin/users/" + user_identifier,
            "DELETE",
            ADMINISTRATOR_HEADERS,
        )
        assert response_status in (200, 204), (
            "Failed to remove a local test user"
        )
    print(
        "Removed temporary test users and profile; stopped the test function server."
    )
