
ICON_RESOLUTIONS = 60 128 32 90 120 256
ICONS = $(ICON_RESOLUTIONS:%=icon-%.png)

.PHONY: clean all

all: $(ICONS) package.zip

icon-%.png: icon-scalable.svg
	convert -background transparent $< -resize $*x$* $@
	
package.zip:
	zip package.zip -r js partials style index.html manifest.webapp $(ICONS)
	
clean:
	rm -rf package.zip $(ICONS)
