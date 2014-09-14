/**
 * This file is part of FireDict.
 * (c) 2013-2014 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */
 
var FireDictDirectives = angular.module("FireDictDirectives", [])
.directive("ngHeader", function ($timeout) {
    return { 
        replace: true,
        restrict: "A",
        scope: {
            "onFocus": '=focus',
            "searchTerm": '=term',
            "toggleSidebar": '=toggle',
            "onReindex": '=reindex',
            "onEnter": '=enter',
            "text": '@text'
        },
        link: function ($scope, $element, $attrs) {
            $scope.type = $attrs.type;
            $scope.onClear = function (e) {
                $scope.searchTerm = "";
                $timeout(function() {
                  $element.find("form input").focus();
                });
            };
            $element.find("form input").bind("keydown keypress",
                function (e) {
                    if(e.which === 13) {
                        $scope.onEnter(e);
                        e.preventDefault();
                    }
                }
            );
        },
        templateUrl: "partials/header.html"
    };
})
.directive("ngDrawer", function () {
    return { 
        replace: true,
        transclude: true,
        restrict: "A",
        link: function ($scope, $element, $attrs) {
            $scope.title = $attrs.title;
        },
        templateUrl: "partials/sidebar.html"
    };
})
.directive("ngSortable", function () {
    return {
        compile: function () {
            return function ($scope, $element, $attr) {
                var handle, startY, currIndex = -1, dragover = null;
                    
                var moveAfter = $scope.$eval($attr.moveFn);
                
                function touchY(evt) {
                    return evt.originalEvent.changedTouches[0].pageY;
                }
                
                function getNext(curr, last) {
                    $(curr).siblings().css("transition", "border 0.5s");
                    var currRect = curr.getBoundingClientRect(),
                        lastRect = last.getBoundingClientRect(),
                        currMiddleY = 0.5*(currRect.bottom + currRect.top),
                        next = null;
                    if(currMiddleY < lastRect.top + 0.5*last.clientHeight) {
                        if(isFirst(curr, last)) {
                            next = last;
                            $(next).removeClass("insertAfter")
                                .addClass("insertBefore");
                        } else {
                            $(last).removeClass("insertAfter");
                            if($(last).index() == $(curr).index() + 1)
                                next = $(curr).prev()[0];
                            else next = $(last).prev()[0];
                            $(next).addClass("insertAfter");
                        }
                    } else {
                        var parentRect = $(curr).parent()[0].getBoundingClientRect();
                        if($(last).hasClass("insertBefore")) {
                            next = last;
                            $(next).removeClass("insertBefore")
                                .addClass("insertAfter");
                        } else if(isLast(curr, last)) {
                            next = last;
                        } else {
                            $(last).removeClass("insertAfter");
                            if($(last).index() == $(curr).index() - 1)
                                next = $(curr).next()[0];
                            else next = $(last).next()[0];
                            $(next).addClass("insertAfter");
                        }
                    }
                    return next;
                }
                
                function parentMiddleDistY(el) {
                    var parentRect = $(el).parent()[0].getBoundingClientRect(),
                        currRect = el.getBoundingClientRect();
                    return 0.5*(currRect.bottom + currRect.top) - parentRect.top;
                }
                
                function isContained(curr, testEl) {
                    var currRect = curr.getBoundingClientRect(),
                        testRect = testEl.getBoundingClientRect(),
                        currMiddleY = 0.5*(currRect.bottom + currRect.top);
                    if(isFirst(curr, testEl)) {
                        if(parentMiddleDistY(curr) <= 0) return true;
                        if($(testEl).hasClass("insertBefore")) {
                            return currMiddleY <= testRect.bottom - 0.5*testEl.clientHeight;
                        }
                    }
                    var parentRect = $(curr).parent()[0].getBoundingClientRect();
                    return (currMiddleY  >= testRect.top + 0.5*testEl.clientHeight
                        && currMiddleY <= testRect.bottom + 0.5*testEl.clientHeight)
                        || (currRect.bottom > parentRect.bottom && isLast(curr, testEl));
                }
                
                function isFirst(curr, testEl) {
                    return $(testEl).index() == 0
                        || ($(testEl).index() == 1 && $(curr).index() == 0);
                }
                
                function isLast(curr, testEl) {
                    var len = $(testEl).siblings().length,
                        result = $(testEl).index() == len
                        || ($(testEl).index() == len-1 && $(curr).index() == len);
                    return result;
                }
                
                $element
                .on("touchstart", "li[draggable]", function (e) {
                    if($(this).siblings().length > 0) {
                        handle = e.target;
                        startY = touchY(e);
                    }
                })
                .on("touchmove", "li[draggable]", function (e) {
                    if($(this).find(".handle").length == 0) return;
                    if($(this).find(".handle")[0].contains(handle)) {
                        e.preventDefault();
                        if(currIndex >= 0) {
                            $(this).css({ "top": touchY(e) - 20 + "px" });
                            if(dragover == null) {
                                if($(this).index() > 0)
                                    dragover = $(this).prev().addClass("insertAfter")[0];
                                else dragover = $(this).next().addClass("insertBefore")[0];
                            } else if (!isContained(this, dragover)) {
                                dragover = getNext(this, dragover);
                            }
                        } else if(Math.abs(startY - touchY(e)) > 3) {
                            $(this).parent("ul").height($(this).parent("ul").height()+20);
                            $(this).addClass("sorting")
                            .siblings().addBack().removeClass("selected");
                            currIndex = $(this).index();
                        }
                    }
                })
                .on("touchend", "li[draggable]", function (e) {
                    if($(this).find(".handle").length == 0) return;
                    if($(this).find(".handle")[0].contains(handle) && currIndex >= 0) {
                        var target = $(this).siblings(".insertAfter");
                        $(this).removeClass("sorting").css({ "top": "auto" })
                        .siblings().css("transition", "none")
                        .removeClass("insertBefore insertAfter")
                        .parent("ul").height("auto");
                        startY = null; currIndex = -1; handle = null; dragover = null;
                        moveAfter(this, (target.length > 0) ? target[0] : null);
                    }
                });
            };
        }
    };
})
.directive('compile', ['$compile', function ($compile) {
    return function(scope, element, attrs) {
        var ensureCompileRunsOnce = scope.$watch(
            function(scope) {
                return scope.$eval(attrs.compile);
            },
            function(value) {
                element.html(value);
                $compile(element.contents())(scope);
                ensureCompileRunsOnce();
            }
        );
    };
}])
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
                        + '<span data-ng-moz-l10n="synonym">Synonym</span>:'
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
})
.factory("ngDialog", ["$document", "$compile", "$rootScope",
    function ($document, $compile, $rootScope) {
        var defaults = {
              type: "confirm",
              text: "Default text",
              success: 'OK',
              cancel:'Cancel',
              l20n: null,
              value: null,
              callbk: null
            },
            defaults_l20n = {
              text: "",
              success: "",
              cancel: ""
            },
            body = $document.find("body"), 
            modalEl = angular.element('<div ng:dialog data="modal"></div>'),
            closeFn = function () { set_opts(defaults); },
            $scope = $rootScope.$new();
            
        function set_opts(options) {
            if(options.type == "progress" && typeof options.value === "undefined")
                options.value = [];
            options = angular.extend({}, defaults, options);
            if(options.type == "confirm") options.value = true;
            if(options.l20n instanceof Object)
                options.l20n = angular.extend({}, defaults_l20n, options.l20n);
            $scope.modal = {
                visible: false,
                result: options.value,
                type: options.type,
                text: options.text,
                success: options.success,
                l20n: options.l20n,
                cancel: options.cancel,
                callbk: function (result) {
                    var callFn = options.callbk || closeFn;
                    callFn(result);
                    $scope.$modalClose();
                }
            };
            if(!$scope.$$phase) { $scope.$apply(); }
        }
        
        $scope.$modalClose = closeFn;
        set_opts(defaults);
        $compile(modalEl)($scope);
        body.append(modalEl);
        
        return {
            update: function (res, text) {
                $scope.modal.result = res;
                if(typeof text !== "undefined")
                    $scope.modal.text = text;
                if(!$scope.$$phase) { $scope.$apply(); }
            },
            close: function () {
                set_opts(defaults);
            },
            open: function (options) {
                set_opts(options);
                $scope.modal.visible = true;
            },
            type: function () {
                return $scope.modal.type;
            }
        };
    }
])
.factory("dictWorker", function () {
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
});
