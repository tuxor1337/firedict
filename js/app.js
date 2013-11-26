$(function() {
    var dict_list = [];
    var res_files = [];
    var last_search = "";
    var sdcard = navigator.getDeviceStorage('sdcard');
    
    var delay = (function(){
      var timer = 0;
      return function(callback, ms){
        clearTimeout (timer);
        timer = setTimeout(callback, ms);
      };
    })();
    
    var log_to_screen = function (text) {
        $("#dict_test").append("<p>" + text + "</p>");
    }
    
    var split_path = function (path) {
        pos_slash = path.lastIndexOf('/');
        pos_dot = path.lastIndexOf('.');
        return [
            path.substring(0, pos_slash),
            path.substring(pos_slash+1),
            path.substring(pos_dot+1),
        ];
    };
    
    var load_dicts = function () {
        log_to_screen("");
        dict_list.forEach(function (d) {
            d.dobj.onsuccess = function () {
                log_to_screen(d.dobj.get_key("bookname"));
                log_to_screen("&nbsp;");
                var tmp = 0;
                while(tmp < dict_list.length && dict_list[tmp++].dobj.loaded);
                if(tmp == dict_list.length)
                    $("#search_term").prop('disabled', false);
            };
            d.dobj.load(d.main,d.res);
        });
    };
    
    var process_dicts = function () {
        var tmp = 0;
        dict_list.forEach(function (d) {
            var request = sdcard.enumerate(d.path);
            
            request.onsuccess = function () {
                if(!this.result) {
                    tmp++;
                    if(tmp == dict_list.length) load_dicts();
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
                } else {
                    log_to_screen("ignoring " + file.name);
                }
                request.continue();
            }
            
            request.onerror = function () {
                log_to_screen("An unexpected error occurred: " + this.error);
            };
        });
    };
    
    var search_dicts = function () {
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
                    "main": [],
                    "dobj": new StarDict(),
                    "color": '#'+(0x1000000+(Math.random())*0xffffff)
                        .toString(16).substr(1,6)
                };
                console.log("dictionary found: " + dict.base);
                dict_list.push(dict);
            }
            
            this.continue();
            return;
        };
        
        request.onerror = function () {
            log_to_screen("No dictionaries found: " + this.error);
        };
    };
    
    search_dicts();
    
    var switch_mode = function (mode) {
        window.scrollTo(0,0);
        if(mode == "display") {
            $("#dict_test").html("");
            for(var d = 0; d < dict_list.length; d++) {
                $("<div />").addClass("text dict"+d).data("did",d)
                    .append("<h2>"+dict_list[d].dobj.get_key("bookname")+"</h2>")
                    .appendTo("#dict_test").hide();
            }
        } else if (mode == "list") {
            $("#dict_test").html("<ul></ul>");
        }
    }
    
    var show_word_by_term = function (term, did) {
        var dl;
        if("undefined" === typeof did) {
            for(var d = 0; d < dict_list.length; d++) {
                wid = dict_list[d].dobj.lookup_term(term,false)[1];
                render_entry(wid, d, term);
            }
        } else {
            wid = dict_list[did].dobj.lookup_term(term,false)[1];
            render_entry(wid, did, term);
        }
    };
    
    var render_entry = function (wid, did, term) {
        switch_mode("display");
        $("#search_term").val(term);
        var dict = dict_list[did].dobj;
        
        dict.lookup_id(wid, function (data, idx) {
            data.forEach(function (d) {
                p = $("<p />");
                
                if(d[1] == "m") $(p).append(document.createTextNode(d[0]));
                else if(d[1] == "h") render_html_content(p, d[0], did);
                
                if(term != idx[0]) syn = " <b>(Synonym: " + term + ")</b>";
                else syn = "";
                
                $("#dict_test div.dict"+did)
                    .append("<h3>" + idx[0] + syn + "</h3>").append(p)
                    .css("border-color",dict_list[did].color).show();
                $("#dict_test div.dict"+did).find("h2, h3")
                    .css("background-color",dict_list[did].color);
            });
        });
    };
    
    var render_html_content = function (p, html, did) {
        $(p).append(html);
        $(p).attr("class","entry");
        $(p).find("img").each(function () {
            img_file = dict_list[did].dobj.request_res($(this).attr("src"));
            if(img_file == null)
                console.log(
                    "File " + $(this).attr("src") + " not found."
                );
            else {
                var reader = new FileReader();
                reader.onload = (function (theImg) {
                    return function (e) {
                        $(theImg).attr('src', e.target.result);
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
    
    var render_list = function (matches) {
        switch_mode("list");
        if(matches.length == 0) {
            $("#dict_test").html("<i>Nichts gefunden!</i>");
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
                li = $(document.createElement('li'));
                $(li).data("entries",matches[m][1]);
                $(li).html(matches[m][0]);
                $("#dict_test ul").append(li);
             }
        }
    };
    
    $("#search_term").on("keyup", function() {
        delay(function() {
            var term = $("#search_term").val();
            last = last_search;
            last_search = term;
            if(term == "") {
                $("#dict_test").html("");
                return;
            } else if(term == last) return;
            
            var matches = [];
            for(var d = 0; d < dict_list.length; d++) {
                var tmp = dict_list[d].dobj.lookup_term(term,true);
                for(var i = 0; i < tmp.length; i++) {
                    tmp[i].push(d);
                    matches.push(tmp[i]);
                }
            }
            render_list(matches);
        }, 300);
    });
    
    $("#dict_test").on("click", "div.text a", function (evt) {
        ref = $(evt.target).data("ref");
        did = $(evt.target)
            .parents("div.text").data("did");
        show_word_by_term(ref, did);
    });
    
    $("#dict_test").on("click", "li", function(evt) {
        $(evt.target).data("entries").forEach(function (entr) {
            render_entry(entr[0], entr[1], $(evt.target).text());
        });
    });
});
