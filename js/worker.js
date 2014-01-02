
var console = {
    "log": function (str) {
        postMessage(str);
    },
    "err": function (str) {
        postMessage("Error: " + str);
    }
};

importScripts("rawinflate.js");
importScripts("dictzip.js");
importScripts("stardict.js");
    
var dict_list = [];
var transactions = [];

var queryableFunctions = {
    load_dicts: function (dlist) {
        dict_list = dlist;
        function loadNext(d) {
            if(d < dict_list.length) {
                var dict = dict_list[d];
                dict.dobj = new StarDict(new indexedDB(d));
                dict.dobj.onsuccess = function () {
                    reply("loadEnd", d,
                        dict_list[d].dobj.get_key("bookname"),
                        dict_list[d].dobj.get_key("dbwordcount"));
                    loadNext(d+1);
                };
                dict.dobj.onerror = function (msg) {
                    console.err(msg);
                    reply("loadEnd", d, null, null);
                    loadNext(d+1);
                };
                dict.dobj.load(dict.main, dict.res);
            }
        }
        loadNext(0);
    },
    
    load_dicts_idb: function (dlist) {
        dict_list = dlist;
        if(dict_list.length == 0) reply("dbLoadEnd");
        for(var d = 0; d < dict_list.length; d++) {
            var dict = dict_list[d], tmp = 0;
            dict.dobj = new StarDict(new indexedDB(d));
            dict.dobj.onsuccess = function () {
                if(++tmp == dict_list.length) reply("dbLoadEnd");
            };
            dict.dobj.onerror = function (msg) {
                console.err(msg);
                if(++tmp == dict_list.length) reply("dbLoadEnd");
            };
            dict.dobj.load(dict.main, dict.res, dict.dbwordcount);
        }
    },
    
    get_entry: function (did, decodedObj) {
        dict_list[did].dobj.get_entry(decodedObj, function (data) {
            reply("printEntry", did, decodedObj, data);
        });
    },
    
    lookup_fuzzy: function (term) {
        var matches = [];
        function rec_lookup(d) {
            if(d < dict_list.length) {
                if(dict_list[d].dobj.loaded == false) rec_lookup(d+1);
                else{
                    dict_list[d].dobj.lookup_term(term, function (tmp) {
                        for(var i = 0; i < tmp.length; i++) matches.push(tmp[i]);
                        rec_lookup(d+1);
                    }, true);
                }
            } else reply("printList", matches);
        }
        rec_lookup(0);
    },
    
    lookup_exact: function (did, term) {
        dict_list[did].dobj.lookup_term(term, function(matches) {
            function nextMatch(m) {
                if(m < matches.length) {
                    dict_list[did].dobj.get_entry(matches[m], function (data) {
                        reply("printEntry", did, matches[m], data);
                        nextMatch(m+1);
                    });
                }
            }
            nextMatch(0)
        });
    },
    
    indexedDB: function (tid, data) {
        transactions[tid](data);
        delete transactions[tid];
    }
};

function defaultQuery (vMsg) { console.log(vMsg); }

function reply () {
    if (arguments.length < 1) {
        throw new TypeError("reply - not enough arguments");
        return;
    }
    postMessage({
        "vo42t30": arguments[0],
        "rnb93qh": Array.prototype.slice.call(arguments, 1)
    });
}

var indexedDB = (function () {
    var cls = function (did) {
        var did = did; this.did = did;
        var that = this;
        
        this.do_action = function(action, data, callbk) {
            var tid = transactions.length;
            transactions.push(callbk);
            reply("indexedDB", tid, action, did, data);
        };
        
        this.store_synonyms = function(synonyms, callbk) {
            this.do_action("store_synonyms", synonyms, callbk);
        };
        
        this.backup_idx = function (index, callbk) {
            this.do_action("backup_idx", index, callbk);
        };
        
        this.restore_idx = function (callbk) {
            this.do_action("restore_idx", null, callbk);
        };
        
        this.get = function (id, callbk) {
            this.do_action("get", id, callbk);
        };
        
        this.get_range = function (start, len, callbk) {
            this.do_action(
                "get_range", 
                { "start": start, "len": len },
                callbk
            );
        };
    };
    
    return cls;
})();

onmessage = function (oEvent) {
    if (oEvent.data instanceof Object 
        && oEvent.data.hasOwnProperty("bk4e1h0")
        && oEvent.data.hasOwnProperty("ktp3fm1"))
        queryableFunctions[oEvent.data.bk4e1h0].apply(self, oEvent.data.ktp3fm1);
    else defaultQuery(oEvent.data);
};
