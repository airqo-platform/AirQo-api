terraform {
 backend "gcs" {
   bucket  = "airqo-250220-terraform-state"
   prefix  = "terraform/state"
 }
}
