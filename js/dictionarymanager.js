/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

(function (GLOBAL) {
    var transactions = [];

    function historyManager() {
        var cache = [];

        function put_data(data) { IdbWrapper.set_history(data); }

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
            IdbWrapper.get_history()
            .then(function (data) { cache = data; });
        };

        this.get = function () { return cache.concat().reverse(); }
    }

    function cacheManager() {
        var cache = [];

        this.add = function (key, did, data) {
            cache.push({ "key": key, "did": did, "data": data.concat() });
            cache = cache.slice(-30);
        };

        this.get = function (key, did) {
            for(var h = 0; h < cache.length; h++) {
                if(cache[h].key == key && cache[h].did == did)
                    return cache[h].data.concat();
            }
            return null;
        }

        this.clear = function () { cache = []; };
    }

    var DictionaryManager = (function () {
        var cls = function () {
            var aDicts = [], ready = false;
                oHistoryManager = new historyManager(),
                oCaches = {
                    "entries": new cacheManager(),
                    "lookup": new cacheManager()
                };

            function dict_by_id(version) {
                var result = null;
                aDicts.forEach(function (d) {
                    if(d.version() == version) result = d;
                });
                return result;
            }

            this.init = function () {
                var dictdata_dirs = [];

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
                        IdbWrapper.remove_dictionary(aDicts[n].version)
                        .then(function () {
                            aDicts.splice(n,1);
                            remove_zombie(n);
                        });
                    } else load_dictionary(0);
                }

                function process_dictdata() {
                    DictScanner.scan()
                    .then(function (file_list) {
                        dictdata_dirs = file_list;
                        remove_zombie(0);
                    });
                }

                function get_dictionaries() {
                    query("progress", { text: "Processing dictionaries..." })
                    IdbWrapper.get_dictionaries()
                    .then(function (dict_list) {
                        aDicts = dict_list;
                        process_dictdata();
                    });
                }

                IdbWrapper.init()
                .then(function () {
                    oHistoryManager.load();
                    oCaches["entries"].clear();
                    oCaches["lookup"].clear();
                    get_dictionaries();
                });
            };

            this.lookup_fuzzy = function (term) {
                if(!ready) return [];

                console.log("DictionaryManager: lookup_fuzzy(" + term + ")");

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
                    function continue_lookup(d) {
                        if(d < aDicts.length) {
                            query("lookup_continue", { term: term })
                            .then(function (bool) {
                                if(!bool)
                                    console.log("lookup_fuzzy("
                                        + term + ") request canceled");
                                else {
                                    if(aDicts[d].meta().active) {
                                        var short_name = aDicts[d].meta().alias;
                                        if(short_name.length > 10)
                                            short_name = short_name.substring(0,10) + "...";
                                        console.log("lookup_fuzzy(" + term + ") in `"
                                            + short_name + "`");

                                        var cached_matches = oCaches["lookup"].get(term,d);
                                        if(null === cached_matches) {
                                            cached_matches = aDicts[d].lookup(term, true);
                                            oCaches["lookup"].add(term, d, cached_matches);
                                        } else {
                                            console.log("...from cache...");
                                        }
                                        console.log("... " + cached_matches.length + " matches");
                                        add_matches(cached_matches);
                                    }
                                    continue_lookup(d+1);
                                }
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

                    continue_lookup(0);
                });
            };

            this.lookup_exact = function (term) {
                if(!ready) return [];
                var result = [];
                for(var d = 0; d < aDicts.length; d++) {
                    if(aDicts[d].meta().active) {
                        var cached_matches = oCaches["lookup"].get(term, -d-1);
                        if(null == cached_matches) {
                            cached_matches = aDicts[d].lookup(term);
                            oCaches["lookup"].add(term, -d-1, cached_matches);
                        }
                        result.push(cached_matches);
                    }
                };
                var tmp = [].concat.apply([], result),
                    u = {}, a = [];
                for(var i = 0; i < tmp.length; i++){
                    var teststr = tmp[i][2] + "_" + tmp[i][1].dictpos[0];
                    if(u.hasOwnProperty(teststr)) continue;
                    a.push(tmp[i]);
                    u[teststr] = 1;
                }
                return a;
            };

            this.entry = function (decodedObj) {
                if(!ready) return [];
                oHistoryManager.add(decodedObj);

                var short_name = dict_by_id(decodedObj[2]).meta().alias;
                if(short_name.length > 10)
                    short_name = short_name.substring(0,10) + "..."
                console.log("loading entry " + decodedObj[1].term
                    + " from `" + short_name + "`");

                var cached_entry = oCaches["entries"]
                        .get(decodedObj[1].dictpos[0], decodedObj[2]);
                if(null == cached_entry) {
                    cached_entry = dict_by_id(decodedObj[2]).entry(decodedObj);
                    oCaches["entries"].add(decodedObj[1].dictpos[0], decodedObj[2], cached_entry);
                } else {
                    console.log("...from cache...");
                }

                return {
                    term: decodedObj[1].term,
                    data: cached_entry,
                    did: decodedObj[2]
                };
            };

            this.resource = function (version, name) {
                if(!ready) return null;
                return dict_by_id(version).resource(name);
            };

            this.edit = function (dict) {
                if(!ready) return false;
                oCaches["entries"].clear();
                oCaches["lookup"].clear();
                dict_by_id(dict.version).meta(dict);
            };

            this.history = oHistoryManager.get;

            this.clear_history = oHistoryManager.clear;
        }

        return cls;
    })();

    GLOBAL.DictionaryManager = DictionaryManager;
}(this));
