
var console = {
    log: function (str) {
        postMessage(str);
    },
    error: function (str) {
        postMessage("(error) " + str);
    }
};

importScripts("lib/promise.js");
importScripts("lib/inflate.js");
importScripts("lib/dictzip_sync.js");
importScripts("lib/stardict_sync.js");

importScripts("dictionary.js");
importScripts("dictionarymanager.js"); 

dictMan = new DictionaryManager();

function cacheManager() {
    var cache = [];
    
    this.add = function (key, did, data) {
        for(var h = 0; h < cache.length; h++) {
            if(cache[h].key == key && cache[h].did == did) return;
        }
        cache.push({ "key": key, "did": did, "data": data });
        cache = cache.slice(-30);
    };
    
    this.get = function (key, did) { 
        for(var h = 0; h < cache.length; h++) {
            if(cache[h].key == key && cache[h].did == did)
                return cache[h].data;
        }
        return null;
    }
    
    this.clear = function () { cache = []; };
}

var transactions = [],
    caches = {
        "entries": new cacheManager(),
        "lookup": new cacheManager()
    };
    queryableFunctions = {
        init: function (obj) {
            caches["entries"].clear();
            caches["lookup"].clear();
            dictMan = new DictionaryManager();
            dictMan.init();
        },
        lookup: function (obj) {
            if(obj.data == "") {
                obj.reply(dictMan.history());
            } else {
                var cached_matches = caches["lookup"].get(obj.data,-1);
                if(null != cached_matches) obj.reply(cached_matches);
                else {
                    dictMan.lookup_fuzzy(obj.data)
                    .then(function (matches) {
                        obj.reply(matches);
                        caches["lookup"].add(obj.data, -1, matches)
                    });
                }
            }
        },
        entry: function (obj) {
            function get_entry(d) {
                var cached_entry = caches["entries"].get(d[1].dictpos[0], d[2]);
                if(null == cached_entry) {
                    cached_entry = dictMan.entry(d);
                    caches["entries"].add(d[1].dictpos[0], d[2], cached_entry);
                }
                return cached_entry;
            }
            
            function lookup_exact(term) {
                var cached_matches = caches["lookup"].get(term, -2);
                if(null == cached_matches) {
                    cached_matches = dictMan.lookup_exact(term);
                    caches["lookup"].add(term, -2, cached_matches);
                }
                return cached_matches;
            }
            
            var entries = [];
            if(obj.data instanceof Object) {
                obj.data.forEach(function (d) {
                    entries.push(get_entry(d));
                });
                obj.reply(entries);
            } else {
                lookup_exact(obj.data).forEach(function (m) {
                    entries.push(get_entry(m));
                });
                obj.reply(entries);
            }
        },
        clear_history: function (obj) {
            dictMan.clear_history();
        },
        edit_dictionaries: function (obj) {
            obj.data.forEach(dictMan.edit);
            caches["entries"].clear();
            caches["lookup"].clear();
        },
        resource: function (obj) {
            obj.reply(dictMan.resource(obj.data.did, obj.data.name));
        },
        reply: function (obj) {
            transactions[obj.tid](obj.data);
            delete transactions[obj.tid];
        }
    },
    query = function () {
        if (arguments.length < 1) {
            throw new TypeError("queryMain - not enough arguments");
            return;
        }
        var queryObj = {
            "vo42t30": arguments[0],
            "e4b869b": 0,
            "rnb93qh": arguments[1]
        };
        return new Promise(function (resolve, reject) {
            queryObj.e4b869b = transactions.length;
            transactions.push(resolve);
            postMessage(queryObj);
        });
    };

onmessage = function (oEvent) {
    if (oEvent.data instanceof Object 
        && oEvent.data.hasOwnProperty("bk4e1h0")
        && oEvent.data.hasOwnProperty("df65d4e")
        && oEvent.data.hasOwnProperty("ktp3fm1")) {
        var tid = oEvent.data.df65d4e;
        queryableFunctions[oEvent.data.bk4e1h0]({
            tid: tid,
            data: oEvent.data.ktp3fm1,
            reply: function (data) {
                postMessage({
                    "vo42t30": "reply",
                    "e4b869b": tid,
                    "rnb93qh": data
                });
            }
        });
    } else console.log(oEvent.data);
};

