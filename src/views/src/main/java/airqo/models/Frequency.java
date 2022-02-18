package airqo.models;

public enum Frequency {
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
