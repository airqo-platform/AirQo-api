resource "google_compute_disk" "temp_calibrate_service" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-2004-focal-v20220419"
  name                      = "temp-calibrate-service"
  physical_block_size_bytes = 4096
  project                   = "${var.project-id}"
  size                      = 10
  type                      = "pd-balanced"
  zone                      = "europe-west1-b"
}
# terraform import google_compute_disk.temp_calibrate_service projects/airqo-250220/zones/europe-west1-b/disks/temp-calibrate-service
