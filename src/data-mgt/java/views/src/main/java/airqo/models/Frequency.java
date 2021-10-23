package airqo.models;

public enum Frequency {
	ROW {
		@Override
		public String toString() {
			return "row";
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
	},
	MONTHLY {
		@Override
		public String toString() {
			return "monthly";
		}
	}
}
