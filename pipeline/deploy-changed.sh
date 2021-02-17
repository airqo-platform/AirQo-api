#!/bin/bash

# main script entrypoint 
function main {
    # get previous and current commit heads
    # jenkins offers this as environment variables within Jenkins GIT Plugin
    GIT_PREVIOUS_COMMIT=$(git rev-parse --short "HEAD^")
    GIT_COMMIT=$(git rev-parse --short HEAD)
    
    get_branch_name
    echo "$branch"
    get_changed_microservices
    echo "$changed_microservices"

    # trigger_build
}
function get_branch_name {
    branch_name=$(git symbolic-ref -q HEAD)
    branch_name=${branch_name##refs/heads/}
    branch_name=${branch_name:-HEAD}
    export branch=$branch_name
}

function get_changed_microservices {
    folders=`git diff --name-only $GIT_PREVIOUS_COMMIT $GIT_COMMIT | sort -u | awk 'BEGIN {FS="/"} {print $1}' | uniq`
    export changed_microservices=$folders
}

# function trigger_build {
    # STAGING="get-changed-microservices"
    # if ["$branch" -eq $STAGING]; then
    #     echo "deployment activities..."
    #     for microservice in ${changed_microservices}; do
    #         case "$microservice" in
    #             #case 1
    #             "auth-service") echo "deployment activities for auth service..." ;;
    #             #case 2
    #             "device-registry") echo "deployment activities for device registry service..." ;;
    #             #case 3
    #             "data-mgt") echo "deployment activities for data management service..." ;;
    #             #case 4
    #             "device-monitory") echo "deployment activities for device registry service..." ;;
    #             #case 5
    #             "location-registry") echo "deployment activities for location registry service..." ;;
    #             #case 6
    #             "predict") echo "deployment activities for predict service..." ;;
    #             #case 7
    #             "locate") echo "deployment activities for locate service..." ;;
    #             #case 8
    #             "calibrate") echo "deployment activities for calibrate service..." ;;
    #             #case 9
    #             "analytics") echo "deployment activities for analytics service..." ;;
    #             #case 10
    #             "incentives") echo "deployment activities for incentives service..." ;;
    #         esac
    #     done
    # fi

#     if ["$branch" -eq "master"]; then
#         echo "deployment activities..."
#         for microservice in ${changed_microservices}; do
#             case "$microservice" in
#                 #case 1
#                 "auth-service") echo "deployment activities for auth service..." ;;
#                 #case 2
#                 "device-registry") echo "deployment activities for device registry service..." ;;
#                 #case 3
#                 "data-mgt") echo "deployment activities for data management service..." ;;
#                 #case 4
#                 "device-monitory") echo "deployment activities for device registry service..." ;;
#                 #case 5
#                 "location-registry") echo "deployment activities for location registry service..." ;;
#                 #case 6
#                 "predict") echo "deployment activities for predict service..." ;;
#                 #case 7
#                 "locate") echo "deployment activities for locate service..." ;;
#                 #case 8
#                 "calibrate") echo "deployment activities for calibrate service..." ;;
#                 #case 9
#                 "analytics") echo "deployment activities for analytics service..." ;;
#                 #case 10
#                 "incentives") echo "deployment activities for incentives service..." ;;
#             esac
#         done
#     fi
# }

main
