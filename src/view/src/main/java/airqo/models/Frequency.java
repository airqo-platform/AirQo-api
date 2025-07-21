package airqo.models;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum Frequency {
	@JsonProperty("hourly")
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
	@JsonProperty("daily")
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
