//Copyright 2014 ERAS/Educational Research and Services
//Reproduction of this material strictly prohibited.
//Written by Ryan Lee

'use strict';
/*jslint node:true, indent:2, nomen:true*/

var argv = require('minimist')(process.argv.slice(2));
var jsdom = require("jsdom");
var fs = require('fs');
var async = require('async');
var semver = require('semver');
var request = require('request');


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

async.waterfall([
  function (cb) {
    if (argv.h || argv.help) {
      console.log('Angular Fetch Utility');
      console.log('Usage:');
      console.log('  ngFetch [options] <version>');
      console.log('Options:');
      console.log('  --list: prints all available versions and exit');
      process.exit(0);
    }
    cb();
  },
  function (cb) {
    buildRevTree(function (err, vals) {
      cb(err, vals);
    });
  },
  function (revs, cb) {
    if(argv.list) {
      console.log(revs);
      process.exit(0);
    }
    cb(null, revs);
  },
  function (revs, cb) {
    var version;
    if (argv._.length === 0) {
      console.log('Warning: No version selected. Using latest.');
      version = "*";
    } else {
      version = argv._[0];
    }
    version = semver.maxSatisfying(revs, version);
    cb(null, version);
  },
  function (version, cb) {
    var tmpName, path = 'http://code.angularjs.org/' + version + '/angular-' + version;
    if (semver.lte(version, '1.0.8')) {
      tmpName = 'tmp.tgz';
      path += '.tgz';
    } else {
      tmpName = 'tmp.zip';
      path += '.zip';
    }
    out = fs.createWriteStream(tmpName);
    request(path, function (err, res) {
      if (err) { return cb(err); }
      cb(null, tmpName);
    }).pipe(out);
  }
], function (err) {
  if (err) { 
    throw err;
  }
  console.log('done');
  process.exit(0);
});
