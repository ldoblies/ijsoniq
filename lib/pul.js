/**
 * JS module that implements JSONiq update primitives using IndexedDB as backend
 */
define(function(require, exports, module){

  var Utils = require('./utils').Utils;

  /*
   * Pending Update List
   */
  var PendingUpdateList = exports.PendingUpdateList = function(){

    /* List of all update primitives */
    this.ups = function(){
      return [].concat(this.dels).concat(this.inserts).concat(this.updates);
    }

    this.dels = [];
    this.inserts = [];
    this.updates = [];

    this.addUpdatePrimitive = function(up){
      var upCopy = JSON.parse(JSON.stringify(up));
      var type = upCopy.type;
      if (type == "insert"){
        this.addInsertUp(upCopy);
      }else if(type == "del"){
        this.addDelUp(upCopy);
      }else{
        this.updates.push(upCopy);
      }
    };

    this.addInsertUp = function(up){
      // Add items to insert update primitive with same target collection,
      // if found. Else add a new insert update primitive.
      for (var i in this.inserts){
        var curIns = this.inserts[i];
        if (curIns.target.collection == up.target.collection){
          for (var j in up.items){
            var curItem = up.items[j];
            if (!curIns.idMap[curItem.id]){
              curIns.idMap[curItem.id] = true;
              curIns.items.push(curItem);
            }
          }
          return;
        }
      }
      var idMap = {};
      for (var i in up.items){
        idMap[up.items[i].id] = true;
      }
      up.idMap = idMap;
      this.inserts.push(up);
    };

    this.addDelUp = function(up){
      // Add ids to del update primitive with same target collection,
      // if found. Else add a new del update primitive.
      for (var i in this.dels){
        var curDel = dels[i];
        if (curDel.target.collection == up.target.collection){
          for (var j in up.ids){
            var curId = up.ids[j];
            if (!curDel.idMap[curId]){
              curDel.idMap[curId] = true;
              curDel.ids.push(curId);
            }
          }
          return;
        }
      }
      var idMap = {};
      for (var i in up.ids){
        idMap[up.ids[i]] = true;
      }
      up.idMap = idMap;
      this.dels.push(up);     
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
