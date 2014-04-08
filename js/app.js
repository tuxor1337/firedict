"use strict";
    
var stardict_strcmp = (function () {
    var CHARCODE_A_CAPITAL = "A".charCodeAt(0),
        CHARCODE_Z_CAPITAL = "Z".charCodeAt(0),
        CHARCODE_A_SMALL = "a".charCodeAt(0);
        
    function isAsciiUpper(c) {
        return c.charCodeAt(0) >= CHARCODE_A_CAPITAL
            && c.charCodeAt(0) <= CHARCODE_Z_CAPITAL;
    }
    
    function asciiLower(c) {
        if(isAsciiUpper(c))
            return String.fromCharCode(
                CHARCODE_A_SMALL + c.charCodeAt(0) - CHARCODE_A_CAPITAL
            );
        else return c;
    }
    
    function ascii_strcasecmp(s1, s2) {
        var commonLen = Math.min(s1.length, s2.length)
        for(var i = 0; i < commonLen; i++) {
            var c1 = asciiLower(s1[i]).charCodeAt(0),
                c2 = asciiLower(s2[i]).charCodeAt(0);
            if(c1 != c2) return c1 - c2;
        }
        return s1.length - s2.length;
    }
    
    function strcmp(s1, s2) {
        var commonLen = Math.min(s1.length, s2.length)
        for(var i = 0; i < commonLen; i++) {
            var c1 = s1.charCodeAt(i),
                c2 = s2.charCodeAt(i);
            if(c1 != c2) return c1 - c2;
        }
        return s1.length - s2.length
    }
    
    return function (s1, s2) {
        var cmp = ascii_strcasecmp(s1, s2);
        if(cmp == 0) return strcmp(s1, s2);
        else return cmp;
    };
})();

var iterFactory = function(view, mode) {
    function getUintAt(arr, offs) {
        if(offs < 0) offs = arr.length + offs;
        out = 0;
        for (var j = offs; j < offs+4; j++) {
                out <<= 8;
                out |= arr[j] & 0xff;
        }
        return out;
    }
    
    var readUTF8String = (function () {
        var decoder = new TextDecoder("utf-8");
        return function (bytes) {
            return decoder.decode(bytes);
        };
    })();

    return new function () {
        var currOffset = 0;
    
        function getEOS(offset) {
            for(var i = offset; i < view.length; i++) {
                if(view[i] == 0) return i;
            }
            return -1;
        }
        
        this.data = function (offset) {
            if(mode == "synonyms")
                return getUintAt(view, getEOS(offset)+1);
            else return [
                getUintAt(view, getEOS(offset)+1),
                getUintAt(view, getEOS(offset)+5)
            ];
        };
        
        this.term = function (offset) {
            return readUTF8String(
                view.subarray(offset, getEOS(offset))
            );
        };
        
        this.next = function () {
            var j = currOffset, result = null,
                datalen = (mode == "synonyms") ? 4 : 8;
            
            for( ; currOffset < view.length; currOffset++) {
                if(view[currOffset] == 0) {
                    result = j; currOffset += datalen + 1;
                    break;
                }
            }
            return result;
        };
        
        this.view = view;
    };
};

angular.module("FireDict", [
    "ngRoute", "ngSanitize", "ngTouch",
    "FireDictControllers", "FireDictDirectives"
])
.config(["$compileProvider", function($compileProvider) {
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(file|https?|ftp|mailto|app):/);
}])
.config(["$routeProvider", function($routeProvider) {
        $routeProvider
        .when('/lookup', {
            templateUrl: 'partials/lookup.html',
            controller: 'lookupCtrl'
        })
        .when('/manage', {
            templateUrl: 'partials/manage.html',
            controller: 'manageCtrl'
        })
        .when('/settings', {
            templateUrl: 'partials/settings.html',
            controller: 'settingsCtrl'
        })
        .when('/about', {
            templateUrl: 'partials/about.html',
            controller: 'aboutCtrl'
        })
        .otherwise({
            redirectTo: '/lookup'
        });
}])
.run(["$rootScope", "dictWorker", "ngDialog",
    function ($rootScope, dictWorker, ngDialog) {
        $rootScope.search_term = "";
        $rootScope.menuitems = [
            { ref: "lookup", label: "Lookup Words" },
            { ref: "manage", label: "Manage Dictionaries" },
            { ref: "settings", label: "Settings" },
            { ref: "about", label: "About" }
        ];
        $rootScope.drawerOpen = false;
        $rootScope.toggleSidebar = function () {
            if($rootScope.drawerOpen) $rootScope.drawerOpen = false;
            else $rootScope.drawerOpen = true;
        };
        
        $rootScope.dictionaries = [];
        $rootScope.$watch("dictionaries", function (val) {
            dictWorker.query("edit_dictionaries", val);
        }, true);
        $rootScope.dictById = function (ver) {
            for(var d = 0; d < $rootScope.dictionaries.length; d++) {
                if($rootScope.dictionaries[d].version == ver)
                    return $rootScope.dictionaries[d];
            }
        };
        
        dictWorker.addListener("init_ready", function (obj) {
            ngDialog.close();
            $rootScope.dictionaries = obj.data;
            if(!$rootScope.$$phase) { $rootScope.$apply(); }
        });
        dictWorker.addListener("progress", function (obj) {
            var data = obj.data,
                value = [];
            if(data.hasOwnProperty("total"))
                value = [data.status, data.total];
            if(ngDialog.type() == "progress") {
                ngDialog.update(value, data.text);
            } else {
                ngDialog.open({
                    type: "progress",
                    text: data.text,
                    value: value
                });
            }
            if(!$rootScope.$$phase) { $rootScope.$apply(); }
        });
        dictWorker.addListener("indexedDB", function (obj) {
            var action = obj.data.action, data = obj.data.data;
            function do_async_rec(work, check, terminate) {
                if(!check()) terminate();
                else work().then(function () {
                    do_async_rec(work, check, terminate);
                });
            }
            
            if(action == "get_dictionaries") {
                var aDicts = [];
                indexedDB_handle.transaction("dictionaries")
                    .objectStore("dictionaries").openCursor()
                    .onsuccess = function (event) {
                    var cursor = event.target.result;
                    if(!!cursor == false) obj.reply(aDicts);
                    else {
                        aDicts.push(cursor.value);
                        cursor.continue();
                    }
                }
            } else if(action == "get_history") {
                indexedDB_handle.transaction("history")
                    .objectStore("history").get(0)
                    .onsuccess = function (evt) {
                    var cache = evt.target.result;
                    if(typeof evt.target.result === "undefined") cache = [];
                    obj.reply(cache);
                };
            } else if(action == "add_dictionary") {
                var version = parseInt(indexedDB_handle.version)+1;
                if(typeof data === "undefined") data = {};
                open_db(
                    function () {
                        data.version = version;
                        indexedDB_handle.transaction("dictionaries", "readwrite")
                            .objectStore("dictionaries").add(data, version);
                        obj.reply(version);
                    },
                    function (db) {
                        db.createObjectStore("idx"+version);
                        db.createObjectStore("dict"+version);
                    },
                    version
                );
            } else if(action == "remove_dictionary") {
                var version = parseInt(indexedDB_handle.version)+1;
                open_db(
                    function () {
                        indexedDB_handle.transaction("dictionaries", "readwrite")
                            .objectStore("dictionaries").delete(data);
                        obj.reply();
                    },
                    function (db) {
                        db.deleteObjectStore("idx"+data);
                        db.deleteObjectStore("dict"+data);
                    },
                    version
                );
            } else if(action == "set_history") {
                indexedDB_handle.transaction("history", "readwrite")
                    .objectStore("history").put(data, 0);
            } else if(action == "set_meta") {
                var did = data.did, data = data.data;
                indexedDB_handle.transaction("dictionaries", "readwrite")
                    .objectStore("dictionaries").put(data, did)
                    .onsuccess = function () { obj.reply(); };
            } else if(action == "get_meta") {
                var did = data.did;
                indexedDB_handle.transaction("dictionaries")
                    .objectStore("dictionaries").get(did)
                    .onsuccess = function (event) {
                        obj.reply(event.target.result);
                };
            } else if(action == "store_terms") {
                var did = data.did, chunksize = data.chunksize,
                    idb_ostore = "dict" + did,
                    data = data.data, wordcount = data["wordcount"];
                    
                var aIndex = [], aChunks = [], full_term_list = [],
                    cmp_func = stardict_strcmp,
                    merge_sorted_iters = function (iter1, iter2) {
                        var curr1 = iter1.next(), curr2 = iter2.next(),
                            currentCmp, currentTerm;
                        
                        function add_el(offset, type) {
                            var id = (type == 0) ? aIndex.length : offset;
                            if(type == 0) aIndex.push(offset);
                            if(full_term_list.length % chunksize == 0) {
                                if(type == 0) currentTerm = iter1.term(offset);
                                else currentTerm = iter2.term(offset);
                                aChunks.push(currentTerm);
                            }
                            full_term_list.push({ "type": type, "id": id });
                        }
                        
                        while(curr1 != null && curr2 != null) {
                            currentCmp = cmp_func(iter1.term(curr1), iter2.term(curr2));
                            
                            if(currentCmp <= 0) {
                                add_el(curr1, 0);
                                curr1 = iter1.next();
                            } else {
                                add_el(curr2, 1);
                                curr2 = iter2.next();
                            }
                            
                            if(full_term_list.length % chunksize == 0)
                                ngDialog.update([
                                    30*full_term_list.length/wordcount, 100
                                ]);
                        }
                        while(curr1 != null) {
                            add_el(curr1, 0); curr1 = iter1.next();
                        }
                        while(curr2 != null) {
                            add_el(curr2, 1); curr2 = iter2.next();
                        }
                    };
                
                merge_sorted_iters(
                    iterFactory(data["viewIdx"], "index"),
                    iterFactory(data["viewSyn"], "synonyms")
                );
                
                data = full_term_list;
                ngDialog.update([30, 100]);
                
                var store = indexedDB_handle.transaction(idb_ostore, "readwrite")
                                            .objectStore(idb_ostore),
                    i = 0, totalwordcount = data.length;
                do_async_rec(
                    function () {
                        return new Promise(function (resolve, reject) {
                            store.add(data.slice(0, chunksize), i)
                                .onsuccess = function () {
                                i += 1;
                                if(i % 7 == 0)
                                    ngDialog.update([
                                        30+70*i*chunksize/totalwordcount,
                                        100
                                    ]);
                                data = data.slice(chunksize);
                                resolve();
                            };
                        });
                    },
                    function () { return data.length > 0; },
                    function () {
                        idb_ostore = "idx" + did;
                        indexedDB_handle.transaction(idb_ostore, "readwrite")
                            .objectStore(idb_ostore).add(aIndex, 0)
                            .onsuccess = function () {
                            obj.reply({
                                "index": aIndex,
                                "chunks": aChunks
                            });
                        };
                    }
                );
            } else if(action == "restore_idx") {
                var did = data.did,
                    idb_ostore = "idx" + did,
                    data = data.data;
                indexedDB_handle.transaction(idb_ostore)
                    .objectStore(idb_ostore).get(0)
                    .onsuccess = function (event) {
                        obj.reply(event.target.result);
                };
            } else if(action == "get_range") {
                var did = data.did, chunksize = data.chunksize,
                    idb_ostore = "dict" + did,
                    data = data.data,
                    size = $rootScope.dictById(did).size;
                data.len = Math.min(data.len, size - data.start);
                var result = [], len, start = data.start,
                    offset = start / chunksize | 0;
                do_async_rec(
                    function () {
                        return new Promise(function (resolve, reject) {
                            indexedDB_handle.transaction(idb_ostore)
                                .objectStore(idb_ostore).get(offset)
                                .onsuccess = function (evt) {
                                var res = evt.target.result,
                                    chunk_a = start%chunksize,
                                    chunk_b = chunk_a + len;
                                result = result.concat(res.slice(chunk_a, chunk_b));
                                offset += 1; start = 0;
                                resolve();
                            };
                        });
                    },
                    function () { 
                        len = data.len - result.length;
                        return len > 0;
                    },
                    function () { obj.reply(result); }
                );
            } else if(action == "get") {
                var did = data.did, chunksize = data.chunksize,
                    idb_ostore = "dict" + did,
                    data = data.data;
                var offset = data / chunksize | 0,
                    idx = data%chunksize;
                indexedDB_handle.transaction(idb_ostore)
                    .objectStore(idb_ostore).get(offset)
                    .onsuccess = function(evt) {
                        var ret = evt.target.result[idx];
                        obj.reply(ret);
                };
            }
        });
        dictWorker.addListener("scan_dictdata", function (obj) {
            var sdcard = navigator.getDeviceStorage("sdcard"),
                request = sdcard.enumerate("dictdata"),
                result = [];
                
            function add_subdir(n) {
                if(result.length <= n) obj.reply(result);
                else {
                    var req = sdcard.enumerate(result[n]);
                    result[n] = { "path": result[n], "files": [] };
                    req.onsuccess = function () {
                        if(!this.result) add_subdir(n+1);
                        else {
                            result[n].files.push(this.result);
                            this.continue();
                        }
                    };
                    req.onerror = function () { 
                        console.log("Error while scanning '" + result[n].path
                            + "': (" + request.error.name
                            + ") " + request.error.message);
                        add_subdir(n+1); 
                    };
                }
            }
            
            function split_path(path) {
                var pos_slash = path.lastIndexOf('/'),
                    pos_dot = path.lastIndexOf('.');
                return [
                    path.substring(0, pos_slash),
                    path.substring(pos_slash+1),
                    path.substring(pos_dot+1),
                ];
            }
            
            var path_prefix = null;
            request.onsuccess = function () {
                if(!this.result) add_subdir(0);
                else {
                    var fname = this.result.name;
                    if(path_prefix === null) {
                        var pos = fname.indexOf("dictdata");
                        path_prefix = fname.substring(0, pos);
                    }
                    fname = fname.substring(path_prefix.length);
                    if(null != fname.match(/^dictdata\/[^\/]+\/[^\/]+\.ifo$/)) {
                        var path = split_path(fname)[0];
                        result.push(path);
                    }
                    this.continue();
                }
            };
                
            request.onerror = function () {
                console.log("Error while scanning sdcard: (" + request.error.name
                    + ") " + request.error.message);
                obj.reply(result);
            };
        });
        
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
        open_db(
            function () { dictWorker.query("init"); },
            function (db) {
                db.createObjectStore("dictionaries");
                db.createObjectStore("history");
            }
        );
    }
]);
