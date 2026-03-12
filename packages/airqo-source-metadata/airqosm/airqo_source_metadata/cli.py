import argparse

from .client import DEFAULT_PLATFORM_BASE_URL
from .api import create_app


def main():
    parser = argparse.ArgumentParser(description="Run airqosm API server")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8010)
    parser.add_argument("--debug", action="store_true")
    parser.add_argument("--platform-base-url", default=DEFAULT_PLATFORM_BASE_URL)
    parser.add_argument("--platform-token", default=None)
    parser.add_argument("--platform-timeout", type=int, default=30)
    args = parser.parse_args()

    app = create_app(
        platform_base_url=args.platform_base_url,
        platform_token=args.platform_token,
        platform_timeout=args.platform_timeout,
    )
    app.run(host=args.host, port=args.port, debug=args.debug)


if __name__ == "__main__":
    main()
