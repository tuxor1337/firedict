/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

"use strict";

var DEFAULT_SETTINGS = [
    ["settings-greyscale", "false"],
    ["settings-fontsize", "1.0"]
];

DEFAULT_SETTINGS.forEach(function (el) {
    if(localStorage.getItem(el[0]) === null)
        localStorage.setItem(el[0], el[1]);
});

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
        $rootScope.dictColor = function (dict) {
            if(localStorage.getItem("settings-greyscale") == "true") {
                var aRGB = hexToRGB(dict.color),
                    gr = ((aRGB[0]+aRGB[1]+aRGB[2])/3.0)>>0;
                return RGBToHex([gr,gr,gr]);
            }
            return dict.color;
        }

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
        dictWorker.addListener("IdbWrapper", function (obj) {
            var action = obj.data.action, data = obj.data.data;
            IdbWrapper[action](data).then(obj.reply);
        });
        dictWorker.addListener("DictScanner", function (obj) {
            DictScanner.scan().then(obj.reply);
        });

        dictWorker.query("init");
    }
]);
