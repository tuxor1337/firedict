
ICON_RESOLUTIONS = 60 128 32 90 120 256
ICONS = $(ICON_RESOLUTIONS:%=icon-%.png)

.PHONY: clean all

all: package.zip

icon-%.png: icon-scalable.svg icon-scalable-detail.svg
	if [ $* -lt 100 ] ; then \
		convert -background transparent $(word 1, $^) -resize $*x$* $@ ; \
	else \
		convert -background transparent $(word 2, $^) -resize $*x$* $@ ; \
	fi
	
package.zip: $(ICONS)
	zip package.zip -r js partials style locales COPYING index.html manifest.webapp $(ICONS)
	
clean:
	rm -rf package.zip $(ICONS)
