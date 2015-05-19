/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

"use strict";

var jq = angular.element;

jq.prototype.index = function () {
    var i = 0, child = this[0];
    while( (child = child.previousSibling) != null) {
        if(child.nodeType === 1) i++;
    }
    return i;
};

jq.prototype.next = function () {
    var cur = this[0];
	while ( (cur = cur.nextSibling) && cur.nodeType !== 1 ) {}
	return jq(cur);
};

jq.prototype.prev = function () {
    var cur = this[0];
	while ( (cur = cur.previousSibling) && cur.nodeType !== 1 ) {}
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
            $event.preventDefault();
            if(typeof drawerOpen === "undefined")
                drawerOpen = !$rootScope.drawerOpen;
            $rootScope.drawerOpen = drawerOpen;
            if($event.currentTarget.getAttribute("id") !== "mainArea")
                $event.stopPropagation();
        };
    }
]);
