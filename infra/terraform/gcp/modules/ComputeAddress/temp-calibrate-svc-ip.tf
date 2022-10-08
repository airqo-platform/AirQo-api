resource "google_compute_address" "temp_calibrate_svc_ip" {
  address      = "104.155.76.226"
  address_type = "EXTERNAL"
  name         = "temp-calibrate-svc-ip"
  network_tier = "PREMIUM"
  project      = "${var.project-id}"
  region       = "europe-west1"
}
# terraform import google_compute_address.temp_calibrate_svc_ip projects/airqo-250220/regions/europe-west1/addresses/temp-calibrate-svc-ip
