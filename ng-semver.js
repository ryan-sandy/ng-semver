#!/usr/bin/env node
//Copyright 2014 Ryan Lee
//See license file

'use strict';
/*jslint node:true, indent:2, nomen:true*/

var exec = require('child_process').exec;
var argv = require('minimist')(process.argv.slice(2));
var jsdom = require("jsdom");
var fs = require('fs');
var async = require('async');
var semver = require('semver');
var request = require('request');
var path = require('path');
var log = require('npmlog');

var buildRevTree =  function (next) {
  log.info('revTree', 'Loading revisions');
  jsdom.env(
    "http://code.angularjs.org",
    ["http://code.jquery.com/jquery.js"],
    function (err, window) {
      if (err) { return next(err); }
      log.silly('revTree', 'Formatting revisions');
      var revs = [];
      window.$("a").each(function (i, elm) {
        var href;
        href = window.$(elm).attr('href');
        //NOTE 1.0.0rc are invaild and ignored
        if (semver.valid(href.slice(0, -1))) {
          revs.push(semver.clean(href.slice(0, -1)));
        /*
        } else {
          console.log('bad:' + href);
        */
        }
      });
      log.silly('revTree', 'Complete');
      next(null, revs);
    }
  );
};

var printHelp  = function () {
  console.log('Angular Fetch Utility');
  console.log('Usage:');
  console.log('  semver-anuglar <Action>');
  console.log('Actions:');
  console.log('  list');
  console.log('    prints all available versions and exits');
  console.log('  install <path> <version>');
  console.log('    <path>: path to install angular.');
  console.log('    <version>: version of angular to install.');
  console.log('  update <path> <version>');
  console.log('    <path>: path to angular. If empty will install.');
  console.log('    <version>: version of anulgar. Will attempt to update version to max satifies.');
  console.log('               On update the path will be emptied.');
  console.log('  help');
  console.log('    print this message.');
  console.log('  -h --help: Print this message');
  console.log('NOTE: 1.0.0rc* releases are unsupported by the utility.');
  process.exit(0);
};

var list = function () {
  buildRevTree(function (err, revs) {
    if (err) { throw err; }
    console.log(revs.join('\n'));
    process.exit(0);
  });
};

var create = function (filePath, version, next) {
  async.waterfall([
    function (cb) {
      log.silly('create', 'Checking if directory exists: %s', path.resolve(filePath));
      fs.exists(path.resolve(filePath), function (exists) {
        cb(null, exists);
      });
    },
    function (exists, cb) {
      if (exists) {
        log.verbose('create', 'Directory exists. Skipping creation.');
        return cb(null);
      }
      fs.mkdir(path.resolve(filePath), function (err) {
        log.verbose('create', 'Directory created.');
        cb(err);
      });
    },
    function (cb) {
      if (semver.gt(version, '1.0.2')) {
        log.verbose('create', 'Version greater than 1.0.2. Using zip archive');
        //zip
        cb(null, false);
      } else {
        log.verbose('create', 'Version less than 1.0.2. Using tarball.');
        //tarball
        cb(null, true);
      }
    },
    function (tarball, cb) {
      var out, tmpName, url = 'http://code.angularjs.org/' + version + '/angular-' + version;
      if (tarball) {
        tmpName = 'tmp.tgz';
        url += '.tgz';
      } else {
        tmpName = 'tmp.zip';
        url += '.zip';
      }
      log.info('create', 'Creating tmp file %s', tmpName);
      out = fs.createWriteStream(tmpName);
      log.info('create', 'Fetching %s', url);
      request(url, function (err, res) {
        if (err) { return cb(err); }
        if (res.statusCode !== 200) {
          return cb(new Error('Could not download archive. Status:' + res.statusCode));
        }
        cb(null, tarball);
      }).pipe(out);
    },
    function (tarball, cb) {
      log.silly('create', 'Do we have a tarball? %s', tarball);
      if (tarball) {
        log.error('create', 'Tarball unsupported');
        return cb();
      }
      var tmpPath = path.resolve('tmp.zip');
      log.verbose('create', 'Extracting %s', tmpPath);
      exec('unzip -j -o -d ' + path.resolve(filePath) + ' ' + tmpPath + '; rm tmp.zip', function (err) {
        if (err) { return cb(err); }
        log.info('create', 'Extarcted to %s', path.resolve(filePath));
        cb(err);
      });
    }
  ], function (err) {
    next(err);
  });
};

var update = function (filePath, version) {
  filePath = path.normalize(filePath);
  async.waterfall([
    function (cb) {
      buildRevTree(function (err, revs) {
        if (err) { return cb(err); }
        cb(null, semver.maxSatisfying(revs, version));
      });
    },
    function (ver, cb) {
      var tmpPath = path.resolve(path.join(filePath, 'version.json'));
      log.verbose('update', 'Checking for installed version in %s', tmpPath);
      fs.exists(tmpPath, function (exists) {
        if (exists) {
          cb(null, ver, require(tmpPath).full);
        } else {
          cb(null, ver, false);
        }
      });
    },
    function (ver, checkedVersion, cb) {
      log.silly('update', 'Checked version: %s', checkedVersion);
      if (checkedVersion !== false && semver.gte(checkedVersion, ver)) {
        log.info('update', 'All up to date.');
        process.exit(0);
      }
      log.warn('update', 'Updating to version %s', ver);
      cb(null, ver);
    },
    function (ver, cb) {
      create(filePath, ver, cb);
    }
  ], function (err) {
    if (err) {
      throw err;
    }
    log.info('Update complete');
    process.exit(0);
  });
};

var install = function (filePath, version) {
  filePath = path.normalize(filePath);
  async.waterfall([
    function (cb) {
      var tmpPath = path.resolve(path.join(filePath, 'version.json'));
      log.verbose('install', 'Checking for installed version in %s', tmpPath);
      fs.exists(tmpPath, function (exists) {
        if (exists) {
          cb(null, require(tmpPath).full);
        } else {
          cb(null, false);
        }
      });
    },
    function (checkedVersion, cb) {
      log.verbose('install', 'Checked version: %s', checkedVersion);
      if (checkedVersion === false) {
        log.silly('install', 'Cannot find installed version.');
        return cb();
      }
      if (semver.satisfies(checkedVersion, version)) {
        log.info('Acceptiable version installed. Stopping.');
        process.exit(0);
      }
      log.warn('install', 'Unhandled case');
      cb();
    },
    function (cb) {
      buildRevTree(function (err, revs) {
        if (err) { return cb(err); }
        cb(null, semver.maxSatisfying(revs, version));
      });
    },
    function (ver, cb) {
      create(filePath, ver, cb);
    }
  ], function (err) {
    if (err) {
      throw err;
    }
    log.info('install', 'Install complete');
    process.exit(0);
  });
};

if (argv.h || argv.help) {
  printHelp();
}
log.level = 'info';
if (argv.v) {
  log.level = 'verbose';
}
if (argv.silly) {
  log.level = 'silly';
}
if (argv._.length === 1 && argv._[0] === 'list') {
  list();
} else if (argv._.length === 3 && argv._[0] === 'install') {
  install(argv._[1], argv._[2]);
} else if (argv._.length === 3 && argv._[0] === 'update') {
  update(argv._[1], argv._[2]);
} else {
  printHelp();
}
