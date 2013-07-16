if (typeof process !== "undefined") {
  require("amd-loader");
}

define(function(require, exports, module) {
  "use strict";

  var assert = require("./assertions");

  var requirejs = require('../r');
  var IDBWrapper = require('../lib/idbwrapper').IDBWrapper;

  var fs = require('fs');
  var path = require('path');

  module.exports = {

    name: "IDBWrapper",

    "test: 0": function() {
      var wrapper = new IDBWrapper({});
    }

   }
});

if (typeof module !== "undefined" && module === require.main) {
  require("asyncjs").test.testcase(module.exports).exec()
}
