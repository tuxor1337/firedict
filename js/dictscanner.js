/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

"use strict";

(function (GLOBAL) {
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

    function scan_area(sdcard) {
        var request = sdcard.enumerate("dictdata"),
            path_prefix = null,
            filelist = [],
            subdirs = [];

        function sort_files() {
            for(var i = 0; i < subdirs.length; i++) {
                var test = cat_paths(subdirs[i].prefix, subdirs[i].path);
                filelist.forEach(function (f) {
                    if(f.name.substring(0,test.length) == test)
                        subdirs[i].files.push(f);
                });
            }
        }

        return new Promise(function (resolve) {
            request.onsuccess = function () {
                if(!this.result) {
                    sort_files();
                    resolve(subdirs);
                } else {
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
                sort_files();
                resolve(subdirs);
            };
        });
    }

    function DictScanner_scan() {
        var sdcard_areas = GLOBAL.navigator.getDeviceStorages("sdcard"),
            subdirs = [];

        return new Promise(function (resolve) {
            (function rec_scan(n) {
                if(n < sdcard_areas.length) {
                    scan_area(sdcard_areas[n])
                    .then(function (result){
                        subdirs = subdirs.concat(result)
                        rec_scan(n+1);
                    });
                } else {
                    resolve(subdirs);
                }
            })(0);
        });
    }

    var DictScanner = {
        "scan": DictScanner_scan
    };

    var DictScannerCompat = {
        "scan": function () { return query("DictScanner"); }
    };

    if(!GLOBAL.navigator.getDeviceStorages) {
        GLOBAL.DictScanner = DictScannerCompat;
        console.log("Using DictScanner in compat mode, i.e. calls are redirected to main thread.");
    } else GLOBAL.DictScanner = DictScanner;
}(this));
