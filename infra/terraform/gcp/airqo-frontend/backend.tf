terraform {
 backend "gcs" {
   bucket  = "airqo-frontend-terraform-state"
   prefix  = "terraform/state"
 }
}
