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
  var PULComposer = require('../lib/pulcomposer').PULComposer;
  var Utils = require('../lib/utils').Utils;

  var _ = require('../lib/underscore');

  var fs = require('fs');
  var path = require('path');

  function asserting(text){
    debugMsg("Asserting that " +  text);
  }

  /* Assert contents of arr matches items (set semantics) */
  function assertArrayContents(arr, items){
    // console.log("arr: " + arr + ", items: " + items);
    assert.ok(arr.length === items.length);
    assert.equal(_.difference(arr, items).length, 0);
  }

  /* True iff arrays have identical contents (including order) */
  function arraysMatch(arr1, arr2){
    if (arr1.length - arr2.length) return false;
    for (var i = 0; i < arr1.length; i++){
      if (!objsEqual(arr1[i], arr2[i])) return false;
    }
    return true;
  }

  function assertSortedByIndex(arr){
    var isSorted =  _.every(arr, function(value, i, arr){
      return i === arr.length-1 || value.params[0] >= arr[i+1].params[0];
    });
    assert.ok(isSorted);
  }

  
  function objsEqual(o1,o2){
   // console.log("objsEqual("+JSON.stringify(o1)+","+JSON.stringify(o2)+")");
    if (_.isArray(o1)){
      return _.isArray(o2) && arraysMatch(arr1,arr2);
    }else if (o1 === null || o2 === null || typeof o1 !== 'object' ||
        typeof o2 !== 'object'){
          return o1 === o2;
        }
    var keys1 = Object.keys(o1);
    var keys2 = Object.keys(o2);
    keys1.sort();
    keys2.sort();
    if (!arraysMatch(keys1, keys2)) return false;
    for (var i = 0; i < keys1.length; i++){
      if (!objsEqual(o1[keys1[i]], o2[keys1[i]])){
        return false;
      }  
    }

    return true;
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
    var targets = pul.computeTargets();
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
    // Sorted descendingly by index
    asserting("insert-into-array UPs are sorted");
    assertSortedByIndex(pul.insert_into_array);

    // 8. jupd:delete-from-array
    // Unique UP with same target
    asserting("delete-from-array UPs are unique w.r.t. target");
    assertUnique(targets.delete_from_array);
    asserting("delete_from_array UPs are sorted");
    assertSortedByIndex(pul.delete_from_array);

    // 9. jupd:replace-in-array
    // Unique UP with same target
    asserting("replace-in-array UPs are unique w.r.t. target");
    assertUnique(targets.replace_in_array);
    // No replace on deleted objects
    asserting("there are no replace-in-array UPs for deleted elements");
    assertNoIntersection(targets.replace_in_array, targets.delete_from_array);        
    asserting("replace-in-array UPs are sorted");
    assertSortedByIndex(pul.replace_in_array);


    debugMsg("...PUL normalization assertion complete.");
  };


  function logIntroducedTargets(pul){
    var iTargets = pul.computeIntroducedTargets();
    console.log("PUL:\n" + JSON.stringify(pul,null,2));
    console.log("Introduced Targets:\n" + JSON.stringify(iTargets,null,1));
  };

  function testComposition(p1,p2){
    var normalizer = new PULNormalizer();
    var composer = new PULComposer();

    p1 = normalizer.normalize(p1);
    p2 = normalizer.normalize(p2);
    var composedPul = composer.compose(p1,p2);
    console.log(JSON.stringify(composedPul,null,2));
    return composedPul;
  };

  module.exports = {

    name: "PUL Composition",
    
    "test: on rename-in-object": function() {
      var P1 = new PUL();
      var P2 = new PUL();
      var target = {
        collection: "c",
        key: 1,
        path: "a"
      };

      P1.addUpdatePrimitive(UPFactory.rename_in_object(target,"b","x"));

      //  This UP should have its name selector adapted to b
      P2.addUpdatePrimitive(UPFactory.delete_from_object(target, "x"));

      // This UP should have its path adapted to a.b
      target.path = "a.x";
      P2.addUpdatePrimitive(UPFactory.delete_from_object(target, "d"));

      // Containing deletes
      var composed = testComposition(P1,P2);
      assert.equal(composed.delete_from_object[0].params[0][0], "b");
      assert.equal(composed.delete_from_object[1].target.path, "a.b");


      P2 = new PUL();
      target.path = "a";
      //  This UP should have its name selector adapted to b
      P2.addUpdatePrimitive(UPFactory.replace_in_object(target, "x", 1));

      // This UP should not appear in the composed PUL but the rename above
      // should be modified to rename "b" to "y"
      P2.addUpdatePrimitive(UPFactory.rename_in_object(target, "x", "y"));

      // All these UPs should have their path adapted to a.b
      target.path = "a.x";
      P2.addUpdatePrimitive(UPFactory.insert_into_object(target, {c:1}));
      P2.addUpdatePrimitive(UPFactory.replace_in_object(target, "e", 1));
      P2.addUpdatePrimitive(UPFactory.rename_in_object(target, "f", "g"));

      // Containing no deletes
      composed = testComposition(P1,P2);
      assert.equal(composed.replace_in_object[0].params[0], "b");
      assert.equal(composed.rename_in_object[0].params[0], "b");
      assert.equal(composed.rename_in_object[0].params[1], "y");
      assert.equal(composed.insert_into_object[0].target.path, "a.b");
      assert.equal(composed.replace_in_object[1].target.path, "a.b");
      assert.equal(composed.rename_in_object[1].target.path, "a.b");

    },

    "test: on insert-into-object": function() {
      var P1 = new PUL();
      var P2 = new PUL();
      var target = {
        collection: "c",
        key: 1
      };

      P1.addUpdatePrimitive(UPFactory.insert_into_object(target,{b: 1, a: {b: {}}}));
      target.path = "c";
      P1.addUpdatePrimitive(UPFactory.insert_into_object(target, {a: 1}));

      //  This UP should remove a in the value of the first iio above 
      delete target["path"];
      P2.addUpdatePrimitive(UPFactory.delete_from_object(target, "a"));

      // This UP should make the second iio above disappear
      target.path = "c";
      P2.addUpdatePrimitive(UPFactory.delete_from_object(target, "a"));

      var composed = testComposition(P1,P2);
      assert.equal(composed.numUps(), 1);
      assert.ok(objsEqual(composed.insert_into_object[0].params[0], {b:1}));


      P2 = new PUL();
      delete target["path"];
      //  These UPs should modify the value in the 1. iio above
      P2.addUpdatePrimitive(UPFactory.replace_in_object(target, "b", {}));
      P2.addUpdatePrimitive(UPFactory.rename_in_object(target, "b", "x"));
      
      target.path = "a.b";
      P2.addUpdatePrimitive(UPFactory.insert_into_object(target, {c:1, d:2}));

      composed = testComposition(P1,P2);
      assert.equal(composed.numUps(), 2);
      assert.ok(objsEqual(composed.insert_into_object[0].params[0], {x:{}, a: {b: {c:1,d:2}}}));
      assert.ok(objsEqual(composed.insert_into_object[1].params[0], {a: 1}));
    },

    "test: on replace-in-object": function() {
      var P1 = new PUL();
      var P2 = new PUL();
      var target = {
        collection: "c",
        key: 1
      };

      P1.addUpdatePrimitive(UPFactory.replace_in_object(target,"a", {b: 0, c: {}}));
      P1.addUpdatePrimitive(UPFactory.replace_in_object(target,"b", {b: 0}));

      // Should change 1st replace value to {c: {}}
      target.path = "a";
      P2.addUpdatePrimitive(UPFactory.delete_from_object(target, "b"));

      // Should make the 2nd replace disappear
      // Should be added to the PUL
      target.path = "";
      P2.addUpdatePrimitive(UPFactory.delete_from_object(target, "b"));

      var composed = testComposition(P1,P2);
      assert.equal(composed.numUps(), 2);
      assert.ok(objsEqual(composed.replace_in_object[0].params[1], {c: {}}));


      P2 = new PUL();
      //  These UPs should modify the value in the 1. rio above
      target.path = "a";
      P2.addUpdatePrimitive(UPFactory.replace_in_object(target, "b", 1));
      P2.addUpdatePrimitive(UPFactory.rename_in_object(target, "b", "x"));
      
      target.path = "a.c"; 
      P2.addUpdatePrimitive(UPFactory.insert_into_object(target, {d:0, e:0}));

      composed = testComposition(P1,P2);
      assert.equal(composed.numUps(), 2);
      assert.ok(objsEqual(composed.replace_in_object[0].params[1], {x:1, c: {d:0, e:0}}));
      assert.ok(objsEqual(composed.replace_in_object[1].params[1], {b: 0}));
    },

    "test: on insert": function() {
      var P1 = new PUL();
      var P2 = new PUL();
      var target = {
        collection: "c"
      };

      P1.addUpdatePrimitive(UPFactory.insert(target,[{id: 1}]));
      P1.addUpdatePrimitive(UPFactory.insert(target,[{id: 2}]));
      P1.addUpdatePrimitive(UPFactory.insert(target,[{id: 3}]));

      target.collection = "d";
      P1.addUpdatePrimitive(UPFactory.insert(target, [{id:1}]));
     

      // This UP should remove the 1. and 3. insert above 
      // (remove from the items list of the insert up)
      target.collection = "c";
      target.key = 1;
      P2.addUpdatePrimitive(UPFactory.del(target, [1,3]));

      // This UP should remove the 4. insert above
      target.collection = "d";
      P2.addUpdatePrimitive(UPFactory.del(target, [1]));

      var composed = testComposition(P1,P2);
      assert.equal(composed.numUps(), 1);
      assert.equal(composed.insert[0].params[0].length, 1);
      assert.ok(objsEqual(composed.insert[0].params[0][0], {id: 2}));


      target.collection = "c";
      P1 = new PUL();
      P1.addUpdatePrimitive(UPFactory.insert(target,[{id: 1, a: 0, y: 0}]));
      
      P2 = new PUL();
      target.key = 1;
      //  These UPs should modify the value in the 1. insert above
      P2.addUpdatePrimitive(UPFactory.replace_in_object(target, "a", 1));
      P2.addUpdatePrimitive(UPFactory.rename_in_object(target, "a", "x"));
      P2.addUpdatePrimitive(UPFactory.insert_into_object(target, {b: 2, c: 3}));
      P2.addUpdatePrimitive(UPFactory.delete_from_object(target, "y"));

      composed = testComposition(P1,P2);
      assert.equal(composed.numUps(), 1);
      assert.ok(objsEqual(composed.insert[0].params[0][0], {id:1, x:1, b:2, c:3}));
    }
  }
});

if (typeof module !== "undefined" && module === require.main) {
  require("asyncjs").test.testcase(module.exports).exec()
}
