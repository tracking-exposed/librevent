const _ = require('lodash');
const debug = require('debug')('parsers:images');
const moment = require('moment');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const helper = require('./helper');
const FETCH_IMAGES = true;

function mineImg(anode) {
    let retval = {
        src: anode.getAttribute('src'),
        role: anode.getAttribute('role'),
        parent: anode.parentNode.tagName,
        parentRole: anode.parentNode.getAttribute('role'),
        parentLabel: anode.parentNode.getAttribute('aria-label'),
        height: anode.getAttribute('height'),
        width: anode.getAttribute('width'),
    };

    if(_.startsWith(retval.src, "data:image/svg+xml"))
        return null;

    if(retval.height && retval.width)
        retval.dimension = [ _.parseInt(retval.width), _.parseInt(retval.height) ];

    /* image meaning evaluation */
    retval.urlo = new URL(retval.src);
    retval.origname = path.basename(retval.urlo.pathname);
    const urlchunks = retval.urlo.pathname.split('/');
    const definition = _.reduce(urlchunks, function(memo, chunk) {
        if(chunk.match(/s(\d+)x(\d+)/))
            memo = chunk;
        return memo;
    }, null);

    if(definition)
        retval.definition = definition;

    retval.valuable = !!retval.urlo.pathname.match(/(\d+)_(\d+)_(\d+)/);
    /* the .definition and .valuable help to select what we need later */
    retval = helper.updateHrefUnit(retval, 'src');
    return retval;
}

async function fetchImages(imgo, origHREF, metadataId) {
    let destfname = path.join('images', metadataId, imgo.origname);
    let fetchUrl = imgo.src;

    try {
        const d = path.join('images', metadataId);
        fs.mkdirSync(d, { recursive: true});
    } catch(error) {
        debug("mkdir recursive error %s", error.message);
        return null;
    }

    if(imgo.origname === 'safe_image.php') {
        debug("Unexpected presence of safe_image in events!");
        return null;
    }

    if(fs.existsSync(destfname)) {
        // debug("Not downloading %s as it already exist", destfname);
        imgo.saved = destfname;
        return imgo;
    }

    debug("Fetching image from %s", fetchUrl);
    try {
        await axios({
            method: "get",
            url: fetchUrl,
            headers: {'referer': origHREF },
            responseType: "stream"
        }).then(function (response) {
            response.data.pipe(fs.createWriteStream(destfname));
        });
        imgo.saved = destfname;
        return imgo;
    } catch(error) {
        debug("Error in fetching image %s: %s", fetchUrl, error.message)
        return null;
    }
}

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
    let images = _.compact(_.map(envelop.jsdom.querySelectorAll('img'), mineImg));
    /* in 'events' there are the 320x320 pictures and other bigger pictures, we need the biggest */
    if(previous.nature.fblinktype === 'events')
        images = keepTheBiggest(images);

    if(FETCH_IMAGES) {
        const r = [];
        // debug("After filtering the picture to download are %d", _.size(images));
        for (imginfo of images) {
            const extendedInfo = await fetchImages(imginfo,
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