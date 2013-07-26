/**
 * PUL data structures 
 */
define(function(require, exports, module){

  var Utils = require('./utils').Utils;

  /*
   * Pending Update List
   */
  var PendingUpdateList = exports.PendingUpdateList = function(handler){

    /* List of all update primitives */
    this.ups = function(){
      return this.replace_in_object.concat(this.delete_from_object).
        concat(this.rename_in_object).concat(this.insert_into_object).
        concat(this.replace_in_array).concat(this.delete_from_array).
        concat(this.insert_into_array).concat(this.del).
        concat(this.insert);
    };

    this.del = [];
    this.insert = [];
    this.insert_into_object = [];
    this.delete_from_object = [];
    this.replace_in_object = [];
    this.rename_in_object = [];
    this.insert_into_array = [];
    this.delete_from_array = [];
    this.replace_in_array = [];

    this.addUpdatePrimitive = function(up){
      var upCopy = JSON.parse(JSON.stringify(up));
      var type = upCopy.type;
      var addFunc = handler ? handler["addUp_" + type] : null;
      if (addFunc){
        addFunc.call(handler,this,up);
      }else{ 
        if (handler){
          console.log("Warning: Adding update primitive (" + type + ") without handler function");
        }
        this[type].push(upCopy);
      }
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
      var t = target.collection ? JSON.parse(JSON.stringify(target)) : {collection: target};
      delete t.key;
      delete t.path;
      
      var params = [items];
      return new UpdatePrimitive("insert", t, params);
    },

    del: function(target, ids){
      var t = target.collection ? JSON.parse(JSON.stringify(target)) : {collection: target};
      delete t.key;
      delete t.path;
      var params = [ids];
      return new UpdatePrimitive("del", target, params);
    },

    insert_into_object: function(target, source){
      Utils.normalizeTarget(target);
      var params = [source];
      return new UpdatePrimitive("insert_into_object", target, params);
    },

    delete_from_object: function(target, names){
      Utils.normalizeTarget(target);
      var params = [names];
      return new UpdatePrimitive("delete_from_object", target, params);
    },

    replace_in_object: function(target, name, item){
      Utils.normalizeTarget(target);
      var params = [name, item];
      return new UpdatePrimitive("replace_in_object", target, params);
    },

    rename_in_object: function(target, name, newName){
      Utils.normalizeTarget(target);
      var params = [name, newName];
      return new UpdatePrimitive("rename_in_object", target, params);
    },

    insert_into_array: function(target, index, items){
      Utils.normalizeTarget(target);
      var params = [index, items];
      return new UpdatePrimitive("insert_into_array", target, params);
    },

    delete_from_array: function(target, index){
      Utils.normalizeTarget(target);
      var params = [index];
      return new UpdatePrimitive("delete_from_array", target, params);
    },

    replace_in_array: function(target, index, item){
      Utils.normalizeTarget(target);
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
      Utils.normalizeTarget(target);
      // NOTE this is brute-force overwriting, we could instead compute the
      // diff between old/newObject and update primitives reflecting this diff
      return [this.insert(target, [oldObj])];
    }

  };

});
  
