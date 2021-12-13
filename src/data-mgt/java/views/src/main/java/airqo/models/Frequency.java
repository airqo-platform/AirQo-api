package airqo.models;

public enum Frequency {
	RAW {
		@Override
		public String toString() {
			return "raw";
		}
	},
	HOURLY {
		@Override
		public String toString() {
			return "hourly";
		}
	},
	DAILY {
		@Override
		public String toString() {
			return "daily";
		}
	}
}
