const _ = require('lodash');
const debug = require('debug')('parsers:images');

const imagefetch = require('./imagefetch');
const FETCH_IMAGES = true;

function stripUseless(imagelist) {
    // this is to remove all the unnecessary fields!
    return _.map(imagelist, function(imginfo) {
        return _.pick(imginfo, ['src', 'urlId', 'saved']);
    });
}

function keepTheBiggest(imagel) {
    /* this sorting only matters for images with more than one equale pathname */
    return _.reject(imagel, { definition: 's320x320'});
}

async function imageChains(envelop, previous) {
    /* alt, the altenative text used in pictures, might contain the individual name of an user
     * from their picture profile. This selector might take that too. That is not an information
     * we should collect */
    let images = _.compact(_.map(envelop.jsdom.querySelectorAll('img'), imagefetch.mineImg));
    /* in 'events' there are the 320x320 pictures and other bigger pictures, we need the biggest */
    if(previous.nature.fblinktype === 'events')
        images = keepTheBiggest(images);

    if(FETCH_IMAGES) {
        const r = [];
        // debug("After filtering the picture to download are %d", _.size(images));
        for (imginfo of images) {
            const extendedInfo = await imagefetch.fetchImages(imginfo,
                envelop.html.href,
                previous.nature.fblinktype + " " + envelop.html.id);
            if(extendedInfo)
                r.push(extendedInfo);
        }
        debug("After fetching, returning %d images", _.size(r));
        return { images: stripUseless(r) };
    }
    return { images: stripUseless(images) };
};

module.exports = imageChains;