resource "google_storage_bucket" "dataprep_staging_0f89fc0a_bc59_4801_b555_ac817ced8b7f" {
  force_destroy            = false
  location                 = "US"
  name                     = "dataprep-staging-0f89fc0a-bc59-4801-b555-ac817ced8b7f"
  project                  = "${var.project-id}"
  storage_class            = "MULTI_REGIONAL"
}
# terraform import google_storage_bucket.dataprep_staging_0f89fc0a_bc59_4801_b555_ac817ced8b7f dataprep-staging-0f89fc0a-bc59-4801-b555-ac817ced8b7f
