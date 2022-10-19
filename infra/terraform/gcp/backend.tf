terraform {
  backend "gcs" {
    bucket = "airqo-terraform-state"
    prefix = "terraform/state"
  }
}
