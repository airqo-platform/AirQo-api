resource "google_compute_disk" "paul_analysis_pd" {
  description               = "Persistent disk for a Google Cloud Datalab instance"
  name                      = "paul-analysis-pd"
  physical_block_size_bytes = 4096
  project                   = "${var.project-id}"
  size                      = 200
  type                      = "pd-standard"
  zone                      = "us-east1-b"
}
# terraform import google_compute_disk.paul_analysis_pd projects/airqo-250220/zones/us-east1-b/disks/paul-analysis-pd
