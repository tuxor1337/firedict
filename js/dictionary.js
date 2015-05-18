/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

"use strict";

(function (GLOBAL) {
    var CHUNKSIZE = 2531;

    function random_color() {
        var min = 0x33, max = 0xbb, result = "#";
        for(var i = 0; i < 3; i++)
            result += (0x100+min + (max-min) * Math.random())
                .toString(16).substr(1,2);
        return result;
    }

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

    var dictionaryIdb = (function () {
        var cls = function (version) {
            var did = version;

            function do_action(action, data) {
                return IdbWrapper[action]({
                    "data": data,
                    "did": did,
                    "chunksize": CHUNKSIZE
                });
            }

            this.store_oft = function(data) {
                return do_action("store_oft", data);
            };

            this.restore_oft = function () {
                return do_action("restore_oft");
            };

            this.get_meta = function () {
                return do_action("get_meta");
            };

            this.set_meta = function (meta) {
                return do_action("set_meta", meta);
            };

            this.version = function () { return did; };
        };

        cls.create = function () {
            return new Promise(function (resolve, reject) {
                IdbWrapper.add_dictionary()
                .then(function (version) { resolve(new cls(version)); });
            });
        };

        return cls;
    })();

    var Dictionary = (function () {
        var cls = function(files, cmp_fct) {
            var meta_info = {},
                idxOft = null, synOft = null,
                oStarDict = new StarDict(files), oDB,
                cmp_func = cmp_fct || stardict_strcmp,
                that = this;

            function save_meta() {
                return oDB.set_meta(meta_info);
            }

            function getSynonymAt(offset) {
                return oStarDict.synonyms({
                    "start_offset": offset
                })[0];
            }

            function getIndexAt(offset) {
                return oStarDict.index({
                    "start_offset": offset
                })[0];
            }

            function getIndexById(wid) {
                var view = new Uint32Array(idxOft);
                var idx = oStarDict.index({
                    "start_offset": view[wid]
                })[0];
                return idx;
            }

            function getTermFromObj(obj) {
                if(obj.type == 0) return getIndexAt(obj.id).term;
                else return getSynonymAt(obj.id).term;
            }

            function decodeObj(obj) {
                var idx, term, result = [];
                if(obj.type == 0) {
                    idx = getIndexAt(obj.id);
                    term = idx.term;
                } else {
                    var syn = getSynonymAt(obj.id);
                    idx = getIndexById(syn.wid);
                    term = syn.term;
                }
                return [term, idx, oDB.version()];
            }

            function createOft() {
                idxOft = oStarDict.oft();
                synOft = oStarDict.oft("synonyms");
                query("progress", {
                    text: oStarDict.keyword("bookname")
                });
                return oDB.store_oft({
                    "idxOft": idxOft,
                    "synOft": synOft
                });
            }

            this.resource = oStarDict.resource;

            this.entry = function (decodedObj) {
                return oStarDict.entry(decodedObj[1].dictpos);
            };

            this.lookup = function (word, fuzzy) {
                if(typeof fuzzy === "undefined") fuzzy = false;
                if(fuzzy) word = word.toLowerCase();

                function cmp(id, type) {
                    var term = getTermFromObj({ "type": type, "id": id });
                    if(fuzzy) term = term.substr(0, word.length).toLowerCase();
                    return cmp_func(term, word);
                }
                function binarySearch(arr, type) {
                    var miIndex = 0,
                        maIndex = arr.length - 1,
                        currIndex, currCmp = -1;

                    while (miIndex <= maIndex) {
                        currIndex = (miIndex + maIndex) / 2 | 0;
                        currCmp = cmp(arr[currIndex], type);
                        if (currCmp < 0) {
                            miIndex = currIndex + 1;
                        } else if (currCmp > 0) {
                            maIndex = currIndex - 1;
                        } else {
                            if(maIndex == miIndex) break;
                            else maIndex = currIndex;
                        }
                    }
                    return miIndex;
                }

                var result = [];

                [0,1].forEach(function (type) {
                    var buf = (type == 1) ? synOft : idxOft,
                        view = new Uint32Array(buf),
                        match = binarySearch(view, type);
                    while(match < view.length
                        && result.length < (type+1)*20
                        && cmp(view[match], type) == 0) {
                        result.push(
                            decodeObj({ "type": type, "id": view[match++] })
                        );
                    }
                });

                result.sort(function (a,b) {
                    return cmp_func(a[0],b[0]);
                });
                return result.slice(0,20);
            };

            this.init = function (path, rank) {
                var wordcount = parseInt(oStarDict.keyword("wordcount")),
                    synwordcount = parseInt(oStarDict.keyword("synwordcount") ? oStarDict.keyword("synwordcount") : 0),
                    short_name = oStarDict.keyword("bookname");
                if(short_name.length > 10)
                    short_name = short_name.substring(0,10) + "...";

                return dictionaryIdb.create()
                .then(function (db) {
                    oDB = db;
                    console.debug("(syn)wordcount for dictionary `"
                            + short_name + "`: " + wordcount + " (" + synwordcount + ")");
                    return createOft();
                }).then(function () {
                    meta_info = {
                        "path": path,
                        "version": oDB.version(),
                        "color": random_color(),
                        "rank": rank,
                        "alias": oStarDict.keyword("bookname"),
                        "size": wordcount + synwordcount,
                        "active": true
                    };
                    return save_meta();
                });
            };

            this.restore = function (version, force_oft_creation) {
                oDB = new dictionaryIdb(version);
                return new Promise(function (resolve, reject) {
                    oDB.get_meta().then(function (meta) {
                        meta_info = meta;
                        if(force_oft_creation) return createOft();
                        else return oDB.restore_oft();
                    }).then(function (data) {
                        if(idxOft === null) {
                            idxOft = data.idxOft;
                            synOft = data.synOft;
                        }
                        resolve();
                    });
                });
            };

            this.meta = function (dict) {
                if(typeof dict !== "undefined") {
                    meta_info = dict; save_meta();
                }
                return meta_info;
            };

            this.version = function () { return meta_info.version; };
        }

        return cls;
    })();

    GLOBAL.Dictionary = Dictionary;
}(this));
