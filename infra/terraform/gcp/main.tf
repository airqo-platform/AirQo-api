provider "google" {
  project = var.project-id
  region  = var.region
}

module "ComputeDisk" {
  source = "./modules/ComputeDisk"

  project-id = var.project-id
  zone      = var.zone
  os        = var.os
  disk_size = var.disk_size
}

module "ComputeInstance" {
  source = "./modules/ComputeInstance"

  project-id     = var.project-id
  project-number = var.project-number
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeInstanceTemplate" {
  source = "./modules/ComputeInstanceTemplate"

  project-id     = var.project-id
  project-number = var.project-number
  os             = var.os
  disk_size      = var.disk_size
}

module "SecretManagerSecret" {
  source = "./modules/SecretManagerSecret"

  project-id     = var.project-id
  project-number = var.project-number
}
