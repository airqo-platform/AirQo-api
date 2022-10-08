resource "google_storage_bucket" "dataproc_temp_us_central1_702081712633_f7po0k4p" {
  force_destroy = false

  lifecycle_rule {
    action {
      type = "Delete"
    }

    condition {
      age        = 90
      with_state = "ANY"
    }
  }

  location                 = "US-CENTRAL1"
  name                     = "dataproc-temp-us-central1-702081712633-f7po0k4p"
  project                  = "${var.project-id}"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.dataproc_temp_us_central1_702081712633_f7po0k4p dataproc-temp-us-central1-702081712633-f7po0k4p
