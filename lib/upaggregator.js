define(function(require, exports, module){

  var _ = require('./underscore') || window._;
  var Utils = require('./utils').Utils;

  var UPAggregator = exports.UPAggregator = {

    aggregate: function(pul, targetUp, sourceUp){
      return this["aggregateOn_" + targetUp.type](pul,targetUp,sourceUp);
    },

adaptToRenamedPath: function(renameUp, up, ret){
  var upPathLength = Utils.pathLength(up.target);
  var renamePathLength = Utils.pathLength(renameUp.target);
  if (renamePathLength >= upPathLength){
    ret.error = "Invalid parameters passed to adaptToRenamedPath():"+
  JSON.stringify(renameUp) + ", " + JSON.stringify(up);
  }else{
    if (!Utils.setPathEntry(up.target, renamePathLength, renameUp.params[0])){
      ret.error = "Couldn't update path entry";
    }else{
      ret.sourceModified = true;
    }
  }
},

  // TODO array UPs

  aggregateOn_rename_in_object: function(pul,renameUp,sourceUp){
    var ret = {targetModified: false, sourceModified: false};
    var setPathErr = function(){
      ret.error = "Invalid renameUp/sourceUp paths:" +
        "\ntargetUp: " + JSON.stringify(renameUp) +
        "\nsourceUp:" + JSON.stringify(sourceUp);
    };
    var upPathLength = Utils.pathLength(sourceUp.target);
    var renamePathLength = Utils.pathLength(renameUp.target);
    if (sourceUp.type === renameUp.type){
      // rename on rename
      if (upPathLength === renamePathLength){
        // Sequential renaming of the same object: Adapt renameUp
        renameUp.params[1] = sourceUp.params[1];
      }else if (upPathLength > renamePathLength){
        // Adapt the path in sourceUp to point to the original name 
        this.adaptToRenamedPath(renameUp, sourceUp, ret);
      }else{
        setPathErr();
      }
    }else if (sourceUp.type === "insert_into_object"){
      // Adapt sourceUp path
      this.adaptToRenamedPath(renameUp, sourceUp, ret);
    }else if (sourceUp.type === "delete_from_object"){
      if (renamePathLength < upPathLength){
        this.adaptToRenamedPath(renameUp, sourceUp, ret);
      }else if (renamePathLength === upPathLength){
        // Change the item to be deleted
        sourceUp.params[0] = _.reject(sourceUp.params[0], function(name){
          return name === renameUp.params[1];
        });
        sourceUp.params[0].push(renameUp.params[0]);
        ret.sourceModified = true;
      }else{
        setPathErr();
      }
    }else if (sourceUp.type === "replace_in_object"){
      if (renamePathLength < upPathLength){
        this.adaptToRenamedPath(renameUp, sourceUp, ret);
      }else if (renamePathLength === upPathLength){
        // Update the name to be replaced
        sourceUp.params[0] =  renameUp.params[0];
        ret.sourceModified = true;
      }else{
        setPathErr();
      }
    }
    return ret;
  },

};
});
