
var console = {
    "log": function (str) {
        postMessage(str);
    },
    "error": function (str) {
        postMessage("Error: " + str);
    }
};

importScripts("lib/inflate.js");
importScripts("lib/dictzip_sync.js");
importScripts("lib/stardict_sync.js");
importScripts("lib/promise.js");

importScripts("dictionary.js");
importScripts("dictionarymanager.js");

var transactions = [], dictMan = new DictionaryManager();

function new_transaction(callbk) {
    var tid = transactions.length;
    transactions.push(callbk);
    return tid;
}

var queryableFunctions = {
    init: function () {
        dictMan = new DictionaryManager();
        dictMan.init();
    },
    
    get_entry: function (decodedObj) {
        var data = dictMan.entry(decodedObj);
        reply("printEntry", decodedObj, data);
    },
    
    history: function () {
        reply("printHistory", dictMan.history());
    },
    
    lookup_fuzzy: function (term) {
        dictMan.lookup_fuzzy(term).then(function (matches) {
            reply("printList", matches)
        });
    },
    
    lookup_exact: function (did, term) {
        dictMan.lookup_exact(did,term).then(function (matches) {
            for(var m = 0; m < matches.length; m++) {
                var data = dictMan.entry(matches[m]);
                reply("printEntry", matches[m], data);
            }
        });
    },
    
    resource: function (rid, did, name) {
        reply("resource", rid, dictMan.resource(did, name));
    },
    
    transaction: function(tid, data) {
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

onmessage = function (oEvent) {
    if (oEvent.data instanceof Object 
        && oEvent.data.hasOwnProperty("bk4e1h0")
        && oEvent.data.hasOwnProperty("ktp3fm1"))
        queryableFunctions[oEvent.data.bk4e1h0].apply(self, oEvent.data.ktp3fm1);
    else defaultQuery(oEvent.data);
};
