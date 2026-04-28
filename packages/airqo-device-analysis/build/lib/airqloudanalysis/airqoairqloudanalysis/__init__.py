import numpy as np
import datetime
import matplotlib.units as munits
import matplotlib.dates as mdates
from plotly.offline import init_notebook_mode
import cufflinks as cf

# Configure matplotlib for concise date formatting
try:
    converter = mdates.ConciseDateConverter()
    munits.registry[np.datetime64] = converter
    munits.registry[datetime.date] = converter
except Exception:
    pass

# Initialize plotly and cufflinks for offline use (Notebook support)
try:
    init_notebook_mode(connected=True)
    cf.go_offline()
except Exception:
    pass

# Export everything from sub-modules for backward compatibility
from .datainitialisation import *
from .devicespecifics import *
from .generalsummary import *
