
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
            this.depth = parent ? parent.depth + 1 : 0;
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
            
            this.removeChild = function (id) {
                idx = this.childIdxById(id);
                if(idx > -1) return this.children.splice(idx, 1).shift();
                return null;
            };
            
            this.addWidToPath = function (path, wid) {
                if(path.length == 0 && this.word_ids.indexOf(wid) == -1)
                    this.word_ids.push(wid);
                else this.addChild(path.charAt(0))
                        .addWidToPath(path.slice(1), wid);
            };
            
            this.removeWidFromPath = function (path, wid) {
                if(path.length == 0) {
                    idx = this.word_ids.indexOf(wid);
                    if(idx > -1) {
                        if(this.word_ids.length == 1 && this.children.length == 0)
                            this.parent.removeChild(this.id);
                        return this.word_ids.splice(idx,1).shift();
                    }
                    return null;
                } else {
                    child = this.childById(path.charAt(0));
                    if(child != null)
                        return child.removeWidFromPath(path.slice(1), wid);
                    return null;
                }
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
                return child.jumpToPath(path.slice(1));
            };
        };
    
        return cls;
    })();
    
    GLOBAL.DicTree = DicTree;
}(this));
