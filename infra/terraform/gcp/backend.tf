terraform {
 backend "gcs" {
   bucket  = "${var.project-id}-terraform-state"
   prefix  = "terraform/state"
 }
}
