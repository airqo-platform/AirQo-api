# AirQo-Api contributing guide

Thank you for investing your time in contributing to our project!

In this guide you will get an overview of the contribution workflow from opening an issue, creating a PR, reviewing, and merging the PR.

## New contributor guide

To get an overview of each microservice, read the respective microservice READMEs:

- [workflows](/src/workflows/README.md)
- [Analytics](/src/analytics/README.md)
- [Auth-service](/src/auth-service/README.md)
- [Calibrate](/src/calibrate/readme.md)
- [Device-registry](/src/device-registry/README.md)
- [Firebase](/src/firebase/backup/README.md)
- [kafka-connectors(bigquery-connector)](/src/kafka-connectors/bigquery-connector/README.md)
- [kafka-connectors(measurement-source-connector)](/src/kafka-connectors/measurements-source-connector/Readme.md)
- [locate](/src/locate/README.md)
- [meta-data](/src/meta-data/README.md)
- [Predict](/src/predict/README.md)
- [View](/src/view/README.md)


Here are some resources to help you get started with open source contributions:

- [How to Contribute to Open Source](https://opensource.guide/how-to-contribute/)
- [Set up Git](https://docs.github.com/en/get-started/quickstart/set-up-git)
- [Collaborating with pull requests](https://docs.github.com/en/github/collaborating-with-pull-requests)

## Getting started

### Issues

#### Create a new issue

If you spot a problem with any of our products, check the [existing issues](https://github.com/airqo-platform/AirQo-api/issues) to establish if the problem has already been reported. If a related issue doesn't exist, you can open a new issue using a relevant [issue form](https://github.com/airqo-platform/AirQo-api/issues/new/choose).

#### Solve an issue

Scan through the [existing issues](https://github.com/airqo-platform/AirQo-api/issues) to find one that interests you. You can narrow down the search using `labels` as filters. If you find an issue to work on, you are welcome to open a PR with a fix.

**Note** that you don't need to be assigned to this issue to work on it. Simply raise a PR that address it and add `closes #issue-number` in the PR description to [automatically link your PR to the issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue#linking-a-pull-request-to-an-issue-using-a-keyword).

### Make Changes

#### Make changes locally

1. [Install Git LFS](https://docs.github.com/en/github/managing-large-files/versioning-large-files/installing-git-large-file-storage).

2. [Fork the repository](https://docs.github.com/en/github/getting-started-with-github/fork-a-repo#fork-an-example-repository).

3. [Create a working branch](https://docs.github.com/en/issues/tracking-your-work-with-issues/creating-a-branch-for-an-issue) and start with your changes!

## Style Guides
Basing on the framework and language you are using to develop any microservice, please ensure that you follow the [Style Guide](http://google.github.io/styleguide/) for that language accordingly. 

### Commit your update

Commit the changes, with a [good commit message](http://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html) once you are happy with them.

Once your changes are ready, don't forget to test and self-review them to speed up the review process:zap:.

### Pull Request

When you're finished with the changes, create a pull request, also known as a PR.

- Fill the "Ready for review" template so that we can review your PR. This template helps reviewers understand your changes as well as the purpose of your pull request.
- Don't forget to [link PR to issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue) if you are solving one.
- Enable the checkbox to [allow maintainer edits](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork) so the branch can be updated for a merge.
  Once you submit your PR, AirQo team members will review your proposal.
- We may ask for changes to be made before a PR can be merged. You can apply suggested changes and/or make any other changes in your fork, then commit them to your branch.
- As you update your PR and apply changes, mark each conversation as [resolved](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/commenting-on-a-pull-request#resolving-conversations).
- If you run into any merge issues, checkout this [git tutorial](https://github.com/skills/resolve-merge-conflicts) to help you resolve merge conflicts and other issues.

### Your PR is merged!

Congratulations :tada::tada: <br />
The AirQo team thanks you :sparkles:.
