/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

(function (GLOBAL) {
    function do_async_rec(work, check, terminate) {
        if(!check()) terminate();
        else work().then(function () {
            do_async_rec(work, check, terminate);
        });
    }

    var IdbWrapper = (function () {
        var indexedDB = GLOBAL.indexedDB;

        var cls = function () {
            var indexedDB_handle, dbName = "FireDictDB";

            function open_db(successCallbk, upgradeCallbk, version) {
                var request;
                if(!!indexedDB_handle) indexedDB_handle.close();
                if(typeof version === "undefined")
                    request = indexedDB.open(dbName);
                else {
                    request = indexedDB.open(dbName, version);
                    console.log("Opening " + dbName + " v" + version);
                }

                request.onerror = function (event) {
                   throw new Error("Why didn't you allow my web app to use IndexedDB?!");
                };
                request.onsuccess = function (e) {
                    indexedDB_handle = request.result;
                    indexedDB_handle.onerror = function (e) {
                        throw new Error("Database error: " + e.target.errorCode);
                    };
                    successCallbk();
                };
                request.onupgradeneeded = function (e) {
                    upgradeCallbk(e.target.result);
                };
            }

            this.init = function () {
                return new Promise(function (resolve,reject) {
                    open_db(resolve,
                        function (db) {
                            db.createObjectStore("dictionaries");
                            db.createObjectStore("history");
                        }
                    );
                });
            };

            this.get_dictionaries = function () {
                var aDicts = [],
                    request = indexedDB_handle.transaction("dictionaries")
                        .objectStore("dictionaries").openCursor();
                return new Promise(function (resolve, reject) {
                    request.onsuccess = function (event) {
                        var cursor = event.target.result;
                        if(!!cursor == false) resolve(aDicts);
                        else {
                            aDicts.push(cursor.value);
                            cursor.continue();
                        }
                    };
                });
            };

            this.get_history = function () {
                var request = indexedDB_handle.transaction("history")
                    .objectStore("history").get(0);
                return new Promise(function (resolve, reject) {
                    request.onsuccess = function (evt) {
                        var cache = evt.target.result;
                        if(typeof evt.target.result === "undefined") cache = [];
                        resolve(cache);
                    };
                });
            };

            this.add_dictionary = function (data) {
                var version = parseInt(indexedDB_handle.version)+1;
                if(typeof data === "undefined") data = {};
                return new Promise(function (resolve, reject) {
                    open_db(
                        function () {
                            data.version = version;
                            indexedDB_handle.transaction("dictionaries", "readwrite")
                                .objectStore("dictionaries").add(data, version);
                            resolve(version);
                        },
                        function (db) {
                            db.createObjectStore("dict"+version);
                        },
                        version
                    );
                });
            };

            this.remove_dictionary = function (data) {
                var version = parseInt(indexedDB_handle.version)+1;
                return new Promise(function (resolve, reject) {
                    open_db(
                        function () {
                            indexedDB_handle.transaction("dictionaries", "readwrite")
                                .objectStore("dictionaries").delete(data);
                            resolve();
                        },
                        function (db) {
                            db.deleteObjectStore("dict"+data);
                        },
                        version
                    );
                });
            };

            this.set_history = function (data) {
                indexedDB_handle.transaction("history", "readwrite")
                    .objectStore("history").put(data, 0);
                return Promise.resolve();
            };

            this.set_meta = function (data) {
                var did = data.did, data = data.data,
                    request = indexedDB_handle
                        .transaction("dictionaries", "readwrite")
                        .objectStore("dictionaries").put(data, did);
                return new Promise(function (resolve, reject) {
                     request.onsuccess = function () { resolve(); };
                });
            };

            this.get_meta = function (data) {
                var did = data.did,
                    request = indexedDB_handle.transaction("dictionaries")
                        .objectStore("dictionaries").get(did);
                return new Promise(function (resolve, reject) {
                    request.onsuccess = function (e) { resolve(e.target.result); };
                });
            };

            this.store_oft = function (data) {
                var did = data.did, chunksize = data.chunksize,
                    idb_ostore = "dict" + did,
                    data = data.data,

                    store = indexedDB_handle
                        .transaction(idb_ostore, "readwrite")
                        .objectStore(idb_ostore),

                    request = store.add(data.idxOft, 0);

                return new Promise(function (resolve, reject) {
                    request.onsuccess = function () {
                        store.add(data.synOft, 1)
                        .onsuccess = function () { resolve(); };
                    };
                });
            };

            this.restore_oft = function (data) {
                var did = data.did,
                    idb_ostore = "dict" + did,

                    store = indexedDB_handle
                        .transaction(idb_ostore)
                        .objectStore(idb_ostore),
                    result = {},
                    request = store.get(0);

                return new Promise(function (resolve, reject) {
                    request.onsuccess = function (event) {
                        result.idxOft = event.target.result;
                        store.get(1)
                        .onsuccess = function (event) {
                            result.synOft = event.target.result;
                            resolve(result);
                        };
                    };
                });
            };
        };

        return cls;
    })();

    var IdbWrapperCompat = (function () {
        var cls = function () {
            this.init = function () {
                return query("IdbWrapper", { action: "init" });
            };

            this.get_dictionaries = function () {
                return query("IdbWrapper", { action: "get_dictionaries" });
            };

            this.get_history = function () {
                return query("IdbWrapper", { action: "get_history" });
            };

            this.add_dictionary = function (data) {
                return query("IdbWrapper", {
                    action: "add_dictionary", data: data
                });
            };

            this.remove_dictionary = function (data) {
                return query("IdbWrapper", {
                    action: "remove_dictionary", data: data
                });
            };

            this.set_history = function (data) {
                return query("IdbWrapper", {
                    action: "set_history", data: data
                });
            };

            this.set_meta = function (data) {
                return query("IdbWrapper", {
                    action: "set_meta", data: data
                });
            };

            this.get_meta = function (data) {
                return query("IdbWrapper", {
                    action: "get_meta", data: data
                });
            };

            this.store_oft = function (data) {
                return query("IdbWrapper", {
                    action: "store_oft", data: data
                });
            };

            this.restore_oft = function (data) {
                return query("IdbWrapper", {
                    action: "restore_oft", data: data
                });
            };
        };

        return cls;
    })();

    if(!GLOBAL.indexedDB) {
        GLOBAL.IdbWrapper = new IdbWrapperCompat();
        console.log("Using IdbWrapper in compat mode, i.e. calls are redirected to main thread.");
    } else GLOBAL.IdbWrapper = new IdbWrapper();
}(this));
