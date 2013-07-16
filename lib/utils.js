
define(function(require, exports, module){

  //var Utils = require('./utils').Utils;
  //var fs = require('fs');

  var Utils = exports.Utils = {


    curKey: function(key){
      return key.split('.')[0];
    },

    nextKey: function(key){
      if (key.indexOf('.') == -1){
        return "";
      }
      return key.substring(key.indexOf('.') + 1);
    },    

    lastKey: function(key){
      if (key.indexOf('.') == -1){
        return key;
      }else{
        return key.substring(key.lastIndexOf('.') + 1);
      }
    },

    /**
     * Returns true iff obj.key is present, where key is a JSON 
     * path separated by '.'.
     */
    hasKey: function(obj, key){ 
      var obj = this.getContainingObject(obj, key);
      return obj && this.lastKey(key) in obj;
    },

    getContainingObject: function(obj, key, addIfNeeded){
      var curKey = this.curKey(key);
      if (curKey === key){
        return obj;
      }
      if (!obj[curKey]){
        if (!addIfNeeded){
          return;
        }else{
          obj[curKey] = {};
        }
      }else if (typeof(obj[curKey]) !== 'object'){
        return;
      }
      return this.getContainingObject(obj[curKey], this.nextKey(key), addIfNeeded);
    },

    getObject: function(obj, key){
      var cont = this.getContainingObject(obj, key);
      var lastKey = this.lastKey(key);
      if (!cont || !(lastKey in cont)){
        return;
      }
      return cont[lastKey];
    },

    set: function(obj, key, val){
      var target = this.getContainingObject(obj, key, true);     
      if (!target){
        return;
      }
      target[this.lastKey(key)] = val;
      return obj;
    },

    unset: function(obj, key){
      var target = this.getContainingObject(obj, key);
      if (target){
        delete target[this.lastKey(key)];
      }
      return obj;
    },

    update: function(obj, key, val, okIfNotFound){
      if (!this.getContainingObject(obj, key)){
        if (okIfNotFound){
          return true;
        }
        return;     
      }else{
        return this.set(obj,key,val);
      }
    },

    replace: function(obj, key, val){
      if (!key){
        // Replace whole object
        var keys = Object.keys(obj);
        for (i in keys){
          delete obj[keys[i]];
        }
        var kvPairs = this.getKeyValuePairs(val);
        for (i in kvPairs){
          obj[kvPairs[i].key] = kvPairs[i].val;
        }
        return obj;
      }else{
        return this.update(obj, key, val, true);      
      }
    },

    rename: function(obj, key, val){
      var cont = this.getContainingObject(obj, key);
      var lastKey = this.lastKey(key);
      if (cont && lastKey in cont){
        cont[val] = cont[lastKey];
        delete cont[lastKey];
      }
      return true;
    },
    

    isValidInsertIndex: function(arr, index){
      return arr instanceof Array && index >= 0 && index <= arr.length;
    },

    isValidIndex: function(arr, index){
      return arr instanceof Array && index >= 0 && index < arr.length;
    },
    
    arrayInsert: function(obj, key, index, items){
      var cont = this.getContainingObject(obj, key);
      var targetArr = cont[this.lastKey(key)];
      if (!targetArr || !(this.isValidInsertIndex(targetArr, index))){
        return false;
      }
      var newArr = targetArr.slice(0, index);
      newArr = newArr.concat(items);
      newArr = newArr.concat(targetArr.slice(index, targetArr.length));
      cont[this.lastKey(key)] = newArr;
      return true;
    },

    arrayDelete: function(obj, key, index){
      var cont = this.getContainingObject(obj, key);
      var targetArr = cont[this.lastKey(key)];
      if (!targetArr || !(this.isValidIndex(targetArr, index))){
        return false;
      }
      targetArr.splice(index, 1);
      return true;
    },

    arrayReplace: function(obj, key, index, val){
      var cont = this.getContainingObject(obj, key);
      var targetArr = cont[this.lastKey(key)];
      if (!targetArr || !(this.isValidIndex(targetArr, index))){
        return false;
      }
      targetArr[index] = val;
      return true;
    },  

    getKeyValuePairs: function(src){
      var res = [];
      for (var key in src) {
        var obj = src[key];
        if (src.hasOwnProperty(key)){
          res.push({key: key, val: obj});
        }
      }
      return res;
    },

    /**
     * Parse a database object ID from a Collection:Key[:Path] string
     */
    parseDBObjectID: function(idString){
      var parts = idString.split(':');       
      var ret = {};
      if (parts.length < 2 || parts.length > 3){
        console.log("Error: Invalid ID " + idString);
        return;
      }
      
      ret.collection = parts[0];
      ret.key = parseInt(parts[1]);
      ret.path = parts[2]; // undefined if no path     
      // TODO sanity checks
      return ret;
    },


    /**
     * Serialize a database object ID into a Collection:Key[:Path] string
     */
    serializeDBObjectID: function(id){
      if (id.path){
        return id.collection + ":" + id.key + ":" + id.path;
      }else{
        return id.collection + ":" + id.key;
      }
    }
  };
});
