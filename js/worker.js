/**
 * This file is part of FireDict.
 * (c) 2013-2014 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */
 
var console = {
    log: function (str) {
        postMessage(str);
    },
    error: function (str) {
        postMessage("(error) " + str);
    }
};

importScripts("lib/promise.min.js");
importScripts("lib/inflate.js");
importScripts("lib/dictzip_sync.js");
importScripts("lib/stardict_sync.js");

importScripts("dictionary.js");
importScripts("dictionarymanager.js"); 

dictMan = new DictionaryManager();

var transactions = [];
    queryableFunctions = {
        init: function (obj) {
            dictMan = new DictionaryManager();
            dictMan.init();
        },
        lookup: function (obj) {
            if(obj.data == "") {
                obj.reply(dictMan.history());
            } else {
                dictMan.lookup_fuzzy(obj.data)
                .then(function (matches) { obj.reply(matches); });
            }
        },
        entry: function (obj) {
            var entries = [];
            if(obj.data instanceof Object) {
                obj.data.forEach(function (d) {
                    entries.push(dictMan.entry(d));
                });
                obj.reply(entries);
            } else {
                dictMan.lookup_exact(obj.data).forEach(function (m) {
                    entries.push(dictMan.entry(d));
                });
                obj.reply(entries);
            }
        },
        clear_history: function (obj) {
            dictMan.clear_history();
        },
        edit_dictionaries: function (obj) {
            obj.data.forEach(dictMan.edit);
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

