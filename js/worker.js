
var console = {
    "log": function (str) {
        postMessage(str);
    }
};

importScripts("rawinflate.js");
importScripts("dictzip.js");
importScripts("tree.js");
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
                dict.dobj.onsuccess = (function(theD) {
                    return function () {
                        reply("loadEnd", theD,
                            dict_list[theD].dobj.get_key("bookname"));
                        loadNext(d+1);
                    };
                })(d);
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
                if(++tmp == dict_list.length)
                    reply("dbLoadEnd");
            };
            dict.dobj.load(dict.main, dict.res, true);
        }
    },
    
    lookup_fuzzy: function (term) {
        var matches = [];
        function rec_lookup(d) {
            if(d < dict_list.length) {
                dict_list[d].dobj.lookup_term(term, function (tmp) {
                    for(var i = 0; i < tmp.length; i++) {
                        tmp[i].push(d);
                        matches.push(tmp[i]);
                    }
                    rec_lookup(d+1);
                }, true);
            } else {
                reply("printList", matches);
            }
        }
        rec_lookup(0);
    },
    
    lookup_id: function (did, wid) {
        dict_list[did].dobj.lookup_id(wid, function (data, idx) {
            reply("printEntry", did, wid, idx, data);
        });
    },
    
    lookup_exact: function (did, term) {
        dict_list[did].dobj.lookup_term(term, function(wid) {
            dict_list[did].dobj.lookup_id(wid, function (data, idx) {
                reply("printEntry", did, wid, idx, data);
            });
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
        
        this.put = function (obj, callbk) {
            this.do_action("put", obj, callbk);
        };
        
        this.delete = function (id, callbk) {
            this.do_action("delete", id, callbk);
        };
        
        this.get = function (id, callbk) {
            this.do_action("get", id, callbk);
        };
        
        this.get_root = function (callbk) {
            this.do_action("get_root", null, callbk);
        };
        
        this.backup_idx = function (index, callbk) {
            this.do_action("backup_idx", index, callbk);
        };
        
        this.restore_idx = function (callbk) {
            this.do_action("restore_idx", null, callbk);
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
