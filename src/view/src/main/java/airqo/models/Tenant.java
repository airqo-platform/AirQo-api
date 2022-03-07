package airqo.models;

public enum Tenant {
	AIRQO {
		@Override
		public String toString() {
			return "AIRQO";
		}
	},
	KCCA {
		@Override
		public String toString() {
			return "KCCA";
		}
	}
}
