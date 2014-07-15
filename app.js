//Copyright 2014 ERAS/Educational Research and Services
//Reproduction of this material strictly prohibited.
//Written by Ryan Lee

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


var buildRevTree =  function (next) {
  jsdom.env(
    "http://code.angularjs.org",
    ["http://code.jquery.com/jquery.js"],
    function (err, window) {
      if (err) { return next(err); }
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

var update = function (path, version) {
  console.log('update is a stub');
  process.exit(1);
};

var install = function (filePath, version) {
  filePath = path.normalize(filePath);
  async.waterfall([
    function (cb) {
      buildRevTree(function (err, revs) {
        if (err) { return cb(err); }
        cb(null, semver.maxSatisfying(revs, version));
      });
    },
    function (ver, cb) {
      var tmpPath;
      if (semver.gt(ver, '1.0.3')) {
        tmpPath = path.resolve(path.join(filePath, 'version.json'));
        fs.exists(tmpPath, function (exists) {
          if (exists) {
            cb(null, ver, require(tmpPath).full);
          } else {
            cb(null, ver, false);
          }
        });
      } else {
        tmpPath = path.join(filePath, 'angular-' + ver + '.js');
        tmpPath = path.resolve(tmpPath);
        fs.exists(tmpPath, function (exists) {
          if (exists) {
            cb(null, ver, version);
          } else {
            cb(null, ver, false);
          }
        });
      }
    },
    function (ver, checkedVersion, cb) {
      if (checkedVersion && semver.satisfies(checkedVersion, ver)) {
        console.log('up to date');
        process.exit(0);
      }
      cb(null, ver);
    },
    function (ver, cb) {
      fs.exists(filePath, function (exists) {
        cb(null, ver, exists);
      });
    },
    function (ver, exists, cb) {
      if (exists) {
        return cb(null, ver);
      }
      fs.mkdir(filePath, function (err) {
        cb(err, ver);
      });
    },
    function (ver, cb) {
      if (semver.gt(ver, '1.0.2')) {
        //zip
        cb(null, ver, false);
      } else {
        //tarball
        cb(null, ver, true);
      }
    },
    function (ver, tarball, cb) {
      var out, tmpName, url = 'http://code.angularjs.org/' + ver + '/angular-' + ver;
      if (tarball) {
        tmpName = 'tmp.tgz';
        url += '.tgz';
      } else {
        tmpName = 'tmp.zip';
        url += '.zip';
      }
      console.log(url);
      out = fs.createWriteStream(tmpName);
      request(url, function (err, res) {
        if (err) { return cb(err); }
        if (res.statusCode !== 200) {
          return cb(new Error('Could not download archive. Status:' + res.statusCode));
        }
        cb(null, tarball);
      }).pipe(out);
    },
    function (tarball, cb) {
      console.log(tarball);
      if (tarball) {
        console.log('tarball unsupported');
        return cb();
      }
      exec('unzip -j -o -d ' + path.join(filePath, 'tmp.zip') + '; rm tmp.zip', function (err) {
        cb(err);
      });
    }
  ], function (err) {
    if (err) {
      throw err;
    }
    process.exit(0);
  });
};

if (argv.h || argv.help) {
  printHelp();
}
if (argv._.length === 1 && argv._[0] === 'list') {
  list();
} else if (argv._.length === 3 && argv._[0] === 'install') {
  install(argv._[1], argv._[2]);
} else if (argv._length === 3 && argv._[0] === 'update') {
  update();
} else {
  printHelp();
}
