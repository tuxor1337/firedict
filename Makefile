
SRC_DIR := src
OUTPUT_DIR := build

NODE_MODULES := node_modules
NODE_BIN := $(NODE_MODULES)/.bin
UGLIFYJS := $(NODE_BIN)/uglifyjs

FONT_DIR := $(OUTPUT_DIR)/fonts
FONT_FLAVORS := light regular medium
FONT_FILES := $(FONT_FLAVORS:%=firasansot-%-webfont.woff)
FONT_URL := "https://raw.githubusercontent.com/mozilla/fireplace/master/src/media/fonts/FiraSans"
FONTS := $(FONT_FILES:%=$(FONT_DIR)/%)

LOCALES_DIR := $(OUTPUT_DIR)/locales
LOCALES_FILES := firedict.*.properties
LOCALES_SRC := $(LOCALES_FILES:%=$(SRC_DIR)/locales/%)
LOCALES := $(LOCALES_FILES:%=$(LOCALES_DIR)/%)

ICON_DIR := $(OUTPUT_DIR)/icons
ICON_SRC := $(SRC_DIR)/icon-scalable.svg $(SRC_DIR)/icon-scalable-detail.svg
ICON_RESOLUTIONS := 60 128 32 90 120 256
ICONS := $(ICON_RESOLUTIONS:%=$(ICON_DIR)/icon-%.png)

THIRDPARTY_DIR := $(OUTPUT_DIR)/thirdparty
THIRDPARTY_ANGULAR := $(NODE_MODULES)/angular/angular.min.js \
                      $(NODE_MODULES)/angular-route/angular-route.min.js \
                      $(NODE_MODULES)/angular-sanitize/angular-sanitize.min.js \
                      $(NODE_MODULES)/angular-touch/angular-touch.min.js
THIRDPARTY_MINSRC := $(NODE_MODULES)/es6-promise/dist/es6-promise.min.js \
                     $(NODE_MODULES)/pako/dist/pako_inflate.min.js
THIRDPARTY_SRC :=  thirdparty/dictzip.js/dictzip_sync.js \
                   thirdparty/stardict.js/stardict_sync.js \
                   thirdparty/wiki2html.js \
                   thirdparty/l10n.js
THIRDPARTY_FILES := angular.min.js \
                    $(notdir $(THIRDPARTY_MINSRC)) \
                    $(notdir $(THIRDPARTY_SRC:.js=.min.js))
THIRDPARTY := $(THIRDPARTY_FILES:%=$(THIRDPARTY_DIR)/%)

TESTBUILD := $(OUTPUT_DIR)/testbuild

LIVE_DIR := $(OUTPUT_DIR)/live

PACKAGE := $(OUTPUT_DIR)/package.zip

all: $(PACKAGE) $(TESTBUILD)

test: $(TESTBUILD)

$(THIRDPARTY):
	mkdir -p $(THIRDPARTY_DIR)
	git submodule update --init
	npm install
	cp $(THIRDPARTY_MINSRC) $(THIRDPARTY_DIR)
	$(UGLIFYJS) $(THIRDPARTY_ANGULAR) -cmo $(THIRDPARTY_DIR)/angular.min.js
	for src in $(THIRDPARTY_SRC); do \
		$(UGLIFYJS) "$$src" -cmo "$(THIRDPARTY_DIR)/$$(basename $${src%.*}).min.js" ; \
	done

$(LOCALES):
	mkdir -p $(LOCALES_DIR)
	cp $(LOCALES_SRC) $(LOCALES_DIR)

$(FONTS):
	mkdir -p $(FONT_DIR)
	for file in $(FONT_FILES); do \
		curl $(FONT_URL)/$$file -o $(FONT_DIR)/$$file ; \
	done

$(ICONS): $(ICON_SRC)
	mkdir -p $(ICON_DIR)
	for res in $(ICON_RESOLUTIONS); do \
		if [ $$res -lt 100 ] ; then \
			convert -background transparent \
			        $(word 1, $^) \
			        -resize "$$res"x"$$res" \
			        $(ICON_DIR)/icon-$$res.png ; \
		else \
			convert -background transparent \
			        $(word 2, $^) \
			        -resize "$$res"x"$$res" \
			        $(ICON_DIR)/icon-$$res.png ; \
		fi ; \
	done

$(TESTBUILD): $(LIVE_DIR)
	mkdir -p $@ $@/locales $@/js/lib $@/style/fonts
	cp -r $(SRC_DIR)/partials \
	      $(SRC_DIR)/style \
	      $(SRC_DIR)/js \
	      $(SRC_DIR)/index.html \
	      $(ICON_DIR)/icon-60.png \
	      $@
	cp -r $(FONTS) $@/style/fonts
	cp -r $(LOCALES) $@/locales
	cp -r $(THIRDPARTY_DIR)/{angular*,l10n*,wiki2html*,es6-promise*}.js $@/js/lib
	cp $(SRC_DIR)/test/worker.js $@/js/worker.js

$(LIVE_DIR): $(ICONS) $(THIRDPARTY) $(LOCALES) $(FONTS)
	mkdir -p $@ $@/locales $@/js/lib $@/style/fonts
	cp -r $(SRC_DIR)/js \
	      $(SRC_DIR)/partials \
	      $(SRC_DIR)/style \
	      $(SRC_DIR)/index.html \
	      $(SRC_DIR)/manifest.webapp \
	      COPYING \
	      LICENSE.3rd-party \
	      $(ICONS) \
	      $@
	cp -r $(FONTS) $@/style/fonts
	cp -r $(LOCALES) $@/locales
	cp $(THIRDPARTY) $@/js/lib/

$(PACKAGE): $(LIVE_DIR)
	cd $(LIVE_DIR); zip __.zip -r *
	mv $(LIVE_DIR)/__.zip $(PACKAGE)

clean:
	rm -rf $(OUTPUT_DIR)

.PHONY: clean all
