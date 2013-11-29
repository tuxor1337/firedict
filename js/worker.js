
var console = {
    "log": function (str) {
        postMessage(str);
    }
};

importScripts("rawinflate.js");
importScripts("dictzip.js");
importScripts("tree.js");
importScripts("stardict.js");
    
var dict_list = [];
    
var queryableFunctions = {
    load_dicts: function (dlist) {
        for(var d = 0; d < dlist.length; d++)
            dlist[d].dobj = new StarDict();
        dict_list = dlist;
        dict_list.forEach(function (d) {
            d.dobj.onsuccess = function () {
                var tmp = 0;
                while(tmp < dict_list.length 
                    && dict_list[tmp].dobj.loaded) tmp++;
                if(tmp == dict_list.length) {
                    var dlist = [];
                    for(var i = 0; i < dict_list.length; i++) 
                        dlist.push(dict_list[i].dobj.get_key("bookname"));
                    reply("loadEnd", dlist);
                }
            };
            d.dobj.load(d.main,d.res);
        });
    },
    
    lookup_fuzzy: function (term) {
        matches = [];
        for(var d = 0; d < dict_list.length; d++) {
            var tmp = dict_list[d].dobj.lookup_term(term,true);
            for(var i = 0; i < tmp.length; i++) {
                tmp[i].push(d);
                matches.push(tmp[i]);
            }
        }
        reply("printList", matches);
    },
    
    lookup_id: function (did, wid) {
        dict_list[did].dobj.lookup_id(wid, function (data, idx) {
            reply("printEntry", did, idx, data);
        });
    },
    
    lookup_exact: function (did, term) {
        var wid = dict_list[did].dobj.lookup_term(term, false);
        dict_list[did].dobj.lookup_id(wid, function (data, idx) {
            reply("printEntry", did, idx, data);
        });
    }
};

function defaultQuery (vMsg) { console.log(vMsg); }

function reply () {
    if (arguments.length < 1) {
        throw new TypeError("reply - not enough arguments");
        return;
    }
    postMessage({
        "vo42t30": arguments[0],
        "rnb93qh": Array.prototype.slice.call(arguments, 1)
    });
}

onmessage = function (oEvent) {
    if (oEvent.data instanceof Object 
        && oEvent.data.hasOwnProperty("bk4e1h0")
        && oEvent.data.hasOwnProperty("ktp3fm1"))
        queryableFunctions[oEvent.data.bk4e1h0].apply(self, oEvent.data.ktp3fm1);
    else defaultQuery(oEvent.data);
};

