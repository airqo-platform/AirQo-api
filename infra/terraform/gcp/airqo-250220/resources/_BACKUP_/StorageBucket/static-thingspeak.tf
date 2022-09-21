resource "google_storage_bucket" "static_thingspeak" {
  force_destroy            = false
  location                 = "US"
  name                     = "static-thingspeak"
  project                  = "airqo-250220"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.static_thingspeak static-thingspeak
