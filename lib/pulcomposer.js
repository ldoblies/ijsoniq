/**
 * PUL Composer
 */ 
define(function(require, exports, module){

  var Utils = require('./utils').Utils;
  var PUL = require('./pul').PendingUpdateList;
  var _ = require('./underscore') || window._;

  /**
   * Composer (UP-Handler for a PUL that is to be composed with the incoming 
   * UPs). Assuming that the two PULs are serial, i.e., the right-hand-side PUL
   * was created from the database state after the left-hand-side PUL was 
   * applied. 
   */
  var PULComposer = exports.PULComposer = function(){

    this.error = null;

    /**
     * Compose pul1, pul2. pul2 is the right-hand-side PUL for composition.
     * Both pul1 and pul2 are normalized PULs.
     */
    this.compose = function(pul1, pul2){
      var p = JSON.parse(JSON.stringify(pul1));
      if (p.error || !p.isNormalized){         
        p.error = "Invalid left-hand-side PUL for composition";
        return p;
      }else if (pul2.error || !pul2.isNormalized){
        p.error = "Invalid right-hand-side PUL for composition";
        return p;
      }
      p.setHandler(this);
      var ups = pul2.ups();
      for(var i = 0; !this.error && i < ups.length; i++){
        p.addUpdatePrimitive(ups[i]);
      }
      if (this.error){
        p.error = this.error;
        return p;
      }
      this.finalize(p);
      return p;
    };

    this.finalize = function(pul){
      // TODO remove idMap2, remove UPs that are empty (empty insert, del)
      // remove delIds2

    };

    // If pul introduces the target (or any of its ancestors) of up, return 
    // the update primitive in the pul that introduces it. Otherwise return 
    // undefined. 
    this.getAggregationTarget = function(pul, up){
      // Insert/delete ups are handled separately - they don't require
      // aggregation 
      if (up.type === "insert" || up.type === "del"){ return; }
      var upTarget = up.effectiveTarget(); // Needed for replace/rename 
      if (pul.dirty || !pul.introducedTargets){
        pul.introducedTargets = pul.computeIntroducedTargets();
        pul.dirty = false;
      }
      for (var i = 0; i < pul.introducedTargets.length; i++){
        if (Utils.containsTarget(pul.introducedTargets[i].target, upTarget)){
          return pul.introducedTargets[i].up;
        }
      }
    };

    this.addUp_insert = function(pul, up){
      // Add items to insert update primitive with same target collection,
      // if found. Else add a new insert update primitive. On primary key
      // collision of items, replace the old item with the incoming one.
      pul.dirty = true;
      var selector = [{key: "target", value: up.target}];
      var curIns = this.findUpdate(up.type, selector, pul.insert);
      var upItems = up.params[0];
      if (curIns){
        if (!curIns.idMap2){
          // The list of ids that come from P2
          curIns.idMap2 = {};
        }
        for (var i = 0; i < upItems.length; i++){
          var curItem = upItems[i];
          curIns.idMap2[curItem.id] = true;
          if (!curIns.idMap[curItem.id]){
            // Item with new (or no) primary key
            if (curItem.id){
              curIns.idMap[curItem.id] = true;
            }
            curIns.params[0].push(curItem);
          }else{
            // Primary key collision
            // Replace old item having the same primary key
            for (var j = 0; j < curIns.params[0].length; j++){
              if (curIns.params[0][j].id === curItem.id){
                curIns.params[0][j] = curItem;
                break;
              }
            }
            // If there is no delete in P1 on the collision key, omit delete
            // from P2 on this key
            // XXX Assuming deletes are composed before inserts!
            var curDel = this.findUpdate("del", selector, pul.del);
            var foundDel = false;
            if (curDel){
              if (curDel.delIds2[curItem.id]){
                foundDel = true;
                delete curDel.delIds2[curItem.id];
                curDel.params[0] = _.reject(curDel.params[0], function(curId){
                  return curId === curItem.id;
                });
              }
            }
            if (!foundDel){
              console.err("Warning: Primary key collison on " + 
                  JSON.stringify(up.target), + ", missing delete in P2");
            }
          }
        }
      }else{
        var idMap = {};
        var idMap2 = {};
        for (var i = 0; i < upItems.length; i++){
          if (upItems[i].id !== undefined){
            idMap[upItems[i].id] = true;
            idMap2[upItems[i].id] = true;
          }
        }
        up.idMap = idMap;
        up.idMap2 = idMap2;
        pul.insert.push(up);
      }
    };

    this.addUp_del = function(pul,up){
      // Add ids to del update primitive with same target collection,
      // if found. Else add a new del update primitive.
      // If there is an insert present in the pul of a document with an
      // id to be deleted, remove that insert item if it comes from P1.
      pul.dirty = true;
      var selector = [{key: "target", value: up.target}];
      var curDel = this.findUpdate(up.type, selector, pul.del);
      var upIds = up.params[0];
      if (curDel){
        if (!curDel.delIds2){
          // DelIds from P2
          curDel.delIds2 = {};
        }
        upIds.forEach(function(curId){
          curDel.delIds2.curId = true;
        });
        curDel.params[0] = curDel.params[0].concat(upIds);
      }else{ 
        if (!up.delIds2){
          up.delIds2 = {};
        } 
        up.params[0].forEach(function(curId){
          up.delIds2.curId = true;
        });
        pul.del.push(up);
      }
      var curInsert = this.findUpdate(up.type, selector, pul.insert); 
      if (curInsert){
        // There is an insert UP on the same collection as the delete UP.
        // Remove all items from the insert UP that have a primary key in 
        // the ids of the delete UP and come from P1.
        upIds.forEach(function(delId){
          if (curInsert.idMap[delId] && !curInsert.idMap2[delId]){
            delete curInsert.idMap[delId];
            for (var i = 0; i < curInsert.params[0].length; i++){
              if (curInsert.params[0][i].id === delId){
                curInsert.params[0].splice(i,1);
                break;
              }
            }
          }
        });
      }
    };


    this.addUp_insert_into_object = function(pul,up){
      pul.dirty = true;
      var targetUp = this.getAggregationTarget(pul, up);
      if (targetUp){
        // Aggregation case

      } else {
        // Accumulation case: like normalization
        // Add (key,value) pairs to object of UP with same target, if found.
        // Else add a new insert-into-object update primitive.
        var selector = [{key: "target", value: up.target}];
        var curIns = this.findUpdate(up.type, selector, pul.insert_into_object);
        if (curIns){
          var keys1 = Object.keys(curIns.params[0]);
          var keys2 = Object.keys(up.params[0]);
          var conflictKeys = _.intersection(keys1,keys2);
          if (conflictKeys.length){
            this.error = "Key conflict for insert-into-object UPs with target "
              + Utils.serializeTarget(up.target) + " on keys: " + conflictKeys;
            return;
          }
          keys2.forEach(function(key){
            curIns.params[0][key] = up.params[0][key];
          }); 
        }else{
          pul.insert_into_object.push(up);
        }

      }
    };

    this.addUp_delete_from_object = function(pul,up){
      // Add names to delete-from-object update primitive with same target, 
      // if found. Else add a new delete-from-object update primitive.
      for (var i = 0; i < pul.delete_from_object.length; i++){
        var curDel = pul.delete_from_object[i];
        if (Utils.targetsEqual(curDel.target, up.target)){
          curDel.params[0] = curDel.params[0].concat(up.params[0]);
          return;
        }
      }
      pul.delete_from_object.push(up);
    };

    this.addUp_replace_in_object = 
      this.addUp_rename_in_object = function(pul, up){
        pul.dirty = true;
        // Multiple UPs of this type with the same (object,name) target raise an 
        // error.
        var selector = [{key: "target", value: up.target}, 
        {key: "params", index: 0, value: up.params[0]}];
        if (this.findUpdate(up.type, selector, pul[up.type])){
          this.error = "Multiple " + up.type + 
            " update primitives with same target: " + 
            Utils.serializeTarget(up.target, up.params[0]);
        }else{
          pul[up.type].push(up);
        }
      };

    this.addUp_insert_into_array = function(pul,up){
      // Multiple UPs of this type with the same (array,index) target are merged
      // into one UP with this target, where the items are merged.
      var selector = [{key: "target", value: up.target}, 
          {key: "params", index: 0, value: up.params[0]}];
      var insertUp = this.findUpdate(up.type, selector, pul.insert_into_array);
      if (insertUp){
        // Concat items lists
        insertUp.params[1] = insertUp.params[1].concat(up.params[1]);
      }else{
        // Append UP
        pul.insert_into_array.push(up);
      }
    };

    this.addUp_delete_from_array = function(pul,up){
      // Multiple UPs of this type with the same (array,index) target are merged
      // into one UP with this target.
      var selector = [{key: "target", value: up.target}, 
          {key: "params", index: 0, value: up.params[0]}];
      if (!this.findUpdate(up.type, selector, pul.delete_from_array)){
        // Append UP
        pul.delete_from_array.push(up);
      } // Else nothing to do, UP was already present
    };

    this.addUp_replace_in_array = function(pul,up){
      // Multiple UPs of this type with the same (array,index) target raise an
      // error.
      var selector = [{key: "target", value: up.target}, 
          {key: "params", index: 0, value: up.params[0]}];
      if(this.findUpdate(up.type, selector, pul.replace_in_array)){
        this.error = "Multiple " + up.type + " update primitives with same target";
      }else{
        // Append UP
        pul.replace_in_array.push(up);
      }
    };

    this.findUpdate = function(upType, selector, upCollection){
      for (var i = 0; i < upCollection.length; i++){
        var curUp = upCollection[i];
        if (curUp.type === upType){
          var found = true;
          for (var j = 0; j < selector.length && found; j++){
            if (!this.evalSelector(curUp, selector[j])){
              found = false;
            }
          }
          if (found) { return curUp; }
        }
      }
    };

    this.evalSelector = function(up, selector){
      var upValue = up[selector.key];
      if (selector.index !== undefined){
        upValue = upValue[selector.index];
      }
      if (selector.key === "target"){
        return Utils.targetsEqual(upValue, selector.value);
      }
      return upValue === selector.value;
    };
  };

});
