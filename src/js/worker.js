/**
 * This file is part of FireDict
 *
 * Copyright 2018 Thomas Vogt
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

"use strict";

var console = {
    log: function (str) {
        postMessage(str);
    },
    error: function (str) {
        postMessage("(error) " + str);
    },
    debug: function (str) {
        /* Set to true for debugging purposes. */
        if(false) postMessage(str);
    }
};

importScripts("lib/es6-promise.min.js");
importScripts("lib/pako_inflate.min.js");
importScripts("lib/dictzip_sync.min.js");
importScripts("lib/stardict_sync.min.js");

importScripts("wrapper-devicestorage.js");
importScripts("wrapper-indexeddb.js");
importScripts("worker-dictionary.js");
importScripts("worker-dictionarymanager.js");

var dictMan = new DictionaryManager(),
    transactions = [],
    queryableFunctions = {
        init: function (obj) {
            dictMan = new DictionaryManager();
            dictMan.init(obj.data);
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
                    entries.push(dictMan.entry(m));
                });
                obj.reply(entries);
            }
        },
        clear_history: function () { dictMan.clear_history(); },
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
            throw new TypeError("query: not enough arguments");
        }
        var queryObj = {
            "vo42t30": arguments[0],
            "e4b869b": 0,
            "rnb93qh": arguments[1]
        };
        return new Promise(function (resolve) {
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

