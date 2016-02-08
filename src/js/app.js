/**
 * This file is part of FireDict.
 * (c) 2013-2016 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

"use strict";

angular.module("FireDictProvider", []);
angular.module("FireDictControllers", ["FireDictProvider"]);
angular.module("FireDictDirectives", ["FireDictProvider", "ngRoute"]);
angular.module("FireDict", ["FireDictControllers", "FireDictDirectives", "ngRoute", "ngSanitize"]);

angular.module("FireDict")
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
}]);
