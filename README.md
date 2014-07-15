#ng-semver

Semantic Versioning for Angular

#Install
This package is meant to provide a temporary fix to version control angular. It is simply filling a gap until angular gets published an npm module.

    npm install ng-semver

##Known Issues

* Any 1.0.0rc releases are ignored. (Semantically incorrect versions)
* Versions below 1.0.2 get overwritten each time. (Version.json does not exist.)
