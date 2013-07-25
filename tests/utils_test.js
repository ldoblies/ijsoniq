if (typeof process !== "undefined") {
  require("amd-loader");
}

define(function(require, exports, module) {
  "use strict";

  var assert = require("./assertions");

  var requirejs = require('../r');
  var Utils = require('../lib/utils').Utils;

  var fs = require('fs');
  var path = require('path');

//  var ObjectDiff = require('../lib/objectDiff');

  module.exports = {

    name: "Utils",

"test: keyValuePairs": function() {
  var obj = {"a": 1, "b": 2, c: {d: 4}};
},

  "test: hasKey": function() {
    var obj = {a: 1, b: {c: 2}};
    assert.ok(Utils.hasKey(obj, "a"));
    assert.ok(Utils.hasKey(obj, "b"));
    assert.ok(Utils.hasKey(obj, "b.c"));

    assert.ok(!Utils.hasKey(obj, "c"));
    assert.ok(!Utils.hasKey(obj, "b.d"));
    assert.ok(!Utils.hasKey(obj, "b.c.a"));
  },

  "test: getContainingObject": function() {
    var obj = {a: 1, b: {c: 2}};

    assert.equal(Utils.getContainingObject(obj, "a"), obj);
    assert.equal(Utils.getContainingObject(obj, "b"), obj);
    assert.equal(Utils.getContainingObject(obj, "b.c"), obj.b);

    var inserted = Utils.getContainingObject(obj, "c.d.e.f.g.h.i.j", true);
    inserted["j"] = 1;
    //console.log(inserted);
    //console.log(JSON.stringify(obj));
  },

  "test: set": function() {
    var obj = {a: 1, b: {c: 2}};

    assert.ok(!Utils.set(obj, "a", 2));
    assert.ok(Utils.set(obj, "a", 2, true));
    assert.equal(obj.a, 2);

    assert.ok(Utils.set(obj, "c.d.e", 3));
    //console.log(obj);

    assert.ok(!Utils.set(obj, "a.b", 1));
    assert.ok(!Utils.set(obj, "b.c.d", 1));
  },

  "test: arrayInsert": function() {
    var obj = {a: 1, b: { c: [0,0,0]}};
    var arr = obj.b.c;

    assert.ok(Utils.arrayInsert(obj, "b.c", 0, [1,2]));
    //console.log(obj);
    assert.ok(Utils.arrayInsert(obj, "b.c", 3, [3,4]));
    //console.log(obj);
    assert.ok(Utils.arrayInsert(obj, "b.c", 7, [5,6]));
    //console.log(obj);
  },

  "test: arrayDelete": function() {
    var obj = {a: 1, b: { c: [1,2,3,4]}};
    var arr = obj.b.c;

    assert.ok(Utils.arrayDelete(obj, "b.c", 1));
    //console.log(obj);
    assert.ok(Utils.arrayDelete(obj, "b.c", 0));
    //console.log(obj);
    assert.ok(Utils.arrayDelete(obj, "b.c", 1));
    //console.log(obj); 
    assert.ok(!Utils.arrayDelete(obj, "b.c", 1));
    //console.log(obj);
  },

  "test: serializeTarget": function(){
    var target = {collection: "c", key: 0, path: "a.b"};
    assert.equal(Utils.serializeTarget(target), "c:0:a.b");
    assert.equal(Utils.serializeTarget(target, "c"), "c:0:a.b.c");
    delete target.path;
    assert.equal(Utils.serializeTarget(target), "c:0");
    assert.equal(Utils.serializeTarget(target,"a.b.c"), "c:0:a.b.c");
    target.path = "a.b.arr";
    assert.equal(Utils.serializeTarget(target), "c:0:a.b.arr");
    assert.equal(Utils.serializeTarget(target, 0, true), "c:0:a.b.arr:0");
    target.path = "arr";
    target.key = 1;
    assert.equal(Utils.serializeTarget(target, 1, true), "c:1:arr:1"); 
    delete target.path;
    assert.equal(Utils.serializeTarget(target, "arr.1"), "c:1:arr.1"); 
  }, 

  "test: containsTarget": function(){
    assert.ok(Utils.containsTarget("a", "a"));
    assert.ok(Utils.containsTarget("a", "a.b"));
    assert.ok(Utils.containsTarget("0:a", "0:a"));
    assert.ok(Utils.containsTarget("0:a", "0:a.b"));
    assert.ok(Utils.containsTarget("c:0:a", "c:0:a"));
    assert.ok(Utils.containsTarget("c:0:a", "c:0:a.b"));
    assert.ok(Utils.containsTarget("c:0:a", "c:0:a.b.c.d.e"));
    var c1 = {collection: "c", key: 0, path: "a"};
    var c2 = "c:0:a.b.c";
    assert.ok(Utils.containsTarget(c1,c2));

    assert.ok(!Utils.containsTarget("a", "b"));
    assert.ok(!Utils.containsTarget("a", "b.c"));
    assert.ok(!Utils.containsTarget("c:0:a", "a"));
    assert.ok(!Utils.containsTarget("c:0:a", "c:1:a"));
    assert.ok(!Utils.containsTarget("c:0:a", "d:0:a"));
    assert.ok(!Utils.containsTarget("c:0:a", "c:0:b"));
    assert.ok(!Utils.containsTarget("c:0:a", "c:0:b.c.d.e"));
  }

}
});

if (typeof module !== "undefined" && module === require.main) {
  require("asyncjs").test.testcase(module.exports).exec()
}
