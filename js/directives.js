/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

"use strict";

angular.module("FireDictDirectives")
.directive("ngHeader", function ($timeout) {
    return {
        replace: true,
        restrict: "A",
        scope: {
            "onFocus": '=focus',
            "searchTerm": '=term',
            "toggleSidebar": '=toggle',
            "onReindex": '=reindex',
            "onAdd": '=addButton',
            "onEnter": '=enter',
            "onGroupButton": '=groups',
            "text": '@text'
        },
        link: function ($scope, $element, $attrs) {
            $scope.type = $attrs.type;
            $scope.onClear = function () {
                $scope.searchTerm = "";
                $timeout(function() {
                    $element.find("input")[0].focus();
                });
            };
            $element.find("input").on("keydown keypress",
                function (e) {
                    if(e.which === 13) {
                        e.preventDefault();
                        $timeout(function() { $scope.onEnter(e); });
                    }
                }
            );
        },
        templateUrl: "partials/header.html"
    };
})
.directive("ngWordpicker", function () {
    return {
        replace: true,
        restrict: "A",
        scope: {
            "markup": '=markup',
            "picked": '='
        },
        link: function ($scope, $element) {
            var c_div = $element[0].children[1];
            $scope.$watch(
            function () {
                var picked = c_div.querySelector(".picked");
                return (picked)?picked.textContent:"";
            },
            function (value) {
                $scope.picked = value
                .replace(/[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*$/,'')
                .replace(/^[\s!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]*/,'');
            });
            $scope.pick_word = wordpicker_wrap;
        },
        templateUrl: "partials/wordpicker.html"
    };
})
.directive("ngGrouppicker", ["dictProvider", function (dictProvider) {
    return {
        replace: true,
        restrict: "A",
        link: function ($scope, $element, $attrs) {
            $scope.selectable = $attrs.selectable;
            $scope.selected = -1;
            $scope.groups = dictProvider.groups;
            $scope.dictionaries = dictProvider.dicts;
            $scope.select = function (group) {
                if($scope.selectable) {
                    if($scope.selected == group) $scope.selected = -1;
                    else $scope.selected = group;
                }
            };
            $scope.isSelected = function (group) {
                return ($scope.selected === group)? "selected" : "";
            }
            $scope.groupDictFilter = function (group) {
                return function (dict) {
                    return dictProvider.groups.members(group).indexOf(dict.id) >= 0;
                };
            };
            $scope.all_active = function (bol) {
                var aDicts = dictProvider.dicts;
                function is_active() {
                    var result = 0;
                    aDicts.forEach(function (dict) {
                        if(dict.active) result += 1;
                    });
                    if(result == 0) return "inactive";
                    if(result < aDicts.length) return "";
                    return "active";
                }
                var target = false;
                if(typeof bol === "undefined") return is_active();
                else {
                    if(is_active() === "inactive") target = true;
                    aDicts.forEach(function (dict) { dict.active = target; });
                }
            };
            $scope.remove = function (group) {
                $scope.dialog.open({
                    l20n: {
                        text: "dialog-remove-group",
                        success: "dialog-yes-sure",
                        cancel: "dialog-no-forget-it"
                    },
                    value: group,
                    callbk: function (result) {
                        if(result === true) dictProvider.groups.remove_group(group);
                    }
                });
            };
            $scope.rename = function (group) {
                $scope.dialog.open({
                    type: "prompt",
                    l20n: {
                        text: "dialog-rename-group"
                    },
                    value: group,
                    callbk: function (alias) {
                        if(alias !== null) dictProvider.groups.rename_group(group, alias);
                    },
                    validate: function (alias) { return alias != ""; }
                });
            };
            $scope.setMembers = function (group) {
                var aDicts = [];
                dictProvider.dicts.sorted().forEach(function (dict) {
                    aDicts.push({
                        active: dictProvider.groups.is_member(group, dict.id),
                        name: dict.alias,
                        did: dict.id
                    });
                });
                $scope.dialog.open({
                    type: "group_membership",
                    l20n: {
                        text: "dialog-change-members"
                    },
                    value: aDicts,
                    callbk: function (dicts) {
                        if(dicts === null) return;
                        dicts.forEach(function (d) {
                            if(d.active) dictProvider.groups.add_to_group(group, d.did);
                            else dictProvider.groups.remove_from_group(group, d.did);
                        });
                    }
                });
            };
        },
        templateUrl: "partials/grouppicker.html"
    };
}])
.directive("ngDrawer", ["$location", function ($location) {
    return {
        replace: true,
        transclude: true,
        restrict: "A",
        link: function ($scope, $element, $attrs) {
            $scope.title = $attrs.title;
            $scope.menuitems = [
                {
                    "route": "/lookup",
                    "l10n": "section-lookup-words"
                },
                {
                    "route": "/manage",
                    "l10n": "section-manage-dicts"
                },
                {
                    "route": "/groups",
                    "l10n": "section-manage-groups"
                },
                {
                    "route": "/settings",
                    "l10n": "section-settings"
                },
                {
                    "route": "/about",
                    "l10n": "section-about"
                }
            ];
            $scope.go = function (path) { $location.path(path); };
        },
        templateUrl: "partials/sidebar.html"
    };
}])
.directive("ngSortable", function () {
    return {
        compile: function () {
            return function ($scope, $element, $attr) {
                var currIndex = -1,
                    dragover = null,
                    curr = null,
                    offsetX = 0, offsetY = 0,
                    ul_top = 0;

                var moveAfter = $scope.$eval($attr.moveFn);

                function dragover_handler() {
                    if(dragover === null) {
                        if(currIndex > 0) dragover = jq(curr).prev();
                        else dragover = jq(curr).next();
                        dragover = dragover.addClass("dragover")[0];
                    }
                    var pad = parseInt(
                            window.getComputedStyle(curr, null).marginBottom
                        ), refy = 0;
                    if(jq(dragover).index() == 0
                       || jq(dragover).index() == 1 && currIndex == 0)
                        refy = ul_top - pad;
                    else refy = dragover_prev().getBoundingClientRect().bottom;
                    var crect = curr.getBoundingClientRect(),
                        drect = dragover.getBoundingClientRect(),
                        dheight = drect.height + pad,
                        cheight = crect.height + pad,
                        mbottom = (crect.top - refy - pad)*cheight/dheight,
                        mtop = cheight - mbottom;
                    if(mtop < 0 || mbottom < 0) {
                        var candidate = (mtop < 0)?dragover_next():dragover_prev();
                        if(candidate !== null) return dragover_reset(candidate);
                    }
                    mtop = Math.min(cheight,Math.max(mtop,0))
                    mbottom = Math.min(cheight,Math.max(mbottom,0))
                    jq(dragover)
                    .css("margin-top", (mtop + pad) + "px")
                    .css("margin-bottom", (mbottom + pad) + "px");
                }

                function dragover_reset(candidate) {
                    jq(dragover).removeClass("dragover")
                        .css("margin-top","").css("margin-bottom","");
                    dragover = jq(candidate).addClass("dragover")[0];
                    dragover_handler();
                }

                function dragover_prev() {
                    var candidate = (currIndex+1 === jq(dragover).index())?
                        jq(curr).prev():jq(dragover).prev();
                    if(candidate.length === 0) return null;
                    return candidate[0];
                }

                function dragover_next() {
                    var candidate = (currIndex-1 === jq(dragover).index())?
                        jq(curr).next():jq(dragover).next();
                    if(candidate.length === 0) return null;
                    return candidate[0];
                }

                function curr_prev() {
                    var crect = curr.getBoundingClientRect(),
                        cmid = 0.5*(crect.bottom+crect.top),
                        drect = dragover.getBoundingClientRect(),
                        dmid = 0.5*(drect.bottom+drect.top);
                    if(cmid > dmid) return dragover;
                    else return dragover_prev();
                }

                function ontouchstart(e) {
                    var t = touchXY(e),
                        crect = curr.getBoundingClientRect();
                    $element.css("height", $element[0].clientHeight + "px")
                    ul_top = $element[0].getBoundingClientRect().top;
                    currIndex = jq(curr).index();
                    offsetY = t.Y - crect.top;
                    offsetX = t.X - crect.left;
                    jq(curr).css("width", curr.clientWidth + "px")
                        .addClass("sorting")
                        .css({ "top": crect.top + "px" })
                        .css({ "left": crect.left + "px" });
                    dragover_handler();
                }

                function ontouchmove(e) {
                    var t = touchXY(e);
                    jq(curr).css({ "top": (t.Y - offsetY) + "px" })
                        .css({ "left": (t.X - offsetX) + "px" });
                    dragover_handler();
                }

                function ontouchend() {
                    var prev = curr_prev();
                    jq(dragover).removeClass("dragover")
                        .css("margin-top","").css("margin-bottom","");
                    jq(curr).removeClass("sorting").css("width","")
                        .css("top","").css("left","");
                    $element.css("height","");
                    moveAfter(curr, prev);
                    curr = null, currIndex = -1, dragover = null;
                }

                $element
                .on("touchstart mousedown", function(e) {
                        if(e.target.classList.contains("handle")
                           && jq(this).children().length > 1) {
                            e.preventDefault();
                            curr = jq(e.target).parent()[0];
                            ontouchstart(e);
                       }
                })
                .on("touchmove mousemove", function (e) {
                    if(currIndex >= 0) {
                        e.preventDefault();
                        ontouchmove(e);
                    }
                })
                .on("touchend mouseup", function (e) {
                    if(currIndex >= 0) {
                        e.preventDefault();
                        ontouchend(e);
                    }
                });
            };
        }
    };
})
.directive('compile', ['$compile', "dictProvider",
    function ($compile, dictProvider) {
        return function($scope, $element, $attrs) {
            var ensureCompileRunsOnce = $scope.$watch(
                function($scope) {
                    return $scope.$eval($attrs.compile);
                },
                function(value) {
                    $element.html(value);
                    var c_div = $element.parent(),
                        picked_el = $element[0].querySelector(".picked");
                    if(dictProvider.settings.get("expandable") != "false") {
                        if(c_div.hasClass("content")
                           && c_div[0].scrollHeight > 150) {
                            c_div.addClass("expandable");
                        }
                    }
                    $compile($element.contents())($scope);
                    if(c_div.hasClass("wordpicker")) {
                        if(picked_el !== null) {
                            $element[0].scrollTop = picked_el.offsetTop;
                        } else $element[0].scrollTop = 0;
                    }
                    ensureCompileRunsOnce();
                }
            );
        };
    }
])
.directive('ngMozL10n', function () {
    return {
        restrict: "A",
        compile: function () {
            return function (scope, element, attrs) {
                attrs.$observe('ngMozL10n', function () {
                    element.attr('data-l10n-id', attrs.ngMozL10n);
                    navigator.mozL10n.once(function () {
                        navigator.mozL10n.localize(element[0], attrs.ngMozL10n);
                    });
                });
            };
        }
    };
})
.directive('ngRenderTerm', function ($compile) {
    return {
        restrict: "A",
        link: function (scope, element, attrs) {
            var term = escapeHtml(attrs.ngRenderTerm),
                result = "";
            if(scope.search_term == term && scope.search_term != "")
                result += "<b>" + term + "</b>";
            else result += term + " ("
                        + '<span data-ng-moz-l10n="lookup-synonym"></span>:'
                        + " <b>" + scope.search_term + "</b>)";
            element.html(result);
            $compile(element.contents())(scope);
        }
    };
})
.directive("ngDialog", function () {
    return {
        replace: true,
        restrict: "A",
        scope: {
            modal: "=data"
        },
        templateUrl: "partials/dialog.html"
    };
});
