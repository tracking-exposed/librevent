const _ = require('lodash');
const debug = require('debug')('parsers:nature');
const querystring = require('querystring');

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
    } else if(first == 'events') {
        retval.fblinktype = 'events';
        retval.pageId = second;
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
    } else if(first == 'media') {
        debugger;
        debug("media: %j", sectionlist)
        retval.fblinktype = 'media'; /*
        href: "https://www.facebook.com/media/set/?set=a.2630484733888064&type=3&__xts__%5B0%5D=68.ARDcTIWjOO2JYRuCTLSgIyHB8U55kD5gMlaBJSNYRfMQ4Wx7Bkaf_QOtHYTJQ1Af5E184hfT7uOnLpFFtdBX1rUFOydUQ6DU8MKgv49wWOM_LAnQVdxpw3774yKIOnHqyWjt21hFk0X7vW2g1e_utXqgMCJG1F2p7vqN6hYbt_KVOQXz8GmpSBQIHskmw53L8DuNbCo1D8uKNpZLbZtRiAPOqwzikiqtTxoUGzO_ucamlroB6gA6hyDRg28AWEYTuGHLdzMZeFLcGHzFIGjkRdGpl_cUOF5f8gqdSqFFbHA9rjQNdrAkyLvr3nmqIKK9-FzpsZoXBaV_CUf3bq4SmEi5bVI&__tn__=-UCH-R"
        parsed:
        ?set: "a.2630484733888064"
        type: "3"
        */
        return false;
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
    } else if(_.size(sectionlist) === 1) {
        retval.fblinktype = 'profile';
        retval.profileName = first;
        return true;
    } else if(second == 'posts') {
        retval.fblinktype = 'post';
        retval.profileName = first;
        retval.postId = _.nth(sectionlist, 2);
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
    } else if(second === undefined) {
        // https://www.facebook.com/daniela.3/
        retval.fblinktype = 'profile';
        retval.profileId = first;
    } else {
        console.log("should this be catch by format as first?", sectionlist);
        // debugger;
        return false;
    }
    return true;
}


function nature(envelop, previous) {

    const retval = { href: envelop.html.href };
    retval.urlo = new URL(retval.href);
    retval.parsed = querystring.parse(retval.urlo.search); 
    retval.messages = [];

    /* only facebook path now are selected */
    const chunks = _.compact(retval.urlo.pathname.split('/'));
    /* at first analyze complex url, with?params */
    const firstTry = attributeLinkByFormat(chunks, retval, retval.urlo.parsed);
    if(!firstTry)
        /* then look at the substring in position 0, as profile/group/page name .. */
        attributeLinkByPattern(chunks, retval);

    if(retval.useless) {
        debug("marked useless removing %j", retval.href);
        return null;
    }

    // to check when URL is changed and the app page not yet and newsfeed is collected
    const divCheck = envelop.jsdom.querySelectorAll('div').length;
    if(divCheck > 1000) {
        debug("_Div %d too many!!", divCheck);
        retval.unintended = true;
        retval.messages.push("too many div?");
    } else {
        debug("_The div are less than 1000 %d", divCheck);
    }

    const checkTimeline = envelop.jsdom.querySelectorAll('[role="main"]');
    if(checkTimeline && checkTimeline.length) {
        debug("timeline spot?");
        retval.messages.push("timeline spotted? " + checkTimeline[0].outerHTML.length);
    }
    debugger;

    // this is to spot when a post was deleted
    const spanCheck = _.compact([...envelop.jsdom.querySelectorAll('span')].map(function(e) {
        return (e.textContent.length > 20) ? e.textContent : null;
    }));

    if(_.size(spanCheck) < 3) {
        debug("Empty check: %j match", spanCheck);
        retval.unintended = true;
        retval.messages.push(spanCheck);
    }

    if(!retval.fblinktype) {
        debug("fail, not found nature w/ %s", retval.href);
        retval.unintended = true;
        retval.messages.push("not found nature?");
    }
    return retval;
}

module.exports = nature;
