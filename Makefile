
ICON_RESOLUTIONS = 60 128 32 90 120 256
ICONS = $(ICON_RESOLUTIONS:%=icon-%.png)

.PHONY: clean all

all: package.zip

testbuild: icon-60.png
	mkdir -p testbuild/js/lib
	cp -r partials style locales testbuild
	cp -r index.html icon-60.png testbuild
	cp -r js/*.js testbuild/js
	cp test/worker.js testbuild/js/worker.js
	cp -r js/lib/{angular*,l10n,wiki2html,jquery*,promise*}.js testbuild/js/lib

icon-%.png: icon-scalable.svg icon-scalable-detail.svg
	if [ $* -lt 100 ] ; then \
		convert -background transparent $(word 1, $^) -resize $*x$* $@ ; \
	else \
		convert -background transparent $(word 2, $^) -resize $*x$* $@ ; \
	fi

package.zip: $(ICONS)
	zip package.zip -r js partials style locales COPYING index.html manifest.webapp $(ICONS)

clean:
	rm -rf package.zip $(ICONS) testbuild
