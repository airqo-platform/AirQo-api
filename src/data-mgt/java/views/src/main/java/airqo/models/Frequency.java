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

//	Frequency fromString(String s) {
//		String value = s.trim().toLowerCase();
//		switch (value){
//			case "row":
//				return Frequency.ROW;
//			case "hourly":
//				return Frequency.HOURLY;
//			case "daily":
//				return Frequency.DAILY;
//			case "monthly":
//				return Frequency.MONTHLY;
//			default:
//				return null;
//		}
//	}

}
