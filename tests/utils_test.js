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

  var ObjectDiff = require('../lib/objectDiff');

  module.exports = {

    name: "Utils",

"test: keyValuePairs": function() {
  var obj = {"a": 1, "b": 2, c: {d: 4}};
  //console.log(Utils.getKeyValuePairs(obj));
},

"test: serializeID": function() {
  var id = {
    collection: "Reservation", 
    key: 13,
    path: "room.name"
  };
  assert.equal(Utils.serializeDBObjectID(id), "Reservation:13:room.name");
  var parsedId = Utils.parseDBObjectID("Reservation:13:room.name");
  assert.equal(parsedId.collection, "Reservation");
  assert.equal(parsedId.key, 13);
  assert.equal(parsedId.path, "room.name");      
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

    assert.ok(Utils.set(obj, "a", 2));
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
    console.log(obj);
    assert.ok(Utils.arrayDelete(obj, "b.c", 0));
    console.log(obj);
    assert.ok(Utils.arrayDelete(obj, "b.c", 1));
    console.log(obj); 
    assert.ok(!Utils.arrayDelete(obj, "b.c", 1));
    console.log(obj);
  },

  "test: objectDiff": function() {
    var obj = {a: 1, b: { c: [1,2,3,4]}};
    var obj2 = {a: 1, b: { c: 2}} ;
    console.log(JSON.stringify(ObjectDiff.diff(obj,obj2), null, 2));
  }

}
});

if (typeof module !== "undefined" && module === require.main) {
  require("asyncjs").test.testcase(module.exports).exec()
}
