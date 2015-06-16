# 2.0.0
- Update to support latest FF (but remove Java/Saxon (XSLT 2) functionality/dependency)

# 1.7.2
- Very small fix to ensure that output extension control is disabled if user opts for textbox only
- Maximize layout space around output controls
- Fix focus to main window when opening a tab

# 1.7.1
- Put focus at top of XSL textbox after selecting a file
- Add option to add XSL results to tab

# 1.7
- Cleaned up code, including better namespacing

# 1.6.9
- Fixed for Java 6 update 12
- Added LGPL 3+ license throughout files

# 1.6.8
- Updated for FF3.1b2

# 1.6.7
- User feedback on errors

# 1.6.6
- Additional error checking

# 1.6.5
- Fixed problem with context menu and added error checking when no stylesheet is present

# 1.6.4
- Bug fix

# 1.6.3
- Accidental alert removed

# 1.6.2
- Important fix to make data persistent across extension updates (now data in profile folder)
- Fixed bug with first creation of XSL stripping newlines
- Added more error checking

# 1.6.1
- Fix to allow View Source context menu items to work correctly

# 1.6

--Major features
- Per site preferences to apply stylesheets as pages load (ala Greasemonkey)
- Ability to retrieve content prior to an attached xml-stylesheet being applied
- Option to apply XSLT 2.0 stylesheet instructions automatically
- Context menu option to get transformation using Saxon or Transformiix or source (in textbox, as text, or as XML)
--Minor features
- Option in dialog to load XSL stylesheet for current page (if present)
- Option to update XML source with current page's source (pre or post xml-stylesheet)
--Compatibility
- Test for Java support and Java enabled
--Minor adjustments
- Remove OK button (hitting transform will allow recall of window size and position)
- Allowed window to be minimizable
- Minor UI tweaks (remove ?'s and red color in Tools menu)


# 1.5.7
- Hard-wired Jar location for Saxon-B (in cross-platform way) and removed 
-   related preferences from interface
- Fixed issue to work again with FF2
- Updated to Saxon-B 9.0.0.6

# 1.5.6
- Small change in default stylesheet
- Removal of reset defaults debug code

# 1.5.5
- Updated to work in Firefox 3 RC 1
- Updated to Saxonica 9.0.0.5
- Updated readme and added readme tab
- Fix for FF3 to get results from context menu
- Improved comment to XML comment code
- Improved Doctype stripping to include internal document set contents
- Added option to turn off opening of new window
- Added XML Output results box
- Added ability to specify the output file extension
- Adding remembering of sizing of internal textboxes

# 1.5.4
-Fix for FF3 to get results from context menu

# 1.5.3
- Fixed a bug which might cause Saxon transforms to fail

# 1.5.2
- Small bug fix
- Updated to work with FF3b3

# 1.5.1
- Small formatting fix

# 1.5
- Added X/HTML and XML DTD stripping preferences
- Added reset to default button

# 1.3.7
- Added XSLT 2.0 support via Saxon B! (also can chose Firefox's built-in XSLT)
- Retain memory of previous XSLT

# 1.3.6
- Fixed potential spawning of extra windows

# 1.3.5
- Fix: Added (hopeful) fix to display of progress meter
- Gave textbox memory and made textboxes small by default so could fit on Mac and be resized according to taste of user
- Added splitter and memory of its position (when use OK/accept button)
- Added access via Options URL (and author URL)

# 1.3.4
- Added progress meter (and disabled accept button) during transformations

# 1.3.3
- Give alert instead of opened window if resulting document is blank
- Made error strings localizable

# 1.3.2
- Changed browse file textbox to allow file dialog

# 1.3.1
- Adjusted default XSL and ensure XSL textbox is used if file field is empty

# 1.3

- Added textbox to allow editing of the current document's XML/HTML (or to start over)
- Added convert-to-HTML button to attempt to convert the upper-cased Firefox DOM representation of HTML (i.e., when a genuine XML document or XHTML-served-as-application/xhtml+xml is not loaded) into its proper lower-case (and some other potential fixes affecting poorly-formed HTML)
