provider "google" {
  project = var.project-id
}

## As of Sept/2022, the provider hashicorp/google does not support
## resource type "google_iam_custom_role"
# module "IAMCustomRole" {
#  source = "./modules/IAMCustomRole"
# }


# module "ComputeURLMapl" {
#  source = "./modules/ComputeURLMap"
# }


# module "ComputeSubnetwork-australia-southeast1" {
#  source = "./modules/ComputeSubnetwork/australia-southeast1"
# }


# module "ComputeRouter" {
#  source = "./modules/ComputeRouter"
# }


# module "ComputeSubnetwork-asia-south1" {
#  source = "./modules/ComputeSubnetwork/asia-south1"
# }


# module "BigQueryDataset" {
#  source = "./modules/BigQueryDataset"
# }


# module "ComputeAddress1" {
#  source = "./modules/ComputeAddress"
# }


# module "ComputeAddress" {
#  source = "./modules/ComputeAddress"
# }


# module "ComputeSubnetwork-us-east5" {
#  source = "./modules/ComputeSubnetwork/us-east5"
# }


# module "ComputeSubnetwork-europe-west9" {
#  source = "./modules/ComputeSubnetwork/europe-west9"
# }


module "StorageBucket" {
  source = "./modules/StorageBucket"
}


# module "ComputeForwardingRule" {
#  source = "./modules/ComputeForwardingRule"
# }


# module "ComputeSubnetwork-europe-west4" {
#  source = "./modules/ComputeSubnetwork/europe-west4"
# }


# module "ComputeDisk" {
#  source = "./modules/ComputeDisk"
# }


# module "IAMServiceAccount" {
#  source = "./modules/IAMServiceAccount"
# }


# module "KMSKeyRing" {
#  source = "./modules/KMSKeyRing"
# }


## As of Sept/2022, the provider hashicorp/google does not support resource type
## "google_logging_log_sink" on line 1 of the file a-required.tf
# module "a-required" {
#  source = "./modules/a-required.tf"
# }


# module "ComputeSubnetwork-asia-southeast1" {
#  source = "./modules/ComputeSubnetwork/asia-southeast1"
# }


# module "ComputeSubnetwork-australia-southeast2" {
#  source = "./modules/ComputeSubnetwork/australia-southeast2"
# }


# module "ComputeBackendBucket" {
#  source = "./modules/ComputeBackendBucket"
# }


# module "ComputeSubnetwork-northamerica-northeast1" {
#  source = "./modules/ComputeSubnetwork/northamerica-northeast1"
# }


# module "ComputeSubnetwork-asia-northeast3" {
#  source = "./modules/ComputeSubnetwork/asia-northeast3"
# }


# module "ComputeSubnetwork-southamerica-east1" {
#  source = "./modules/ComputeSubnetwork/southamerica-east1"
# }


# module "ComputeSubnetwork-asia-northeast1" {
#  source = "./modules/ComputeSubnetwork/asia-northeast1"
# }


# module "ComputeSubnetwork-europe-west6" {
#  source = "./modules/ComputeSubnetwork/europe-west6"
# }


# module "ComputeFirewall" {
#  source = "./modules/ComputeFirewall"
# }


# module "ComputeSubnetwork-asia-southeast2" {
#  source = "./modules/ComputeSubnetwork/asia-southeast2"
# }


# module "702081712633-Service" {
#  source = "./modules/Service"
# }


# module "ComputeSubnetwork-us-west1" {
#  source = "./modules/ComputeSubnetwork/us-west1"
# }


# module "SQLInstance" {
#  source = "./modules/SQLInstance"
# }


# module "ComputeSubnetwork-us-south1" {
#  source = "./modules/ComputeSubnetwork/us-south1"
# }


# module "ComputeSubnetwork-us-east1" {
#  source = "./modules/ComputeSubnetwork/us-east1"
# }


# module "ComputeTargetPool" {
#  source = "./modules/ComputeTargetPool"
# }


# module "ComputeSubnetwork-europe-central2" {
#  source = "./modules/ComputeSubnetwork/europe-central2"
# }


# module "ComputeSubnetwork-us-west4" {
#  source = "./modules/ComputeSubnetwork/us-west4"
# }


module "SecretManagerSecret" {
  source = "./modules/SecretManagerSecret"
}


# module "ComputeSubnetwork-us-west3" {
#  source = "./modules/ComputeSubnetwork/us-west3"
# }


# module "ComputeSubnetwork-europe-north1" {
#  source = "./modules/ComputeSubnetwork/europe-north1"
# }


# module "ComputeSubnetwork-europe-west3" {
#  source = "./modules/ComputeSubnetwork/europe-west3"
# }


# module "ComputeRoute" {
#  source = "./modules/ComputeRoute"
# }


# module "ComputeSubnetwork-europe-west2" {
#  source = "./modules/ComputeSubnetwork/europe-west2"
# }


# module "ComputeSubnetwork-us-central1" {
#  source = "./modules/ComputeSubnetwork/us-central1"
# }


# module "ComputeInstanceTemplate" {
#  source = "./modules/ComputeInstanceTemplate"
# }


# module "ComputeSubnetwork-us-east4" {
#  source = "./modules/ComputeSubnetwork/us-east4"
# }


# module "ComputeSubnetwork-southamerica-west1" {
#  source = "./modules/ComputeSubnetwork/southamerica-west1"
# }


# module "PubSubSubscription" {
#  source = "./modules/PubSubSubscription"
# }


# module "ComputeInstance" {
#  source = "./modules/ComputeInstance"
# }


# module "ComputeSubnetwork-europe-west1" {
#  source = "./modules/ComputeSubnetwork/europe-west1"
# }


# module "BigQueryTable" {
#  source = "./modules/BigQueryTable"
# }


# module "ComputeSubnetwork-asia-northeast2" {
#  source = "./modules/ComputeSubnetwork/asia-northeast2"
# }


# module "ComputeSubnetwork-europe-west8" {
#  source = "./modules/ComputeSubnetwork/europe-west8"
# }


# module "ComputeSubnetwork-asia-east1" {
#  source = "./modules/ComputeSubnetwork/asia-east1"
# }


# module "PubSubTopic" {
#  source = "./modules/PubSubTopic"
# }


# module "ComputeSnapshot" {
#  source = "./modules/ComputeSnapshot"
# }


# module "ComputeSubnetwork-northamerica-northeast2" {
#  source = "./modules/ComputeSubnetwork/northamerica-northeast2"
# }


# module "ComputeSubnetwork-asia-south2" {
#  source = "./modules/ComputeSubnetwork/asia-south2"
# }


# module "ComputeSubnetwork-us-west2" {
#  source = "./modules/ComputeSubnetwork/us-west2"
# }


# module "ComputeTargetHTTPProxy" {
#  source = "./modules/ComputeTargetHTTPProxy"
# }


# module "ComputeSubnetwork-asia-east2" {
#  source = "./modules/ComputeSubnetwork/asia-east2"
# }


# module "ComputeNetwork" {
#  source = "./modules/ComputeNetwork"
# }


# module "ComputeSubnetwork-europe-southwest1" {
#  source = "./modules/ComputeSubnetwork/europe-southwest1"
# }


# module "ComputeHTTPHealthCheck" {
#  source = "./modules/ComputeHTTPHealthCheck"
# }

