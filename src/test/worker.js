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

importScripts("lib/es6-promise.min.js");

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
            var result = [],
                testnames = [
                    "Dictionnaires de l’Académie française: 8ème édition ",
                    "Etymologisches Wörterbuch © Dr. Wolfgang Pfeifer",
                    "Georges: Kleines deutsch-lateinisches Handwörterbuch (1910)",
                    "Georges: Ausführliches lateinisch-deutsches Handwörterbuch (1913-1918)",
                    "Online Etymology Dictionary, ©Douglas Harper/etymonline.com",
                    "Folkets lexikon En-Sv, ©folkets-lexikon.csc.kth.se",
                    "Oxford Dictionaries Online - British & World English",
                    "Folkets lexikon Sv-En, ©folkets-lexikon.csc.kth.se",
                    "Pape: Handwörterbuch der griechischen Sprache (1914)",
                    "XMLittré, ©littre.org",
                    "GNU Collaborative International Dictionary of English",
                    "The World Factbook 2014",
                    "The American Heritage Dictionary of the English Language, Fifth Edition",
                    "Diccionario de la lengua española: 22a edición"

                ];
            for(var i = 0; i < testnames.length; i++) {
                result.push({ alias: testnames[i], version: 2*i, rank: i, color: random_color(), active: true });
            }
            query("init_ready", result);
        },
        lookup: function (obj) {
            obj.reply([
                { term: "hand", entries: [ ["hand", [0,0], 8], ["Hand", [0,0], 2], ["hand", [0,0], 12] ] },
                { term: "trop", entries: [ ["trop", [0,0], 18], ["trop", [0,0], 0] ] },
                { term: "ἁγαθός", entries: [ ["ἁγαθός", [0,0], 16] ] }
            ]);
        },
        entry: function (obj) {
            obj.reply([
                { term: "git", data: [{
                    type: "m",
                    content: "Hello World! This is <b>injected HTML</b>."
                }], did: 20 },
                { term: "origin", data: [{
                    type: "h",
                    content: "Hello World! This markup is okay: <b>test</b>."
                }], did: 8 },
                { term: "master", data: [{
                        type: "h",
                        content: "<dt>Hello World!</dt> <dd>"
                            + "<p>I'm an entry with a lot of text.</p>"
                            + "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
                            + "Donec a diam lectus. Sed amet mauris. Maecenas congue "
                            + "ligula ac quam viverra.</p>"
                            + "<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. "
                            + "Donec a diam lectus. Sed amet mauris. Maecenas congue "
                            + "ligula ac quam viverra.</p></dd>"
                }], did: 6 }
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

