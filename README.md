# xsl-results

Firefox add-on (at [AMO](https://addons.mozilla.org/en-US/firefox/addon/xsl-results/)) to allow XSL transformations.

# History

Due to prior Java support in Firefox for add-ons, I had included the then
open source Saxon software to provide XSLT 2.0 support.

However, due to Java support being removed (not to mention the latest
versions of Saxon not being open source anyways), I decided to
strip this functionality so I could at least get the add-on to
work again for XSLT 1.0.

# To-dos

1. User requested support for `<xsl:include href="another.xsl"/>` where another.xsl is in the same directory (currently gives NS_ERROR_DOM_BAD_URI)
1. Character set fixes
1. Make restartless
