(function (GLOBAL) {
    var CHUNKSIZE = 2531;
    
    function random_color() {
        var min = 0x33, max = 0xbb, result = "#";
        for(var i = 0; i < 3; i++)
            result += (0x100+min + (max-min) * Math.random())
                .toString(16).substr(1,2);
        return result;
    }
    
    function strcasecmp(a, b) {
        var a = a.toLowerCase(), b = b.toLowerCase();
        if (a > b) return 1;
        else if (a == b) return 0;
        return -1;
    }
    
    function strcmp(a, b) {
        if (a > b) return 1;
        else if (a == b) return 0;
        return -1;
    }
    
    function stardictcmp(a, b) {
        var cmp = strcasecmp(a, b);
        if(cmp == 0) return strcmp(a, b);
        else return cmp;
    }
    
    var indexedDB = (function () {
        var cls = function (version) {
            var did = version;
            
            function do_action(action, data) {
                return query("indexedDB", {
                        "action": action,
                        "data": { 
                            "data": data, 
                            "did": did, 
                            "chunksize": CHUNKSIZE 
                        }
                });
            }
            
            this.store_terms = function(terms) {
                return do_action("store_terms", terms);
            };
            
            this.store_idx = function (index) {
                return do_action("store_idx", index);
            };
            
            this.restore_idx = function () {
                return do_action("restore_idx");
            };
            
            this.get = function (id) {
                return do_action("get", id);
            };
            
            this.get_range = function (start, len) {
                return do_action("get_range", { "start": start, "len": len });
            };
            
            this.get_meta = function () {
                return do_action("get_meta");
            };
            
            this.set_meta = function (meta) {
                return do_action("set_meta", meta);
            };
            
            this.version = function () { return did; };
        };
        
        cls.create = function () {
            return new Promise(function (resolve, reject) {
                query("indexedDB", { action: "add_dictionary" })
                .then(function (version) {
                    resolve(new cls(version));
                });
            });
        };
        
        return cls;
    })();
    
    var Dictionary = (function () {
        var cls = function(files, cmp_fct) {
            var meta_info = {},          
                oStarDict = new StarDict(files), oDB,
                aIndex = [], aChunks = [],
                cmp_func = cmp_fct || stardictcmp,
                that = this;
            
            function save_meta() {
                return oDB.set_meta(meta_info);
            }
            
            function getSynonymAt(offset) {
                return oStarDict.synonyms({
                    "start_offset": offset
                })[0];
            }
            
            function getIndexById(wid) {
                return oStarDict.index({
                    "start_offset": aIndex[wid]
                })[0];
            }
            
            function getTermFromObj(obj) {
                if(obj.type == 0) return getIndexById(obj.id).term;
                else return getSynonymAt(obj.id).term;
            }
            
            function decodeObj(obj) {
                var idx, term, result = [];
                if(obj.type == 0) {
                    idx = getIndexById(obj.id);
                    term = idx.term;
                } else {
                    var syn = getSynonymAt(obj.id);
                    idx = getIndexById(syn.wid);
                    term = syn.term;
                }
                return [term, idx, oDB.version()];
            }
            
            this.resource = oStarDict.resource;
            
            this.entry = function (decodedObj) {
                return oStarDict.entry(decodedObj[1].dictpos);
            };
            
            this.lookup = function (word, fuzzy) {
                if(typeof fuzzy === "undefined") fuzzy = false;
                function cmp(obj) {
                    var term = getTermFromObj(obj);
                    if(fuzzy) term = term.substr(0, word.length);
                    return cmp_func(term, word);
                }
                function binarySearch(mode, arr) {
                    var miIndex = 0,
                        maIndex = arr.length - 1,
                        currIndex, currCmp = -1;
                    
                    while (miIndex <= maIndex) {
                        currIndex = (miIndex + maIndex) / 2 | 0;
                        if(mode == "max") currCmp = cmp_func(arr[currIndex], word);
                        else currCmp = cmp_func(getTermFromObj(arr[currIndex]), word);
                        if (currCmp == -1) {
                            miIndex = currIndex + 1;
                        } else if (currCmp == 1) {
                            maIndex = currIndex - 1;
                        } else {
                            while(currCmp == 0 && currIndex > 0) {
                                currIndex--;
                                if(mode == "max") currCmp = cmp_func(arr[currIndex], word);
                                else currCmp = cmp_func(getTermFromObj(arr[currIndex]), word);
                                currIndex -= currCmp;
                            }
                            if(mode == "max") maIndex = currIndex;
                            else miIndex = currIndex;
                            break;
                        }
                    }
                    if(mode == "max") return Math.max(maIndex,0);
                    else return miIndex;
                }
                
                return new Promise(function (resolve, reject) {
                    function process_range(range) {
                        var result = [];
                        for(var r = 0; r < range.length; r++) {
                            if(cmp(range[r]) != 0) break;
                            else result.push(decodeObj(range[r]));
                        }
                        resolve(result);
                    }
                    
                    if(!meta_info.active) { resolve([]); return; }
                    var offset = binarySearch("max", aChunks) * CHUNKSIZE;
                    oDB.get_range(offset, CHUNKSIZE).then(function (list) {
                        var currIdx = binarySearch("min", list),
                            result = [];
                        if(currIdx < list.length && cmp(list[currIdx]) != 0) {
                            resolve(result); return;
                        }
                        if(currIdx + 20  < CHUNKSIZE) {
                            process_range(list.slice(currIdx, currIdx + 20));
                        } else {
                            oDB.get_range(offset + currIdx, 20).then(process_range);
                        }
                    });
                });
            };
            
            this.init = function (path, rank) {
                var wordcount = parseInt(oStarDict.keyword("wordcount")),
                    synwordcount = parseInt(oStarDict.keyword("synwordcount") ? oStarDict.keyword("synwordcount") : 0),
                    short_name = oStarDict.keyword("bookname");
                if(short_name.length > 10)
                    short_name = short_name.substring(0,10) + "...";
                
                
                
                return indexedDB.create()
                .then(function (db) {
                    oDB = db;
                    
                    var full_term_list = [],
                        iter = oStarDict.iterable();
                        
                    function binaryInsert(data, term) {
                        var minIndex = 0,
                            maxIndex = full_term_list.length - 1,
                            currentIndex,
                            currentCmp;
                        
                        while (minIndex <= maxIndex) {
                            currentIndex = (minIndex + maxIndex) / 2 | 0;
                            currentCmp = cmp_func(
                                iter.term(full_term_list[currentIndex]), term
                            );
                            
                            if (currentCmp == -1) {
                                minIndex = currentIndex + 1;
                            } else if (currentCmp == 1) {
                                maxIndex = currentIndex - 1;
                            } else {
                                minIndex = currentIndex;
                                break;
                            }
                        }
                        full_term_list.splice(minIndex, 0, data);
                        return minIndex;
                    }
                    
                    console.log("Wordcount for dictionary `"
                            + short_name + "`: " + wordcount);
                    console.log("Synwordcount for dictionary `"
                            + short_name + "`: " + synwordcount);
                    
                    
                    
                    for(var curr = iter.next(); curr != null; curr = iter.next()) {
                        if(curr.type == 0) {
                            curr.wid = aIndex.length;
                            aIndex.push(curr.offset);
                        }
                        binaryInsert(curr, iter.term(curr));
                        if(full_term_list.length % CHUNKSIZE == 0)
                            query("progress", {
                                status: 90*full_term_list.length/(wordcount+synwordcount),
                                total: 100,
                                text: oStarDict.keyword("bookname")
                            });
                    }
                    
                    for(var i = 0; i < full_term_list.length; i++) {
                        var obj = full_term_list[i],
                            tmp_id = obj.offset;
                        if(obj.type == 0) tmp_id = obj.wid;
                        if(i % CHUNKSIZE == 0) aChunks.push(iter.term(obj));
                        full_term_list[i] = { type: obj.type, id: tmp_id };
                    }
                    
                    return oDB.store_terms(full_term_list);
                }).then(function () {
                    meta_info = {
                        "path": path,
                        "version": oDB.version(),
                        "color": random_color(),
                        "rank": rank,
                        "alias": oStarDict.keyword("bookname"),
                        "size": wordcount + synwordcount,
                        "active": true
                    };
                    return oDB.store_idx(aIndex);
                }).then(function () {
                    return save_meta();
                });
            };
            
            this.restore = function (version) {
                oDB = new indexedDB(version);
                return new Promise(function (resolve, reject) {
                    oDB.get_meta().then(function (meta) {
                        meta_info = meta;
                        return oDB.restore_idx();
                    }).then(function (idx) {
                        aIndex = idx;
                        var i = 0;
                        function recSyn() {
                            if(i < meta_info.size)
                                oDB.get(i).then(function (obj) {
                                    aChunks.push(getTermFromObj(obj));
                                    i += CHUNKSIZE;
                                    recSyn();
                                });
                            else resolve();
                        }
                        recSyn();
                    });
                });
            };
            
            this.meta = function (dict) {
                if(typeof dict !== "undefined") {
                    meta_info = dict; save_meta();
                }
                return meta_info;
            };
            
            this.version = function () { return meta_info.version; };
        }
        
        return cls;
    })();
    
    GLOBAL.Dictionary = Dictionary;
}(this));
