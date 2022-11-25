package airqo.models;

public enum Frequency {
	HOURLY {
		@Override
		public String toString() {
			return "HOURLY";
		}

		@Override
		public String dateTimeFormat() {
			return "yyyy-MM-dd'T'HH:00:00'Z'";
		}
	},
	DAILY {
		@Override
		public String toString() {
			return "DAILY";
		}

		@Override
		public String dateTimeFormat() {
			return "yyyy-MM-dd'T'00:00:00'Z'";
		}
	};

	public String dateTimeFormat() {
		return "yyyy-MM-dd'T'HH:mm:ss'Z'";
	}
}
