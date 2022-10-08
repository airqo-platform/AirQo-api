resource "google_storage_bucket" "piratefast_lts_5b874f8e_310a_429e_a5ba_4031a0f4ff40" {
  force_destroy = false

  labels = {
    created-by = "danielogenrwot"
  }

  location                 = "US-CENTRAL1"
  name                     = "piratefast-lts-5b874f8e-310a-429e-a5ba-4031a0f4ff40"
  project                  = "${var.project-id}"
  storage_class            = "STANDARD"
}
# terraform import google_storage_bucket.piratefast_lts_5b874f8e_310a_429e_a5ba_4031a0f4ff40 piratefast-lts-5b874f8e-310a-429e-a5ba-4031a0f4ff40
