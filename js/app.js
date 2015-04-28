/**
 * This file is part of FireDict.
 * (c) 2013-2014 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */
 
"use strict";

function escapeHtml(text) {
    var map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
        
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
        $rootScope.drawerOpen = false;
        $rootScope.toggleSidebar = function ($event, drawerOpen) {
            if(typeof drawerOpen === "undefined")
                drawerOpen = !$rootScope.drawerOpen;
            $rootScope.drawerOpen = drawerOpen;
            if($event.currentTarget.getAttribute("id") !== "mainArea")
                $event.stopPropagation();
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
        dictWorker.addListener("lookup_continue", function (obj) {
            obj.reply(obj.data.term == $rootScope.search_term
                      && $rootScope.showingEntry === false);
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
            } else if(action == "store_oft") {
                var did = data.did, chunksize = data.chunksize,
                    idb_ostore = "dict" + did,
                    data = data.data;
                
                var store = indexedDB_handle.transaction(idb_ostore, "readwrite")
                                            .objectStore(idb_ostore);
                store.add(data.idxOft, 0)
                .onsuccess = function () {
                    store.add(data.synOft, 1)
                    .onsuccess = function () {
                        obj.reply();
                    };
                };
            } else if(action == "restore_oft") {
                var did = data.did,
                    idb_ostore = "dict" + did;
                    
                var store = indexedDB_handle.transaction(idb_ostore)
                    .objectStore(idb_ostore),
                    result = {};
                store.get(0)
                .onsuccess = function (event) {
                    result.idxOft = event.target.result;
                    store.get(1)
                    .onsuccess = function (event) {
                        result.synOft = event.target.result;
                        obj.reply(result);
                    };
                };
            }
        });
        dictWorker.addListener("scan_dictdata", function (obj) {
            var sdcard_areas = navigator.getDeviceStorages("sdcard"),
                filelist = [],
                subdirs = [];
            
            function split_path(path) {
                var pos_slash = path.lastIndexOf('/'),
                    pos_dot = path.lastIndexOf('.');
                return [
                    path.substring(0, pos_slash),
                    path.substring(pos_slash+1),
                    path.substring(pos_dot+1),
                ];
            }
            
            function cat_paths(p1, p2) {
                if(p1 == "") return p2;
                if(p2 == "") return p1;
                p1 = p1.replace(/\/+$/, "");
                p2 = p2.replace(/^\/+/, "");
                return p1 + "/" + p2;
            }
            
            (function scan_area(n) {
                if(n < sdcard_areas.length) {
                    var sdcard = sdcard_areas[n],
                        request = sdcard.enumerate("dictdata"),
                        path_prefix = null;
                        
                    request.onsuccess = function () {
                        if(!this.result) scan_area(n+1);
                        else {
                            var fname = this.result.name;
                            if(path_prefix === null) {
                                var pos = fname.indexOf("dictdata");
                                path_prefix = fname.substring(0, pos);
                            }
                            fname = fname.substring(path_prefix.length);
                            if(null != fname.match(/^dictdata\/[^\/]+\/[^\/]+\.ifo$/)) {
                                var path = split_path(fname)[0] + "/";
                                subdirs.push({
                                    "path": path,
                                    "prefix": path_prefix,
                                    "files": []
                                });
                            }
                            filelist.push(this.result);
                            this.continue();
                        }
                    };
                    
                    request.onerror = function () {
                        console.log("Error while scanning sdcard: ("
                            + request.error.name + ") " + request.error.message);
                        console.log("Path prefix of current storage: "
                            + path_prefix);
                        scan_area(n+1);
                    };
                } else {
                    for(var i = 0; i < subdirs.length; i++) {
                        var test = cat_paths(subdirs[i].prefix, subdirs[i].path);
                        filelist.forEach(function (f) {
                            if(f.name.substring(0,test.length) == test)
                                subdirs[i].files.push(f);
                        });
                    }
                    obj.reply(subdirs);
                }
            })(0);
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
