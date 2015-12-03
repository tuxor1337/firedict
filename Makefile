
OUTPUT_DIR := build

NODE_MODULES := node_modules
NODE_BIN := $(NODE_MODULES)/.bin
UGLIFYJS := $(NODE_BIN)/uglifyjs

LICENSE := COPYING.txt LICENSE.3rd-party

SRC_DIR := src
MANIFEST := $(SRC_DIR)/manifest.webapp
TEST_WORKER := $(SRC_DIR)/test/worker.js

CODE_HTML := $(SRC_DIR)/index.html
CODE_JS := $(wildcard $(SRC_DIR)/js/*.js)
CODE_CSS := $(wildcard $(SRC_DIR)/style/*.css)
CODE_IMG := $(wildcard $(SRC_DIR)/style/images/*.png)
CODE_PARTIALS := $(wildcard $(SRC_DIR)/partials/*.html)
CODE_LOCALES := $(wildcard $(SRC_DIR)/locales/firedict.*.properties)
CODE := $(CODE_HTML) $(CODE_JS) $(CODE_CSS) $(CODE_IMG) $(CODE_PARTIALS) $(CODE_LOCALES)

FONT_DIR := $(OUTPUT_DIR)/fonts
FONT_FLAVORS := light regular medium
FONT_FILES := $(FONT_FLAVORS:%=firasansot-%-webfont.woff)
FONT_URL := https://raw.githubusercontent.com/mozilla/fireplace/master/src/media/fonts/FiraSans
FONTS := $(addprefix $(FONT_DIR)/,$(FONT_FILES))

ICON_DIR := $(OUTPUT_DIR)/icons
ICON_SRC := $(SRC_DIR)/icon-scalable.svg $(SRC_DIR)/icon-scalable-detail.svg
ICON_RESOLUTIONS := 60 128 32 90 120 256
ICON_FILES := $(ICON_RESOLUTIONS:%=icon-%.png)
ICONS := $(addprefix $(ICON_DIR)/,$(ICON_FILES))

THIRDPARTY_DIR := $(OUTPUT_DIR)/thirdparty
THIRDPARTY_ANGULAR := $(NODE_MODULES)/angular/angular.min.js \
                      $(NODE_MODULES)/angular-route/angular-route.min.js \
                      $(NODE_MODULES)/angular-sanitize/angular-sanitize.min.js \
                      $(NODE_MODULES)/angular-touch/angular-touch.min.js
THIRDPARTY_MINSRC := $(NODE_MODULES)/es6-promise/dist/es6-promise.min.js \
                     $(NODE_MODULES)/pako/dist/pako_inflate.min.js
THIRDPARTY_RAWSRC :=  thirdparty/dictzip.js/dictzip_sync.js \
                      thirdparty/stardict.js/stardict_sync.js \
                      thirdparty/wiki2html.js \
                      thirdparty/l10n.js
THIRDPARTY_SRC := $(THIRDPARTY_RAWSRC) $(THIRDPARTY_MINSRC) $(THIRDPARTY_ANGULAR)
THIRDPARTY_FILES := angular.min.js \
                    $(notdir $(THIRDPARTY_MINSRC)) \
                    $(notdir $(THIRDPARTY_RAWSRC:.js=.min.js))
THIRDPARTY_TEST := $(THIRDPARTY_DIR)/{angular*,l10n*,wiki2html*,es6-promise*}.js
THIRDPARTY := $(THIRDPARTY_FILES:%=$(THIRDPARTY_DIR)/%)

BUILD_TEST := $(OUTPUT_DIR)/testbuild
BUILD_LIVE := $(OUTPUT_DIR)/livebuild
BUILDS := $(BUILD_LIVE) $(BUILD_TEST)
PACKAGE_SUBDIRS := locales \
                   partials \
                   js/lib \
                   style/fonts \
                   style/images
PACKAGE_FILES := $(CODE) $(THIRDPARTY) $(TEST_WORKER) \
                 $(MANIFEST) $(LICENSE) \
                 $(ICONS) $(FONTS)
PACKAGE := $(OUTPUT_DIR)/package.zip

define \n


endef

all: $(PACKAGE) $(BUILD_TEST)

%/.d:
	mkdir -p $(@D)
	@touch $@

$(THIRDPARTY_SRC):
	git submodule update --init
	npm install

$(THIRDPARTY): $(THIRDPARTY_SRC) $(THIRDPARTY_DIR)/.d
	cp $(THIRDPARTY_MINSRC) $(THIRDPARTY_DIR)
	$(UGLIFYJS) $(THIRDPARTY_ANGULAR) -cmo $(THIRDPARTY_DIR)/angular.min.js
	$(foreach src,$(THIRDPARTY_RAWSRC), \
		$(UGLIFYJS) "$(src)" -cmo "$(THIRDPARTY_DIR)/$(notdir $(src:.js=.min.js))"${\n} \
	)

$(FONTS): $(FONT_DIR)/.d
	curl -s $(FONT_URL)/$(@F) -o $@

$(ICON_DIR)/icon-%.png: $(ICON_SRC) $(ICON_DIR)/.d
	$(if $(shell [ $* -lt 100 ] && echo 0), \
	    convert -background transparent $(word 1, $^) -resize "$*x$*" $@, \
	    convert -background transparent $(word 2, $^) -resize "$*x$*" $@ \
	)

.SECONDEXPANSION:
$(BUILDS): $(OUTPUT_DIR)/%build: $(PACKAGE_SUBDIRS:%=$$@/%/.d) $(PACKAGE_FILES)
	cp $(CODE_HTML) $@
	cp $(CODE_PARTIALS) $@/partials
	cp $(CODE_LOCALES) $@/locales
	cp $(CODE_JS) $@/js
	cp $(CODE_CSS) $@/style
	cp $(CODE_IMG) $@/style/images
	cp $(FONTS) $@/style/fonts
	$(if $(findstring test,$*), \
	    cp $(ICON_DIR)/icon-60.png $@, \
	    cp $(MANIFEST) $(LICENSE) $(ICONS) $@ \
	)
	$(if $(findstring test,$*), \
	    cp $(TEST_WORKER) $@/js/worker.js \
	)
	$(if $(findstring test,$*), \
	    cp $(THIRDPARTY_TEST) $@/js/lib, \
	    cp $(THIRDPARTY) $@/js/lib \
	)

$(PACKAGE): $(BUILD_LIVE)
	cd $(BUILD_LIVE); zip __.zip -q -r ./* -x \*/.d
	mv $(BUILD_LIVE)/__.zip $(PACKAGE)

clean:
	rm -rf $(OUTPUT_DIR)
	
.PRECIOUS: %/.d $(ICONS)
.PHONY: clean all
