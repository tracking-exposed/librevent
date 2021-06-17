const fs = require('fs');
const _ = require('lodash');
const path = require('path');
const axios = require('axios');
const debug = require('parsers:imagefetch');
const moment = require('moment');

const helper = require('./helper');

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

module.exports = {
    mineImg,
    fetchImages
}