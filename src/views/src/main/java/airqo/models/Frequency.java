package airqo.models;

public enum Frequency {
	RAW {
		@Override
		public String toString() {
			return "RAW";
		}
	},
	HOURLY {
		@Override
		public String toString() {
			return "HOURLY";
		}
	},
	DAILY {
		@Override
		public String toString() {
			return "DAILY";
		}
	}
}
