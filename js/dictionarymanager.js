
(function (GLOBAL) {
    var transactions = [];
    
    function historyManager() {
        var cache = [];
        
        function get_data(callbk) {
            reply("indexedDB", new_transaction(callbk), "get_history");
        }
        
        function put_data(data) {
            reply("indexedDB", -1, "set_history", data);
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
            get_data(function (data) { cache = data; });
        };
        
        this.get = function () { return cache; }
    }
    
    var DictionaryManager = (function () {
        var cls = function () {
            var aDicts = [],
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
                        var oDict = new Dictionary(dictdata_dirs[n].files);
                        oDict.init(dictdata_dirs[n].path, aDicts.length)
                        .then(function () {
                            aDicts.push(oDict);
                            add_dictionary(n+1);
                        });
                    } else {
                        var d = [];
                        for(var i = 0; i < aDicts.length; i++)
                            d.push(aDicts[i].exportable());
                        reply("init_ready", d);
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
                        var tid = new_transaction(function () {
                            aDicts.splice(n,1);
                            remove_zombie(n);
                        });
                        reply("indexedDB", tid, "remove_dictionary", aDicts[n].version);
                    } else load_dictionary(0);
                }
                
                function process_dictdata() {
                    var tid = new_transaction(function (file_list) {
                        dictdata_dirs = file_list;
                        remove_zombie(0);
                    });
                    reply("scan_dictdata", tid);
                }
                
                function get_dictionaries() {
                    var tid = new_transaction(function (dict_list) {
                        aDicts = dict_list;
                        process_dictdata();
                    });
                    reply("indexedDB", tid, "get_dictionaries");
                }
                
                get_dictionaries();
            };
            
            this.lookup_fuzzy = function (term) {
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
                        } else resolve(matches);
                    }
                    rec_lookup(0);
                });
            };
            
            this.lookup_exact = function (did, term) {
                return dict_by_id(did).lookup(term);
            };
            
            this.entry = function (decodedObj) {
                oHistoryManager.add(decodedObj);
                return dict_by_id(decodedObj[2]).entry(decodedObj);
            };
        
            this.resource = function (version, name) {
                return dict_by_id(version).resource(name);
            };
            
            this.history = oHistoryManager.get;
        }
        
        return cls;
    })();
    
    GLOBAL.DictionaryManager = DictionaryManager;
}(this));