const _ = require('lodash');
const moment = require('moment');
const debug = require('debug')('parsers:meaningfulId');

function attributeLinkByPattern(sectionlist, retval) {
    const first = _.nth(sectionlist, 0);
    const second = _.nth(sectionlist, 1)

    if(first == 'groups') {
        retval.fblinktype = 'groups';
        retval.groupId = second;
        retval.infotype = _.nth(sectionlist, 2);
        retval.authorId = _.nth(sectionlist, 3);
        return true;
    } else if(first == 'stories') {
        retval.fblinktype = 'stories';
        retval.storyId = second;
        return true;
    } else if(first == 'events' && second == 'search') {
        retval.fblinktype = 'event-search';
        return true;
    } else if(first == 'events') {
        retval.fblinktype = 'event';
        retval.eventId = second;
        return true;
    } else if(first == 'watch') {
        retval.fblinktype = 'watch';
        retval.pageId = second;
        retval.detailId = _.nth(sectionlist, 2);
        return true;
    } else if(first == 'notes') {
        retval.fblinktype = 'notes';
        debugger;
    } else if(first == 'donate') {
        retval.fblinktype = 'donate';
        retval.pageId = second;
        return true;
    } else if(first == 'media' && second == 'set') {
        // href: "https://www.facebook.com/media/set/?set=a.2630484733888064&type=3&__xts__%5B0%5D=68.ARDcTIWjOO2JYRuCTLSgIyHB8U55kD5gMlaBJSNYRfMQ4Wx7Bkaf_QOtHYTJQ1Af5E184hfT7uOnLpFFtdBX1rUFOydUQ6DU8MKgv49wWOM_LAnQVdxpw3774yKIOnHqyWjt21hFk0X7vW2g1e_utXqgMCJG1F2p7vqN6hYbt_KVOQXz8GmpSBQIHskmw53L8DuNbCo1D8uKNpZLbZtRiAPOqwzikiqtTxoUGzO_ucamlroB6gA6hyDRg28AWEYTuGHLdzMZeFLcGHzFIGjkRdGpl_cUOF5f8gqdSqFFbHA9rjQNdrAkyLvr3nmqIKK9-FzpsZoXBaV_CUf3bq4SmEi5bVI&__tn__=-UCH-R"
        retval.fblinktype = 'media'; 
        return true;
    } else if(first == 'hashtag') {
        retval.fblinktype = 'hashtag';
        retval.hashtag = second;
        return true;
    } else if(first == 'ad_center') {
        retval.fblinktype = 'boost';
        return true;
    } else if(first == 'images') {
        retval.fblinktype = 'static';
        return true;
    } else if(first === 'photo' && _.size(sectionlist) === 1) {
        // https://www.facebook.com/photo/?fbid=10106438295296426&set=gm.3220462401513683
        retval.fblinktype = 'photo'; 
        return true;
    } else if(_.size(sectionlist) === 1) {
        retval.fblinktype = 'profile';
        retval.profileName = first;
        return true;
    } else if(second == 'posts') {
        retval.fblinktype = 'post';
        retval.profileName = first;
        return true;
    } else if(second == 'videos') {
        retval.fblinktype = 'video';
        retval.profileName = first;
        retval.detailId = _.nth(sectionlist, 2);
        return true;
    }

    return false;
}

function attributeLinkByFormat(sectionlist, retval, parsed) {
    const first = _.nth(sectionlist, 0);
    const second = _.nth(sectionlist, 1);

    if(second == 'photos') {
        /* /MillenniumHiltonNewYorkOneUNPlaza/photos/a.415328151930706/1441157289347782/ */
        retval.fblinktype = 'photo';
        retval.groupId = first;
        retval.albumId = second.replace(/a\./, '');
        retval.authorId = _.nth(sectionlist, 2);
    } else if(first == 'photo.php') {
        /* https://www.facebook.com/photo.php?fbid=10224586748685348&set=a.10202327757704485&type=3 */
        retval.fblinktype = 'photo';
        retval.authorId = parsed['?fbid'];
        retval.photoId = parsed['set'].replace(/a\./, '');
    } else if(first == 'rsrc.php') {
        retval.useless = true;
    } else if(first == 'ufi') {
        //https://www.facebook.com/ufi/reaction/profile/browser/?ft_ent_identifier=Z
        retval.profileId = parsed['av'];
        retval.fblinktype = 'reaction';
    } else {
        return false;
    }
    return true;
}

function detailFbURL(urlo) {
    /* this function summarize the 'urlo's and return only meaningful infos */
    if(urlo.linktype !== 'external') throw new Error("misuse");

    const embedded = urlo.parsed['?u'];
    const href = embedded ? embedded : (urlo.href ? urlo.href : (urlo.src ? urlo.src : null));
    if(!href) throw new Error("really unexpected condition in urlo");
    // NOTA TODO -- divergenza, in facebook c'è incluso utils e forse non dovrebbe starci,
    const retval = {
        // id: utils.hash({ parsedURL: href }),
        href,
    };
    return retval;
}

function detailFbImg(urlo) {
    /* this function summarize the 'urlo's and find only meaningful infos */
    if(urlo.linktype !== 'cdn') throw new Error("misuse");
    const u = urlo.URLo;

    if(urlo.width == null && urlo.height == null) {

        /* a profile picture has this */
        if(u.pathname.match(/\/p(\d+)x(\d+)\//))
            return null;

        /* internal fb static resources */
        if(_.endsWith(u.pathname, '.gif'))
            return null;
    }

    const retval = {
        src: u.hostname + u.pathname + (_.size(u.searchParams.toString()) ? ( '/?' + u.searchParams.toString() ) : ""),
    };
    return retval;
}

function notRelevantUrl(url) {
    const listofr = [
        /.*tracking\.exposed/,
        /.*localhost:.*/,
        /.*\.facebook\.com\/$/,
        /.*\.facebook\.com\/friends\/$/,
        /.*\.facebook\.com\/watch\/$/,
        /.*\.facebook\.com\/groups\/$/,
        /.*\.facebook\.com\/me\/$/,
        /.*\.facebook\.com\/[bookmarks|business]\/$/,
        /.*\.facebook\.com\/events\/[calendar|birthday|create]\/.*/,
        /.*\.facebook\.com\/marketplace\/\?.*/,
        /.*\.facebook\.com\/privacy\/explanation$/,
        /.*\.facebook\.com\/help\/568137493302217/,
        /.*\.facebook\.com\/policies\/cookies/,
        /.*\.facebook\.com\/policies\?.*/,
    ];
    return !! _.compact(_.map(listofr, function(regexptr) {
        // if(url.match(regexptr)) debug("killing %s from %s", url, regexptr);
        return url.match(regexptr);
    })).length;
}

function detailFbLink(urlo) {
    /* this function summarize the 'urlo's and find only meaningful infos */
    if(urlo.linktype !== 'local') throw new Error("misuse");
    const u = urlo.URLo; // comes from helper.updateHrefUnit

    if(notRelevantUrl(u.href))
        return null;

    const retval = {
        text: urlo.text,
    };

    /* only facebook path now are selected */
    const chunks = _.compact(u.pathname.split('/'));

    if(urlo.urlId === "d3b22f1c84a290e8c9fb9286d249bd4c06edc2ec")
        debugger;

    /* at first analyze complex url, with?params */
    const firstTry = attributeLinkByFormat(chunks, retval, urlo.parsed);
    if(!firstTry) {
        /* then look at the substring in position 0, as profile/group/page name .. */
        let anymeaning = attributeLinkByPattern(chunks, retval);
        // if has any meaning, then it is worthy to be saved
        if(!anymeaning)
            return null;
    }

    if(retval.useless) {
        debug("marked useless removing %j", retval.href);
        return null;
    }

    if(!retval.fblinktype) {
        debug("fail w/ %s", urlo.href);
        return null;
    }

    // debug("[OK?] %s [%j] = %s", retval.fblinktype, _.omit(retval, ['href','id','fblinktype']), urlo.href.replace(/facebook\.com/,'').substr(0, URLDEB));
    return retval;
}


function domainAttribution(urlo) {
    const u = urlo.URLo; // comes from helper.updateHrefUnit
    if(u.hostname === 'www.facebook.com') {
        urlo.linktype = 'local';
    } else if(u.hostname === 'l.facebook.com') {
        urlo.linktype = 'external';
    } else if(_.endsWith(u.hostname, 'fbcdn.net')) {
        urlo.linktype = 'cdn';
    } else if(_.startsWith(urlo.href, 'javascript') || _.startsWith(urlo.src, 'data:image/svg+xml')) {
        urlo.linktype = 'code';
    } else {
        urlo.linktype = 'external';
    }
    return urlo;
}

function meaningfulId(envelop, previous) {
    /* by looking at facebook links it look for meaningful ID that might be used to link publishers, page, etc .. */
    const meaningSources = {
        'hrefChains.hrefs': 'hrefs',
        'imageChains.images': 'images',
        'profiles.profiles': 'profiles'
    };
    const enriched = _.reduce(meaningSources, function(memo, destk, objectsPath) {
        const urlcontainer = _.get(previous, objectsPath);
        // debug("From %s found %d useful URLs", objectsPath, _.size(urlunits));
        const olist = _.map(urlcontainer, function(u) {
            try {
                u = domainAttribution(u);
                if(u.linktype === 'local') {
                    const determination = detailFbLink(u);
                    // if determination is null we don't care to save this
                    if(!determination)
                        return null;
                    return _.merge(u, determination);
                }
                else if(u.linktype === 'cdn')
                    return _.merge(detailFbImg(u));
                else if(u.linktype === 'external')
                    return _.merge(detailFbURL(u));
                else {
                    debug("ignored type %s", u.linktype);
                    return u;
                }
            } catch(e) {
                if(u.href.length > 9)
                    debug("Unexpected failure while looking for %s", u.href);
                return null;
            }
        });
        const clean = _.uniqBy(_.compact(_.map(olist, function(o) {
            _.unset(o, 'URLo');
            return _.reduce(o, function(rebuiltobj, val, key) {
                if(val)
                    _.set(rebuiltobj, key, val);
                return rebuiltobj;
            }, Object({}));
        })), 'urlId');
        memo[destk] = clean;
        return memo;
    }, {});

    // debug(_.map(enriched, function(lista, name) { return [ name, _.size(lista)] } ));
    return enriched;
}

module.exports = meaningfulId;