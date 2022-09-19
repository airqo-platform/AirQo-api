provider "google" {
  project = "airqo-250220"
}

## As of Sept/2022, the provider hashicorp/google does not support
## resource type "google_iam_custom_role"
# module "resources-IAMCustomRole" {
#  source = "./resources/IAMCustomRole"
# }


module "resources-ComputeURLMapl" {
  source = "./resources/ComputeURLMap"
}


module "resources-ComputeSubnetwork-australia-southeast1" {
  source = "./resources/ComputeSubnetwork/australia-southeast1"
}


module "resources-ComputeRouter" {
  source = "./resources/ComputeRouter"
}


module "resources-ComputeSubnetwork-asia-south1" {
  source = "./resources/ComputeSubnetwork/asia-south1"
}


module "resources-BigQueryDataset" {
  source = "./resources/BigQueryDataset"
}


module "resources-ComputeAddress1" {
  source = "./resources/ComputeAddress"
}


module "resources-ComputeAddress" {
  source = "./resources/ComputeAddress"
}


module "resources-ComputeSubnetwork-us-east5" {
  source = "./resources/ComputeSubnetwork/us-east5"
}


module "resources-ComputeSubnetwork-europe-west9" {
  source = "./resources/ComputeSubnetwork/europe-west9"
}


module "resources-StorageBucket" {
  source = "./resources/StorageBucket"
}


module "resources-ComputeForwardingRule" {
  source = "./resources/ComputeForwardingRule"
}


module "resources-ComputeSubnetwork-europe-west4" {
  source = "./resources/ComputeSubnetwork/europe-west4"
}


module "resources-ComputeDisk" {
  source = "./resources/ComputeDisk"
}


module "resources-IAMServiceAccount" {
  source = "./resources/IAMServiceAccount"
}


module "resources-KMSKeyRing" {
  source = "./resources/KMSKeyRing"
}


## As of Sept/2022, the provider hashicorp/google does not support resource type
## "google_logging_log_sink" on line 1 of the file a-required.tf
# module "resources-a-required" {
#  source = "./resources/a-required.tf"
# }


module "resources-ComputeSubnetwork-asia-southeast1" {
  source = "./resources/ComputeSubnetwork/asia-southeast1"
}


module "resources-ComputeSubnetwork-australia-southeast2" {
  source = "./resources/ComputeSubnetwork/australia-southeast2"
}


module "resources-ComputeBackendBucket" {
  source = "./resources/ComputeBackendBucket"
}


module "resources-ComputeSubnetwork-northamerica-northeast1" {
  source = "./resources/ComputeSubnetwork/northamerica-northeast1"
}


module "resources-ComputeSubnetwork-asia-northeast3" {
  source = "./resources/ComputeSubnetwork/asia-northeast3"
}


module "resources-ComputeSubnetwork-southamerica-east1" {
  source = "./resources/ComputeSubnetwork/southamerica-east1"
}


module "resources-ComputeSubnetwork-asia-northeast1" {
  source = "./resources/ComputeSubnetwork/asia-northeast1"
}


module "resources-ComputeSubnetwork-europe-west6" {
  source = "./resources/ComputeSubnetwork/europe-west6"
}


module "resources-ComputeFirewall" {
  source = "./resources/ComputeFirewall"
}


module "resources-ComputeSubnetwork-asia-southeast2" {
  source = "./resources/ComputeSubnetwork/asia-southeast2"
}


module "resources-702081712633-Service" {
  source = "./resources/Service"
}


module "resources-ComputeSubnetwork-us-west1" {
  source = "./resources/ComputeSubnetwork/us-west1"
}


module "resources-SQLInstance" {
  source = "./resources/SQLInstance"
}


module "resources-ComputeSubnetwork-us-south1" {
  source = "./resources/ComputeSubnetwork/us-south1"
}


module "resources-ComputeSubnetwork-us-east1" {
  source = "./resources/ComputeSubnetwork/us-east1"
}


module "resources-ComputeTargetPool" {
  source = "./resources/ComputeTargetPool"
}


module "resources-ComputeSubnetwork-europe-central2" {
  source = "./resources/ComputeSubnetwork/europe-central2"
}


module "resources-ComputeSubnetwork-us-west4" {
  source = "./resources/ComputeSubnetwork/us-west4"
}


module "resources-SecretManagerSecret" {
  source = "./resources/SecretManagerSecret"
}


module "resources-ComputeSubnetwork-us-west3" {
  source = "./resources/ComputeSubnetwork/us-west3"
}


module "resources-ComputeSubnetwork-europe-north1" {
  source = "./resources/ComputeSubnetwork/europe-north1"
}


module "resources-ComputeSubnetwork-europe-west3" {
  source = "./resources/ComputeSubnetwork/europe-west3"
}


module "resources-ComputeRoute" {
  source = "./resources/ComputeRoute"
}


module "resources-ComputeSubnetwork-europe-west2" {
  source = "./resources/ComputeSubnetwork/europe-west2"
}


module "resources-ComputeSubnetwork-us-central1" {
  source = "./resources/ComputeSubnetwork/us-central1"
}


module "resources-ComputeInstanceTemplate" {
  source = "./resources/ComputeInstanceTemplate"
}


module "resources-ComputeSubnetwork-us-east4" {
  source = "./resources/ComputeSubnetwork/us-east4"
}


module "resources-ComputeSubnetwork-southamerica-west1" {
  source = "./resources/ComputeSubnetwork/southamerica-west1"
}


module "resources-PubSubSubscription" {
  source = "./resources/PubSubSubscription"
}


module "resources-ComputeInstance" {
  source = "./resources/ComputeInstance"
}


module "resources-ComputeSubnetwork-europe-west1" {
  source = "./resources/ComputeSubnetwork/europe-west1"
}


module "resources-BigQueryTable" {
  source = "./resources/BigQueryTable"
}


module "resources-ComputeSubnetwork-asia-northeast2" {
  source = "./resources/ComputeSubnetwork/asia-northeast2"
}


module "resources-ComputeSubnetwork-europe-west8" {
  source = "./resources/ComputeSubnetwork/europe-west8"
}


module "resources-ComputeSubnetwork-asia-east1" {
  source = "./resources/ComputeSubnetwork/asia-east1"
}


module "resources-PubSubTopic" {
  source = "./resources/PubSubTopic"
}


module "resources-ComputeSnapshot" {
  source = "./resources/ComputeSnapshot"
}


module "resources-ComputeSubnetwork-northamerica-northeast2" {
  source = "./resources/ComputeSubnetwork/northamerica-northeast2"
}


module "resources-ComputeSubnetwork-asia-south2" {
  source = "./resources/ComputeSubnetwork/asia-south2"
}


module "resources-ComputeSubnetwork-us-west2" {
  source = "./resources/ComputeSubnetwork/us-west2"
}


module "resources-ComputeTargetHTTPProxy" {
  source = "./resources/ComputeTargetHTTPProxy"
}


module "resources-ComputeSubnetwork-asia-east2" {
  source = "./resources/ComputeSubnetwork/asia-east2"
}


module "resources-ComputeNetwork" {
  source = "./resources/ComputeNetwork"
}


module "resources-ComputeSubnetwork-europe-southwest1" {
  source = "./resources/ComputeSubnetwork/europe-southwest1"
}


module "resources-ComputeHTTPHealthCheck" {
  source = "./resources/ComputeHTTPHealthCheck"
}

