/**
 * JS module that implements JSONiq update primitives using IndexedDB as backend
 */
define(function(require, exports, module){

  var Utils = require('./utils').Utils;
  require('./underscore');

  /*
   * Pending Update List
   */
  var PendingUpdateList = exports.PendingUpdateList = function(){

    /* List of all update primitives */
    this.ups = function(){
      return [].concat(this.del).concat(this.insert).
  concat(this.insert_into_object).concat(this.delete_from_object).
  concat(this.insert_into_array).concat(this.delete_from_array).
  concat(this.updates);
    }

    this.del = [];
    this.insert = [];
    this.insert_into_object = [];
    this.delete_from_object = [];
    this.insert_into_array = [];
    this.delete_from_array = [];
    this.updates = [];

    this.addUpdatePrimitive = function(up){
      var upCopy = JSON.parse(JSON.stringify(up));
      var type = upCopy.type;
      var addFunc = this["addUp_" + type];
      if (addFunc){
        addFunc.call(this,up);
      }else{ 
        console.log("Warning: Adding update primitive (" + type  + ") without normalization handler");
        this.updates.push(upCopy);
      }
    };

    this.addUp_insert = function(up){
      // Add items to insert update primitive with same target collection,
      // if found. Else add a new insert update primitive.
      var selector = [{key: "target", value: up.target}];
      var curIns = this.findUpdate(up.type, selector, this.insert);
      var upItems = up.params[0];
      if (curIns){
        for (var i = 0; i < upItems.length; i++){
          var curItem = upItems[i];
          if (!curIns.idMap[curItem.id]){
            curIns.idMap[curItem.id] = true;
            curIns.params[0].push(curItem);
          }else{
            console.log("Warning: Multiple inserts of item with same id ("+
                curItem.id + ") on collection " + up.target.collection); 
          }
        }
      }else{
        var idMap = {};
        for (var i = 0; i < upItems.length; i++){
          idMap[upItems[i].id] = true;
        }
        up.idMap = idMap;
        this.insert.push(up);
      }
    };

    this.addUp_del = function(up){
      // Add ids to del update primitive with same target collection,
      // if found. Else add a new del update primitive.
      var selector = [{key: "target", value: up.target}];
      var curDel = this.findUpdate(up.type, selector, this.del);
      var upIds = up.params[0];
      if (curDel){
        for (var i = 0; i < upIds.length; i++){
          var curId = upIds[i];
          if (!curDel.idMap[curId]){
            curDel.idMap[curId] = true;
            curDel.params[0].push(curItem);
          }else{
            console.log("Warning: Multiple inserts of item with same id ("+
                curItem.id + ") on collection " + up.target.collection); 
          }
        }
      }else{
        var idMap = {};
        for (var i = 0; i < upIds.length; i++){
          idMap[upIds[i]] = true;
        }
        up.idMap = idMap;
        this.del.push(up);
      }    
    };

    this.addUp_delete_from_object = function(up){
      // Add names (removing duplicates) to delete-from-object update
      // primitive with same target, if found.
      // Else add a new delete-from-object update primitive.
      for (var i = 0; i < this.delete_from_object.length; i++){
        var curDel = this.delete_from_object[i];
        if (Utils.targetsEqual(curDel.target, up.target)){
          curDel.params[0] = _.uniq(curDel.params[0].concat(up.params[0]));
          return;
        }
      }
      this.delete_from_object.push(up);
    };

    this.addUp_replace_in_object = 
      this.addUp_rename_in_object = function(up){
        // Multiple UPs of this type with the same (object,name) target raise an 
        // error.
        var selector = [{key: "target", value: up.target}, 
        {key: "params", index: 0, value: up.params[0]}];
        if (this.findUpdate("replace_in_object", selector, this.updates)){
          console.err(
              "Error: Multiple " + up.type + " update primitives with same target");
        }else{
          this.updates.push(up);
        }
      };

    this.addUp_insert_into_array = function(up){
      // Multiple UPs of this type with the same (array,index) target are merged
      // into one UP with this target, where the items are merged.
      var selector = [{key: "target", value: up.target}, 
          {key: "params", index: 0, value: up.params[0]}];
      var insertUp = this.findUpdate(up.type, selector, this.insert_into_array);
      if (insertUp){
        // Concat items lists
        insertUp.params[1] = insertUp.params[1].concat(up.params[1]);
      }else{
        // Append UP
        this.insert_into_array.push(up);
      }
    };

    this.addUp_delete_from_array = function(up){
      // Multiple UPs of this type with the same (array,index) target are merged
      // into one UP with this target.
      var selector = [{key: "target", value: up.target}, 
          {key: "params", index: 0, value: up.params[0]}];
      if (!this.findUpdate(up.type, selector, this.delete_from_array)){
        // Append UP
        this.delete_from_array.push(up);
      }
    };

    this.addUp_replace_in_array = function(up){
      // Multiple UPs of this type with the same (array,index) target raise an
      // error.
      var selector = [{key: "target", value: up.target}, 
          {key: "params", index: 0, value: up.params[0]}];
      if(this.findUpdate(up.type, selector, this.updates)){
        console.err(
            "Error: Multiple " + up.type + " update primitives with same target");
      }else{
        // Append UP
        this.updates.push(up);
      }
    };



    this.findUpdate = function(upType, selector, upCollection){
      for (var i = 0; i < upCollection.length; i++){
        var curUp = upCollection[i];
        if (curUp.type === upType){
          for (var j = 0; j < selector.length; j++){
            if (!this.evalSelector(curUp, selector[j])){
              continue;
            }
            return curUp;
          }
        }
      }
    };

    this.evalSelector = function(up, selector){
      var upValue = up[selector.key];
      if (selector.index){
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
  
