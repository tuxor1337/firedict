$(function() {
    var search_reset = "form[role=search] button[type=reset]";
    var search_input = "form[role=search] input[type=text]";
    var output_area = "section[data-type=output]";
    var list_section = "section[data-type=list]";
    var progress = "p.loading";
    var last_search = "";
    var dict_list = [], oDictWorker;
    
    var delay = (function(){
      var timer = 0;
      return function(callback, ms){
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
      };
    })();
    
    var random_color = function () {
        var min = 0x33, max = 0xbb, result = "";
        for(var i = 0; i < 3; i++)
            result += (0x100+min + (max-min) * Math.random())
                .toString(16).substr(1,2);
        return result;
    };
    
    var log_to_screen = function (text) {
        $(output_area).append("<p>" + text + "</p>");
    };
    
    var split_path = function (path) {
        pos_slash = path.lastIndexOf('/');
        pos_dot = path.lastIndexOf('.');
        return [
            path.substring(0, pos_slash),
            path.substring(pos_slash+1),
            path.substring(pos_dot+1),
        ];
    };
    
    function DictWorker (sURL, fDefListener, fOnError) {
        var that = this, oWorker = new Worker(sURL), oListeners = {};
        this.defaultListener = fDefListener || function () {};
        
        oWorker.onmessage = function (oEvent) {
            if (oEvent.data instanceof Object
                && oEvent.data.hasOwnProperty("vo42t30")
                && oEvent.data.hasOwnProperty("rnb93qh"))
                oListeners[oEvent.data.vo42t30].apply(that, oEvent.data.rnb93qh);
            else that.defaultListener(oEvent.data);
        };
        
        if (fOnError) { oWorker.onerror = fOnError; }
        
        this.sendQuery = function () {
            if (arguments.length < 1) {
                throw new TypeError("QueryableWorker.sendQuery - not enough arguments");
                return; 
            }
            oWorker.postMessage({
                "bk4e1h0": arguments[0],
                "ktp3fm1": Array.prototype.slice.call(arguments, 1) 
            });
        };
        
        this.postMessage = function (vMsg) {
            Worker.prototype.postMessage.call(oWorker, vMsg);
        };
        
        this.terminate = function () {
            Worker.prototype.terminate.call(oWorker);
        };
        
        this.addListener = function (sName, fListener) {
            oListeners[sName] = fListener;
        };
        
        this.removeListener = function (sName) {
            delete oListeners[sName];
        };
    }
    
    var process_dicts = function () {
        var tmp = 0;
        dict_list.forEach(function (d) {
            var request = sdcard.enumerate(d.path);
            request.onsuccess = function () {
                if(!this.result) {
                    tmp++; if(tmp == dict_list.length)
                        oDictWorker.sendQuery("load_dicts", dict_list);
                    return;
                }
                
                file = this.result;
                patt = RegExp("^" + d.base + "\.");
                splitted = split_path(file.name);
                if(splitted[0] == d.path + "/res" && splitted[1] != "") {
                    d.res.push(file);
                } else if(splitted[0] == d.path
                  && null != splitted[1].match(patt)) {
                    d.main.push(file);
                }
                request.continue();
            };
        });
    };
    
    var switch_mode = function (mode) {
        window.scrollTo(0,0);
        $(output_area).hide();
        $(list_section).hide();
        $(progress).hide();
        if(mode == "display") {
            $(output_area).html("").show();
            for(var d = 0; d < dict_list.length; d++) {
                $("<div />").addClass("text dict"+d).data("did",d)
                    .append("<h2>"
                        + dict_list[d].name
                        + "</h2>")
                    .css("border-color",dict_list[d].color)
                    .appendTo(output_area).hide()
                    .find("h2").css("background-color",dict_list[d].color);
            }
        } else if(mode == "list") {
            $(list_section).html("<ul />").show();
        } else if(mode == "loading") {
            $(progress).show();
        }
    }
    
    var render_html_content = function (p, html, did) {
        dict = dict_list[did];
        $(p).append(html).attr("class","entry")
          .find("img").each(function () {
            var img_filename = $(this).attr("src")
                .replace(/^\x1E/, '').replace(/\x1F$/, '');
            var img_file = null;
            for(var r = 0; r < dict.res.length; r++) {
                var fname = dict.res[r].name;
                if(img_filename == fname.substring(
                    fname.lastIndexOf("/")+1
                )) {
                    img_file = dict.res[r]; break;
                }
            }
            if(img_file == null)
                console.log("File " + img_filename + " not found.");
            else {
                var reader = new FileReader();
                reader.onload = (function (theImgElement) {
                    return function (e) {
                        $(theImgElement).attr('src', e.target.result);
                    };
                })(this);
                reader.readAsDataURL(img_file);
            }
        });
        $(p).find("a").each(function () {
            linkText = $(this).text();
            linkRef = $(this).attr("href");
            if("bword://" != linkRef.substring(0,8)) {
                $(this).replaceWith(linkText);
            } else $(this).data("ref",linkRef.substring(8))
                        .attr("href","javascript:void(0)");
        });
    };
    
    var not_found = function () {
        switch_mode("list");
        $(list_section + " ul")
            .html("<li><p>Nichts gefunden!</p></li>");
    };
    
    $("form[role=search]").on("mousedown", "button", function () {
        switch_mode("display");
        $(output_area).find("div.text").show();
        $(search_input).val("");
    });
    
    $(list_section).on("click", "a", function(evt) {
        entries = $(evt.target).parents("li").data("entries");
        $(search_input).val($(evt.target).text());
        switch_mode("display");
        entries.forEach(function (entr) {
            oDictWorker.sendQuery("lookup_id", entr[1], entr[0]);
        });
    });
    
    $(search_input).on("keyup", function() {
        delay(function() {
            var term = $(search_input).val();
            last = last_search;
            last_search = term;
            if(term == "") {
                switch_mode("display");
                $(output_area).find("div.text").show();
                return;
            } else if(term == last) return;
            
            switch_mode("loading");
            oDictWorker.sendQuery("lookup_fuzzy", term, true);
        }, 50);
    });
    
    $(output_area).on("click", "div.text a", function (evt) {
        term = $(evt.target).data("ref").trim();
        did = $(evt.target).parents("div.text").data("did");
        switch_mode("display");
        oDictWorker.sendQuery("lookup_exact", did, term);
    });
    
    switch_mode("loading");
    $(search_input).prop('disabled', true);
    var oDictWorker = new DictWorker("/js/worker.js", function (data) {
        console.log(data);
    });
    
    oDictWorker.addListener("loadEnd", function (dlist) {
        for(var d = 0; d < dlist.length; d++) {
            dict_list[d].name = dlist[d];
            dict_list[d].color = '#'+random_color();
        }
        switch_mode("display");
        $(output_area).find("div.text").show();
        $(search_input).prop('disabled', false);
        $("#search_term").prop('disabled', false);
    });
    
    oDictWorker.addListener("printList", function (matches) {
        switch_mode("list");
        if(matches.length == 0) {
            not_found();
        } else {
            if(dict_list.length > 1)
                matches.sort(function (a,b) {
                    a = a[0].toLowerCase(), b = b[0].toLowerCase();
                    if (a > b) return 1;
                    if (a < b) return -1;
                    return 0;
                });
            var tmp = [];
            while(matches.length > 0) {
                var m = matches.shift();
                if(tmp.length == 0) tmp.push([m[0], []]);
                for(var i = 0; i < tmp.length; i++) {
                    if(m[0] == tmp[i][0]) {
                        tmp[i][1].push([m[1],m[2]]);
                        break;
                    } else if (i == tmp.length-1) {
                        tmp.push([m[0], []]);
                    }
                }
            }
            matches = tmp;
            for(var m = 0; m < matches.length; m++) {
                var dlist = [];
                matches[m][1].forEach(function (match) {
                        if(dlist.indexOf(match[1]) == -1)
                            dlist.push(match[1]);
                });
                dlist.sort().reverse();
                p = $("<p />");
                dlist.forEach(function (d) {
                        $("<span />")
                            .css("background-color",dict_list[d].color)
                            .addClass("marker").appendTo(p);
                });
                $(p).append(matches[m][0]);
                $("<li />").data("entries", matches[m][1])
                    .append($("<a href=\"#\"></a>").append(p))
                    .appendTo(list_section + " ul");
             }
        }
    });
    
    oDictWorker.addListener("printEntry", function (did, idx, data) {
        var term = $(search_input).val();
        if(idx == null) not_found();
        data.forEach(function (d) {
            p = $("<p />");
            if(d[1] == "m") $(p).append(document.createTextNode(d[0]));
            else if(d[1] == "h") render_html_content(p, d[0], did);
            
            if(term != idx[0]) syn = " <b>(Synonym: " + term + ")</b>";
            else syn = "";
            
            $(output_area).find("div.dict"+did)
                .append("<h3>" + idx[0] + syn + "</h3>")
                .append(p).show().find("h3")
                .css("background-color", dict_list[did].color);
        });
    });
    
    sdcard = navigator.getDeviceStorage('sdcard');
    request = sdcard.enumerate("dictdata");
    request.onsuccess = function () {
        if(!this.result) {
            process_dicts();
            return;
        }
        
        var file = this.result;
        if(null != file.name.match(/\.ifo$/)) {
            splitted = split_path(file.name);
            dict = {
                "path": splitted[0],
                "base": splitted[1].replace(/\.ifo$/,""),
                "res": [],
                "main": []
            };
            dict_list.push(dict);
        }
        
        this.continue();
        return;
    };
});
