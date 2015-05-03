/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

var FireDictProvider = angular.module("FireDictProvider", [])
.factory("dictProvider", ["$rootScope", function ($rootScope) {
    var groupProvider = (function () {
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
                $rootScope.dictionaries.forEach(function (dict) {
                    if(members.indexOf(dict.version) >= 0 && dict.active)
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
                $rootScope.dictionaries.forEach(function (dict) {
                    if(members.indexOf(dict.version) >= 0) dict.active = target;
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

    var dictWorker = (function () {
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
            } else console.log("Wk: " + oEvent.data);
        };

        oWorker.onerror = function (e) {
                e.preventDefault();
                console.error("Wk: " + e.filename + "(" + e.lineno + "): " + e.message);
        };

        return {
            query: function () {
                if (arguments.length < 1) {
                    throw new TypeError("dictWorker.query - not enough arguments");
                    return;
                }
                var queryObj = {
                    "bk4e1h0": arguments[0],
                    "df65d4e": 0,
                    "ktp3fm1": arguments[1]
                }
                return new Promise(function (resolve, reject) {
                    queryObj.df65d4e = transactions.length;
                    transactions.push(resolve);
                    oWorker.postMessage(queryObj);
                });
            },
            addListener: function (sName, fListener) {
                oListeners[sName] = fListener;
            }
        };
    })();

    return {
        "dictionaries": function (sorted) {
            if("undefined" === typeof sorted) sorted = false;
            var aDicts = $rootScope.dictionaries;
            if(sorted) {
                aDicts = aDicts.concat();
                aDicts.sort(function(a,b) {return a.rank - b.rank;});
            }
            return aDicts;
        },
        "worker": dictWorker,
        "groups": groupProvider
    };
}]);
