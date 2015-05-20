/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

"use strict";

var jq = angular.element;

jq.prototype.index = function () {
    var i = 0, child = this[0];
    while((child = child.previousSibling) != null) {
        if(child.nodeType === 1) i++;
    }
    return i;
};

jq.prototype.next = function () {
    var cur = this[0];
    while((cur = cur.nextSibling) && cur.nodeType !== 1) {}
    return jq(cur);
};

jq.prototype.prev = function () {
    var cur = this[0];
    while((cur = cur.previousSibling) && cur.nodeType !== 1) {}
    return jq(cur);
};

angular.module("FireDict", [
    "ngRoute", "ngSanitize", "ngTouch", "FireDictControllers"
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
        .when('/groups', {
            templateUrl: 'partials/groups.html',
            controller: 'groupsCtrl'
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
.run(["$rootScope", function ($rootScope) {
        $rootScope.drawerOpen = false;
        $rootScope.toggleSidebar = function ($event, drawerOpen) {
            if(typeof drawerOpen === "undefined")
                drawerOpen = !$rootScope.drawerOpen;
            $rootScope.drawerOpen = drawerOpen;
            if($event.currentTarget.getAttribute("id") !== "mainArea")
                $event.stopPropagation();
        };

        var defaults = {
              type: "confirm",
              range: null,
              l20n: null,
              value: null,
              callbk: null,
              validate: null
            },
            defaults_l20n = {
              text: "",
              success: "dialog-ok",
              cancel: "dialog-cancel"
            },
            validateFn = function () { return true; };

        function set_opts(options) {
            if(options.type == "progress" && typeof options.value === "undefined")
                options.value = [];
            options = angular.extend({}, defaults, options);
            if(options.type == "confirm") options.value = true;
            if(options.type == "prompt") {
                window.screen.mozLockOrientation("portrait-primary");
            } else {
                window.screen.mozUnlockOrientation();
            }
            if(options.l20n instanceof Object)
                options.l20n = angular.extend({}, defaults_l20n, options.l20n);
            $rootScope.modal = {
                visible: false,
                result: options.value,
                range: options.range,
                type: options.type,
                text: options.text,
                l20n: options.l20n,
                callbk: function (result) {
                    var callFn = options.callbk || validateFn;
                    callFn(result);
                    set_opts(defaults);
                },
                validate: function (result) {
                    var callFn = options.validate || validateFn;
                    return callFn(result);
                }
            };
        }

        set_opts(defaults);

        $rootScope.dialog = {
            update: function (res, text) {
                $rootScope.modal.result = res;
                if(typeof text !== "undefined")
                    $rootScope.modal.text = text;
            },
            close: function () {
                set_opts(defaults);
            },
            open: function (options) {
                set_opts(options);
                $rootScope.modal.visible = true;
            },
            type: function () {
                return $rootScope.modal.type;
            }
        };
    }
]);
