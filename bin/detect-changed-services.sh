#!/bin/bash -e

detect_changed_services() {
  echo "----------------------------------------------"
  echo "detecting changed folders for this commit"

  # get a list of all the changed folders only
  changed_folders=`git diff --name-only $SHIPPABLE_COMMIT_RANGE | grep / | awk 'BEGIN {FS="/"} {print $1}' | uniq`
  echo "changed folders "$changed_folders

  changed_services=()
  for folder in $changed_folders
  do
    if [ "$folder" == '_global' ]; then
      echo "common folder changed, building and publishing all microservices"
      changed_services=`find . -maxdepth 1 -type d -not -name '_global' -not -name 'shippable' -not -name '.git' -not -path '.' | sed 's|./||'`
      echo "list of microservice "$changed_services
      break
    else
      echo "Adding $folder to list of services to build"
      changed_services+=("$folder")
    fi
  done

  # Iterate on each service and run the packaging script
  for service in $changed_services
  do
      echo "-------------------Running packaging for $service---------------------"
      # copy the common code to the service so that it can be packaged in the docker image
      cp -r ./_global $service
      pushd "$service"
      # move the build script to the root of the service
      mv ./_global/package-service.sh ./.
      ./package-service.sh "$service"
      popd
  done
}

detect_changed_services