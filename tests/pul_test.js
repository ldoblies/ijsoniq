if (typeof process !== "undefined") {
  require("amd-loader");
}

define(function(require, exports, module) {
  "use strict";

  var assert = require("./assertions");
  
  var VERBOSE = false;

  var requirejs = require('../r');
  var PUL = require('../lib/pul').PendingUpdateList;
  var UPFactory = require('../lib/pul').UPFactory;
  var PULNormalizer = require('../lib/pulnormalizer').PULNormalizer;
  var Utils = require('../lib/utils').Utils;

  var _ = require('../lib/underscore');

  var fs = require('fs');
  var path = require('path');

  function asserting(text){
    debugMsg("Asserting that", text);
  }
  
  function assertUnique(arr){
    assert.equal(arr.length, _.uniq(arr).length);
  }

  function assertNoIntersection(arr1, arr2){
    assert.equal(_.intersection(arr1,arr2).length, 0);
  }

  function assertTargetsNotDeleted(deletes, targets){
    targets.forEach(function(target){
      deletes.forEach(function(del){
        assert.ok(!Utils.containsTarget(del,target));
      });
    });
  }

  function debugMsg(msg){
    if (VERBOSE){
      console.log(msg);
    }
  };

  function assertNormalized(pul){
    debugMsg("Asserting that PUL is normalized...");
    asserting("PUL is valid");
    assert.ok(!pul.error);
    debugMsg("Input PUL:", JSON.stringify(pul, null, 2));
    var targets = new PULNormalizer().computeTargets(pul);
    debugMsg("Computed PUL Targets: " + JSON.stringify(targets,null,2));

    // 1. jupd:insert
    // Unique UP with same target
    asserting("insert UPs are unique w.r.t. target");
    assertUnique(targets.insert);

    // 2. jupd:delete
    // Unique del ids
    asserting("delete ids are unique");
    for (var i = 0; i < pul.del.length; i++){
      var delIds = pul.del[i].params[0];
      assertUnique(delIds);
    }
    // Unique UP with same target
    asserting("delete UPs are unique w.r.t. target");
    assertUnique(targets.del);

    // 3. jupd:insert-into-object
    // Unique UP with same target
    asserting("insert-into-object UPs are unique w.r.t. target");
    assertUnique(targets.insert_into_object);

    // 4. jupd:delete-from-object
    // Unique del names 
    asserting("delete-from-object names are unique");
    var upd = pul.delete_from_object;
    for (var i = 0; i < upd.length; i++){
      var delNames = upd[i].params[0];
      assertUnique(delNames);
    }
    // Unique UP with same target
    asserting("delete-from-object UPs are unique w.r.t. target");
    assertUnique(targets.delete_from_object);
    
    // 5. jupd:replace-in-object
    // Unique UP with same target
    asserting("replace-in-object UPs are unique w.r.t. target");
    assertUnique(targets.replace_in_object_selected);
    // No replace on deleted objects
    asserting("there are no replace-in-object UPs for deleted objects");
    assertNoIntersection(targets.delete_from_object_selected,
        targets.replace_in_object_selected);

    // 6. jupd:rename-in-object 
    // Unique UP with same target
    asserting("rename-in-object UPs are unique w.r.t. target");
    assertUnique(targets.rename_in_object_selected);
    // No rename on deleted objects
    asserting("there are no rename-in-object UPs for deleted objects");
    assertNoIntersection(targets.delete_from_object_selected,
        targets.rename_in_object_selected);

    // 7. jupd:insert-into-array
    // Unique UP with same target
    asserting("insert-into-array UPs are unique w.r.t. target");
    assertUnique(targets.insert_into_array);

    // 8. jupd:delete-from-array
    // Unique UP with same target
    asserting("delete-from-array UPs are unique w.r.t. target");
    assertUnique(targets.delete_from_array);
   
    // 9. jupd:replace-in-array
    // Unique UP with same target
    asserting("replace-in-array UPs are unique w.r.t. target");
    assertUnique(targets.replace_in_array);
    // No replace on deleted objects
    asserting("there are no replace-in-array UPs for deleted elements");
    assertNoIntersection(targets.replace_in_array, targets.delete_from_array);        

    debugMsg("...PUL normalization assertion complete.");

  }



  module.exports = {

    name: "PUL",

    "test: insert, delete": function() {
      var target = {
        collection: 'collection0'
      };
      var target2 = {
        collection: 'collection1'
      };
      var normalizer = new PULNormalizer();
      var p = new PUL();
      var up = UPFactory.insert(target, [{id: 0, from: "insert"}]);
      p.addUpdatePrimitive(up);
      up = UPFactory.insert(target, [{id: 1, from: "insert"}]);
      p.addUpdatePrimitive(up);
      up = UPFactory.insert(target2, [{from: "insert"}]);
      p.addUpdatePrimitive(up);
      p.addUpdatePrimitive(up);

      p.addUpdatePrimitive(UPFactory.del(target, [1,2,3]));
      p.addUpdatePrimitive(UPFactory.del(target, [2,3,4]));
      p.addUpdatePrimitive(UPFactory.del(target2, [1,2,3]));
      
      p = normalizer.normalize(p);
      
      assertNormalized(p);
    },

    "test: insert-into-object": function() {
      var target = {
        collection: 'collection0'
      };
      var target2 = {
        collection: 'collection1'
      };
      var normalizer = new PULNormalizer();
      var p = new PUL();

      var obj = {a: 1, b: {c: 2}};
      var obj2 = {d: 1, e: 1, f: 1};
      p.addUpdatePrimitive(UPFactory.insert_into_object(target,obj));
      p.addUpdatePrimitive(UPFactory.insert_into_object(target,obj2));
      target.path = "c";
      p.addUpdatePrimitive(UPFactory.insert_into_object(target,obj));

      p = normalizer.normalize(p);

      assertNormalized(p);

      p = new PUL();
      p.addUpdatePrimitive(UPFactory.insert_into_object(target,obj));
      p.addUpdatePrimitive(UPFactory.insert_into_object(target,obj));
      p = normalizer.normalize(p);
      assert.ok(p.error);
      debugMsg(p.error);
    },
    
    "test: replace-in-object, delete-from-object": function() {
      var target = {
        collection: 'collection0',
        key: 0,
        path: "a"
      };
      var target2 = {
        collection: 'collection0',
        key: 0
      };
      var normalizer = new PULNormalizer();
      var p = new PUL();
      p.addUpdatePrimitive(UPFactory.delete_from_object(target, "b")); // a.b
      p.addUpdatePrimitive(UPFactory.replace_in_object(target, "a", 0)); // a.a, effective
      p.addUpdatePrimitive(UPFactory.replace_in_object(target, "b", 0)); // a.b, non-effective
      target.path = "a.b.c";
      p.addUpdatePrimitive(UPFactory.replace_in_object(target, "d", 0)); // a.b.c.d, non-effective

      p.addUpdatePrimitive(UPFactory.delete_from_object(target2, "c")); // c
      p.addUpdatePrimitive(UPFactory.replace_in_object(target2, "b", 0)); // b, effective
      p.addUpdatePrimitive(UPFactory.replace_in_object(target2, "c", 0)); // c, non-effective
      target2.path = "c";
      p.addUpdatePrimitive(UPFactory.replace_in_object(target2, "d", 0)); // c.d, non-effective 

      debugMsg("PUL before normalization: " + JSON.stringify(p,null,2));
      p = normalizer.normalize(p);
      if (p.error) { 
        debugMsg("Error:", p.error);
      }
      assertNormalized(p);

      assert.equal(p.replace_in_object.length, 2);
      var targets = normalizer.computeTargets(p);
      assert.ok(_.contains(targets.replace_in_object_selected, "collection0:0:a.a"));
      assert.ok(_.contains(targets.replace_in_object_selected, "collection0:0:b"));
    },
   
    "test: rename-in-object, delete-from-object": function() {
      var target = {
        collection: 'collection0',
        key: 0,
        path: "a"
      };
      var target2 = {
        collection: 'collection0',
        key: 0
      };
      var normalizer = new PULNormalizer();
      var p = new PUL();
      p.addUpdatePrimitive(UPFactory.delete_from_object(target, "b")); // a.b
      p.addUpdatePrimitive(UPFactory.rename_in_object(target, "a", 0)); // a.a, effective
      p.addUpdatePrimitive(UPFactory.rename_in_object(target, "b", 0)); // a.b, non-effective
      target.path = "a.b.c";
      p.addUpdatePrimitive(UPFactory.rename_in_object(target, "d", 0)); // a.b.c.d, non-effective

      p.addUpdatePrimitive(UPFactory.delete_from_object(target2, "c")); // c
      p.addUpdatePrimitive(UPFactory.rename_in_object(target2, "b", 0)); // b, effective
      p.addUpdatePrimitive(UPFactory.rename_in_object(target2, "c", 0)); // c, non-effective
      target2.path = "c";
      p.addUpdatePrimitive(UPFactory.rename_in_object(target2, "d", 0)); // c.d, non-effective 

      debugMsg("PUL before normalization: " + JSON.stringify(p,null,2));
      p = normalizer.normalize(p);
      if (p.error) { 
        debugMsg("Error:", p.error);
      }
      assertNormalized(p);

      assert.equal(p.rename_in_object.length, 2);
      var targets = normalizer.computeTargets(p);
      assert.ok(_.contains(targets.rename_in_object_selected, "collection0:0:a.a"));
      assert.ok(_.contains(targets.rename_in_object_selected, "collection0:0:b"));
    }
  }
});

if (typeof module !== "undefined" && module === require.main) {
  require("asyncjs").test.testcase(module.exports).exec()
}
