from api.app import create_app
from api.config import DevelopmentConfig, ProductionConfig


application = create_app(config_object=ProductionConfig)

try:
  import googleclouddebugger
  googleclouddebugger.enable()
except ImportError:
  pass

if __name__ == '__main__':
    application.run(debug=True)
