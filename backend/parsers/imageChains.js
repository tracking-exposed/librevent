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

    retval = helper.updateHrefUnit(retval, 'src');
    return retval;
}

async function fetchImages(imgo, metadataId) {
    const urlo = new URL(imgo.src);
    const origname = path.basename(urlo.pathname);
    const today = moment().format("YYYY-MM-DD");
    let destfname = path.join('images', metadataId, origname);
    let fetchUrl = imgo.src;

    try {
        const d = path.join('images', metadataId);
        fs.mkdirSync(d, { recursive: true});
    } catch(error) {
        debug("mkdir recursive error %s", error.message);
        return null;
    }

    if(origname === 'safe_image.php') {
        debug("Unexpected presence of safe_image in events!");
        return null;
    }

    if(fs.existsSync(destfname)) {
        // debug("Not downloading %s as it already exist", destfname);
        imgo.saved = destfname;
        return imgo;
    }

    try {
        await axios({
            method: "get",
            url: fetchUrl,
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

async function imageChains(envelop, previous) {
    /* alt, the altenative text used in pictures, might contain the individual name of an user
     * from their picture profile. This selector might take that too. That is not an information
     * we should collect */
    const images = _.compact(_.map(envelop.jsdom.querySelectorAll('img'), mineImg));
    if(FETCH_IMAGES) {
        const r = [];
        // debug("After filtering the picture to download are %d", _.size(images));
        for (imginfo of images) {
            const extendedInfo = await fetchImages(imginfo,
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