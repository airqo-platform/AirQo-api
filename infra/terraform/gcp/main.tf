provider "google" {
  project = var.project_id
  region  = var.region
}

module "ComputeDisk" {
  source = "./modules/ComputeDisk"

  project_id = var.project_id
  zone       = var.zone
  os         = var.os
  disk_size  = var.disk_size
}

module "ComputeFirewall" {
  source = "./modules/ComputeFirewall"

  project_id = var.project_id
}

module "ComputeInstance" {
  source = "./modules/ComputeInstance"

  project_id     = var.project_id
  project_number = var.project_number
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeInstanceTemplate" {
  source = "./modules/ComputeInstanceTemplate"

  project_id     = var.project_id
  project_number = var.project_number
  region         = var.region
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeNetwork" {
  source = "./modules/ComputeNetwork"

  project_id = var.project_id
}

module "ComputeSubnetwork" {
  source = "./modules/ComputeSubnetwork"

  project_id = var.project_id
  region     = var.region
}
