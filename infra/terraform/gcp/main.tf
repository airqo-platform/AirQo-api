provider "google" {
  project = var.project-id
  region  = var.region
}

module "BigQueryDataset" {
  source = "./modules/BigQueryDataset"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeAddress1" {
  source = "./modules/ComputeAddress"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeAddress" {
  source = "./modules/ComputeAddress"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "StorageBucket" {
  source = "./modules/StorageBucket"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeDisk" {
  source = "./modules/ComputeDisk"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "IAMServiceAccount" {
  source = "./modules/IAMServiceAccount"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeBackendBucket" {
  source = "./modules/ComputeBackendBucket"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeFirewall" {
  source = "./modules/ComputeFirewall"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "SQLInstance" {
  source = "./modules/SQLInstance"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "SecretManagerSecret" {
  source = "./modules/SecretManagerSecret"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeRoute" {
  source = "./modules/ComputeRoute"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeInstanceTemplate" {
  source = "./modules/ComputeInstanceTemplate"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "PubSubSubscription" {
  source = "./modules/PubSubSubscription"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeInstance" {
  source = "./modules/ComputeInstance"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "BigQueryTable" {
  source = "./modules/BigQueryTable"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "PubSubTopic" {
  source = "./modules/PubSubTopic"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}

module "ComputeNetwork" {
  source = "./modules/ComputeNetwork"

  project-id     = var.project-id
  project-number = var.project-number
  location       = var.location
  region         = var.region
  zone           = var.zone
  os             = var.os
  disk_size      = var.disk_size
}