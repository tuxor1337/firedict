(function (GLOBAL) {
    var CHUNKSIZE = 2531;
    
    function random_color() {
        var min = 0x33, max = 0xbb, result = "#";
        for(var i = 0; i < 3; i++)
            result += (0x100+min + (max-min) * Math.random())
                .toString(16).substr(1,2);
        return result;
    }
    
    var stardict_strcmp = (function () {
        var CHARCODE_A_CAPITAL = "A".charCodeAt(0),
            CHARCODE_Z_CAPITAL = "Z".charCodeAt(0),
            CHARCODE_A_SMALL = "a".charCodeAt(0);
            
        function isAsciiUpper(c) {
            return c.charCodeAt(0) >= CHARCODE_A_CAPITAL
                && c.charCodeAt(0) <= CHARCODE_Z_CAPITAL;
        }
        
        function asciiLower(c) {
            if(isAsciiUpper(c))
                return String.fromCharCode(
                    CHARCODE_A_SMALL + c.charCodeAt(0) - CHARCODE_A_CAPITAL
                );
            else return c;
        }
        
        function ascii_strcasecmp(s1, s2) {
            var commonLen = Math.min(s1.length, s2.length)
            for(var i = 0; i < commonLen; i++) {
                var c1 = asciiLower(s1[i]).charCodeAt(0),
                    c2 = asciiLower(s2[i]).charCodeAt(0);
                if(c1 != c2) return c1 - c2;
            }
            return s1.length - s2.length;
        }
        
        function strcmp(s1, s2) {
            var commonLen = Math.min(s1.length, s2.length)
            for(var i = 0; i < commonLen; i++) {
                var c1 = s1.charCodeAt(i),
                    c2 = s2.charCodeAt(i);
                if(c1 != c2) return c1 - c2;
            }
            return s1.length - s2.length
        }
        
        return function (s1, s2) {
            var cmp = ascii_strcasecmp(s1, s2);
            if(cmp == 0) return strcmp(s1, s2);
            else return cmp;
        };
    })();
    
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
            
            this.store_terms = function(data) {
                return do_action("store_terms", data);
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
                cmp_func = cmp_fct || stardict_strcmp,
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
                if(fuzzy) word = word.toLowerCase();
                function cmp(term) {
                    if(term.hasOwnProperty("type")) term = getTermFromObj(term);
                    if(fuzzy) term = term.substr(0, word.length).toLowerCase();
                    return cmp_func(term, word);
                }
                function binarySearch(mode, arr) {
                    var miIndex = 0,
                        maIndex = arr.length - 1,
                        currIndex, currCmp = -1;
                    
                    while (miIndex <= maIndex) {
                        currIndex = (miIndex + maIndex) / 2 | 0;
                        currCmp = cmp(arr[currIndex]);
                        if (currCmp < 0) {
                            miIndex = currIndex + 1;
                        } else if (currCmp > 0) {
                            maIndex = currIndex - 1;
                        } else {
                            while(currCmp == 0 && currIndex > 0) {
                                currIndex--;
                                currCmp = cmp(arr[currIndex]);
                            }
                            if(mode == "max") maIndex = currIndex;
                            else {
                                miIndex = currIndex;
                                if(currCmp < 0) miIndex++;
                            }
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
                    
                    console.log("Wordcount for dictionary `"
                            + short_name + "`: " + wordcount);
                    console.log("Synwordcount for dictionary `"
                            + short_name + "`: " + synwordcount);
                    
                    var iterIdx = oStarDict.iterable(),
                        iterSyn = oStarDict.iterable("synonyms");
                    
                    query("progress", {
                        status: 0, total: 100,
                        text: oStarDict.keyword("bookname")
                    });
                    
                    return oDB.store_terms({
                        "viewIdx": iterIdx.view,
                        "viewSyn": iterSyn.view,
                        "wordcount": wordcount+synwordcount
                    });
                }).then(function (data) {
                    aIndex = data["index"];
                    aChunks = data["chunks"];
                    meta_info = {
                        "path": path,
                        "version": oDB.version(),
                        "color": random_color(),
                        "rank": rank,
                        "alias": oStarDict.keyword("bookname"),
                        "size": wordcount + synwordcount,
                        "active": true
                    };
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
