/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

"use strict";

angular.module("FireDictProvider")
.factory("dictProvider", ["$timeout", "$rootScope",
    function ($timeout, $rootScope) {
        var groupProvider, dictWorker, dictionaries, settingsProvider;

        groupProvider = (function () {
            var groups = {}, cls;

            (function () {
                var stored_groups = localStorage.getItem("dictionary-groups")
                if(stored_groups === null) save_data()
                else groups = JSON.parse(stored_groups);
            })();

            function save_data() {
                localStorage.setItem("dictionary-groups", JSON.stringify(groups));
            }

            cls = {
                "new_group": function (group) {
                    if(groups.hasOwnProperty(group)) return false;
                    else {
                        groups[group] = [];
                        save_data();
                        return true;
                    }
                },
                "rename_group": function (group, new_name) {
                    if(!groups.hasOwnProperty(group)) return false;
                    else {
                        var result = groupProvider.new_group(new_name),
                            old_members = groupProvider.members(group);
                        for(var i = 0; i < old_members.length; i += 1) {
                            result = result && groupProvider.add_to_group(new_name, old_members[i]);
                        }
                        return result && groupProvider.remove_group(group);
                    }
                },
                "remove_group": function (group) {
                    if(!groups.hasOwnProperty(group)) return false;
                    else {
                        delete groups[group];
                        save_data();
                        return true;
                    }
                },
                "add_to_group": function (group, did) {
                    if(!groups.hasOwnProperty(group)) return false;
                    if(groups[group].indexOf(did) === -1) {
                        groups[group].push(did);
                        save_data();
                    }
                    return true;
                },
                "remove_from_group": function (group, did) {
                    if(!groups.hasOwnProperty(group)) return false;
                    var didx = groups[group].indexOf(did);
                    if(didx >= 0) {
                        groups[group].splice(didx, 1);
                        save_data();
                    }
                    return true;
                },
                "is_member": function (group, did) {
                    if(!groups.hasOwnProperty(group)) return null;
                    else return groups[group].indexOf(did) >= 0;
                },
                "members": function (group) {
                    if(!groups.hasOwnProperty(group)) return null;
                    else return groups[group].concat();
                },
                "is_active": function (group) {
                    var members = groupProvider.members(group),
                        result = 0;
                    dictionaries.forEach(function (dict) {
                        if(members.indexOf(dict.id) >= 0 && dict.active)
                            result += 1;
                    });
                    if(result == 0) return "inactive";
                    if(result < members.length) return "";
                    return "active";
                },
                "toggle_active": function (group, target) {
                    if(typeof target !== "undefined") target = false;
                    var members = groupProvider.members(group);
                    if(groupProvider.is_active(group) === "inactive") target = true;
                    dictionaries.forEach(function (dict) {
                        if(members.indexOf(dict.id) >= 0) dict.active = target;
                    });
                }
            };

            Object.defineProperty(cls, "list", {
                get: function () {
                    var result = [];
                    for(var group in groups) {
                        if(groups.hasOwnProperty(group)) {
                            result.push(group)
                        }
                    }
                    return result;
                }
            });

            return cls;
        })();

        dictWorker = (function () {
            var oWorker = new Worker("js/worker.js"),
                oListeners = {
                    reply: function (obj) {
                        transactions[obj.tid](obj.data);
                        delete transactions[obj.tid];
                    }
                },
                transactions = [];

            oWorker.onmessage = function (oEvent) {
                if (oEvent.data instanceof Object
                    && oEvent.data.hasOwnProperty("vo42t30")
                    && oEvent.data.hasOwnProperty("e4b869b")
                    && oEvent.data.hasOwnProperty("rnb93qh")) {
                    var tid = oEvent.data.e4b869b;
                    $timeout(function () {
                        oListeners[oEvent.data.vo42t30]({
                            tid: tid,
                            data: oEvent.data.rnb93qh,
                            reply: function (data) {
                                oWorker.postMessage({
                                    "bk4e1h0": "reply",
                                    "df65d4e": tid,
                                    "ktp3fm1": data
                                });
                            }
                        });
                    });
                } else console.log("Wk: " + oEvent.data);
            };

            oWorker.onerror = function (e) {
                    e.preventDefault();
                    console.error("Wk: " + e.filename + "(" + e.lineno + "): " + e.message);
            };

            var workerObj = {
                query: function () {
                    if (arguments.length < 1)
                        throw new TypeError("dictWorker.query: not enough arguments");
                    var queryObj = {
                        "bk4e1h0": arguments[0],
                        "df65d4e": 0,
                        "ktp3fm1": arguments[1]
                    }
                    return new Promise(function (resolve) {
                        queryObj.df65d4e = transactions.length;
                        transactions.push(resolve);
                        oWorker.postMessage(queryObj);
                    });
                },
                addListener: function (sName, fListener) {
                    oListeners[sName] = fListener;
                }
            };

            workerObj.addListener("init_ready", function (obj) {
                $rootScope.dialog.close();
                dictionaries.set(obj.data);
            });

            workerObj.addListener("progress", function (obj) {
                var data = obj.data,
                    value = [];
                if(data.hasOwnProperty("total"))
                    value = [data.status, data.total];
                if($rootScope.dialog.type() == "progress") {
                    $rootScope.dialog.update(value, data.text);
                } else {
                    $rootScope.dialog.open({
                        type: "progress",
                        text: data.text,
                        l20n: { text: data.l20n_text },
                        value: value
                    });
                }
            });

            workerObj.addListener("IdbWrapper", function (obj) {
                var action = obj.data.action, data = obj.data.data;
                IdbWrapper[action](data).then(obj.reply);
            });

            workerObj.addListener("DictScanner", function (obj) {
                DictScanner.scan().then(obj.reply);
            });

            workerObj.query("init");

            return workerObj;
        })();

        dictionaries = (function () {
            var aDicts = [];

            function edited() {
                var arr = [];
                aDicts.forEach(function (dict) { arr.push(dict.toObj()); });
                dictWorker.query("edit_dictionaries", arr);
            };

            var DictCls = function (dictObj) {
                var dobj = dictObj;

                this.toObj = function () { return dictObj; };

                this.__defineSetter__("color", function (val) {
                    dobj.color = val; edited();
                });
                this.__defineGetter__("color", function () {
                    if(settingsProvider.get("greyscale") == "true") {
                        var aRGB = hexToRGB(dobj.color),
                            gr = ((aRGB[0]+aRGB[1]+aRGB[2])/3.0)>>0;
                        return RGBToHex([gr,gr,gr]);
                    }
                    return dobj.color;
                });

                this.__defineGetter__("rank", function () { return dobj.rank; });
                this.__defineSetter__("rank", function (val) { dobj.rank = val; edited(); });
                this.__defineGetter__("alias", function () { return dobj.alias; });
                this.__defineSetter__("alias", function (val) { dobj.alias = val; edited(); });
                this.__defineGetter__("active", function () { return dobj.active; });
                this.__defineSetter__("active", function (val) { dobj.active = val; edited(); });
                this.__defineGetter__("id", function () { return dobj.version; });
            };

            aDicts.sorted = function () {
                var arr = aDicts.concat();
                arr.sort(function(a,b) {return a.rank - b.rank;});
                return arr;
            }

            aDicts.byId = function (id) {
                for(var d = 0; d < aDicts.length; d++) {
                    if(aDicts[d].id == id) return aDicts[d];
                }
            };

            aDicts.set = function (arr) {
                aDicts.splice(0, aDicts.length);
                for(var d = 0; d < arr.length; d++)
                    aDicts.push(new DictCls(arr[d]));
            };

            return aDicts;
        })();

        settingsProvider = (function () {
            var DEFAULT_SETTINGS = [
                    ["greyscale", "false"],
                    ["expandable", "true"],
                    ["fontsize", "1.0"]
                ],
                SETTINGS_PREFIX = "settings-";

            DEFAULT_SETTINGS.forEach(function (el) {
                var key = SETTINGS_PREFIX + el[0];
                if(localStorage.getItem(key) === null)
                    localStorage.setItem(key, el[1]);
            });

            return {
                "get": function (key) {
                    return localStorage.getItem(SETTINGS_PREFIX + key);
                },
                "set": function (key, val) {
                    localStorage.setItem(SETTINGS_PREFIX + key, val);
                }
            };
        })();

        return {
            "dicts": dictionaries,
            "worker": dictWorker,
            "groups": groupProvider,
            "settings": settingsProvider
        };
    }
]);
