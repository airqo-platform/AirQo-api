provider "google" {
  credentials = file("${path.module}/../assets/airqo-terraform.json")
  project     = var.project-name
  region      = var.region
}
