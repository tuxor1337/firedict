
(function (GLOBAL) {
    var transactions = [];
    
    function historyManager() {
        var cache = [];
        
        function put_data(data) {
            query("indexedDB", {
                action: "set_history",
                data: data
            });
        }
        
        this.add = function (decodedObj) {
            var m = decodedObj;
            for(var h = 0; h < cache.length; h++) {
                if(cache[h].term == m[0]) {
                    cache[h].entries.push(m);
                    var e = cache[h].entries;
                    for(var i = 0; i+1 < e.length; i++) {
                        if(e[i][1].dictpos[0] == m[1].dictpos[0]
                            && e[i][2] == m[2]) {
                            cache[h].entries.pop();
                            break;
                        }
                    }
                    cache.push(cache[h]);
                    cache.splice(h,1);
                    m = null; break;
                }
            }
            if(m != null) cache.push({ "term": m[0], "entries": [m]});
            cache = cache.slice(-20);
            put_data(cache);
        };
        
        this.clear = function (version) {
            if(typeof version === "undefined") {
                cache = [];
            } else {
                for(var i = 0; i < cache.length; i++) {
                    for(var j = 0; j < cache[i].entries.length; j++) {
                        if(cache[i].entries[j][2] == version)
                            cache[i].entries.splice(j--,1);
                    }
                    if(cache[i].entries.length == 0)
                        cache.splice(i--,1);
                }
            }
            put_data(cache);
        };
        
        this.load = function () {
            query("indexedDB", { action: "get_history" })
            .then(function (data) { cache = data; });
        };
        
        this.get = function () { return cache.concat().reverse(); }
    }
    
    var DictionaryManager = (function () {
        var cls = function () {
            var aDicts = [], ready = false;
                oHistoryManager = new historyManager();
    
            function dict_by_id(version) {
                var result = null;
                aDicts.forEach(function (d) {
                    if(d.version() == version) result = d;
                });
                return result;
            }
            
            this.init = function () {
                var dictdata_dirs = [];
                oHistoryManager.load();
                
                function add_dictionary(n) {
                    if(n < dictdata_dirs.length) {
                        try {
                            var oDict = new Dictionary(dictdata_dirs[n].files);
                            oDict.init(dictdata_dirs[n].path, aDicts.length)
                            .then(function () {
                                aDicts.push(oDict);
                                add_dictionary(n+1);
                            });
                        } catch (err) {
                            console.log(err.message);
                            add_dictionary(n+1);
                        }
                    } else {
                        var d = [];
                        aDicts.sort(function (a,b) {
                            a = a.rank, b = b.rank;
                            if(a > b) return 1;
                            if(a < b) return -1;
                            return 0;
                        });
                        for(var i = 0; i < aDicts.length; i++)
                            d.push(aDicts[i].meta());
                        ready = true;
                        query("init_ready", d);
                    }
                }
                
                function load_dictionary(n) {
                    if(n < aDicts.length) {
                        var ver = aDicts[n].version;
                        aDicts[n] = new Dictionary(aDicts[n].files);
                        aDicts[n].restore(ver).then(function () {
                            load_dictionary(n+1);
                        });
                    } else add_dictionary(0);
                }
                
                function remove_zombie(n) {
                    if(n < aDicts.length) {
                        for(var i = 0; i < dictdata_dirs.length; i++) {
                            if(aDicts[n].path == dictdata_dirs[i].path) {
                                aDicts[n].files = dictdata_dirs[i].files;
                                dictdata_dirs.splice(i--,1);
                                remove_zombie(n+1);
                                return;
                            }
                        }
                        console.log("Zombie: " + aDicts[n].path);
                        oHistoryManager.clear(aDicts[n].version);
                        query("indexedDB", {
                            action: "remove_dictionary",
                            data: aDicts[n].version
                        }).then(function () {
                            aDicts.splice(n,1);
                            remove_zombie(n);
                        });
                    } else load_dictionary(0);
                }
                
                function process_dictdata() {
                    query("scan_dictdata")
                    .then(function (file_list) {
                        dictdata_dirs = file_list;
                        remove_zombie(0);
                    });
                }
                
                function get_dictionaries() {
                    query("progress", { text: "Processing dictionaries..." })
                    query("indexedDB", { action: "get_dictionaries" })
                    .then(function (dict_list) {
                        aDicts = dict_list;
                        process_dictdata();
                    });
                }
                
                get_dictionaries();
            };
            
            this.lookup_fuzzy = function (term) {
                if(!ready) return [];
                
                var matches = [];
                function add_matches(raw_matches) {
                    while(raw_matches.length > 0) {
                        var m = raw_matches.shift(), i = 0;
                        for(i = 0; i < matches.length; i++) {
                            if(m[0] == matches[i].term) {
                                matches[i].entries.push(m);
                                m = null; break;
                            } else if(m[0] < matches[i][0]) break;
                        }
                        if(m != null) 
                            matches.splice(i, 0, { "term": m[0], "entries": [m]});
                    }
                }
                
                return new Promise(function (resolve, reject) {
                    function rec_lookup(d) {
                        if(d < aDicts.length) {
                            aDicts[d].lookup(term, true)
                            .then(function (tmp) {
                                add_matches(tmp);
                                rec_lookup(d+1);
                            });
                        } else {
                            resolve(matches.sort(function (a,b) {
                                a = a.term.toLowerCase();
                                b = b.term.toLowerCase();
                                if(a > b) return 1;
                                if(a < b) return -1;
                                return 0;
                            }));
                        }
                    }
                    rec_lookup(0);
                });
            };
            
            this.lookup_exact = function (term) {
                if(!ready) return [];
                var result = [];
                aDicts.forEach(function (dict) {
                    result.push(dict.lookup(term));
                });
                return Promise.all(result).then(function (arr) {
                    var tmp = [].concat.apply([], arr),
                        u = {}, a = [];
                    for(var i = 0, l = tmp.length; i < l; ++i){
                        var teststr = tmp[i][2] + "_" + tmp[i][1].dictpos[0];
                        if(u.hasOwnProperty(teststr)) continue;
                        a.push(tmp[i]);
                        u[teststr] = 1;
                    }
                    return a;
                });
            };
            
            this.entry = function (decodedObj) {
                if(!ready) return [];
                oHistoryManager.add(decodedObj);
                return {
                    term: decodedObj[1].term,
                    data: dict_by_id(decodedObj[2]).entry(decodedObj),
                    did: decodedObj[2]
                };
            };
        
            this.resource = function (version, name) {
                if(!ready) return null;
                return dict_by_id(version).resource(name);
            };
            
            this.edit = function (dict) {
                if(!ready) return false;
                dict_by_id(dict.version).meta(dict);
            };
            
            this.history = oHistoryManager.get;
            
            this.clear_history = oHistoryManager.clear;
        }
        
        return cls;
    })();
    
    GLOBAL.DictionaryManager = DictionaryManager;
}(this));