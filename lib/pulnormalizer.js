
/**
 * PUL Normalizer / Validator
 */ 
define(function(require, exports, module){

  var Utils = require('./utils').Utils;
  var PUL = require('./pul').PendingUpdateList;
  var _ = require('./underscore');

  /*
   * Pending Update List
   */
  var PULNormalizer = exports.PULNormalizer = function(){

    this.error = null;

    /**
     * Normalize and statically validate PUL
     */
    this.normalize = function(inputPul){
      var p = new PUL(this);      
      var ups = inputPul.ups();
      for(var i = 0; !this.error && i < ups.length; i++){
        p.addUpdatePrimitive(ups[i]);
      }
      if (this.error){
        p.error = this.error;
        return p;
      }
      return this.finalizePUL(p);
    };


    /**
     * Finalize a valid, normalized PUL. The output is a PUL that is ready
     * to be applied by applyPul().
     * Removes duplicate ids in jupd:delete primitives.
     * Removes duplicate names from jupd:delete-from-object primitives.
     * Removes jupd:replace-in-object, jupd:rename-in-object and
     *         jupd:replace-in-array primitives that have the same target as
     *         a jupd:delete-from-object/jupd:delete-from-array primitive
     *         (i.e. they are non-effective).
     * Orders jupd:*-array primitives right-to-left w.r.t. their selectors
     *
     */
    this.finalizePUL = function(pul){
      // 1. Duplicate Removal
      // Remove duplicate delete ids
      pul.del.forEach(function(curUp){
        curUp.params[0] = _.uniq(curUp.params[0]);
      });
      // Remove duplicate delete-from-object names 
      pul.delete_from_object.forEach(function(curUp){
        curUp.params[0] = _.uniq(curUp.params[0]);
      });

      // 2. Non-effective UPs Removal
      var targets = this.computeTargets(pul);
      var delTargets = targets.delete_from_object_selected;
      var arrDelTargets = targets.delete_from_array;
      var removeNonEffective = function(upd){
        var isArray = /array$/.test(upd.type);
        for (var i = upd.length-1; i >= 0; --i){
          var curTarget = 
            Utils.serializeTarget(upd[i].target, upd[i].params[0], isArray);
          var removed = false;
          for (var j = 0; j < delTargets.length && !removed; j++){
            if (Utils.containsTarget(delTargets[j], curTarget)){
              upd.splice(i,1);
              removed = true;
            } 
          }
          if (isArray && upd.type !== "insert_into_array"){
            for (var j = 0; j < arrDelTargets.length && !removed; j++){
              if (Utils.containsTarget(arrDelTargets[j], curTarget)){
                upd.splice(i,1);
                removed = true;
              }
            }
          }
        }
      };

      // Remove non-effective replace/rename-in-object update primitives
      removeNonEffective(pul.replace_in_object);
      removeNonEffective(pul.rename_in_object);

      // Remove non-effectve array update primitives
      removeNonEffective(pul.replace_in_array);
      removeNonEffective(pul.insert_into_array);

      // 3. Ordering
      var orderByIndex = function(upd){
        _.sortBy(upd, function(curUpd){
          return -curUpd.params[0];
        });
      };

      orderByIndex(pul.replace_in_array);
      orderByIndex(pul.delete_from_array);
      orderByIndex(pul.insert_into_array);

      return pul;
    };

    /*
     * Returns a targets object that contains for each kind of UP
     * in the input pul the (serialized) targets that appear. 
     */
    this.computeTargets = function(pul){
      var targets = {
        insert: [],
        del: [],
        delete_from_object: [], // The targets without selectors
        delete_from_object_selected: [], // The targets with selectors
        insert_into_object: [],
        replace_in_object: [], // The targets without selectors
        replace_in_object_selected: [], // The targets with selectors
        rename_in_object: [], // The targets without selectors
        rename_in_object_selected: [], // The targets with selectors
        insert_into_array: [],
        delete_from_array: [],
        replace_in_array: []
      };

      for (var i = 0; i < pul.insert.length; i++){
        targets.insert.push(pul.insert[i].target.collection);
      }
      for (var i = 0; i < pul.del.length; i++){
        targets.del.push(pul.del[i].target.collection);
      }
      var upd = pul.insert_into_object;
      for (var i = 0; i < upd.length; i++){
        targets.insert_into_object.push(Utils.serializeTarget(upd[i].target));
      }
      upd = pul.delete_from_object;
      for (var i = 0; i < upd.length; i++){
        var target = upd[i].target;
        targets.delete_from_object.push(Utils.serializeTarget(target));
        upd[i].params[0].forEach(function(name){
          targets.delete_from_object_selected.push(
            Utils.serializeTarget(target,name));
        });   
      }
      upd = pul.replace_in_object;
      for (var i = 0; i < upd.length; i++){
        var target = upd[i].target;
        targets.replace_in_object.push(Utils.serializeTarget(target));
        targets.replace_in_object_selected.push(
            Utils.serializeTarget(target, upd[i].params[0]));
      }
      upd = pul.rename_in_object;
      for (var i = 0; i < upd.length; i++){
        var target = upd[i].target;
        targets.rename_in_object.push(Utils.serializeTarget(target));
        targets.rename_in_object_selected.push(
            Utils.serializeTarget(target, upd[i].params[0]));
      }
      upd = pul.insert_into_array;
      upd.forEach(function(curUp){
        targets.insert_into_array.push(
          Utils.serializeTarget(curUp.target)+":"+curUp.params[0]);            
      });
      upd = pul.delete_from_array;
      upd.forEach(function(curUp){
        targets.delete_from_array.push(
          Utils.serializeTarget(curUp.target)+":"+curUp.params[0]);            
      });
      upd = pul.replace_in_array;
      upd.forEach(function(curUp){
        targets.replace_in_array.push(
          Utils.serializeTarget(curUp.target)+":"+curUp.params[0]);            
      });
      return targets;
    };

    this.addUp_insert = function(pul, up){
      // Add items to insert update primitive with same target collection,
      // if found. Else add a new insert update primitive.
      var selector = [{key: "target", value: up.target}];
      var curIns = this.findUpdate(up.type, selector, pul.insert);
      var upItems = up.params[0];
      if (curIns){
        for (var i = 0; i < upItems.length; i++){
          var curItem = upItems[i];
          if (!curIns.idMap[curItem.id]){
            if (curItem.id){
              curIns.idMap[curItem.id] = true;
            }
            curIns.params[0].push(curItem);
          }else{
            this.error = "Multiple inserts of item with same id ("+
                curItem.id + ") on collection " + up.target.collection;
            return;
          }
        }
      }else{
        var idMap = {};
        for (var i = 0; i < upItems.length; i++){
          if (upItems[i].id !== undefined){
            idMap[upItems[i].id] = true;
          }
        }
        up.idMap = idMap;
        pul.insert.push(up);
      }
    };

    this.addUp_del = function(pul,up){
      // Add ids to del update primitive with same target collection,
      // if found. Else add a new del update primitive.
      var selector = [{key: "target", value: up.target}];
      var curDel = this.findUpdate(up.type, selector, pul.del);
      var upIds = up.params[0];
      if (curDel){
        curDel.params[0] = curDel.params[0].concat(upIds);
      }else{
        pul.del.push(up);
      }
    };

    this.addUp_insert_into_object = function(pul,up){
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

  /*
   * Update Primitive
   *
   * @param {String} type The type of the Update Primitive, a function
   * in IJSONiq.js 
   * @param {String} target The target of the Update Primitive 
   * @param {Object} params Other parameters of the Update Primitive
   */
  var UpdatePrimitive = exports.UpdatePrimitive = function(type, target, params){
    this.type = type;
    this.target = target;
    this.params = params;
  }; 

  var UPFactory = exports.UPFactory = {
    insert: function(target, items){
      target = target.collection ? target : {collection: target};
      var params = [items];
      return new UpdatePrimitive("insert", target, params);
    },

    del: function(target, ids){
      var params = [ids];
      return new UpdatePrimitive("delete", target, params);
    },

    insert_into_object: function(target, source){
      var params = [source];
      return new UpdatePrimitive("insert_into_object", target, params);
    },

    delete_from_object: function(target, names){
      var params = [names];
      return new UpdatePrimitive("delete_from_object", target, params);
    },

    replace_in_object: function(target, name, item){
      var params = [name, item];
      return new UpdatePrimitive("replace_in_object", target, params);
    },

    rename_in_object: function(target, name, newName){
      var params = [name, newName];
      return new UpdatePrimitive("rename_in_object", target, params);
    },

    insert_into_array: function(target, index, source){
      var params = [index, source];
      return new UpdatePrimitive("insert_into_array", target, params);
    },

    delete_from_array: function(target, index){
      var params = [index];
      return new UpdatePrimitive("delete_from_array", target, params);
    },

    replace_in_array: function(target, index, item){
      var params = [index, item];
      return new UpdatePrimitive("replace_in_array", target, params);
    },

    upNoop: function(){
      return new UpdatePrimitive("upNoop");
    },


    /**
     * Return an array of update primitives that lead from newObj to oldObj 
     * when applied
     */
    upInvert: function(target, oldObj, newObj){
      // NOTE this is brute-force overwriting, we could instead compute the
      // diff between old/newObject and update primitives reflecting this diff
      return [this.insert(target, [oldObj])];
    }

  };

});
  
