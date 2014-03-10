/**
 * Reduced version of worker.js
 *
 * Replace js/worker.js with this file if you want to do UI testing on a device
 * not supporting IndexedDB and or the Device Storage API. E.g. it will run
 * on Firefox for desktop and on Firefox for Android.
 *
 */
var console = {
    log: function (str) {
        postMessage(str);
    },
    error: function (str) {
        postMessage("(error) " + str);
    }
};

importScripts("lib/promise.js");

function random_color() {
    var min = 0x33, max = 0xbb, result = "#";
    for(var i = 0; i < 3; i++)
        result += (0x100+min + (max-min) * Math.random())
            .toString(16).substr(1,2);
    return result;
}
    
var transactions = [],
    queryableFunctions = {
        init: function (obj) {
            var result = [];
            for(var i = 0; i < 10; i++) {
                result.push({ alias: "Testbuch"+i, version: 2*i, rank: i, color: random_color(), active: true });
            }
            query("init_ready", result);
        },
        lookup: function (obj) {
            obj.reply([
                { term: "Testterm", entries: [ ["Testterm", [0,0], 2], ["Testterm", [0,0], 4] ] },
                { term: "Testterm3", entries: [ ["Testterm3", [0,0], 2], ["Testterm3", [0,0], 8] ] },
                { term: "Testterm2", entries: [ ["Testterm2", [0,0], 6], ["Testterm2", [0,0], 4] ] }
            ]);
        },
        entry: function (obj) {
            obj.reply([
                { term: "Testterm2a", data: [{ type: "m", content: "Hello World!" }], did: 4 },
                { term: "Testterm2a", data: [{ type: "h", content: "Hello World!" }], did: 8 },
                { term: "Testterm2a", data: [{ type: "m", content: "Hello World!" }], did: 6 }
            ]);
        },
        clear_history: function (obj) {
            console.log("clearing history");
        },
        edit_dictionaries: function (obj) {
            console.log("editing dictionary");
        },
        resource: function (obj) {
            obj.reply(null);
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

