Directory 'parsers' contains a list of parser for each page (and URL type) supported in scraping.

The used parser chain is defined in lib/parserchain.js and it is:

'''
dissectorList: [
	'nature',
	'imageChains',
	'hrefChains',
	'event',
],
'''

## /events/(\d+) is the individual Event page

## /events? is a list of events 
