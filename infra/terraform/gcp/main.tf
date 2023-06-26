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

module "ComputeInstance" {
  source = "./modules/ComputeInstance"

  project_id     = var.project_id
  project_number = var.project_number
  region         = var.region
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

module "ComputeNetworkPeering" {
  source = "./modules/ComputeNetworkPeering"
  
  project_id     = var.project_id
}

module "ComputeResourcePolicy" {
  source = "./modules/ComputeResourcePolicy"

  project_id     = var.project_id
  region         = var.region
}
