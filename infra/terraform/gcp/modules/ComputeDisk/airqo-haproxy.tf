resource "google_compute_disk" "airqo_haproxy" {
  image                     = "https://www.googleapis.com/compute/beta/projects/ubuntu-os-cloud/global/images/ubuntu-1604-xenial-v20200807"
  name                      = "airqo-haproxy"
  physical_block_size_bytes = 4096
  project                   = "${var.project-id}"
  size                      = 10
  type                      = "pd-standard"
  zone                      = "europe-west1-b"
}
# terraform import google_compute_disk.airqo_haproxy projects/airqo-250220/zones/europe-west1-b/disks/airqo-haproxy
