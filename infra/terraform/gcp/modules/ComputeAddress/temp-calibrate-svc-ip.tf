resource "google_compute_address" "temp_calibrate_svc_ip" {
  address_type = "EXTERNAL"
  name         = "temp-calibrate-svc-ip"
  network_tier = "PREMIUM"
  project      = var.project-id
  region       = "${var.region}"
}
# terraform import google_compute_address.temp_calibrate_svc_ip projects/${var.project-id}/regions/europe-west1/addresses/temp-calibrate-svc-ip
