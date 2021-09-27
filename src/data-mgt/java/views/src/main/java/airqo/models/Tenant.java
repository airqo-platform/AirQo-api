package airqo.models;

public enum Tenant {
	AIRQO {
		@Override
		public String toString() {
			return "airqo";
		}
	},
	KCCA {
		@Override
		public String toString() {
			return "kcca";
		}
	}
}
