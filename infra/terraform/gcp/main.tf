provider "google" {
  project = var.project-id
}

module "BigQueryDataset" {
  source = "./modules/BigQueryDataset"

  project-id = var.project-id
}


module "ComputeURLMapl" {
  source = "./modules/ComputeURLMap"
}


module "ComputeRouter" {
  source = "./modules/ComputeRouter"
}


module "ComputeAddress1" {
  source = "./modules/ComputeAddress"
}


module "ComputeAddress" {
  source = "./modules/ComputeAddress"
}


module "StorageBucket" {
  source = "./modules/StorageBucket"
}


module "ComputeForwardingRule" {
  source = "./modules/ComputeForwardingRule"
}


module "ComputeDisk" {
  source = "./modules/ComputeDisk"
}


module "IAMServiceAccount" {
  source = "./modules/IAMServiceAccount"
}


module "KMSKeyRing" {
  source = "./modules/KMSKeyRing"
}


module "ComputeBackendBucket" {
  source = "./modules/ComputeBackendBucket"
}

module "ComputeFirewall" {
  source = "./modules/ComputeFirewall"
}

module "Service" {
  source = "./modules/Service"
}


module "SQLInstance" {
  source = "./modules/SQLInstance"
}



module "ComputeTargetPool" {
  source = "./modules/ComputeTargetPool"
}


module "SecretManagerSecret" {
  source = "./modules/SecretManagerSecret"
}


module "ComputeRoute" {
  source = "./modules/ComputeRoute"
}


module "ComputeInstanceTemplate" {
  source = "./modules/ComputeInstanceTemplate"
}


module "PubSubSubscription" {
  source = "./modules/PubSubSubscription"
}


module "ComputeInstance" {
  source = "./modules/ComputeInstance"
}

module "BigQueryTable" {
  source = "./modules/BigQueryTable"
}


module "PubSubTopic" {
  source = "./modules/PubSubTopic"
}


module "ComputeSnapshot" {
  source = "./modules/ComputeSnapshot"
}


module "ComputeTargetHTTPProxy" {
  source = "./modules/ComputeTargetHTTPProxy"
}


module "ComputeNetwork" {
  source = "./modules/ComputeNetwork"
}


module "ComputeHTTPHealthCheck" {
  source = "./modules/ComputeHTTPHealthCheck"
}


## As of Sept/2022, the provider hashicorp/google does not support
##resource type "google_iam_custom_role"
# module "IAMCustomRole" {
#  source = "./modules/IAMCustomRole"
# }


## As of Sept/2022, the provider hashicorp/google does not support resource type
## "google_logging_log_sink" on line 1 of the file a-required.tf
# module "a-required" {
#  source = "./modules/a-required.tf"
# }
