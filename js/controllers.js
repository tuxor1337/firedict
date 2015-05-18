/**
 * This file is part of FireDict.
 * (c) 2013-2015 https://github.com/tuxor1337/firedict
 * License: GPLv3
 */

"use strict";

var FireDictControllers = angular.module("FireDictControllers",
    ["FireDictDirectives", "FireDictProvider"])
.controller("manageCtrl", ["$scope", "ngDialog", "dictProvider",
    function ($scope, ngDialog, dictProvider) {
        $scope.title = "section-manage-dicts";
        $scope.dictionaries = dictProvider.dicts;
        $scope.selected = -1;
        $scope.select = function (dict) {
            if($scope.selected == dict.id)
                $scope.selected = -1;
            else $scope.selected = dict.id;
        };
        $scope.isDark = function (hexColor) {
            var rgb = hexToRGB(hexColor),
                max = Math.max(rgb),
                sum = rgb[0] + rgb[1] + rgb[2];
            return sum < 360 || max < 190;
        };
        $scope.toggleActive = function (dict) {
            if(dict.active) dict.active = false;
            else dict.active = true;
        };
        $scope.rename = function (dict) {
            ngDialog.open({
                type: "prompt",
                l20n: {
                    text: "dialog-new-alias"
                },
                value: dict.alias,
                callbk: function (alias) {
                    if(alias !== null) dict.alias = alias;
                },
                validate: function (alias) { return alias != ""; }
            });
        };
        $scope.setColor = function (dict) {
            ngDialog.open({
                type: "color",
                l20n: {
                    text: "dialog-choose-color"
                },
                value: hexToRGB(dict.color),
                callbk: function (color) {
                    if(color !== null) dict.color = RGBToHex(color);
                }
            });
        };
        $scope.setGroups = function (dict) {
            var aGroups = [],
                did = dict.id;
            dictProvider.groups.list.forEach(function (group) {
                aGroups.push({
                    active: dictProvider.groups.is_member(group, did),
                    name: group
                });
            });
            ngDialog.open({
                type: "group_membership",
                l20n: {
                    text: "dialog-change-groups",
                    success: "dialog-ok",
                    cancel: "dialog-cancel"
                },
                value: aGroups,
                callbk: function (groups) {
                    if(groups === null) return;
                    groups.forEach(function (group) {
                        if(group.active)
                            dictProvider.groups.add_to_group(group.name, did);
                        else dictProvider.groups.remove_from_group(group.name, did);
                    });
                }
            });
        };
        $scope.reindex = function () {
            dictProvider.worker.query("init", true);
        };
        $scope.dictMoveAfter = function (selected, target) {
            var aDictSorted = dictProvider.dicts.sorted();
            var currVer = parseInt($(selected).find(".color").text()),
                currIdx = -1;
            for(var i = 0; i < aDictSorted.length; i++) {
                if(currVer == aDictSorted[i].id) currIdx = i;
            }
            if(target == null) {
                if(currIdx == 0) return;
                aDictSorted.unshift(aDictSorted.splice(currIdx, 1)[0]);
            } else {
                var curr = aDictSorted.splice(currIdx,1)[0],
                    targetVer = parseInt($(target).find(".color").text());
                for(var i = 0; i < aDictSorted.length; i++) {
                    if(targetVer == aDictSorted[i].id) {
                        aDictSorted.splice(i+1, 0, curr); break;
                    }
                }
            }
            for(var i = 0; i < aDictSorted.length; i++) {
                aDictSorted[i].rank = i;
            }
            if(!$scope.$$phase) { $scope.$apply(); }
        };
    }
])
.controller("groupsCtrl", ["$scope", "$rootScope", "ngDialog", "dictProvider",
    function ($scope, $rootScope, ngDialog, dictProvider) {
        $scope.title = "section-manage-groups";
        $scope.addGroup = function () {
            ngDialog.open({
                type: "prompt",
                l20n: {
                    text: "dialog-add-new-group"
                },
                value: "",
                callbk: function (alias) {
                    if(alias !== null) dictProvider.groups.new_group(alias);
                },
                validate: function (alias) { return alias != ""; }
            });
        };
    }
])
.controller("lookupCtrl", [
    "$scope", "$rootScope", "$timeout", "ngDialog", "dictProvider",
    function ($scope, $rootScope, $timeout, ngDialog, dictProvider) {
        $scope.idle = false;
        $scope.matches = [];
        $scope.entries = [];
        $scope.resources = {};
        $scope.search_term = "";
        $scope.showing_entry = false;
        $scope.dictionaries = dictProvider.dicts;

        dictProvider.worker.addListener("lookup_continue", function (obj) {
            obj.reply(obj.data.term == $scope.search_term
                      && $scope.showing_entry === false);
        });

        $scope.lookup = function (val) {
            if(val == $scope.search_term) {
                $scope.idle = true;
                $scope.matches = [];
                dictProvider.worker.query("lookup", $scope.search_term)
                .then(function (matches) {
                    if($scope.search_term == val) {
                        $scope.matches = matches;
                        $scope.idle = false;
                        if(!$scope.$$phase) { $scope.$apply(); }
                    }
                });
            }
        };

        $scope.lookup_enterpressed = function () {
            if($scope.showing_entry) return;
            $scope.lookup($scope.search_term);
        };

        $scope.lookup_data_changed = function () {
            var val = $scope.search_term,
                milliseconds = 800 - 150*Math.min(val.length,4);
            $scope.idle = true;
            $scope.matches = [];
            if($scope.showing_entry) return;
            var delay = (function(){
              var timer = 0;
              return function(callback, ms) {
                clearTimeout (timer);
                timer = $timeout(callback, ms);
              };
            })();
            delay(function () { $scope.lookup(val); }, milliseconds);
        };

        $scope.choose_groups = function () {
            ngDialog.open({
                type: "grouppicker",
                l20n: {
                    text: "dialog-choose-groups",
                    success: "dialog-ok",
                    cancel: ""
                }
            });
        };

        $scope.pick_word = function ($event) {
            wordpicker_wrap($event.originalEvent);
            ngDialog.open({
                type: "wordpicker",
                range: $event.currentTarget.innerHTML,
                l20n: {
                    text: "dialog-pick-word"
                },
                value: "",
                callbk: function (picked) {
                    if(picked === null) return;
                    $scope.show_entry(picked);
                }
            });
            wordpicker_unwrap($event.currentTarget);
        };

        $scope.show_entry = function(matchObj) {
            $scope.idle = true;
            $scope.matches = [];
            $scope.entries = [];
            if(!$scope.$$phase) { $scope.$apply(); }
            var entr = matchObj, term = matchObj;
            if(matchObj instanceof Object) {
                entr = matchObj.entries;
                term = matchObj.term;
            }
            $scope.search_term = term;
            dictProvider.worker.query("entry", entr)
            .then(function (entries) {
                $scope.idle = false;
                if(entries.length > 0) {
                    $scope.showing_entry = true;
                    $scope.entries = entries;
                } else {
                    $scope.showing_entry = false;
                    $scope.lookup_enterpressed();
                }
                if(!$scope.$$phase) { $scope.$apply(); }
            });
        };

        $scope.showPreview = function(bol, evt) {
            $(evt.currentTarget)
                .siblings(".expandable")
                .toggleClass("preview", bol);
        };

        $scope.$watch(
            "[search_term, dictionaries]",
            $scope.lookup_data_changed, true
        );

        $scope.back = function () {
            if($scope.showing_entry) {
                $scope.showing_entry = false;
                $scope.lookup($scope.search_term);
            }
        };
        $scope.matchDictFilter = function (match) {
            return function (dict) {
                for(var e = 0; e < match.entries.length; e++) {
                    if(match.entries[e][2] == dict.id) return true;
                }
                return false;
            };
        };
        $scope.entryDictFilter = function (dict) {
            for(var e = 0; e < $scope.entries.length; e++) {
                if($scope.entries[e].did == dict.id) return true;
            }
            return false;
        };
        $scope.render_content = function (d, did) {
            function inject_resource(name) {
                if(!$scope.resources.hasOwnProperty(did))
                    $scope.resources[did] = {};
                if(!$scope.resources[did].hasOwnProperty(name)) {
                    dictProvider.worker.query("resource", {
                            did: did, name: name
                    }).then(function (blob) {
                        if(blob == null)
                            console.log(dictProvider.dicts.byId(did).alias +
                                ": File " + name + " not found.");
                        else {
                            $scope.resources[did][name] = window.URL.createObjectURL(blob);
                            if(!$scope.$$phase) { $scope.$apply(); }
                        }
                    });
                }
            }
            function render_html_content(html_markup) {
                var tmp_obj = $("<div />").html(html_markup);
                $(tmp_obj).find(":not("
                    + "p, font, span, div, table, tr, td, tbody, strong, "
                    + "br, i, a, b, u, img, sup, sub, ul, ol, li, abbr, "
                    + "center, left, right, em, dd, dt, blockquote, small, "
                    + "code, del, h1, h2, h3, h4, h5, h6, hr"
                + ")").each(function () {
                    console.log("Html code injection: " + this.tagName);
                    if($(this).children().length == 0)
                        $(this).replaceWith($(this).text());
                    else $(this).children().unwrap();
                });
                $(tmp_obj).find("center, left, right").each(function () {
                    $(this).replaceWith(
                        $("<p />").html($(this).html())
                        .css("text-align",this.tagName)
                    );
                });
                $(tmp_obj).find("font").each(function () {
                    var replacement = $("<span />").html($(this).html());
                    if($(this).attr("color")) {
                       replacement.css("color",$(this).attr("color"));
                    }
                    if($(this).attr("size")) {
                        var fontsize = $(this).attr("size");
                        if("+-".indexOf(fontsize.charAt(0)) >= 0)
                            fontsize = parseInt(fontsize.trim("+")) + 2;
                        else fontsize = parseInt(fontsize);
                        fontsize = Math.min(7,Math.max(fontsize,1))-1;
                        replacement.css("font-size",Array("0.8","1","1.3","1.5","2","2.7","4")[fontsize]+"em");
                    }
                    if($(this).attr("face"))
                       replacement.css("font-family",$(this).attr("face"));
                    $(this).replaceWith(replacement);
                });
                $(tmp_obj).find("img").each(function () {
                    var elImg = this,
                        img_filename = $(elImg).attr("src")
                            .replace(/^\x1E/, '').replace(/\x1F$/, '');
                    $(elImg).attr("src",
                        "{{resources[" + did + "]['" + img_filename + "']}}");
                    if($(elImg).attr("align") == "middle") {
                        $(elImg).removeAttr("align")
                            .css("vertical-align","middle");
                    }
                    inject_resource(img_filename);
                });
                $(tmp_obj).find("a").each(function () {
                    var linkText = $(this).text(),
                        linkRef = $(this).attr("href");
                    if("bword://" != linkRef.substring(0,8)) {
                        $(this).replaceWith(linkText);
                    } else {
                        linkRef = linkRef.substring(8).replace(/'/g, "\\'")
                            .replace(/^ /g, "");
                        $(this).attr("href","javascript:void(0)")
                                .attr("ng-click", "show_entry('" + linkRef + "')");
                    }
                });
                return $(tmp_obj).html();
            }
            function render_pango_content(pango_markup) {
                var tmp_obj = $("<div/>").html(pango_markup.replace(/\n/g,"<br>"));
                $(tmp_obj).find(":not("
                    + "span, big, s, tt, b, i, sub, sup, small, u, br"
                + ")")
                .each(function () {
                    console.log("Pango code injection: " + this.tagName);
                    if($(this).children().length == 0)
                        $(this).replaceWith($(this).text());
                    else $(this).children().unwrap();
                });
                $(tmp_obj).find("span").each(function () {
                    var replacement = $("<span/>"), sup = false;
                    $.each(this.attributes, function(dummy, attrib){
                        var name = attrib.name;
                        var value = attrib.value;
                        if(name == "font_desc")
                            $(replacement).css("font", value);
                        else if(name == "font_family" || name == "face")
                            $(replacement).css("font-family", value);
                        else if(name == "size" && !isNaN(value))
                            $(replacement).css("font-size", value);
                        else if(name == "style")
                            $(replacement).css("font-style", value);
                        else if(name == "weight") {
                            if(value == "ultrabold") value = "800";
                            else if(value == "heavy") value = "900";
                            else if(value == "light") value = "300";
                            else if(value == "ultralight") value = "200";
                            $(replacement).css("font-weight", value);
                        } else if(name == "variant")
                            $(replacement).css("font-variant",
                                value.replace("smallcaps","small-caps"));
                        else if(name == "stretch") {
                            value.replace(/(ultra|extra|semi)(condensed|expanded)/g, "$1-$2");
                            $(replacement).css("font-stretch", value);
                        } else if(name == "foreground")
                            $(replacement).css("color", value);
                        else if(name == "background")
                            $(replacement).css("background-color", value);
                        else if(name == "underline") {
                            if(value == "double")
                                $(replacement).css("border-bottom", "1px #000 double");
                            else if(value == "low")
                                $(replacement).css("border-bottom", "1px #000 solid");
                            else if(value == "single")
                                $(replacement).css("text-decoration", "underline");
                        } else if(name == "strikethrough" && value == "true")
                            $(replacement).css("text-decoration", "line-through");
                        else if(name == "rise" && value != "0") sup = true;
                    });
                    if(sup) {
                        $(this).replaceWith(
                            $(replacement).html($(this).html())
                        );
                    } else {
                        $(this).replaceWith(
                            $("<sup/>").append(
                                $(replacement).html($(this).html())
                            )
                        );
                    }
                });
                $(tmp_obj).find("big").each(function () {
                    $(this).replaceWith(
                        $("<span/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("tt").each(function () {
                    $(this).replaceWith(
                        $("<code/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("s").each(function () {
                    $(this).replaceWith(
                        $("<del/>").html($(this).html())
                    );
                });
                return render_html_content($(tmp_obj).html());
            }
            function render_xdxf_content(xdxf_markup) {
                var tmp_obj = $("<div />").html(xdxf_markup);
                $(tmp_obj).find(":not("
                    + "k, pos, abr, c, kref, ex, "
                    + "big, small, i, sup, sub, b, tt, blockquote"
                + ")").each(function () {
                    console.log("XDXF code injection: " + this.tagName);
                    if($(this).children().length == 0)
                        $(this).replaceWith($(this).text());
                    else $(this).children().unwrap();
                });
                $(tmp_obj).find("k").each(function () {
                    $(this).replaceWith(
                        $("<dt/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("pos").each(function () {
                    $(this).replaceWith(
                        $("<p/>").append(
                            $("<i/>").html($(this).html())
                        )
                    );
                    ;
                });
                $(tmp_obj).find("big").each(function () {
                    $(this).replaceWith(
                        $("<span/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("tt").each(function () {
                    $(this).replaceWith(
                        $("<code/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("abr").each(function () {
                    $(this).replaceWith(
                        $("<abbr/>").html($(this).html())
                    );
                });
                $(tmp_obj).find("c").each(function () {
                    $(this).replaceWith(
                        $("<span/>").html($(this).html())
                        .css("color",$(this).attr("c"))
                    );
                });
                $(tmp_obj).find("kref").each(function () {
                    $(this).replaceWith(
                        $("<a/>").html($(this).html())
                        .attr("href","bword://"+$(this).text().trim())
                    );
                });
                $(tmp_obj).find("ex").each(function () {
                    $(this).replaceWith(
                        $("<span/>").html($(this).html())
                        .css("color","#4682B4")
                    );
                });
                return render_html_content($(tmp_obj).html());
            }
            function render_resource_content(res) {
                var result = [], aRes = res.split("\n");
                aRes.forEach(function () {
                    var type = res.split(":")[0],
                        name = res.split(":")[1];
                    if(type == "img") {
                        inject_resource(name);
                        result.push("<img src=\"{{resources[" + did + "]['" + name + "']}}\" />");
                    }
                    console.log("Resource type not supported: " + d.type);
                    // at least: snd, vdo, att
                    result.push("Resource: " + res);
                });
                return result.join("<br />\n");
            }
            function render_plain_content(plain_text) {
                var div = $("<div />").text(plain_text);
                return $(div).html().replace(/(\r\n|\n\r|\r|\n)/g, "<br>");
            }
            if("g" == d.type)
                return render_pango_content(d.content);
            else if("h" == d.type)
                return render_html_content(d.content);
            else if("x" == d.type)
                return render_xdxf_content(d.content);
            else if("w" == d.type)
                return render_html_content(wiki2html(d.content));
            else if("r" == d.type)
                return render_resource_content(d.content);
            else if("m" == d.type)
                return render_plain_content(d.content);
            else if("t" == d.type)
                return render_plain_content("Pronunciation: /"+d.content+"/");
            else if("y" == d.type)
                return render_plain_content("YinBiao/KANA: "+d.content);

            console.log("Type not supported: " + d.type); // at least: "kWPX"
            return render_plain_content(d.content);
        };
        $scope.content_fontsize = function () {
            return dictProvider.settings.get("fontsize")+"rem";
        };
        $scope.termOrderFn = function (entry) {
            return entry.term.replace(/\(([0-9])\)$/g, '(0$1)');
        };
    }
])
.controller("settingsCtrl", ["$scope", "ngDialog", "dictProvider",
    function ($scope, ngDialog, dictProvider) {
        $scope.title = "section-settings";
        $scope.settings = [
            {
                type: "action",
                name: "settings-clear-history",
                onclick: function () {
                    ngDialog.open({
                        l20n: {
                            text: "dialog-clear-history",
                            success: "dialog-yes-sure",
                            cancel: "dialog-no-forget-it"
                        },
                        callbk: function (result) {
                            if(result === true) {
                                dictProvider.worker.query("clear_history");
                            }
                        }
                    });
                }
            },
            {
                type: "value",
                name: "settings-fontsize",
                value: function () {
                    return dictProvider.settings.get("fontsize");
                },
                onclick: function () {
                    ngDialog.open({
                        type: "fontsize",
                        l20n: {
                            text: "dialog-set-fontsize"
                        },
                        value: parseFloat(dictProvider.settings.get("fontsize"))*100,
                        range: [75,105],
                        callbk: function (value) {
                            if(value !== null)
                                dictProvider.settings.set("fontsize", value/100.0);
                        }
                    });
                }
            },
            {
                type: "toggle",
                name: "settings-greyscale",
                onclick: function () {
                    var curr = dictProvider.settings.get("greyscale"),
                        newval = (curr == "true")?"false":"true";
                    dictProvider.settings.set("greyscale", newval);
                },
                checked: function () {
                    return dictProvider.settings.get("greyscale") == "true";
                }
            },
            {
                type: "toggle",
                name: "settings-expandable",
                onclick: function () {
                    var curr = dictProvider.settings.get("expandable"),
                        newval = (curr == "true")?"false":"true";
                    dictProvider.settings.set("expandable", newval);
                },
                checked: function () {
                    return dictProvider.settings.get("expandable") == "true";
                }
            }
        ];
    }
])
.controller("aboutCtrl", function ($scope) {
    $scope.title = "section-about";
    $scope.manifest = {
      "name": "FireDict",
      "description": "",
      "version": "",
      "developer": { "url": "https://github.com/tuxor1337" }
    }
    var request = navigator.mozApps.getSelf();
    request.onsuccess = function() {
        $scope.manifest = request.result.manifest;
        if(!$scope.$$phase) { $scope.$apply(); }
    };
});
