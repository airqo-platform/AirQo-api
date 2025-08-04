#!/bin/bash
set -ex

echo "🖥️  Starting Superset server on 0.0.0.0:8088..."
# superset run -h 0.0.0.0 -p 8088
gunicorn -w 4 -k gevent -b 0.0.0.0:8088 "superset.app:create_app()"
