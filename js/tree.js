
(function (GLOBAL) {
    function binaryIndexOf(arr, searchElement, cmpFunction) {
        var minIndex = 0;
        var maxIndex = arr.length - 1;
        var currentIndex;
        var currentCmp;
        
        while (minIndex <= maxIndex) {
            currentIndex = (minIndex + maxIndex) / 2 | 0;
            currentCmp = cmpFunction(arr[currentIndex], searchElement);
            
            if (currentCmp == -1) {
                minIndex = currentIndex + 1;
            } else if (currentCmp == 1) {
                maxIndex = currentIndex - 1;
            } else {
                return currentIndex;
            }
        }
        
        return -1;
    }
        
    function binaryInsert(arr, newElement, cmpFunction) {
        var minIndex = 0;
        var maxIndex = arr.length - 1;
        var currentIndex;
        var currentCmp;
        
        while (minIndex <= maxIndex) {
            currentIndex = (minIndex + maxIndex) / 2 | 0;
            currentCmp = cmpFunction(arr[currentIndex], newElement);
            
            if (currentCmp == -1) {
                minIndex = currentIndex + 1;
            } else if (currentCmp == 1) {
                maxIndex = currentIndex - 1;
            } else {
                return currentIndex;
            }
        }
        arr.splice(minIndex, 0, newElement);
        return minIndex;
    }

    var DicTree_IDB = (function () {
        /* The nodes are stored in an IndexedDB ObjectStore
           {
            "id": integer keyPath (auto-incremented),
            "path": path string,
            "word_ids": array of word_ids for lookup in StarDict idx,
            "children": array of arrays each of which contains the 
                keyPath id and node id of a child node
           }
        */
        var cls = function (db, cmp_fct) {
            var that = this;
            var db;
            var cmp_func = cmp_fct || function (a,b) {
                a = a.toLowerCase(), b = b.toLowerCase();
                if(a > b) return 1;
                if(a < b) return -1;
                return 0;
            };
            
            that.child_child_cmp = function (a,b) {
                    return cmp_func(a[1],b[1]);
            };
            that.child_word_cmp = function (a,b) {
                    return cmp_func(a[1],b);
            };
            
            function __construct(idb_object, callbk) {
                that.id = idb_object.id;
                that.path = idb_object.path;
                that.word_ids = idb_object.word_ids;
                that.children = idb_object.children;
                callbk(that);
            }
            
            this.fromData = function (data, callbk) {
                if(!data.hasOwnProperty("path"))
                    throw new Error("No path specified!");
                
                if(!data.hasOwnProperty("id")) data.id = -1;
                if(!data.hasOwnProperty("word_ids")) data.word_ids = [];
                if(!data.hasOwnProperty("children")) data.children = [];
                
                if(data.id == -1) {
                    delete data.id;
                    db.put(data, function(result) {
                        data.id = result;
                        __construct(data, callbk);
                    });
                } else __construct(data, callbk);
            };
            
            this.fromId = function (id, callbk) {
                db.get(id, function (result) {
                    that.fromData(result, callbk);
                });
            };
            
            this.childIdxByChar = function (ch) {
                return binaryIndexOf(this.children, ch, this.child_word_cmp);
            };
            
            this.childByIdx = function (idx, callbk) {
                if(idx == -1) callbk(null);
                else {
                    var child = new DicTree_IDB(db, cmp_func);
                    child.fromId(this.children[idx][0], function (obj) {
                        callbk(obj);
                    });
                }
            };
            
            this.childByChar = function (ch, callbk) {
                var idx = this.childIdxByChar(ch);
                this.childByIdx(idx, callbk);
            };
            
            this.hasChild = function (ch) {
                if(this.childIdxByChar(ch) == -1) return false;
                else return true;
            };
            
            this.addChild = function (ch, callbk) {
                if(this.hasChild(ch)) this.childByChar(ch, callbk);
                else {
                    var child = new DicTree_IDB(db, cmp_func);
                    child.fromData({ path: this.path + ch },
                        function (child_node) {
                            var childIdx = binaryInsert(
                                that.children, [child_node.id, ch],
                                that.child_child_cmp
                            );
                            that.save(function () {
                                callbk(child_node);
                            });
                    });
                }
            };
            
            this.addWidToPath = function (path, wid, callbk) {
                if(path.length == 0 && this.word_ids.indexOf(wid) == -1) {
                    this.word_ids.push(wid);
                    this.save(callbk);
                }
                else this.addChild(path.charAt(0), function (obj) {
                    obj.addWidToPath(path.slice(1), wid, callbk);
                });
            };
            
            this.deepSearchChild = function (child_idx, max, callbk) {
                if(child_idx < this.children.length && max > 0)
                    this.childByIdx(child_idx, function (obj) {
                        obj.deepSearch(max, function (result) {
                            that.deepSearchChild(
                                child_idx+1, max - result.length, 
                                function (res) {
                                    callbk(result.concat(res));
                            });
                        }); 
                    });
                else callbk([]);
                    
            };
            
            this.deepSearch = function (max, callbk) {
                max = max || 100;
                var result = [], i;
                for(i = 0; 
                    i < this.word_ids.length && result.length < max; 
                    i++) result.push([this.path, this.word_ids[i]]);
                this.deepSearchChild(0, max - result.length,
                    function (res) {
                        callbk(result.concat(res));
                });
            };
            
            this.jumpToPath = function (path, callbk) {
                if(path == "") callbk(this);
                else {
                    this.childByChar(path.charAt(0), function (child) {
                        if(child == null) callbk(null);
                        else child.jumpToPath(path.substr(1), callbk);
                    });
                }
            };
            
            this.save = function (callbk) {
                var data = {
                    id: this.id,
                    path: this.path,
                    word_ids: this.word_ids,
                    children: this.children
                };
                db.put(data, function () { callbk(that); });
            };
        };
    
        return cls;
    })();

    var DicTree = (function () {
        var cls = function (parent, id, cmp_fct) {
            var that = this;
            var cmp_func = cmp_fct || function (a,b) {
                a = a.toLowerCase(), b = b.toLowerCase();
                if(a > b) return 1;
                if(a < b) return -1;
                return 0;
            };
            
            this.id = id || "";
            this.path = parent ? parent.path + this.id : this.id;
            this.parent = parent || null;
            this.word_ids = [];
            this.children = [];
            this.child_child_cmp = function (a,b) {
                    return cmp_func(a.id,b.id);
            };
            this.child_word_cmp = function (a,b) {
                    return cmp_func(a.id,b);
            };
            
            this.childIdxById = function (id) {
                return binaryIndexOf(this.children, id, this.child_word_cmp);
            }
            
            this.childById = function (id) {
                var idx = this.childIdxById(id);
                if(idx == -1) return null;
                else return this.children[idx];
            };
            
            this.hasChild = function (id) {
                if(this.childIdxById(id) == -1) return false;
                else return true;
            };
            
            this.addChild = function (id) {
                var childIdx = binaryInsert(
                    this.children, new DicTree(this, id, cmp_func), this.child_child_cmp
                );
                return this.children[childIdx];
            };
            
            this.addWidToPath = function (path, wid) {
                if(path.length == 0 && this.word_ids.indexOf(wid) == -1)
                    this.word_ids.push(wid);
                else this.addChild(path.charAt(0))
                        .addWidToPath(path.slice(1), wid);
            };
            
            this.deepSearch = function (max) {
                max = max || 100;
                var result = [], i;
                for(i = 0; 
                    i < this.word_ids.length && result.length < max; 
                    i++) result.push([this.path,this.word_ids[i]]);
                for(i = 0; 
                    i < this.children.length && result.length < max;
                    i++) result = result.concat(
                            this.children[i].deepSearch(max-result.length)
                         );
                return result;
            };
            
            this.jumpToPath = function (path) {
                if(path == "") return this;
                child = this.childById(path.charAt(0));
                if(child == null) return null;
                return child.jumpToPath(path.substr(1));
            };
            
            this.toDB = function (db, total, callbk) {
                var dbtree = new DicTree_IDB(db, cmp_func);
                var children = [];
                function rec_children_to_db(i) {
                    if(i < that.children.length) {
                        that.children[i].toDB(db, total, function (child) {
                            children.push([child.id, that.children[i].id]);
                            rec_children_to_db(i+1);
                        });
                    } else {
                        dbtree.fromData({
                            "path": that.path,
                            "word_ids": that.word_ids,
                            "children": children
                        }, function (result) {
                            if(that.word_ids.length > 0) {
                                reply("progress", that.word_ids.length, total);
                            }
                            callbk(result);
                        });
                    }
                }
                rec_children_to_db(0);
            };
        };
    
        return cls;
    })();
    
    GLOBAL.DicTree = DicTree;
    GLOBAL.DicTree_IDB = DicTree_IDB;
}(this));

