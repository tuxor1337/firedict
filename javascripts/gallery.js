
(function (GLOBAL) {
    if (!String.prototype.trim) {
        String.prototype.trim=function(){return this.replace(/^\s+|\s+$/g, ''); };
    }
    
    var img_gallery = (function (id, img_list) {
        var cls = function (container_id, img_list) {
            var that = this,
                showing_i = 1,
                id = container_id,
                list = img_list,
                gallery_container = $("#"+id),
                img = $(gallery_container).find("img").first(),
                title, links;
                
            function next() { that.set_i(showing_i+1); }
            function last() { that.set_i(showing_i-1); }
            
            function full() {
                $(gallery_container).removeClass("gallery_full");
                $(gallery_container).removeClass("gallery_preview");
                $(gallery_container).addClass("gallery_full");
            }
            
            function preview() {
                $(gallery_container).removeClass("gallery_full");
                $(gallery_container).removeClass("gallery_preview");
                $(gallery_container).addClass("gallery_preview");
            }
            
            function toggle() {
                if($(gallery_container).hasClass("gallery_preview")) 
                    full();
                else preview();
            }
            
            title = $(gallery_container).find(".gallery_title b").first();
            
            links = { 
                "toggle" : $(gallery_container).find(".gallery_toggle").first(),
                "close" : $(gallery_container).find(".gallery_close").first(),
                "next" : $(gallery_container).find(".gallery_next").first(),
                "last" : $(gallery_container).find(".gallery_last").first()
            };
            
            for(var type in links) {
                $(links[type]).attr("href","javascript:;");
            }
            $(links["toggle"]).click(toggle);
            $(links["close"]).click(toggle);
            $(links["next"]).click(next);
            $(links["last"]).click(last);
    
            this.set_i = function (j) {
                showing_i = j;
                $(links["next"]).removeClass("gallery_hidden");
                $(links["last"]).removeClass("gallery_hidden");
                $(img).attr("src", list[j][0]);
                $(title).text(list[j][1]);
                if(showing_i+1 == list.length)
                    $(links["next"]).addClass("gallery_hidden");
                if(showing_i == 0)
                    $(links["last"]).addClass("gallery_hidden");
            }
            
            this.set_i(0);
        };
        
        return cls;
    })();
    
    GLOBAL.img_gallery = img_gallery;
}(this));
